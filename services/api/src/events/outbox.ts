/**
 * The transactional outbox, and the relay that drains it.
 *
 * The bus's own documentation has always claimed that "events are written to an
 * outbox in the same transaction as the state change they describe and relayed
 * from there". The table existed from the first migration. Nothing ever wrote
 * to it: publishing went to an in-memory bus and nowhere else.
 *
 * That is not a missing nicety. A vendor hears about a gig because publishing
 * it emits match.wave.scheduled. With an in-memory bus, a process that dies
 * between the gig going live and the notification going out loses the
 * notification permanently -- the gig is Open, the vendors were never told, and
 * nothing in the system knows it. "Matched in under an hour" is the product's
 * central promise and it rested on the process staying up.
 *
 * Writing the row inside the caller's transaction is the whole point. Either
 * the gig is published and the event exists, or neither happened.
 */
import { randomUUID } from "node:crypto";
import type { Database } from "../infra/postgres/db.js";
import { currentUnitOfWork } from "../infra/postgres/db.js";
import type { DomainEvent, EventBus, Handler, Topic } from "./bus.js";

interface OutboxRow {
  readonly id: string;
  readonly topic: string;
  readonly partition_key: string;
  readonly payload: unknown;
  readonly trace_id: string | null;
  readonly occurred_at: Date | string;
}

/**
 * Writes events to `event_outbox`, joining the caller's transaction when there
 * is one. Subscribers are notified by the relay, not here: delivering inline
 * would hand a subscriber an event describing a state change that has not
 * committed yet, and might never.
 */
export class OutboxEventBus implements EventBus {
  private readonly handlers = new Map<Topic, Set<Handler>>();

  constructor(private readonly db: Database) {}

  async publish<T>(topic: Topic, key: string, payload: T, traceId?: string): Promise<DomainEvent<T>> {
    const occurredAt = new Date().toISOString();
    const rows = await this.db.query<{ id: string }>(
      `INSERT INTO event_outbox (topic, partition_key, payload, trace_id, occurred_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id::text AS id`,
      [topic, key, JSON.stringify(payload), traceId ?? null, occurredAt],
    );
    return {
      // The row id when the insert returned one; a uuid otherwise, so the caller
      // always has something to log.
      id: rows[0]?.id ?? randomUUID(),
      topic,
      key,
      payload,
      occurredAt,
      ...(traceId ? { traceId } : {}),
    };
  }

  subscribe(topic: Topic, handler: Handler): () => void {
    const set = this.handlers.get(topic) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(topic, set);
    return () => set.delete(handler);
  }

  /** Whether this publish will land in the caller's transaction. */
  get joinsCallerTransaction(): boolean {
    return currentUnitOfWork() !== undefined;
  }

  handlersFor(topic: Topic): ReadonlySet<Handler> {
    return this.handlers.get(topic) ?? new Set<Handler>();
  }
}

export interface RelayOptions {
  /** How many rows to take per pass. */
  readonly batchSize?: number;
  readonly intervalMs?: number;
}

/**
 * Drains the outbox and hands each event to its subscribers.
 *
 * Rows are claimed with FOR UPDATE SKIP LOCKED so more than one replica can
 * relay at once without two of them delivering the same event. Delivery is
 * at-least-once by construction: a crash after handlers run but before the
 * commit replays the batch. That is the correct trade -- a duplicate
 * notification is a nuisance, a missing one is a vendor who never heard about
 * the booking.
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** Counters, for tests and for a health endpoint to report on later. */
  delivered = 0;
  failed = 0;

  constructor(
    private readonly db: Database,
    private readonly bus: OutboxEventBus,
    private readonly options: RelayOptions = {},
  ) {}

  /** One pass. Returns how many events were delivered. */
  async drain(): Promise<number> {
    const batchSize = this.options.batchSize ?? 100;
    return this.db.withTransaction(async (tx) => {
      const rows = await tx.query<OutboxRow>(
        `SELECT id::text AS id, topic, partition_key, payload, trace_id, occurred_at
           FROM event_outbox
          WHERE published_at IS NULL
          ORDER BY id
          FOR UPDATE SKIP LOCKED
          LIMIT $1`,
        [batchSize],
      );
      if (rows.length === 0) return 0;

      const done: string[] = [];
      for (const row of rows) {
        const event: DomainEvent = {
          id: row.id,
          topic: row.topic as Topic,
          key: row.partition_key,
          payload: row.payload,
          occurredAt:
            row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
          ...(row.trace_id ? { traceId: row.trace_id } : {}),
        };

        let ok = true;
        for (const handler of this.bus.handlersFor(event.topic)) {
          try {
            await handler(event);
          } catch (error) {
            // One bad subscriber must not block the topic for everyone. The row
            // stays unpublished and the next pass retries it.
            ok = false;
            console.error(`[outbox] subscriber for ${event.topic} threw`, error);
          }
        }
        if (ok) {
          done.push(row.id);
          this.delivered += 1;
        } else {
          this.failed += 1;
        }
      }

      if (done.length > 0) {
        await tx.query(
          `UPDATE event_outbox SET published_at = now() WHERE id = ANY($1::bigint[])`,
          [done],
        );
      }
      return done.length;
    });
  }

  start(): void {
    if (this.timer) return;
    const interval = this.options.intervalMs ?? 1_000;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try {
        // Keep draining while a full batch comes back, so a burst is not
        // spread across one interval per batch.
        let drained = 0;
        do {
          drained = await this.drain();
        } while (drained >= (this.options.batchSize ?? 100));
      } catch (error) {
        console.error("[outbox] relay pass failed", error);
      } finally {
        this.running = false;
      }
    };
    // tick handles its own failures; the void marks the promise as
    // deliberately not awaited, which setInterval could not do anyway.
    this.timer = setInterval(() => void tick(), interval);
    // Never hold the process open on the relay's account.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
