/**
 * The outbox, against a real database.
 *
 * The guarantee under test is not "events are stored". It is that a state
 * change and the event describing it either both happen or neither does. The
 * table existed from the first migration and nothing wrote to it, so publishing
 * a gig and notifying the matched vendors were two separate transactions with a
 * window between them: process dies, gig is Open, nobody was ever told, and no
 * record of the intent survives.
 *
 * So most of these tests are about the rollback, not the happy path.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connect, withUnitOfWork, type Database } from "../src/infra/postgres/db.js";
import { OutboxEventBus, OutboxRelay } from "../src/events/outbox.js";
import { TOPICS, type DomainEvent } from "../src/events/bus.js";
import { createTestSchema, skipWithoutDatabase, TEST_DATABASE_URL } from "./db.js";

const skip = skipWithoutDatabase;
const SCHEMA = "test_outbox";
let db: Database;

before(async () => {
  if (skip) return;
  db = await createTestSchema(SCHEMA);
});

after(async () => {
  if (db) await db.close();
});

beforeEach(async () => {
  if (!skip) await db.query("TRUNCATE event_outbox RESTART IDENTITY");
});

const unpublished = async (): Promise<number> => {
  const rows = await db.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM event_outbox WHERE published_at IS NULL",
  );
  return Number(rows[0]?.n ?? 0);
};

test("publishing writes a durable row rather than only notifying memory", { skip }, async () => {
  const bus = new OutboxEventBus(db);
  const event = await bus.publish(TOPICS.gigPosted, "gig-1", { gigId: "gig-1" }, "trc_1");

  assert.ok(event.id, "the event carries the row id");
  const rows = await db.query<{ topic: string; partition_key: string; payload: unknown; trace_id: string }>(
    "SELECT topic, partition_key, payload, trace_id FROM event_outbox",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.topic, TOPICS.gigPosted);
  assert.equal(rows[0]?.partition_key, "gig-1");
  assert.equal(rows[0]?.trace_id, "trc_1");
  assert.deepEqual(rows[0]?.payload, { gigId: "gig-1" });
});

test("an event published in a unit of work rolls back with it", { skip }, async () => {
  // The whole point. A state change that fails must not leave behind an event
  // announcing it happened.
  const bus = new OutboxEventBus(db);
  await assert.rejects(
    withUnitOfWork(db, async () => {
      await bus.publish(TOPICS.gigPosted, "gig-rollback", { gigId: "gig-rollback" });
      throw new Error("the state change failed after the event was published");
    }),
    /the state change failed/,
  );
  assert.equal(await unpublished(), 0, "the event must not survive its transaction");
});

test("an event published in a unit of work commits with it", { skip }, async () => {
  const bus = new OutboxEventBus(db);
  await withUnitOfWork(db, async () => {
    await bus.publish(TOPICS.matchWaveScheduled, "gig-2", { gigId: "gig-2", wave: 1 });
  });
  assert.equal(await unpublished(), 1);
});

test("publishing reports whether it joined the caller's transaction", { skip }, async () => {
  // A guard against the wiring silently regressing to non-transactional
  // publishes, which would look identical in every other assertion here.
  const bus = new OutboxEventBus(db);
  assert.equal(bus.joinsCallerTransaction, false);
  await withUnitOfWork(db, async () => {
    assert.equal(bus.joinsCallerTransaction, true);
  });
});

test("the relay delivers to subscribers and marks the row published", { skip }, async () => {
  const bus = new OutboxEventBus(db);
  const seen: DomainEvent[] = [];
  bus.subscribe(TOPICS.gigPosted, (event) => {
    seen.push(event);
  });

  await bus.publish(TOPICS.gigPosted, "gig-3", { gigId: "gig-3" }, "trc_3");
  const relay = new OutboxRelay(db, bus);
  assert.equal(await relay.drain(), 1);

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.topic, TOPICS.gigPosted);
  assert.equal(seen[0]?.key, "gig-3");
  assert.equal(seen[0]?.traceId, "trc_3");
  assert.deepEqual(seen[0]?.payload, { gigId: "gig-3" });
  assert.equal(await unpublished(), 0);
});

test("a delivered event is not delivered again on the next pass", { skip }, async () => {
  const bus = new OutboxEventBus(db);
  let count = 0;
  bus.subscribe(TOPICS.gigPosted, () => {
    count += 1;
  });
  await bus.publish(TOPICS.gigPosted, "gig-4", {});
  const relay = new OutboxRelay(db, bus);
  await relay.drain();
  await relay.drain();
  assert.equal(count, 1);
});

test("a throwing subscriber leaves the event to be retried", { skip }, async () => {
  // At-least-once on purpose: a duplicate notification is a nuisance, a missing
  // one is a vendor who never heard about the booking.
  const bus = new OutboxEventBus(db);
  let attempts = 0;
  bus.subscribe(TOPICS.gigPosted, () => {
    attempts += 1;
    if (attempts === 1) throw new Error("the notification transport was down");
  });

  await bus.publish(TOPICS.gigPosted, "gig-5", {});
  const relay = new OutboxRelay(db, bus);

  assert.equal(await relay.drain(), 0, "a failed delivery publishes nothing");
  assert.equal(await unpublished(), 1, "the row is still waiting");

  assert.equal(await relay.drain(), 1, "the retry succeeds");
  assert.equal(attempts, 2);
  assert.equal(await unpublished(), 0);
});

test("one subscriber failing does not block a different topic", { skip }, async () => {
  const bus = new OutboxEventBus(db);
  const delivered: string[] = [];
  bus.subscribe(TOPICS.gigPosted, () => {
    throw new Error("down");
  });
  bus.subscribe(TOPICS.escrowFunded, (event) => {
    delivered.push(event.key);
  });

  await bus.publish(TOPICS.gigPosted, "gig-6", {});
  await bus.publish(TOPICS.escrowFunded, "gig-7", {});

  const relay = new OutboxRelay(db, bus);
  assert.equal(await relay.drain(), 1);
  assert.deepEqual(delivered, ["gig-7"]);
  assert.equal(await unpublished(), 1, "only the failed one is still waiting");
});

test("events are relayed in the order they were written", { skip }, async () => {
  // Same partition key means same gig; a vendor notified before the gig is
  // announced is an event ordering bug, not a race to shrug at.
  const bus = new OutboxEventBus(db);
  const order: number[] = [];
  bus.subscribe(TOPICS.matchWaveScheduled, (event) => {
    order.push((event.payload as { wave: number }).wave);
  });
  for (const wave of [1, 2, 3, 4, 5]) {
    await bus.publish(TOPICS.matchWaveScheduled, "gig-8", { wave });
  }
  await new OutboxRelay(db, bus).drain();
  assert.deepEqual(order, [1, 2, 3, 4, 5]);
});

test("two relays do not deliver the same event twice", { skip }, async () => {
  // Rows are claimed FOR UPDATE SKIP LOCKED so replicas can drain in parallel.
  // Separate connections, because two relays on one connection would serialise
  // and prove nothing.
  const other = connect({ connectionString: TEST_DATABASE_URL as string, searchPath: [SCHEMA, "public"] });
  try {
    const bus = new OutboxEventBus(db);
    const otherBus = new OutboxEventBus(other);
    const seen: string[] = [];
    const record = (event: DomainEvent) => {
      seen.push(event.key);
    };
    bus.subscribe(TOPICS.gigPosted, record);
    otherBus.subscribe(TOPICS.gigPosted, record);

    for (const key of ["a", "b", "c", "d"]) await bus.publish(TOPICS.gigPosted, key, {});

    const [first, second] = await Promise.all([
      new OutboxRelay(db, bus).drain(),
      new OutboxRelay(other, otherBus).drain(),
    ]);

    assert.equal(first + second, 4, "every event delivered exactly once in total");
    assert.deepEqual([...seen].sort(), ["a", "b", "c", "d"]);
    assert.equal(await unpublished(), 0);
  } finally {
    await other.close();
  }
});
