// Native Obsidian MathJax geometry check. Own dialog, cloned settings, no note/clipboard writes.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.connectOverCDP(process.env.OBSIDIAN_QA_CDP_URL || 'http://127.0.0.1:9225');
  let page;
  for (const candidate of browser.contexts().flatMap(c => c.pages())) {
    if (await candidate.evaluate(() => !!window.app?.plugins?.getPlugin('formula-library')).catch(() => false)) { page = candidate; break; }
  }
  if (!page) { await browser.close(); throw Error('Obsidian plugin unavailable'); }
  const results = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const root = page.locator('[data-matrix-geometry-qa]');
  fs.mkdirSync('output/playwright', { recursive: true });
  try {
    await page.evaluate(() => {
      // Native close animations can leave a previous owned dialog in the DOM.
      for (const previous of document.querySelectorAll('[data-matrix-geometry-qa]')) {
        previous.removeAttribute('data-matrix-geometry-qa');
        previous.querySelector('.modal-close-button')?.click();
      }
      const real = app.plugins.getPlugin('formula-library');
      window.__matrixQaSaved = JSON.stringify(real.settings);
      const clone = Object.assign(Object.create(real), {
        settings: { ...JSON.parse(JSON.stringify(real.settings)), locale: 'en' },
        saveSettings: async () => {}, insertFormula: () => { throw Error('Note writes forbidden'); },
      });
      window.__matrixQaModal = clone.openMatrixPaste();
      __matrixQaModal.modalEl.dataset.matrixGeometryQa = 'true';
    });
    if (process.env.OBSIDIAN_QA_THEME) {
      assert.ok(['light', 'dark'].includes(process.env.OBSIDIAN_QA_THEME));
      await page.evaluate(theme => {
        window.__matrixQaTheme = ['theme-light', 'theme-dark'].filter(c => document.body.classList.contains(c));
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
      }, process.env.OBSIDIAN_QA_THEME);
    }
    await root.locator('.mt-input').waitFor();
    for (const [fixture, input] of [['ragged', '1 1\n1\n1'], ['regular', '1 2 3\n4 5 6'],
      ['tall', '1 2\n3 4\n5 6\n7 8\n9 10']]) {
      for (const environment of ['bmatrix', 'pmatrix', 'vmatrix', 'Vmatrix']) {
        await root.locator('.mt-input').fill(input);
        await root.locator('.mt-controls select').first().selectOption(environment);
        await page.waitForFunction(() => {
          const modal = window.__matrixQaModal;
          const math = modal?.previewEl.querySelector('mjx-math');
          return math && (math.getAttribute('data-latex') === modal.currentLatex() ||
            (!math.hasAttribute('data-latex') && math.querySelectorAll('mjx-mtr').length === modal.grid.height));
        }, null, { timeout: 15000 });
        await root.locator('.ft-preview').scrollIntoViewIfNeeded();
        const metrics = await root.locator('.ft-preview').evaluate(preview => {
          const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
          const table = preview.querySelector('mjx-mtable');
          const stretches = [...preview.querySelectorAll('mjx-stretchy-v')];
          const brackets = stretches.length ? stretches : [...preview.querySelectorAll('mjx-math > mjx-mrow > mjx-mo')];
          const glyphs = [...preview.querySelectorAll('mjx-mtable mjx-c')];
          return { table: table && rect(table), brackets: brackets.map(rect), glyphs: glyphs.map(rect),
            extenders: [...preview.querySelectorAll('mjx-ext')].map(e => getComputedStyle(e).boxSizing),
            stretchy: stretches.length > 0,
            errorCount: preview.querySelectorAll('[data-mjx-error], [data-mml-node="merror"]').length };
        });
        assert.equal(metrics.errorCount, 0);
        assert.ok(metrics.table?.height > 0 && metrics.glyphs.length > 0, `${fixture}/${environment}: missing matrix`);
        assert.equal(metrics.brackets.length, 2, `${fixture}/${environment}: expected two stretch delimiters`);
        for (const bracket of metrics.brackets) {
          const centerDelta = Math.abs((bracket.top + bracket.bottom - metrics.table.top - metrics.table.bottom) / 2);
          assert.ok(centerDelta < 3 && bracket.top <= metrics.table.top + 3 && bracket.bottom >= metrics.table.bottom - 3,
            `${fixture}/${environment}: delimiter does not enclose matrix: ${JSON.stringify(metrics)}`);
          assert.ok(metrics.glyphs.every(g => g.top >= bracket.top - 3 && g.bottom <= bracket.bottom + 3), 'every row must be enclosed');
        }
        results.push({ fixture, environment, metrics });
        if (fixture === 'ragged' && environment === 'bmatrix') {
          const size = await page.evaluate(() => `${innerWidth}x${innerHeight}`);
          await root.screenshot({ path: `output/playwright/native-matrix-ragged-${size}-${process.env.OBSIDIAN_QA_THEME || 'current'}.png` });
        }
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(app.plugins.getPlugin('formula-library').settings) === __matrixQaSaved), true);
    assert.deepEqual(errors, []);
    const host = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, userAgent: navigator.userAgent,
      mathjax: window.MathJax?.version, theme: document.body.classList.contains('theme-dark') ? 'dark' : 'light' }));
    const report = { status: 'passed', host, results, scope: '12 CHTML delimiter/table/glyph geometry cases; no note or clipboard writes; native IME not tested' };
    fs.writeFileSync(`output/playwright/native-matrix-${host.width}x${host.height}-${host.theme}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, host, cases: results.length, scope: report.scope }));
  } finally {
    await page.evaluate(() => {
      window.__matrixQaModal?.modalEl.removeAttribute('data-matrix-geometry-qa');
      window.__matrixQaModal?.close();
      if (window.__matrixQaTheme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(...__matrixQaTheme);
      }
      delete window.__matrixQaTheme;
      delete window.__matrixQaModal; delete window.__matrixQaSaved;
    }).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
