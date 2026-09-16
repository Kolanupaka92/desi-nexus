/**
 * The node:http boundary.
 *
 * node never awaits a request listener, so a rejected promise from one escapes
 * as an unhandled rejection -- and Node ends the process on those by default.
 * The listener used to be `async` with a bare `throw` on its body-read path, so
 * one client disconnecting mid-upload could take the whole API down. Every
 * in-flight booking on that instance goes with it.
 *
 * Nothing covered this: every other test drives the router directly through the
 * harness and never crosses the HTTP boundary where the hazard lives.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequestListener } from "../src/app.js";
import { Router } from "../src/http/router.js";

/** A router with no error boundary, so the handler's failure reaches the listener. */
function exploding(): Router {
  const router = new Router();
  router.add("GET", "/boom", () => {
    throw new Error("a handler failed in a way nothing caught");
  });
  return router;
}

async function serve(router: Router): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer(createRequestListener(router));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("a handler that fails outside the error boundary answers 500 rather than ending the process", async () => {
  const rejections: unknown[] = [];
  const record = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", record);

  const { url, close } = await serve(exploding());
  try {
    const response = await fetch(`${url}/boom`);
    assert.equal(response.status, 500, "the client is answered, not left hanging");
    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "internal");
    assert.ok(
      !JSON.stringify(body).includes("a handler failed"),
      "and the failure's own message is not handed to the client",
    );

    // Give any stray rejection a turn of the loop to surface.
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(rejections, [], "no unhandled rejection escaped the listener");
  } finally {
    process.off("unhandledRejection", record);
    await close();
  }
});

test("the server keeps serving after a request fails", async () => {
  // The point of the wrapper: the process survives, so the next request works.
  const router = exploding();
  router.add("GET", "/healthy", () => ({ status: 200, body: { ok: true } }));

  const { url, close } = await serve(router);
  try {
    assert.equal((await fetch(`${url}/boom`)).status, 500);
    const after = await fetch(`${url}/healthy`);
    assert.equal(after.status, 200, "the instance is still up and answering");
    assert.deepEqual(await after.json(), { ok: true });
  } finally {
    await close();
  }
});

test("an ordinary request is unaffected by the wrapper", async () => {
  const router = new Router();
  router.add("POST", "/echo", (ctx) => ({ status: 200, body: { got: ctx.body } }));

  const { url, close } = await serve(router);
  try {
    const response = await fetch(`${url}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { got: { hello: "world" } });
  } finally {
    await close();
  }
});

test("a body that is not JSON is refused without reaching a handler", async () => {
  const router = new Router();
  let reached = false;
  router.add("POST", "/echo", () => {
    reached = true;
    return { status: 200, body: {} };
  });

  const { url, close } = await serve(router);
  try {
    const response = await fetch(`${url}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "invalid_json");
    assert.equal(reached, false);
  } finally {
    await close();
  }
});
