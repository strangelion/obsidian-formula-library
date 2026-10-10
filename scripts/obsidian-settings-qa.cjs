// Native settings navigation/tool controls using only cloned preferences and an in-memory editor.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  const page = browser.contexts().flatMap((context) => context.pages()).find((entry) => entry.url().startsWith('app://obsidian'));
  if (!page) throw Error('Obsidian page not available');
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const noScreenshots = process.argv.includes('--no-screenshots');
  fs.mkdirSync('output/playwright', { recursive: true });
  try {
    await page.evaluate(async () => {
      const real = app.plugins.getPlugin('formula-library');
      window.__toolsQaSaved = JSON.stringify(real.settings);
      window.__toolsQaMathLocale = window.MathfieldElement?.locale;
      const editor = { text: 'untouched', getValue() { return this.text; }, getCursor: () => ({ line: 0, ch: 0 }),
        posToOffset: (pos) => pos.ch, offsetToPos: (offset) => ({ line: 0, ch: offset }),
        replaceRange(text, start, end) { this.text = this.text.slice(0, start.ch) + text + this.text.slice(end?.ch ?? start.ch); }, setCursor() {}, setSelection() {}, focus() {} };
      window.__toolsQaPlugin = Object.assign(Object.create(real), { settings: { ...JSON.parse(JSON.stringify(real.settings)), locale: 'en', rememberDrafts: false,
        enabledTools: { conversion: true, templates: true, matrix: true, saveToLibrary: true, plot: true, mermaid: true } },
        _coreService: null, _editorModals: new Set(), _conversionModals: new Set(), saveSettings: async () => {}, findMarkdownEditor: () => editor });
      window.__toolsQaEditor = __toolsQaPlugin.openEditor('insert', 'x');
      __toolsQaEditor.modalEl.dataset.toolsEditorQa = 'true';
      window.__toolsQaModal = __toolsQaPlugin.openWorkspaceBackup();
      __toolsQaModal.modalEl.dataset.toolsSettingsQa = 'true';
      __toolsQaModal.contentEl.empty(); __toolsQaModal.contentEl.removeClass('fl-backup-content');
      __toolsQaModal.contentEl.style.overflowY = 'auto';
      const base = app.setting.pluginTabs.find((entry) => entry.id === 'formula-library');
      window.__toolsQaTab = new base.constructor(app, __toolsQaPlugin);
      __toolsQaTab.containerEl = __toolsQaModal.contentEl;
      await __toolsQaTab.display();
      window.__toolsQaContent = JSON.stringify({ templates: __toolsQaPlugin.settings.customParamTemplates, presets: __toolsQaPlugin.settings.paramPresets });
    });
    const settings = page.locator('[data-tools-settings-qa="true"]');
    const editor = page.locator('[data-tools-editor-qa="true"]');
    assert.equal(await settings.getByRole('tab').count(), 5);
    assert.equal(await settings.getByRole('tabpanel').filter({ visible: true }).count(), 1);
    await settings.getByRole('tab', { name: 'Tools', exact: true }).click();
    for (const name of ['Format conversion', 'Parameterized templates', 'Matrix data paste', 'Save to my library', 'Function plotting', 'Mermaid diagrams']) {
      await settings.getByLabel(name, { exact: true }).click();
    }
    await page.waitForFunction(() => Object.values(__toolsQaPlugin.settings.enabledTools).every((value) => value === false));
    assert.equal(await editor.locator('.fe-tools-bar').isVisible(), false);
    assert.equal(await page.evaluate(() => __toolsQaPlugin.openConversion()), null);
    assert.equal(await page.evaluate(() => JSON.stringify({ templates: __toolsQaPlugin.settings.customParamTemplates, presets: __toolsQaPlugin.settings.paramPresets }) === __toolsQaContent), true);
    await settings.getByLabel('Parameterized templates', { exact: true }).click();
    assert.equal(await editor.getByRole('button', { name: 'Templates', exact: true }).isVisible(), true);
    assert.equal(await editor.getByRole('button', { name: 'Convert format', exact: true }).isVisible(), false);
    await page.evaluate(() => __toolsQaTab.display());
    assert.equal(await settings.getByRole('tab', { name: 'Tools', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => __toolsQaPlugin.settings.enabledTools.templates), true);
    // Prove core disposal when disabled; no user-owned service or task is touched.
    await settings.getByLabel('Format conversion', { exact: true }).click();
    assert.equal(await page.evaluate(async () => (await __toolsQaPlugin.getCoreConversionService().getCapabilities()).ok), true);
    await settings.getByLabel('Format conversion', { exact: true }).click();
    assert.equal(await page.evaluate(() => __toolsQaPlugin._coreService === null), true);
    const toolsTab = settings.getByRole('tab', { name: 'Tools', exact: true });
    await toolsTab.focus(); await toolsTab.press('ArrowRight');
    assert.equal(await settings.getByRole('tab', { name: 'Libraries', exact: true }).getAttribute('aria-selected'), 'true');
    await settings.getByRole('tab', { name: 'Libraries', exact: true }).press('Home');
    assert.equal(await settings.getByRole('tab', { name: 'General', exact: true }).getAttribute('aria-selected'), 'true');
    await page.evaluate(async () => { __toolsQaPlugin.settings.locale = 'zh'; await __toolsQaTab.display(); });
    await settings.getByRole('tab', { name: '工具', exact: true }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const clipped = await settings.evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll('button,input,select,.checkbox-container')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && (r.left < bounds.left - 1 || r.right > bounds.right + 1);
        }).map((el) => el.getAttribute('aria-label') || el.textContent);
      });
      assert.deepEqual(clipped, [], `settings controls clipped at ${width}px`);
      assert.equal(await settings.getByRole('tabpanel').filter({ visible: true }).count(), 1);
      if (!noScreenshots) await page.screenshot({ path: `output/playwright/native-settings-tools-${width}.png`, timeout: 12000 });
    }
    // Simulated write failure restores the toggle and produces a visible error.
    await page.evaluate(() => { __toolsQaPlugin.saveSettings = async () => { throw Error('Test write failure'); }; });
    await settings.getByLabel('函数绘图', { exact: true }).click();
    await settings.getByRole('alert').filter({ hasText: '保存开关失败' }).waitFor();
    assert.equal(await page.evaluate(() => __toolsQaPlugin.settings.enabledTools.plot), false);
    assert.equal(await page.evaluate(() => JSON.stringify(app.plugins.getPlugin('formula-library').settings) === __toolsQaSaved), true);
    assert.deepEqual(errors, []);
    console.log('PASS native settings: five en/zh sections, one visible panel, keyboard navigation, six switches, live toolbar hiding/re-enable, no content deletion, Core disposal, active-section preservation and save-error rollback at1280/390px; real settings unchanged.');
  } finally {
    await page.evaluate(async () => {
      window.__toolsQaModal?.close(); window.__toolsQaEditor?.close();
      await window.__toolsQaPlugin?._coreService?.dispose();
      if (window.MathfieldElement && window.__toolsQaMathLocale !== undefined) window.MathfieldElement.locale = __toolsQaMathLocale;
      for (const key of ['__toolsQaSaved', '__toolsQaMathLocale', '__toolsQaPlugin', '__toolsQaEditor', '__toolsQaModal', '__toolsQaTab', '__toolsQaContent']) delete window[key];
    }).catch(() => {});
    await page.setViewportSize(viewport).catch(() => {});
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
