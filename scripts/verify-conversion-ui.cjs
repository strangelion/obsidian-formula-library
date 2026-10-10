// In-memory UI acceptance: no Core assets, vault files or system clipboard are used.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "playwright");
const { build } = require("esbuild");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const stub = `
const make=(tag,opts={})=>{const el=document.createElement(tag);if(opts.cls)el.className=opts.cls;if(opts.text)el.textContent=opts.text;if(opts.value!==undefined)el.value=opts.value;for(const [key,value]of Object.entries(opts.attr||{}))el.setAttribute(key,value);return el;};
HTMLElement.prototype.createEl=function(tag,opts){const el=make(tag,opts);this.appendChild(el);return el;};
HTMLElement.prototype.createDiv=function(opts){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);};
HTMLElement.prototype.createSpan=function(opts){return this.createEl('span',opts);};
HTMLElement.prototype.empty=function(){this.replaceChildren();};HTMLElement.prototype.setText=function(value){this.textContent=value;};HTMLElement.prototype.addClass=function(name){this.classList.add(name);};
export class Modal{constructor(app){this.app=app;this.containerEl=make('div',{cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.titleEl=this.modalEl.createDiv({cls:'modal-title'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});}open(){document.body.appendChild(this.containerEl);this.onOpen();}close(){this.onClose?.();this.containerEl.remove();}}
export class Plugin{} export class PluginSettingTab{} export class ItemView{} export class MarkdownView{} export class Notice{} export class Menu{} export class Component{}
export const getLanguage=()=> 'en';export const setIcon=()=>{};
export const renderMath=(latex)=>{if(window.renderState==='empty')return null;const el=make('span');el.textContent=latex;if(window.renderState==='error')el.setAttribute('data-mml-node','merror');return el;};
export const finishRenderMath=()=>window.finishPromise || Promise.resolve();
`;

async function verify() {
  const bundle = (await build({
    entryPoints: ["src/conversion.js"], bundle: true, write: false, format: "iife", globalName: "conversionQA", platform: "browser",
    plugins: [{ name: "in-memory-obsidian", setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, () => ({ contents: stub, loader: "js" }));
    } }],
  })).outputFiles[0].text;
  const browser = await chromium.launch({ executablePath: process.env.FORMULA_TEST_BROWSER_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    await page.setContent(`<style>
      :root{--background-primary:#202229;--background-secondary:#292c35;--background-modifier-border:#505661;--interactive-accent:#c05e68;--text-normal:#e5e7eb;--text-muted:#b0b7c1;--text-error:#ff9494;--font-ui-medium:16px;--font-ui-small:14px;--font-monospace:monospace;--radius-s:8px}
      *{box-sizing:border-box}body{margin:0;background:#17191e;color:var(--text-normal);font-family:system-ui}button,input,select,textarea{font:inherit;color:inherit;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px}button{cursor:pointer}button:disabled{opacity:.45}.modal-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.modal{background:var(--background-primary);border:1px solid var(--background-modifier-border)}.modal-title{font-size:22px;font-weight:600;padding-bottom:12px}
    </style>`);
    await page.addStyleTag({ content: fs.readFileSync("styles.css", "utf8") });
    await page.addStyleTag({ content: fs.readFileSync("src/styles/conversion.css", "utf8") });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const versions = { apiEnvelopeVersion: 3, coreVersion: "3.2.1" };
      const rows = [];
      for (const input of ["latex", "typst", "mathml", "omml"]) for (const output of ["latex_display", "typst", "mathml", "omml"]) {
        for (const mode of ["strict", "best-effort"]) rows.push({ input, output, mode,
          available: mode === "best-effort" || input === "latex" && output === "omml" });
      }
      window.calls = [];
      window.failLoad = false;
      window.service = {
        getCapabilities: async () => { if (window.failLoad) { window.failLoad = false; throw { code: "CORE_UNAVAILABLE" }; } return { ok: true, versions, data: rows }; },
        convert: (request, options) => new Promise((resolve, reject) => window.calls.push({ request, options, resolve, reject })),
      };
      window.original = "x^2 + 1";
      window.p = { settings: { locale: "en" }, app: {}, getCoreConversionService: () => service,
        editorSource: original, inserted: [], openEditor: (mode, content) => { p.inserted.push({ mode, content }); return true; } };
      window.openModal = (options = {}) => { window.m = new conversionQA.FormulaConversionModal(p.app, p, { source: original, ...options }); m.open(); };
      window.respond = (index, content = "x^2 + 1") => {
        const call = calls[index];
        call.resolve({ ok: true, versions, diagnostics: [{ code: "BEST_EFFORT", message: "Review the result." }],
          data: { content, contentKind: "latex-fragment", capability: {
            input: call.request.inputFormat, output: call.request.outputFormat === "latex-fragment" ? "latex_display" : call.request.outputFormat,
            mode: call.request.mode, available: true, limitations: ["no-complete-round-trip-guarantee"],
          } } });
      };
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.copied = text; } } });
      openModal();
    });
    const mode = page.getByLabel("Conversion mode", { exact: true });
    const convert = page.getByRole("button", { name: "Convert", exact: true });
    const source = page.getByLabel("Original source", { exact: true });
    const output = page.getByLabel("Converted output", { exact: true });
    const use = page.getByRole("button", { name: "Open in formula editor", exact: true });
    await page.getByText("Engine ready. Choose a route and convert explicitly.", { exact: true }).waitFor();
    assert.equal(await mode.inputValue(), "best-effort");
    assert.equal(await convert.isDisabled(), false);
    await mode.selectOption("strict");
    assert.equal(await convert.isDisabled(), true);
    assert.equal(await page.evaluate(() => p._conversionModals.size), 1);
    assert.equal(await page.evaluate(() => calls.length), 0);
    await mode.selectOption("best-effort");
    await convert.click();
    await source.fill("new source");
    assert.equal(await page.evaluate(() => calls[0].options.signal.aborted), true);
    await page.evaluate(() => respond(0, "obsolete result"));
    assert.equal(await output.inputValue(), "");
    assert.equal(await use.isDisabled(), true);
    assert.equal(await page.evaluate(() => p.editorSource), "x^2 + 1");

    await source.fill("x^2 + 1");
    await convert.click();
    await page.evaluate(() => respond(1));
    await page.getByText("Conversion finished. Review the output and diagnostics before using it.", { exact: true }).waitFor();
    assert.equal(await use.isDisabled(), false);
    assert.equal(await page.evaluate(() => p.inserted.length), 0);
    await page.getByRole("button", { name: "Copy output", exact: true }).click();
    assert.equal(await page.evaluate(() => copied), "x^2 + 1");
    fs.mkdirSync("output/playwright", { recursive: true });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const clipped = await page.locator(".formula-conversion-modal").evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll("select,textarea,button")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && (r.left < bounds.left - 1 || r.right > bounds.right + 1);
        }).map((el) => el.getAttribute("aria-label") || el.textContent);
      });
      assert.deepEqual(clipped, [], `conversion controls clipped at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `output/playwright/conversion-${width}.png` });
    }
    await page.evaluate(() => document.documentElement.style.setProperty("--font-ui-medium", "32px"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const largeBounds = await page.locator(".formula-conversion-modal").evaluate((root) => {
      const r = root.getBoundingClientRect();
      return [...root.querySelectorAll("select,textarea,button")].every((el) => {
        const b = el.getBoundingClientRect();
        return !b.width || b.left >= r.left - 1 && b.right <= r.right + 1;
      });
    });
    assert.equal(largeBounds, true, "32px narrow conversion controls exceed modal bounds");
    await page.evaluate(() => document.documentElement.style.removeProperty("--font-ui-medium"));
    await page.setViewportSize({ width: 1280, height: 900 });
    await use.click();
    assert.deepEqual(await page.evaluate(() => p.inserted), [{ mode: "insert", content: "x^2 + 1" }]);
    assert.equal(await page.evaluate(() => p._conversionModals.size), 0);

    await page.evaluate(() => openModal());
    await mode.selectOption("best-effort");
    await page.getByLabel("Output format", { exact: true }).selectOption("mathml");
    await convert.click();
    const xml = '<math><mtext><img src="x" onerror="window.pwned=true"></mtext></math>';
    await page.evaluate((content) => respond(2, content), xml);
    await page.getByText("Conversion finished. Review the output and diagnostics before using it.", { exact: true }).waitFor();
    assert.equal(await output.inputValue(), xml);
    assert.equal(await page.locator(".formula-conversion-modal img").count(), 0);
    assert.equal(await use.isDisabled(), true);

    await page.getByLabel("Output format", { exact: true }).selectOption("latex-fragment");
    await page.evaluate(() => { window.renderState = "empty"; });
    await convert.click();
    await page.evaluate(() => respond(3));
    await page.getByText(/The text was converted, but the formula preview is unavailable/).waitFor();
    assert.equal(await use.isDisabled(), true);
    await page.evaluate(() => { window.renderState = "error"; });
    await convert.click();
    await page.evaluate(() => respond(4));
    await page.getByText(/The text was converted, but the formula preview is unavailable/).waitFor();
    assert.equal(await use.isDisabled(), true);
    assert.equal(await source.inputValue(), "x^2 + 1");

    await page.evaluate(() => { window.renderState = undefined; });
    await convert.click();
    await page.evaluate(() => calls[5].resolve({ ok: false, versions: { apiEnvelopeVersion: 3, coreVersion: "3.2.1" },
      error: { code: "CONVERSION_FAILED", details: { detail: "Bad source" } } }));
    await page.getByText(/The formula could not be converted/).waitFor();
    assert.equal(await source.inputValue(), "x^2 + 1");
    assert.equal(await output.inputValue(), "");
    await convert.click();
    await page.getByRole("button", { name: "Cancel task", exact: true }).click();
    assert.equal(await page.evaluate(() => calls[6].options.signal.aborted), true);
    await page.evaluate(() => respond(6, "cancelled result"));
    assert.equal(await output.inputValue(), "");

    await page.evaluate(() => { m.close(); window.failLoad = true; openModal(); });
    await page.getByText(/The local conversion engine is unavailable/).waitFor();
    assert.equal(await source.inputValue(), "x^2 + 1");
    await page.getByRole("button", { name: "Retry engine", exact: true }).click();
    await page.getByText("Engine ready. Choose a route and convert explicitly.", { exact: true }).waitFor();
    await page.evaluate(() => { p.settings.locale = "zh"; m.refreshLocalization(); });
    await page.getByText("转换单个公式", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("转换模式", { exact: true }).inputValue(), "best-effort");
    await page.getByLabel("转换模式", { exact: true }).selectOption("best-effort");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await page.evaluate(() => m.close());
    assert.equal(await page.evaluate(() => calls[7].options.signal.aborted), true);
    await page.evaluate(() => respond(7, "closed result"));
    assert.equal(await page.evaluate(() => p._conversionModals.size), 0);

    await page.evaluate(() => {
      p.settings.locale = "en";
      openModal({ onInsert: (content) => { p.editorSource = content; } });
    });
    await mode.selectOption("best-effort");
    await convert.click();
    await page.evaluate(() => respond(8, "confirmed fragment"));
    await page.getByRole("button", { name: "Use in current editor", exact: true }).click();
    assert.equal(await page.evaluate(() => p.editorSource), "confirmed fragment");
    assert.equal(await page.evaluate(() => m.originalSource), "x^2 + 1");
    await page.evaluate(() => {
      window.finishPromise = new Promise((resolve, reject) => { window.rejectFinish = reject; });
      openModal();
    });
    await mode.selectOption("best-effort");
    await convert.click();
    await page.evaluate(() => respond(9, "pending preview"));
    await page.waitForFunction(() => m.outputInput.value === "pending preview");
    await source.fill("next source");
    await page.evaluate(() => { window.finishPromise = undefined; });
    await convert.click();
    await page.evaluate(() => respond(10, "current preview"));
    await page.getByText("Conversion finished. Review the output and diagnostics before using it.", { exact: true }).waitFor();
    await page.evaluate(() => rejectFinish(new Error("Obsolete MathJax finishing task")));
    assert.equal(await output.inputValue(), "current preview");
    assert.equal(await use.isDisabled(), false);
    await page.evaluate(() => m.close());
    await page.evaluate(() => openModal({ onInsert: () => { const error = new Error('Changed draft'); error.code = 'EDITOR_CHANGED'; throw error; } }));
    await convert.click();
    await page.evaluate(() => respond(11, 'confirmed but stale target'));
    await page.getByRole('button', { name: 'Use in current editor', exact: true }).click();
    await page.getByText(/The formula editor changed or closed/).waitFor();
    assert.equal(await output.inputValue(), 'confirmed but stale target');
    assert.equal(await source.inputValue(), 'x^2 + 1');
    await page.evaluate(() => m.close());
    assert.deepEqual(errors, []);
    assert.deepEqual(failedRequests, []);
    console.log("PASS conversion UI: strict/manual modes, diagnostics, stale/cancel/close safety, immutable source, plain XML, failed preview gate, copy/manual editor confirmation, backend retry, English/Chinese, 1280/390px control bounds. Mock service and MathJax only; not Core or native Obsidian acceptance.");
  } finally { await browser.close(); }
}

verify().catch((error) => { console.error(error); process.exitCode = 1; });
