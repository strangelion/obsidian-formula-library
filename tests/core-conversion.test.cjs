const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: ["src/core-conversion.js"], bundle: true, write: false,
  platform: "browser", format: "cjs", target: "es2020",
}).outputFiles[0].text;
const sandbox = { module: { exports: {} }, AbortController, TextEncoder, setTimeout, clearTimeout, console };
vm.runInNewContext(source, sandbox);
const { CoreConversionService, CORE_CONVERSION_LIMITS, findConversionRoute } = sandbox.module.exports;
const versions = { apiEnvelopeVersion: 3, capabilitySchemaVersion: 3, coreVersion: "3.2.1" };
const route = (input = "typst", output = "latex_display", mode = "best-effort", available = true) => ({
  input, output, mode, available, target: "wasm32-unknown-unknown",
  path: "reconstructed-latex", limitations: ["no-complete-round-trip-guarantee"],
  ...(!available ? { unavailableReason: "Strict validation is unavailable for this route." } : {}),
});
const capabilities = () => ({ ok: true, versions, diagnostics: [{ code: "CAPABILITY_NOTE" }], data: [
  route(), route("typst", "latex_display", "strict", false),
  route("latex", "latex_display"), route("latex", "omml", "strict"),
] });
const request = (content = "frac(a,b)") => ({ content, inputFormat: "typst", outputFormat: "latex-fragment", mode: "best-effort" });
const result = (req, content = "\\frac{a}{b}") => ({ ok: true, versions,
  diagnostics: [{ code: "BEST_EFFORT", message: "Syntax or style may be lost." }],
  data: { content, contentKind: "latex-fragment", capability: route(req.inputFormat,
    req.outputFormat === "latex-fragment" ? "latex_display" : req.outputFormat, req.mode) },
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const errorCode = (code) => (error) => error.name === "CoreConversionError" && error.code === code;

function harness(options = {}) {
  const events = [];
  const calls = [];
  const sessions = [];
  const caps = options.capabilities ?? capabilities();
  const service = new CoreConversionService({
    ...options.limits,
    createSession: async ({ signal }) => {
      const id = sessions.length + 1;
      events.push(`create:${id}`);
      const session = {
        client: {
          convertFormula: (req, callOptions) => {
            events.push(`convert:${id}`);
            calls.push({ request: req, options: callOptions, id });
            return options.convert ? options.convert(req, callOptions, id) : Promise.resolve(result(req));
          },
          terminate: async () => {
            events.push(`terminate:${id}`);
            await options.terminate?.(id);
          },
        },
        initialize: async (initOptions) => {
          events.push(`initialize:${id}`);
          return options.initialize ? options.initialize(initOptions, id) : caps;
        },
        dispose: async () => { events.push(`dispose:${id}`); },
        releaseAssets: async () => { events.push(`release:${id}`); },
      };
      sessions.push(session);
      return options.create ? options.create(session, signal, id) : session;
    },
  });
  return { service, events, calls, sessions, caps };
}

test("adapter is host-agnostic, lazy, and initialized capabilities retain versions and diagnostics", async () => {
  const h = harness();
  assert.equal(h.events.length, 0);
  assert.equal(h.service.ready, false);
  assert.strictEqual(await h.service.getCapabilities(), h.caps);
  assert.strictEqual(await h.service.getCapabilities(), h.caps);
  assert.equal(h.sessions.length, 1);
  assert.equal(h.service.ready, true);
  await h.service.dispose();
  assert.deepEqual(h.events, ["create:1", "initialize:1", "terminate:1", "dispose:1", "release:1"]);
});

test("fragment lookup maps only to latex_display and preserves explicit unavailable routes", () => {
  const caps = capabilities();
  assert.strictEqual(findConversionRoute(caps, request()), caps.data[0]);
  assert.equal(findConversionRoute(caps, { ...request(), mode: undefined }).available, false);
  assert.equal(findConversionRoute(caps.data, { ...request(), inputFormat: "mtef" }), undefined);
});

test("strict is the default and unsupported strict never falls back to best-effort", async () => {
  const h = harness();
  await assert.rejects(h.service.convert({ content: "frac(a,b)", inputFormat: "typst" }), errorCode("UNSUPPORTED_FORMAT"));
  assert.equal(h.calls.length, 0);
  await h.service.dispose();
});

test("conversion returns the original Core envelope, not stripped document text or dropped diagnostics", async () => {
  let original;
  const h = harness({ convert: async (req) => { original = result(req); return original; } });
  assert.strictEqual(await h.service.convert(request()), original);
  assert.equal(h.calls[0].request.outputFormat, "latex-fragment");
  assert.equal(h.calls[0].request.mode, "best-effort");
  assert.match(h.calls[0].request.requestId, /^formula-library:/);
  assert.ok(h.calls[0].options.timeoutMillis > 0 && h.calls[0].options.timeoutMillis <= 30_000);
  await h.service.dispose();
});

test("genuine failed Core envelopes retain their error, versions and diagnostics", async () => {
  const failure = { ok: false, versions, diagnostics: [{ code: "PARSE_NOTE" }],
    error: { code: "CONVERSION_FAILED", message: "No standalone formula.", details: { detail: "Multiple blocks." } } };
  const h = harness({ convert: async () => failure });
  assert.strictEqual(await h.service.convert(request()), failure);
  assert.equal(h.service.ready, true);
  await h.service.dispose();
});

test("invalid requests are refused before assets are created and input uses UTF-8 bytes", async () => {
  const h = harness();
  for (const invalid of [null, { ...request(), content: " " }, { ...request(), inputFormat: "unknown" },
    { ...request(), mode: "auto" }, { ...request(), outputFormat: "svg" }, { ...request(), requestId: "" }]) {
    await assert.rejects(h.service.convert(invalid), errorCode("INVALID_ARGUMENT"));
  }
  await assert.rejects(h.service.convert(request("中".repeat(21_846))), errorCode("INPUT_TOO_LARGE"));
  assert.equal(h.events.length, 0);
  await h.service.dispose();
});

test("fragment requires contentKind, a bounded serializable envelope, and matching route metadata", async () => {
  const invalid = [
    { ok: true, data: {}, versions: {} },
    { ok: true, versions, diagnostics: {}, data: {} },
    { ...result(request()), data: { ...result(request()).data, contentKind: "latex-document", content: "\\documentclass{article}x" } },
    { ...result(request()), data: { ...result(request()).data, content: " " } },
    { ...result(request()), data: { ...result(request()).data, capability: route("mathml") } },
  ];
  for (const envelope of invalid) {
    const h = harness({ convert: async () => envelope });
    await assert.rejects(h.service.convert(request()), errorCode("INVALID_CORE_RESPONSE"));
    await h.service.dispose();
  }
  const large = harness({ convert: async (req) => result(req, "中".repeat(100_000)) });
  await assert.rejects(large.service.convert(request()), errorCode("OUTPUT_TOO_LARGE"));
  await large.service.dispose();
});

test("unavailable or malformed capability envelopes never call the converter", async () => {
  const failure = { ok: false, versions, error: { code: "UNSUPPORTED_FORMAT", message: "No formula API." } };
  const h = harness({ capabilities: failure });
  assert.strictEqual(await h.service.convert(request()), failure);
  assert.equal(h.calls.length, 0);
  await h.service.dispose();
  const malformed = harness({ capabilities: { ok: true, versions, data: [null] } });
  await assert.rejects(malformed.service.getCapabilities(), errorCode("INVALID_CORE_RESPONSE"));
  assert.equal(malformed.calls.length, 0);
  await malformed.service.dispose();
});

test("queued cancellation does not kill the active Worker and the queue is bounded", async () => {
  const pending = deferred();
  const h = harness({ limits: { maxQueueLength: 1 }, convert: () => pending.promise });
  const active = h.service.convert(request("a"), { supersedeKey: null });
  await tick();
  const controller = new AbortController();
  const queued = h.service.convert(request("b"), { supersedeKey: null, signal: controller.signal });
  const queuedCheck = assert.rejects(queued, errorCode("CANCELLED"));
  await assert.rejects(h.service.convert(request("c"), { supersedeKey: null }), errorCode("CORE_QUEUE_FULL"));
  controller.abort();
  await queuedCheck;
  assert.equal(h.events.includes("terminate:1"), false);
  pending.resolve(result(request("a")));
  await active;
  assert.equal(h.calls.length, 1);
  await h.service.dispose();
});

test("active cancellation aborts official RPC, terminates recovery, then releases URLs before rebuilding", async () => {
  const pending = deferred();
  const termination = deferred();
  const h = harness({ convert: (req, options, id) => id === 1 ? pending.promise : Promise.resolve(result(req)),
    terminate: (id) => id === 1 ? termination.promise : undefined });
  const controller = new AbortController();
  const old = h.service.convert(request("old"), { signal: controller.signal, supersedeKey: null });
  const oldCheck = assert.rejects(old, errorCode("CANCELLED"));
  await tick();
  const next = h.service.convert(request("new"), { supersedeKey: null });
  controller.abort();
  await oldCheck;
  await tick();
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.equal(h.events.includes("terminate:1"), true);
  assert.equal(h.events.includes("release:1"), false);
  assert.equal(h.sessions.length, 1);
  termination.resolve();
  assert.equal((await next).ok, true);
  assert.ok(h.events.indexOf("release:1") < h.events.indexOf("create:2"));
  pending.resolve(result(request("old"), "old-result"));
  await tick();
  assert.equal(h.calls.length, 2);
  await h.service.dispose();
});

test("a newer request in the same stream supersedes stale work but separate streams remain independent", async () => {
  const pending = deferred();
  const h = harness({ convert: (req, options, id) => id === 1 ? pending.promise : Promise.resolve(result(req, req.content)) });
  const first = h.service.convert(request("old"), { supersedeKey: "editor-a" });
  const firstCheck = assert.rejects(first, errorCode("SUPERSEDED"));
  await tick();
  const second = h.service.convert(request("new"), { supersedeKey: "editor-a" });
  const separate = h.service.convert(request("other"), { supersedeKey: "editor-b" });
  await firstCheck;
  assert.equal((await second).data.content, "new");
  assert.equal((await separate).data.content, "other");
  pending.resolve(result(request("old")));
  await h.service.dispose();
});

test("the total deadline includes initialization and cleans up a factory that finishes after timeout", async () => {
  const creation = deferred();
  const h = harness({ limits: { totalTimeoutMillis: 25 }, create: (session) => creation.promise.then(() => session) });
  await assert.rejects(h.service.convert(request()), errorCode("CORE_TIMEOUT"));
  assert.equal(h.calls.length, 0);
  creation.resolve();
  await tick();
  assert.ok(h.events.includes("terminate:1"));
  assert.ok(h.events.includes("release:1"));
  await h.service.dispose();
});

test("conversion timeout hard-stops a nonresponsive bridge instead of only abandoning a Promise", async () => {
  const h = harness({ limits: { totalTimeoutMillis: 25 }, convert: () => new Promise(() => {}) });
  await assert.rejects(h.service.convert(request()), errorCode("CORE_TIMEOUT"));
  await tick();
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.deepEqual(h.events.slice(-3), ["terminate:1", "dispose:1", "release:1"]);
  await h.service.dispose();
});

test("cancelled initialization releases the Worker and cannot make a late capability response ready", async () => {
  const initializing = deferred();
  const h = harness({ initialize: () => initializing.promise });
  const controller = new AbortController();
  const work = h.service.getCapabilities({ signal: controller.signal });
  const check = assert.rejects(work, errorCode("CANCELLED"));
  await tick();
  controller.abort();
  await check;
  await tick();
  assert.equal(h.service.ready, false);
  assert.ok(h.events.includes("release:1"));
  initializing.resolve(h.caps);
  await tick();
  assert.equal(h.service.ready, false);
  await h.service.dispose();
});

test("queue waiting and resource cleanup count against the total deadline", async () => {
  const close = deferred();
  const h = harness({ limits: { totalTimeoutMillis: 35 }, convert: () => new Promise(() => {}), terminate: () => close.promise });
  const controller = new AbortController();
  const first = h.service.convert(request("active"), { supersedeKey: null, signal: controller.signal });
  const firstCheck = assert.rejects(first, errorCode("CANCELLED"));
  await tick();
  const waiting = h.service.convert(request("waiting"), { supersedeKey: null });
  const waitingCheck = assert.rejects(waiting, errorCode("CORE_TIMEOUT"));
  controller.abort();
  await firstCheck;
  await waitingCheck;
  assert.equal(h.calls.length, 1);
  close.resolve();
  await h.service.dispose();
});

test("reset rejects pending work and reinitializes; disposal is terminal and idempotent", async () => {
  const pending = deferred();
  const h = harness({ convert: (req, options, id) => id === 1 ? pending.promise : Promise.resolve(result(req)) });
  const active = h.service.convert(request("first"), { supersedeKey: null });
  const activeCheck = assert.rejects(active, errorCode("CORE_RESET"));
  await tick();
  const queued = h.service.convert(request("queued"), { supersedeKey: null });
  const queuedCheck = assert.rejects(queued, errorCode("CORE_RESET"));
  await h.service.reset();
  await Promise.all([activeCheck, queuedCheck]);
  assert.equal(h.service.ready, false);
  assert.equal((await h.service.convert(request())).ok, true);
  pending.resolve(result(request()));
  await h.service.dispose();
  await h.service.dispose();
  assert.equal(h.service.disposed, true);
  await assert.rejects(h.service.convert(request()), errorCode("CORE_DISPOSED"));
  await assert.rejects(h.service.getCapabilities(), errorCode("CORE_DISPOSED"));
  assert.equal(h.events.filter((event) => event === "release:2").length, 1);
});

test("pre-aborted requests do not initialize assets; late creation after disposal still releases them", async () => {
  const controller = new AbortController();
  controller.abort();
  const h = harness();
  await assert.rejects(h.service.convert(request(), { signal: controller.signal }), errorCode("CANCELLED"));
  assert.equal(h.events.length, 0);
  await h.service.dispose();
  const creation = deferred();
  const late = harness({ create: (session) => creation.promise.then(() => session) });
  const work = late.service.getCapabilities();
  const check = assert.rejects(work, errorCode("CORE_DISPOSED"));
  await tick();
  await late.service.dispose();
  await check;
  creation.resolve();
  await tick();
  assert.ok(late.events.includes("release:1"));
});

test("cleanup failure is visible and resources are not revoked before confirmed termination", async () => {
  const h = harness({ terminate: async () => { throw new Error("Cannot stop Worker"); } });
  await h.service.getCapabilities();
  await assert.rejects(h.service.reset(), errorCode("CORE_CLEANUP_FAILED"));
  assert.equal(h.events.includes("release:1"), false);
  await assert.rejects(h.service.getCapabilities(), errorCode("CORE_CLEANUP_FAILED"));
  await assert.rejects(h.service.dispose(), errorCode("CORE_CLEANUP_FAILED"));
});

test("limits may be lowered but cannot bypass Core input/result ceilings", () => {
  assert.equal(CORE_CONVERSION_LIMITS.maxInputBytes, 65_536);
  assert.throws(() => new CoreConversionService({ createSession() {}, maxInputBytes: 65_537 }), { name: "RangeError" });
  assert.throws(() => new CoreConversionService({ createSession() {}, maxOutputBytes: 262_145 }), { name: "RangeError" });
  assert.throws(() => new CoreConversionService({ createSession() {}, maxQueueLength: 0 }), { name: "RangeError" });
});
