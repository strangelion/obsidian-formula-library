// Attach only to a user-approved Android WebView forward. No viewport emulation,
// clipboard writes, disk-backed note insertion, restore or image export is used.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);

(async () => {
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_QA_CDP_URL || 'http://127.0.0.1:9224');
  let page;
  for (const candidate of browser.contexts().flatMap((context) => context.pages())) {
    if (await candidate.evaluate(() => !!window.app?.plugins?.getPlugin('formula-library')).catch(() => false)) { page = candidate; break; }
  }
  if (!page) { await browser.close(); throw Error('Obsidian plugin not available'); }
  const environment = await page.evaluate(() => ({
    userAgent: navigator.userAgent, width: innerWidth, height: innerHeight,
    dpr: devicePixelRatio, pluginVersion: app.plugins.getPlugin('formula-library').manifest.version,
  }));
  assert.match(environment.userAgent, /Android/, 'Use the actual Android WebView, not desktop size emulation');
  const session = await page.context().newCDPSession(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const root = page.locator('[data-android-feature-qa="true"]');
  const evidence = [];
  fs.mkdirSync('output/playwright', { recursive: true });
  const tap = async (locator) => {
    // QA fills use DOM automation. Release that focus before native taps so a
    // test-owned soft keyboard does not cover an otherwise actionable button.
    await root.evaluate(modal => {
      if (modal.contains(document.activeElement)) document.activeElement.blur();
    });
    await locator.click({ trial: true });
    const box = await locator.boundingBox();
    assert.ok(box && box.width && box.height);
    if (!process.env.OBSIDIAN_QA_ADB || !process.env.OBSIDIAN_QA_ADB_SERIAL) {
      throw Error('Set OBSIDIAN_QA_ADB and OBSIDIAN_QA_ADB_SERIAL for native Android input');
    }
    // For an edge-to-edge WebView, CSS coordinates map to display pixels via DPR.
    // Check this against the device screenshot before using this driver on a new host.
    await runFile(process.env.OBSIDIAN_QA_ADB, ['-s', process.env.OBSIDIAN_QA_ADB_SERIAL,
      'shell', 'input', 'tap', String(Math.round((box.x + box.width / 2) * environment.dpr)),
      String(Math.round((box.y + box.height / 2) * environment.dpr))]);
  };
  const checkBounds = async (name) => {
    const clipped = await root.evaluate((modal) => {
      const box = modal.getBoundingClientRect();
      return [...modal.querySelectorAll('input,select,textarea,button')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && r.height && (r.left < box.left - 2 || r.right > box.right + 2);
      }).map((el) => el.getAttribute('aria-label') || el.textContent);
    });
    assert.deepEqual(clipped, [], `${name}: horizontally clipped controls`);
    const path = `output/playwright/android-${name}-${environment.width}x${environment.height}.png`;
    await root.screenshot({ path, timeout: 12000 });
    evidence.push(path);
  };
  const mathPreview = async () => {
    await root.locator('.ft-preview [jax]').waitFor({ timeout: 15000 });
    assert.equal(await root.locator('.ft-preview [data-mjx-error],.ft-preview [data-mml-node="merror"]').count(), 0);
  };
  try {
    await page.evaluate(() => {
      const real = app.plugins.getPlugin('formula-library');
      window.__androidQaSaved = JSON.stringify(real.settings);
      window.__androidQaLocale = window.MathfieldElement?.locale;
      const editor = { text: 'untouched QA note', getValue() { return this.text; },
        getCursor: () => ({ line: 0, ch: 0 }), posToOffset: (pos) => pos.ch,
        offsetToPos: (offset) => ({ line: 0, ch: offset }), replaceRange() { throw Error('Note insertion is outside this test'); },
        setCursor() {}, setSelection() {}, focus() {} };
      window.__androidQaEditor = editor;
      window.__androidQaPlugin = Object.assign(Object.create(real), {
        settings: { ...JSON.parse(JSON.stringify(real.settings)), locale: 'en', saveWorkspaceDrafts: false,
          enabledTools: { conversion: true, templates: true, matrix: true, saveToLibrary: true, plot: true, mermaid: true } },
        saveSettings: async () => {}, findMarkdownEditor: () => editor,
        _coreService: null, _conversionModals: new Set(), _editorModals: new Set(),
      });
      window.__androidQaOpen = (method, ...args) => {
        window.__androidQaModal?.modalEl.removeAttribute('data-android-feature-qa');
        window.__androidQaModal?.close();
        window.__androidQaModal = __androidQaPlugin[method](...args);
        if (!__androidQaModal) throw Error(`Could not open ${method}`);
        __androidQaModal.modalEl.dataset.androidFeatureQa = 'true';
      };
    });
    const routes = await page.evaluate(async () => {
      const service = __androidQaPlugin.getCoreConversionService();
      const caps = await service.getCapabilities();
      if (!caps.ok) throw Error('Core capabilities failed');
      const passed = [];
      for (const [inputFormat, content] of [ ['latex', '\\frac{a}{b}'], ['typst', 'frac(a,b)'],
        ['mathml', '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>'],
        ['omml', '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x</m:t></m:r></m:oMath>'] ]) {
        for (const outputFormat of ['latex-fragment', 'typst', 'mathml', 'omml']) {
          const result = await service.convert({ inputFormat, content, outputFormat, mode: 'best-effort' });
          if (!result.ok || !result.data.content.trim()) throw Error(`Failed ${inputFormat}→${outputFormat}`);
          passed.push(`${inputFormat}→${outputFormat}`);
        }
      }
      return passed;
    });
    assert.equal(routes.length, 16);
    await page.evaluate(() => __androidQaOpen('openEditor', 'insert', '\\frac{1}{2}'));
    await root.locator('math-field').waitFor();
    await root.getByRole('button', { name: 'Source', exact: true }).click();
    const editorLayout = await root.evaluate((modal) => {
      const content = modal.querySelector('.formula-editor-modal');
      const grid = modal.querySelector('.fl-grid-scroll');
      const source = modal.querySelector('.fe-source-pane textarea');
      const section = modal.querySelector('.fe-tools-section');
      const c = content.getBoundingClientRect(), g = grid.getBoundingClientRect();
      return { compact: matchMedia('(max-width:520px),(max-height:520px)').matches,
        toolsOpen: section.open, sourceHeight: source.getBoundingClientRect().height,
        libraryVisibleHeight: Math.max(0, Math.min(g.bottom, c.bottom) - Math.max(g.top, c.top)),
        contentScrolls: content.scrollHeight > content.clientHeight,
        libraryOverflow: getComputedStyle(grid).overflowY };
    });
    if (editorLayout.compact) {
      assert.equal(editorLayout.toolsOpen, false, 'auxiliary tools start collapsed on small screens');
      assert.ok(editorLayout.sourceHeight >= 100 && editorLayout.sourceHeight <= 180);
      assert.ok(editorLayout.libraryVisibleHeight >= 180, `Library viewport too small: ${JSON.stringify(editorLayout)}`);
      assert.equal(editorLayout.contentScrolls, true);
      assert.equal(editorLayout.libraryOverflow, 'visible');
      await root.locator('.fl-symbol-btn').last().scrollIntoViewIfNeeded();
      assert.ok(await root.locator('.formula-editor-modal').evaluate((el) => el.scrollTop) > 0);
      assert.equal(await root.getByRole('button', { name: 'Insert', exact: true }).isVisible(), true);
      await root.locator('.formula-editor-modal').evaluate((el) => { el.scrollTop = 0; });
    }
    await checkBounds('editor');
    await page.evaluate(() => __androidQaOpen('openMatrixPaste'));
    await root.locator('.mt-input').fill('1 2 3\n4 5 6');
    await mathPreview();
    assert.match(await page.evaluate(() => __androidQaModal.currentLatex()), /1 & 2 & 3/);
    await tap(root.locator('.fl-manage-bar button').first());
    await page.waitForFunction(() => __androidQaModal.grid.height === 3 && __androidQaModal.grid.width === 2, null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => [__androidQaModal.grid.height, __androidQaModal.grid.width]), [3, 2]);
    await mathPreview(); await checkBounds('matrix');
    await page.evaluate(() => __androidQaOpen('openParamTemplates'));
    await root.locator('.ft-form input').first().fill('2');
    await mathPreview();
    assert.match(await page.evaluate(() => __androidQaModal.latexValue), /2/);
    await checkBounds('parameters');
    await page.evaluate(() => __androidQaOpen('openDrawing', 'flowchart LR\n A[Start] --> B[Done]'));
    const diagramSvg = root.locator('.fd-preview .mermaid svg[aria-roledescription]');
    await diagramSvg.waitFor({ timeout: 15000 });
    await tap(root.getByRole('button', { name: 'Visual', exact: true }));
    await page.waitForFunction(() => __androidQaModal.mode === 'visual');
    const transform = await diagramSvg.evaluate((el) => el.style.transform);
    const before = await page.evaluate(() => __androidQaModal.zoom);
    await tap(root.locator('.fd-zoom-bar button').nth(1));
    assert.ok(await page.evaluate(() => __androidQaModal.zoom) > before);
    assert.notEqual(await diagramSvg.evaluate((el) => el.style.transform), transform);
    await tap(root.locator('.fd-zoom-bar button').nth(3));
    assert.equal(await page.evaluate(() => __androidQaModal.zoom), 1);
    await root.locator('.fd-template-field select').selectOption('sequence');
    assert.equal(await page.evaluate(() => __androidQaModal.mode), 'source');
    assert.equal(await root.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), true);
    await tap(root.getByRole('button', { name: 'Undo', exact: true }));
    await page.waitForFunction(() => __androidQaModal.currentTemplateKey === 'flowchart', null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => [__androidQaModal.currentTemplateKey, __androidQaModal.mode]), ['flowchart', 'visual']);
    await root.locator('.fd-status').filter({ hasText: 'Preview updated' }).waitFor();
    const icons = await root.locator('.fd-zoom-icon,.fd-icon-button').evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect(), icon = button.querySelector('svg')?.getBoundingClientRect();
      return { buttonWidth: box.width, buttonHeight: box.height, width: icon?.width, height: icon?.height };
    }));
    assert.ok(icons.length >= 4);
    for (const icon of icons) {
      assert.ok(icon.width >= 16 && icon.height >= 16, `Invisible control icon: ${JSON.stringify(icon)}`);
      assert.ok(icon.buttonWidth >= 44 && icon.buttonHeight >= 44, 'Mobile icon target must be at least44px');
    }
    await tap(root.locator('.fd-visual-row .fd-icon-button').first());
    await page.waitForFunction(() => __androidQaModal.visualGraph.nodes.length === 1, null, { timeout: 5000 });
    await tap(root.getByRole('button', { name: 'Undo', exact: true }));
    await page.waitForFunction(() => __androidQaModal.visualGraph.nodes.length === 2, null, { timeout: 5000 });
    await diagramSvg.waitFor({ timeout: 15000 });
    assert.equal(await diagramSvg.locator('.node').count(), 2, 'measure a real diagram, not a code-block copy icon');
    await checkBounds('mermaid');
    await page.evaluate(() => __androidQaOpen('openFunctionPlot'));
    await root.locator('.ft-input-row input').first().fill('a*x^2+b');
    await root.locator('.fd-preview svg').waitFor();
    assert.equal(await root.locator('.ft-param').count(), 2);
    await root.locator('.ft-param input[type="number"]').first().fill('2.5');
    assert.equal(await page.evaluate(() => __androidQaModal.params.a), 2.5);
    await checkBounds('plot');
    assert.equal(await page.evaluate(() => JSON.stringify(app.plugins.getPlugin('formula-library').settings) === __androidQaSaved), true);
    assert.equal(await page.evaluate(() => __androidQaEditor.text), 'untouched QA note');
    assert.deepEqual(errors, []);
    const report = { status: 'passed', environment, routes, evidence, drawingIcons: icons, editorLayout,
      ui: ['matrix preview and touch transpose', 'parameter input and MathJax preview', 'Mermaid touch zoom/reset, delete, cross-template undo and visible44px icon controls', 'function plot and numeric parameter'],
      boundaries: ['cloned settings', 'no viewport emulation', 'no real note writes or clipboard writes',
        'native IME, persistence, export and comprehensive formula fidelity not tested'] };
    fs.writeFileSync(`output/playwright/android-features-${environment.width}x${environment.height}.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error('Android feature QA state:', JSON.stringify(await root.evaluate((modal) => ({
      title: modal.querySelector('.modal-title')?.textContent,
      state: modal.querySelector('.fd-status')?.textContent,
      error: modal.querySelector('.fd-error')?.textContent,
      geometry: [...modal.querySelectorAll('.modal-content,.fd-toolbar,.fd-workspace,.fd-preview-pane,.fd-preview-viewport,.fd-preview svg')].map((el) => {
        const r = el.getBoundingClientRect(); return { className: el.getAttribute('class'), width: r.width, height: r.height };
      }),
    })).catch(() => ({ closed: true }))));
    await root.screenshot({ path: `output/playwright/android-feature-failure-${environment.width}.png`, timeout: 5000 }).catch(() => {});
    throw error;
  } finally {
    await page.evaluate(async () => {
      window.__androidQaModal?.close();
      for (const entry of window.__androidQaPlugin?._editorModals || []) entry.close();
      await window.__androidQaPlugin?._coreService?.dispose();
      if (window.MathfieldElement && window.__androidQaLocale !== undefined) window.MathfieldElement.locale = __androidQaLocale;
      for (const key of ['__androidQaSaved', '__androidQaLocale', '__androidQaEditor', '__androidQaPlugin', '__androidQaModal', '__androidQaOpen']) delete window[key];
    }).catch(() => {});
    await session.detach().catch(() => {});
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
