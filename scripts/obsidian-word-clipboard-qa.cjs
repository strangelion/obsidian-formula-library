// Explicit Windows acceptance. Replaces clipboard with test equations only;
// Word verification creates/closes its own unsaved documents, never user notes.
const { chromium } = require('playwright');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const run = promisify(execFile);
(async () => {
  assert.equal(process.platform, 'win32');
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_QA_CDP_URL || 'http://127.0.0.1:9223');
  const page = browser.contexts()[0].pages().find(p => p.url().startsWith('app://'));
  const root = page.locator('[data-word-clipboard-qa]');
  const results = [];
  try {
    await page.evaluate(() => {
      const real = app.plugins.getPlugin('formula-library');
      window.__wordQaSaved = JSON.stringify(real.settings);
      window.__wordQaPlugin = Object.assign(Object.create(real), {
        settings: { ...JSON.parse(JSON.stringify(real.settings)), locale: 'en' }, saveSettings: async () => {},
        _coreService: null, _conversionModals: new Set(),
      });
    });
    for (const [fixture, latex] of [['fraction', '\\frac{\\alpha}{\\beta}'], ['superscript', 'x^{2}+1'],
      ['matrix', '\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}']]) {
      await page.evaluate(source => {
        window.__wordQaModal?.modalEl.removeAttribute('data-word-clipboard-qa');
        window.__wordQaModal?.close();
        window.__wordQaModal = __wordQaPlugin.openConversion({ source, inputFormat: 'latex' });
        __wordQaModal.modalEl.dataset.wordClipboardQa = 'true';
      }, latex);
      await root.locator('.fc-status').filter({ hasText: 'Engine ready.' }).waitFor({ timeout: 35000 });
      await root.getByLabel('Output format', { exact: true }).selectOption('omml');
      await root.getByRole('button', { name: 'Convert', exact: true }).click();
      await root.locator('.fc-status').filter({ hasText: 'Conversion finished.' }).waitFor({ timeout: 35000 });
      const omml = await root.getByLabel('Converted output', { exact: true }).inputValue();
      await root.getByRole('button', { name: 'Copy for Word', exact: true }).click();
      await root.locator('.fc-status').filter({ hasText: 'MathML copied for Word.' }).waitFor({ timeout: 35000 });
      assert.equal(await root.getByLabel('Original source', { exact: true }).inputValue(), latex);
      assert.equal(await root.getByLabel('Converted output', { exact: true }).inputValue(), omml);
      const native = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File',
        'scripts/verify-word-clipboard.ps1', '-UseCurrentClipboard'], { timeout: 45000 });
      const result = JSON.parse(native.stdout);
      assert.equal(result.equationCount, 1);
      assert.equal(result[{ fraction: 'hasFraction', superscript: 'hasSuperscript', matrix: 'hasMatrix' }[fixture]], true);
      results.push({ fixture, ...result });
    }
    assert.equal(await page.evaluate(() => JSON.stringify(app.plugins.getPlugin('formula-library').settings) === __wordQaSaved), true);
    fs.mkdirSync('output/playwright', { recursive: true });
    fs.writeFileSync('output/playwright/word-clipboard.json', JSON.stringify({ status: 'passed', results }, null, 2));
    console.log(JSON.stringify({ status: 'passed', results, scope: 'MathML text import creates editable Word OMath; not OLE or PowerPoint/WPS/mobile acceptance' }));
  } finally {
    await page.evaluate(async () => {
      window.__wordQaModal?.close();
      await window.__wordQaPlugin?._coreService?.dispose();
      for (const name of ['__wordQaModal', '__wordQaPlugin', '__wordQaSaved']) delete window[name];
    }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
