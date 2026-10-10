// Isolated navigation/geometry gate; native Obsidian controls are checked separately.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const { build } = require('esbuild');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const bundle = (await build({ stdin: { contents: "export * from './src/settings-navigation.js'; export * from './src/tools.js';", resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'settingsQa' })).outputFiles[0].text;
  const browser = await chromium.launch({ executablePath: process.env.FORMULA_TEST_BROWSER_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(`<style>
      :root{--background-primary:#202229;--background-secondary:#292c35;--background-modifier-border:#505661;--background-modifier-hover:#30353e;--interactive-accent:#c05e68;--text-normal:#e5e7eb;--text-muted:#b0b7c1;--font-ui-medium:16px;--font-semibold:600}
      *{box-sizing:border-box}body{margin:0;font-family:system-ui;background:#17191e;color:var(--text-normal)}button,input{font:inherit;color:inherit;border-radius:6px}button{cursor:pointer}
      .surface{margin:16px auto;padding:20px;max-width:900px;width:calc(100% - 24px);max-height:calc(100dvh - 32px);overflow:auto;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px}
      .setting-item{display:flex;align-items:center;gap:16px;padding:16px 0;border-top:1px solid var(--background-modifier-border)}.setting-item-info{flex:1}.setting-item-name{font-size:var(--font-ui-medium)}.setting-item-description{color:var(--text-muted);margin-top:6px;line-height:1.5;font-size:14px}.setting-item-control{flex-shrink:0}
    </style><div class="surface"><div id="settings" class="formula-library-settings"></div></div>`);
    await page.addStyleTag({ content: fs.readFileSync('src/styles/settings.css', 'utf8') });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      HTMLElement.prototype.createEl = function (tag, options = {}) {
        const el = document.createElement(tag); if (options.cls) el.className = options.cls;
        if (options.text) el.textContent = options.text;
        for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
        this.appendChild(el); return el;
      };
      HTMLElement.prototype.createDiv = function (options) { return this.createEl('div', options); };
      window.activeSection = 'general';
      window.renderSettings = (locale = 'en') => {
        const root = document.getElementById('settings'); root.replaceChildren();
        root.createEl('h2', { text: locale === 'zh' ? 'Formula Library 设置' : 'Formula Library settings' });
        const panels = settingsQa.createSettingsNavigation(root, { locale, active: activeSection, onSelect: (id) => activeSection = id });
        for (const section of settingsQa.SETTINGS_SECTIONS) if (section.id !== 'tools') panels[section.id].createEl('p', { text: section[locale] });
        panels.tools.createEl('p', { text: locale === 'zh' ? '选择要显示的编辑器工具和命令。关闭入口不会删除已有内容。' : 'Choose available editor tools and commands. Disabling entries keeps saved content.' });
        for (const def of settingsQa.TOOL_DEFINITIONS) {
          const row = panels.tools.createDiv({ cls: 'setting-item' }), info = row.createDiv({ cls: 'setting-item-info' });
          info.createDiv({ cls: 'setting-item-name', text: def[locale] });
          info.createDiv({ cls: 'setting-item-description', text: def[locale + 'Desc'] });
          const control = row.createDiv({ cls: 'setting-item-control' }).createEl('input', { attr: { type: 'checkbox', 'aria-label': def[locale] } });
          control.checked = true;
        }
      };
      renderSettings();
    });
    assert.equal(await page.getByRole('tabpanel').filter({ visible: true }).count(), 1);
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    assert.equal(await page.getByLabel('Format conversion').isVisible(), true);
    await page.getByRole('tab', { name: 'Tools', exact: true }).press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Libraries', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Libraries', exact: true }).press('Home');
    assert.equal(await page.getByRole('tab', { name: 'General', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'General', exact: true }).press('End');
    assert.equal(await page.getByRole('tab', { name: 'Backups', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Tools', exact: true }).click(); await page.evaluate(() => renderSettings('zh'));
    assert.equal(await page.getByRole('tab', { name: '工具', exact: true }).getAttribute('aria-selected'), 'true');
    fs.mkdirSync('output/playwright', { recursive: true });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.getByRole('tabpanel').filter({ visible: true }).count(), 1);
      await page.screenshot({ path: `output/playwright/settings-tools-${width}.png` });
    }
    await page.evaluate(() => { document.documentElement.style.setProperty('--font-ui-medium', '32px'); renderSettings('en'); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.getByRole('tab').evaluateAll((tabs) => tabs.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent)), []);
    assert.deepEqual(errors, []);
    console.log('PASS settings navigation: one panel, arrows/Home/End, en/zh, preserved section, 1280/390px and32px labels. DOM navigation only; native controls tested separately.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
