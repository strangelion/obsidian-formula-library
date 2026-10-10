// Simulate mobile themes with large button padding; control SVGs must not shrink to zero.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.FORMULA_TEST_BROWSER_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage();
    for (const mobile of [false, true]) {
      for (const width of [390, 1219]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}.formula-drawing-modal{padding:16px}.fd-zoom-bar,.fd-visual-row{display:flex;gap:8px}.is-mobile button{padding:16px 24px;display:flex}button svg{flex-shrink:1}</style>
          <div class="formula-drawing-modal"><div class="fd-zoom-bar"><button class="fd-zoom-btn fd-zoom-icon" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg></button></div>
          <div class="fd-visual-row"><button class="fd-icon-button" aria-label="Delete node"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 6v14h10V6"/></svg></button></div></div>`);
        await page.evaluate((value) => document.body.classList.toggle('is-mobile', value), mobile);
        await page.addStyleTag({ content: fs.readFileSync('styles.css', 'utf8') });
        const geometry = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => {
          const b = button.getBoundingClientRect(), s = button.querySelector('svg').getBoundingClientRect();
          return { buttonWidth: b.width, buttonHeight: b.height, iconWidth: s.width, iconHeight: s.height,
            contained: s.left >= b.left && s.right <= b.right && s.top >= b.top && s.bottom <= b.bottom };
        }));
        for (const item of geometry) {
          assert.ok(item.iconWidth >= 16 && item.iconHeight >= 16, JSON.stringify(item));
          assert.ok(item.buttonWidth >= (mobile ? 44 : 36) && item.buttonHeight >= (mobile ? 44 : 36));
          assert.equal(item.contained, true);
        }
      }
    }
    console.log('PASS drawing icon controls: nonzero SVGs, containment, 36px desktop/44px mobile targets, large theme padding at390/1219px');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
