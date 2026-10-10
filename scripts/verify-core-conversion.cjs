// Real Chromium module Workers and pinned conversion WASM. No vault or remote server.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const { build } = require('esbuild');
const http = require('node:http');
const assert = require('node:assert/strict');

(async () => {
  const bundle = (await build({ stdin: { contents: "export * from './src/core-assets.js'; export * from './src/core-conversion.js'; export { WORKER_SOURCE } from './src/generated/core-payload.js';", resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'coreQa' })).outputFiles[0].text;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/core.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/core.js' ? bundle : '<!doctype html><title>Core conversion verification</title><script src="/core.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.FORMULA_TEST_BROWSER_PATH || undefined, headless: true });
    const page = await browser.newPage();
    const errors = [], remote = [], failed = [];
    await page.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:')
      || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (req) => failed.push(req.url()));
    page.on('request', (req) => { if (!req.url().startsWith('blob:') && !req.url().startsWith('http://127.0.0.1:')) remote.push(req.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    // Some system browser filters inject scripts at navigation. Block external
    // traffic above and report it separately; measure Core after the harness loads.
    const blockedHostRequests = remote.splice(0);
    failed.length = 0;
    const result = await page.evaluate(async () => {
      const metrics = { workers: 0, terminated: 0, urls: 0, revoked: 0, loopsStarted: 0 };
      const NativeWorker = Worker, create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          // Test-only extension of the actual official Worker: a tiny WASM loop
          // proves that cancellation really terminates execution, not just a Promise.
          const source = window.coreQaBlockWorkers ? coreQa.WORKER_SOURCE + `
const spin = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,7,8,1,4,115,112,105,110,0,0,10,9,1,7,0,3,64,12,0,11,11]))).exports.spin;
const normal = self.onmessage;
self.onmessage = (event) => {
  if (event.data.type === 'convert-formula' && event.data.input.content === '%test-only-block%') {
    self.postMessage({protocolVersion:1,type:'progress',requestId:event.data.requestId,stage:'test-only-loop',progress:0});
    spin();
  } else normal(event);
};` : null;
          const testUrl = source ? URL.createObjectURL(new Blob([source], { type: 'text/javascript' })) : null;
          super(testUrl || url, options);
          this.testUrl = testUrl;
          this.addEventListener('message', (event) => { if (event.data?.stage === 'test-only-loop') metrics.loopsStarted++; });
          metrics.workers++;
        }
        terminate() {
          if (this.dead) return;
          this.dead = true;
          metrics.terminated++; super.terminate();
          if (this.testUrl) URL.revokeObjectURL(this.testUrl);
        }
      };
      URL.createObjectURL = (blob) => { metrics.urls++; return create(blob); };
      URL.revokeObjectURL = (url) => { metrics.revoked++; revoke(url); };
      const service = new coreQa.CoreConversionService({ createSession: coreQa.createBundledCoreSession });
      const caps = await service.getCapabilities();
      const conversions = [];
      for (const [inputFormat, content] of [ ['latex', '\\frac{a}{b}'], ['typst', 'frac(a,b)'],
        ['mathml', '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>'],
        ['omml', '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>'] ]) {
        for (const outputFormat of ['latex-fragment', 'typst', 'mathml', 'omml']) {
          const envelope = await service.convert({ inputFormat, content, outputFormat, mode: 'best-effort' });
          conversions.push({ inputFormat, outputFormat, envelope });
        }
      }
      let strict;
      try { await service.convert({ content: 'frac(a,b)', inputFormat: 'typst' }); } catch (error) { strict = error.code; }
      const strictOmml = await service.convert({ content: 'x^2', inputFormat: 'latex', outputFormat: 'omml' });
      let oversized;
      try { await service.convert({ content: '汉'.repeat(24000), inputFormat: 'latex', mode: 'best-effort' }); } catch (error) { oversized = error.code; }
      const dtd = await service.convert({ content: '<!DOCTYPE math [<!ENTITY x SYSTEM "file:///private">]><math>&x;</math>', inputFormat: 'mathml', mode: 'best-effort' });
      // A cancelled initial load must leave no Worker/Blob alive and must be restartable.
      await service.reset();
      const controller = new AbortController();
      const cancelled = service.getCapabilities({ signal: controller.signal }).catch((error) => error.code);
      controller.abort();
      const cancelCode = await cancelled;
      const recovered = await service.convert({ content: 'x+1', inputFormat: 'latex', mode: 'best-effort' });
      await service.reset();
      const InstrumentedWorker = window.Worker;
      window.Worker = class { constructor() { throw new DOMException('Worker blocked by test host', 'SecurityError'); } };
      let blockedCode;
      try { await service.getCapabilities(); } catch (error) { blockedCode = error.code; }
      await service.reset();
      const blockedCleaned = metrics.urls === metrics.revoked;
      window.Worker = InstrumentedWorker;
      const afterBlocked = await service.convert({ content: 'x+2', inputFormat: 'latex', mode: 'best-effort' });
      await service.dispose();
      window.coreQaBlockWorkers = true;
      const hanging = new coreQa.CoreConversionService({ createSession: coreQa.createBundledCoreSession, totalTimeoutMillis: 1000 });
      await hanging.getCapabilities();
      const activeController = new AbortController();
      const active = hanging.convert({ content: '%test-only-block%', inputFormat: 'latex', mode: 'best-effort' }, { signal: activeController.signal })
        .catch((error) => error.code);
      const loopDeadline = Date.now() + 1500;
      while (!metrics.loopsStarted && Date.now() < loopDeadline) await new Promise((resolve) => setTimeout(resolve, 5));
      if (!metrics.loopsStarted) throw new Error('Test-only WASM loop did not start before its deadline');
      activeController.abort();
      const hardCancelCode = await active;
      const afterHardCancel = await hanging.convert({ content: 'x+3', inputFormat: 'latex', mode: 'best-effort' });
      const hardTimeoutCode = await hanging.convert({ content: '%test-only-block%', inputFormat: 'latex', mode: 'best-effort' }).catch((error) => error.code);
      const afterHardTimeout = await hanging.convert({ content: 'x+4', inputFormat: 'latex', mode: 'best-effort' });
      await hanging.dispose();
      window.coreQaBlockWorkers = false;
      return { caps, conversions, strict, strictOmml, oversized, dtd, cancelCode, recovered, blockedCode, blockedCleaned, afterBlocked,
        hardCancelCode, hardTimeoutCode, afterHardCancel, afterHardTimeout, metrics };
    });
    assert.equal(result.caps.ok, true);
    assert.equal(result.caps.versions.coreVersion, '3.2.1');
    for (const { inputFormat, outputFormat, envelope } of result.conversions) {
      assert.equal(envelope.ok, true, `${inputFormat}→${outputFormat}: ${JSON.stringify(envelope)}`);
      assert.ok(envelope.data.content.trim());
      if (outputFormat === 'latex-fragment') {
        assert.equal(envelope.data.contentKind, 'latex-fragment');
        assert.ok(!/\\documentclass|\\begin\{document\}/.test(envelope.data.content));
      }
    }
    assert.equal(result.strict, 'UNSUPPORTED_FORMAT');
    assert.equal(result.strictOmml.ok, true);
    assert.equal(result.oversized, 'INPUT_TOO_LARGE');
    assert.equal(result.dtd.ok, false);
    assert.equal(result.cancelCode, 'CANCELLED');
    assert.equal(result.recovered.ok, true);
    assert.equal(result.blockedCode, 'CORE_UNAVAILABLE');
    assert.equal(result.blockedCleaned, true, 'Worker constructor failure must not leak asset URLs');
    assert.equal(result.afterBlocked.ok, true, 'Worker constructor failure must not poison retry');
    assert.equal(result.hardCancelCode, 'CANCELLED');
    assert.equal(result.hardTimeoutCode, 'CORE_TIMEOUT');
    assert.equal(result.afterHardCancel.ok, true);
    assert.equal(result.afterHardTimeout.ok, true);
    assert.equal(result.metrics.loopsStarted, 2, 'the WASM loop must actually begin before hard cancel/timeout');
    assert.equal(result.metrics.workers, result.metrics.terminated, 'all workers must terminate');
    assert.equal(result.metrics.urls, result.metrics.revoked, 'all asset URLs must be revoked');
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.deepEqual(remote, []);
    console.log(JSON.stringify({ status: 'passed', directions: result.conversions.map((entry) => `${entry.inputFormat}→${entry.outputFormat}`),
      capabilityRows: result.caps.data.length, metrics: result.metrics, remoteRequests: remote.length, blockedHostRequests }));
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
