// Owned dialogs + cloned settings + in-memory note; never edits user note files.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const realDevice = process.env.OBSIDIAN_QA_REAL_DEVICE === '1';
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_QA_CDP_URL || 'http://127.0.0.1:9223');
  let page;
  for (const candidate of browser.contexts().flatMap((context) => context.pages())) {
    if (await candidate.evaluate(() => !!window.app?.plugins?.getPlugin('formula-library')).catch(() => false)) { page = candidate; break; }
  }
  if (!page) throw new Error('Obsidian page not available');
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const widths = realDevice ? [viewport.width] : [1280, 390];
  const noScreenshots = process.argv.includes('--no-screenshots');
  const modal = page.locator('[data-core-qa="true"]');
  fs.mkdirSync('output/playwright', { recursive: true });
  const capture = async (name) => { if (!noScreenshots) await modal.screenshot({ path: `output/playwright/${realDevice ? 'android' : 'native'}-core-${name}.png`, timeout: 12000 }); };
  try {
    await page.evaluate(() => {
      const real = app.plugins.getPlugin('formula-library');
      window.__coreQaOriginalSettings = JSON.stringify(real.settings);
      window.__coreQaMathLocale = window.MathfieldElement?.locale;
      const editor = { text: 'original note', getValue() { return this.text; }, getCursor: () => ({ line: 0, ch: 0 }),
        posToOffset: (pos) => pos.ch, offsetToPos: (offset) => ({ line: 0, ch: offset }),
        replaceRange(text, start, end) { this.text = this.text.slice(0, start.ch) + text + this.text.slice(end?.ch ?? start.ch); },
        setCursor() {}, setSelection() {}, focus() {} };
      window.__coreQaEditor = editor;
      window.__coreQaPlugin = Object.assign(Object.create(real), { settings: { ...JSON.parse(JSON.stringify(real.settings)), locale: 'en', saveWorkspaceDrafts: false },
        _coreService: null, _conversionModals: new Set(), _editorModals: new Set(), saveSettings: async () => {}, findMarkdownEditor: () => editor });
      window.__coreQaOpen = (options = {}) => {
        window.__coreQaModal?.modalEl.removeAttribute('data-core-qa');
        window.__coreQaModal = __coreQaPlugin.openConversion({ source: 'frac(a,b)', inputFormat: 'typst', ...options });
        __coreQaModal.modalEl.dataset.coreQa = 'true';
      };
      __coreQaOpen();
    });
    await modal.locator('.fc-status').filter({ hasText: 'Engine ready.' }).waitFor({ timeout: 35000 });
    assert.equal(await modal.getByLabel('Conversion mode', { exact: true }).inputValue(), 'best-effort');
    assert.equal(await modal.getByRole('button', { name: 'Convert', exact: true }).isDisabled(), false);
    await modal.getByLabel('Conversion mode', { exact: true }).selectOption('strict');
    assert.equal(await modal.getByRole('button', { name: 'Convert', exact: true }).isDisabled(), true);
    await modal.getByLabel('Conversion mode', { exact: true }).selectOption('best-effort');
    await modal.getByRole('button', { name: 'Convert', exact: true }).click();
    await modal.locator('.fc-status').filter({ hasText: 'Conversion finished.' }).waitFor({ timeout: 35000 });
    assert.match(await modal.getByLabel('Converted output', { exact: true }).inputValue(), /\\frac/);
    assert.equal(await modal.getByRole('button', { name: 'Open in formula editor', exact: true }).isDisabled(), false);
    const math = await modal.locator('.fc-preview').evaluate((el) => {
      const rendered = el.querySelector('[jax]');
      const r = rendered?.getBoundingClientRect();
      return { rendered: !!rendered, width: r?.width, height: r?.height, errors: !!el.querySelector('[data-mjx-error], [data-mml-node="merror"]') };
    });
    assert.equal(math.rendered, true); assert.equal(math.errors, false); assert.ok(math.width > 0 && math.height > 0);
    for (const width of widths) {
      if (!realDevice) await page.setViewportSize({ width, height: 900 });
      const clipping = await modal.evaluate((root) => {
        const box = root.getBoundingClientRect();
        return [...root.querySelectorAll('input,select,textarea,button')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && (r.left < box.left - 1 || r.right > box.right + 1);
        }).map((el) => el.getAttribute('aria-label') || el.textContent);
      });
      assert.deepEqual(clipping, [], `native conversion controls clipped at ${width}px`);
      assert.equal(await modal.evaluate((el) => el.scrollWidth > el.clientWidth + 2), false);
      await capture(String(width));
    }
    if (!realDevice) await page.setViewportSize(viewport);
    // Explicit open only changes a formula draft; the in-memory note stays untouched.
    await modal.getByRole('button', { name: 'Open in formula editor', exact: true }).click();
    await page.waitForFunction(() => [...__coreQaPlugin._editorModals].some((entry) => /\\frac/.test(entry.currentLatex())));
    assert.equal(await page.evaluate(() => __coreQaEditor.text), 'original note');
    await page.evaluate(() => { [...__coreQaPlugin._editorModals][0].modalEl.dataset.coreEditorQa = 'true'; });
    const editorModal = page.locator('[data-core-editor-qa="true"]');
    for (const width of widths) {
      if (!realDevice) await page.setViewportSize({ width, height: 900 });
      assert.deepEqual(await editorModal.evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll('.fe-tools-bar button')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < bounds.left - 1 || r.right > bounds.right + 1;
        }).map((el) => el.textContent);
      }), [], `new editor toolbar clipped at ${width}px`);
    }
    if (!realDevice) await page.setViewportSize(viewport);
    await page.evaluate(() => { for (const entry of __coreQaPlugin._editorModals) entry.close(); __coreQaOpen({ source: 'x+1', inputFormat: 'latex' }); });
    await modal.locator('.fc-status').filter({ hasText: 'Engine ready.' }).waitFor();
    await modal.getByLabel('Output format', { exact: true }).selectOption('omml');
    await modal.getByLabel('Conversion mode', { exact: true }).selectOption('strict');
    await modal.getByRole('button', { name: 'Convert', exact: true }).click();
    await modal.locator('.fc-status').filter({ hasText: 'Conversion finished.' }).waitFor();
    assert.match(await modal.getByLabel('Converted output', { exact: true }).inputValue(), /<m:oMath/);
    assert.equal(await modal.getByRole('button', { name: 'Open in formula editor', exact: true }).isDisabled(), true);
    // Over-limit input must not erase the input or expose a previous result.
    await modal.getByLabel('Original source', { exact: true }).fill('汉'.repeat(24000));
    await modal.getByRole('button', { name: 'Convert', exact: true }).click();
    await modal.locator('.fc-status').filter({ hasText: 'INPUT_TOO_LARGE' }).waitFor();
    assert.equal((await modal.getByLabel('Original source', { exact: true }).inputValue()).length, 24000);
    assert.equal(await modal.getByLabel('Converted output', { exact: true }).inputValue(), '');
    await page.evaluate(() => { __coreQaModal.close(); __coreQaPlugin.settings.locale = 'zh'; __coreQaOpen({ source: 'x+2', inputFormat: 'latex' }); });
    await modal.locator('.fc-status').filter({ hasText: '引擎已就绪' }).waitFor();
    await modal.getByLabel('转换模式', { exact: true }).selectOption('best-effort');
    await modal.getByRole('button', { name: '转换', exact: true }).click();
    await modal.locator('.fc-status').filter({ hasText: '转换完成' }).waitFor();
    assert.equal(await modal.getByRole('button', { name: '打开公式编辑器', exact: true }).isDisabled(), false);
    assert.equal(await page.evaluate(() => JSON.stringify(app.plugins.getPlugin('formula-library').settings) === __coreQaOriginalSettings), true);
    assert.equal(await page.evaluate(() => __coreQaEditor.text), 'original note');
    assert.deepEqual(errors, []);
    console.log(`PASS ${realDevice ? 'real Android WebView' : 'native Obsidian app://'}: Core Worker initialization, Typst→LaTeX MathJax preview, explicit formula draft opening without note writes, strict LaTeX→OMML text, UTF-8 limit/original protection, en/zh, ${widths.join('/')}px bounds. ${realDevice ? 'Actual viewport; no desktop size emulation. Clipboard and physical keyboard interactions are not covered.' : 'No real mobile acceptance.'}`);
  } catch (error) {
    const state = await modal.evaluate((root) => ({
      status: root.querySelector('.fc-status')?.textContent,
      previewErrors: !!root.querySelector('[data-mjx-error],[data-mml-node="merror"]'),
      viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height },
    })).catch(() => ({ modalUnavailable: true }));
    console.error('Conversion QA failure state:', JSON.stringify(state));
    throw error;
  } finally {
    await page.evaluate(async () => {
      window.__coreQaModal?.close();
      for (const entry of window.__coreQaPlugin?._editorModals || []) entry.close();
      await window.__coreQaPlugin?._coreService?.dispose();
      if (window.MathfieldElement && window.__coreQaMathLocale !== undefined) window.MathfieldElement.locale = __coreQaMathLocale;
      for (const key of ['__coreQaModal', '__coreQaPlugin', '__coreQaEditor', '__coreQaOpen', '__coreQaOriginalSettings', '__coreQaMathLocale']) delete window[key];
    }).catch(() => {});
    if (!realDevice) await page.setViewportSize(viewport).catch(() => {});
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
