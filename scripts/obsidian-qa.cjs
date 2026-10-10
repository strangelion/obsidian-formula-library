// Connect to a locally launched Obsidian developer endpoint. No account data is read.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page = pages.find((entry) => entry.url().startsWith("app://obsidian"));
    if (!page) throw new Error("Obsidian page is not available");
    const command = process.argv[2] || "inspect";
    if (command === "inspect") {
      console.log(JSON.stringify(await page.evaluate(() => ({
        vault: window.app?.vault?.getName(),
        loaded: !!window.app?.plugins?.getPlugin("formula-library"),
        version: window.app?.plugins?.getPlugin("formula-library")?.manifest.version,
        theme: document.body.className,
        commands: Object.keys(window.app?.commands?.commands || {}).filter((id) => id.startsWith("formula-library:")),
      })), null, 2));
    } else if (command === "font-inspect") {
      console.log(JSON.stringify(await page.evaluate(() => ({
        baseFontSize: app.vault.getConfig('baseFontSize'),
        bodyTextSize: getComputedStyle(document.body).getPropertyValue('--font-text-size'),
        rootTextSize: getComputedStyle(document.documentElement).getPropertyValue('--font-text-size'),
        fontMethod: typeof app.updateFontSize === 'function' ? app.updateFontSize.toString().slice(0,700) : null,
        baseFontMethod: typeof app.getBaseFontSize === 'function' ? app.getBaseFontSize.toString().slice(0,600) : null,
        paste: app.plugins.getPlugin('formula-library')?.manifest.version,
      })),null,2));
    } else if (command === "reload") {
      await page.evaluate(async () => {
        const manifest = app.plugins.manifests['formula-library'];
        const path = manifest.dir || app.vault.configDir + '/plugins/formula-library';
        const installed = JSON.parse(await app.vault.adapter.read(path + '/manifest.json'));
        Object.assign(manifest, installed);
        await app.plugins.disablePlugin("formula-library");
        await app.plugins.enablePlugin("formula-library");
      });
      console.log("Reloaded Formula Library");
    } else if (command === "cleanup") {
      await page.evaluate(() => {
        const p=app.plugins.getPlugin('formula-library');
        if (window.__formulaQaLocale !== undefined) p.settings.locale=window.__formulaQaLocale;
        window.__formulaQaCustom?.close();
        window.__formulaQaModal?.close();
        window.__formulaQaLeaf?.detach();
        if (window.__formulaQaOriginalLeaf) app.workspace.setActiveLeaf(window.__formulaQaOriginalLeaf,{focus:true});
        for(const key of ['__formulaQaCustom','__formulaQaModal','__formulaQaLeaf','__formulaQaOriginalLeaf','__formulaQaLocale']) delete window[key];
      });
      if (process.argv[3]) await page.evaluate((value) => app.changeTheme(value),process.argv[3]);
      console.log('Cleaned up this script\'s QA dialogs and scratch tab');
    } else if (command === "open") {
      const id = process.argv[3];
      console.log(await page.evaluate((value) => app.commands.executeCommandById(value), id));
      console.log(await page.locator(".modal-container").innerText());
    } else if (command === "snapshot") {
      console.log(JSON.stringify(await page.evaluate(() => ({
        modals: Array.from(document.querySelectorAll(".modal")).map((el) => ({ classes: el.className, parent: el.parentElement.className, buttons: Array.from(el.querySelectorAll("button")).map((button) => button.textContent) })),
        close: Array.from(document.querySelectorAll('[aria-label*="Close"],.modal-close-button')).map((el) => ({ html: el.outerHTML.slice(0, 500), parent: el.parentElement.className })),
      })), null, 2));
    } else if (command === "screenshot") {
      await page.screenshot({ path: process.argv[3] || "output/playwright/obsidian.png" });
    } else if (command === "math") {
      console.log(JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.ft-preview')).map((el) => ({
        html: el.innerHTML.slice(0, 8000),
        box: el.getBoundingClientRect().toJSON(),
        styles: { display: getComputedStyle(el).display, overflow: getComputedStyle(el).overflow },
        svg: Array.from(el.querySelectorAll('svg')).map((svg) => ({ viewBox: svg.getAttribute('viewBox'), width: svg.getAttribute('width'), height: svg.getAttribute('height'), box: svg.getBoundingClientRect().toJSON(), styles: {width: getComputedStyle(svg).width, height: getComputedStyle(svg).height, overflow:getComputedStyle(svg).overflow} })),
        uses: Array.from(el.querySelectorAll('use')).map((use) => { const ref=use.getAttribute('href') || use.getAttribute('xlink:href'); return {ref, exists: !!document.getElementById((ref || '').slice(1))}; }),
        chars: Array.from(el.querySelectorAll('mjx-c')).slice(0, 12).map((char) => {
          const style=getComputedStyle(char), before=getComputedStyle(char, '::before');
          return {text:char.textContent, html:char.outerHTML,box:char.getBoundingClientRect().toJSON(),styles:{height:style.height,lineHeight:style.lineHeight,padding:style.padding,overflow:style.overflow,boxSizing:style.boxSizing},before:{height:before.height,padding:before.padding,overflow:before.overflow,content:before.content,boxSizing:before.boxSizing}};
        }),
      }))), null, 2));
    } else if (command === "matrix-probe") {
      await page.evaluate(() => {
        const p = app.plugins.getPlugin('formula-library');
        window.__matrixProbe = p.openMatrixPaste();
        const m = window.__matrixProbe;
        m.textarea.value = '2 3 4\n4 5 7';
        m.envSelect.value = 'Vmatrix';
        m.refresh();
        m.modalEl.dataset.probe = 'true';
      });
      await page.locator('[data-probe] mjx-container').waitFor();
      console.log(JSON.stringify(await page.locator('[data-probe] .ft-preview').evaluate((root) => Array.from(root.querySelectorAll('mjx-container,mjx-math,mjx-mrow,mjx-mo,mjx-mtable,mjx-table,mjx-itable,mjx-stretchy-v')).map((el) => {
        const s=getComputedStyle(el);
        return {tag:el.tagName,html:el.outerHTML.slice(0,150),box:el.getBoundingClientRect().toJSON(),style:{display:s.display,boxSizing:s.boxSizing,verticalAlign:s.verticalAlign,height:s.height,lineHeight:s.lineHeight,overflow:s.overflow}};
      })), null, 2));
      await page.screenshot({path:'output/playwright/matrix-probe.png'});
      await page.evaluate(() => {window.__matrixProbe.close();delete window.__matrixProbe;});
    } else if (command === "verify-fonts") {
      fs.mkdirSync('output/playwright',{recursive:true});
      const errors=[];
      page.on('pageerror',(error)=>errors.push(error.message));
      const originalViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      await page.evaluate(async () => {
        const p=app.plugins.getPlugin('formula-library');
        window.__formulaFontStored=app.loadLocalStorage('base-font-size');
        window.__formulaFontMathLocale=window.MathfieldElement?.locale;
        window.__formulaFontOriginalLeaf=app.workspace.activeLeaf;
        window.__formulaFontLeaf=app.workspace.getLeaf(true);
        await window.__formulaFontLeaf.setViewState({type:'formula-library-sidebar'});
        const sidebar=window.__formulaFontLeaf.view;
        const m=p.openEditor();
        window.__formulaFontModal=m;
        m.modalEl.dataset.qaFont='true';
        const clone=Object.assign(Object.create(p),{
          settings:{...p.settings,locale:'en',libraryFontFollowObsidian:true,libraryFontSize:18},
          saveSettings:async()=>{},
          refreshViews:()=>{m.refreshLibrary();sidebar.refreshLocalization();sidebar.renderTabs();sidebar.renderList();},
        });
        m.plugin=clone;sidebar.plugin=clone;
        clone.refreshViews();
        const realTab=app.setting.pluginTabs.find((tab)=>tab.id==='formula-library');
        if (!realTab) throw Error('Formula Library setting tab was not registered');
        const tab=new realTab.constructor(app,clone);
        tab.containerEl=document.createElement('div');
        tab.containerEl.dataset.qaFontSettings='true';
        // Render actual Obsidian Setting controls inside this owned test dialog.
        tab.containerEl.style.cssText='position:absolute;inset:45px 20px 20px;overflow:auto;background:var(--background-primary);z-index:2;padding:12px;';
        m.modalEl.appendChild(tab.containerEl);
        await tab.display();
        window.__formulaFontTab=tab;
        app.saveLocalStorage('base-font-size',18);app.updateFontSize();
      });
      const modal=page.locator('[data-qa-font="true"]');
      const settings=modal.locator('[data-qa-font-settings]');
      await settings.getByRole('tab',{name:'Appearance',exact:true}).click();
      const follow=settings.locator('.setting-item').filter({has:page.locator('.setting-item-name',{hasText:'Follow Obsidian font size'})}).locator('.checkbox-container');
      const slider=settings.getByLabel('Formula library font size',{exact:true});
      const sizes=async()=>page.evaluate(()=>({
        label:parseFloat(getComputedStyle(window.__formulaFontModal.libraryPanel.querySelector('.fl-sym-label')).fontSize),
        source:parseFloat(getComputedStyle(window.__formulaFontModal.libraryPanel.querySelector('.fl-sym-fallback')).fontSize),
        sidebar:parseFloat(getComputedStyle(window.__formulaFontLeaf.view.listEl.querySelector('.fl-list-item-symbol')).fontSize),
        math:window.__formulaFontModal.mf?.style.fontSize,
      }));
      const screenshot=async(name)=>{
        if(process.argv.includes('--no-screenshots')) return;
        await page.screenshot({path:'output/playwright/'+name+'.png',timeout:12000});
      };
      try {
        await page.setViewportSize({width:1280,height:900});
        await modal.locator('math-field').waitFor();
        const originalMath=(await sizes()).math;
        assert.equal((await sizes()).label,18);assert.equal((await sizes()).sidebar,18);
        assert.equal(await slider.isDisabled(),true);
        await follow.click();
        assert.equal(await slider.isDisabled(),false);
        await slider.fill('22');
        await slider.dispatchEvent('input');
        await page.waitForFunction(()=>parseFloat(getComputedStyle(window.__formulaFontModal.libraryPanel.querySelector('.fl-sym-label')).fontSize)===22);
        assert.equal((await sizes()).sidebar,22);assert.equal((await sizes()).math,originalMath);
        // Reload the settings controls from the same saved settings object.
        await page.evaluate(()=>window.__formulaFontTab.display());
        assert.equal(await slider.inputValue(),'22');
        assert.equal(await slider.isDisabled(),false);
        await follow.click();
        assert.equal((await sizes()).label,18);
        await page.evaluate(()=>{app.saveLocalStorage('base-font-size',24);app.updateFontSize();});
        await page.waitForFunction(()=>parseFloat(getComputedStyle(window.__formulaFontModal.libraryPanel.querySelector('.fl-sym-label')).fontSize)===24,null,{timeout:5000});
        assert.equal((await sizes()).label,24);assert.equal((await sizes()).sidebar,24);
        assert.equal((await sizes()).math,originalMath);
        console.log('PASS actual settings controls, independent font, restored follow mode and live Appearance changes');
        await follow.click();
        await slider.fill('32');await slider.dispatchEvent('input');
        await page.waitForFunction(()=>parseFloat(getComputedStyle(window.__formulaFontModal.libraryPanel.querySelector('.fl-sym-label')).fontSize)===32);
        await page.evaluate(()=>window.__formulaFontTab.containerEl.remove());
        // Add an intentionally long choice without touching the user's library.
        await page.evaluate(()=>{
          const m=window.__formulaFontModal;
          m.libGrid.appendChild(m.makeLibBtn(['Long choice name that must remain fully readable at a large font size','x^2','Long choice name that must remain fully readable at a large font size']));
        });
        const check=async(name)=>{
          const issues=await modal.evaluate((root)=>{
            const errors=[];
            const panel=root.querySelector('.fe-library-panel');
            if(root.scrollWidth>root.clientWidth+2||panel.scrollWidth>panel.clientWidth+2)errors.push('horizontal overflow');
            for(const label of panel.querySelectorAll('.fl-sym-label')){
              if(label.scrollHeight>label.clientHeight+1)errors.push('clipped label');
              const card=label.closest('.fl-symbol-btn');
              const box=label.getBoundingClientRect(),parent=card.getBoundingClientRect();
              if(box.left<parent.left||box.right>parent.right+1||box.bottom>parent.bottom+1)errors.push('text outside card');
            }
            return errors;
          });
          assert.deepEqual(issues,[],name);await screenshot(name);console.log('PASS '+name);
        };
        await check('font-32-desktop');
        await page.setViewportSize({width:390,height:844});
        await check('font-32-portrait');
        await page.evaluate(()=>{
          const m=window.__formulaFontModal;m.plugin.settings.libraryFontFollowObsidian=true;m.plugin.refreshViews();
          app.saveLocalStorage('base-font-size',18);app.updateFontSize();
        });
        await check('font-18-portrait');
        await page.setViewportSize({width:1280,height:900});
        await check('font-18-desktop');
        assert.equal((await sizes()).label,18);assert.ok((await sizes()).source>=14);
        assert.deepEqual(errors,[],'no renderer exceptions');
      } finally {
        await page.evaluate(()=>{
          app.saveLocalStorage('base-font-size',window.__formulaFontStored);app.updateFontSize();
          window.__formulaFontModal?.close();window.__formulaFontLeaf?.detach();
          if(window.MathfieldElement && window.__formulaFontMathLocale) window.MathfieldElement.locale=window.__formulaFontMathLocale;
          if(window.__formulaFontOriginalLeaf) app.workspace.setActiveLeaf(window.__formulaFontOriginalLeaf,{focus:true});
          for(const key of ['__formulaFontStored','__formulaFontMathLocale','__formulaFontOriginalLeaf','__formulaFontLeaf','__formulaFontModal','__formulaFontTab'])delete window[key];
        });
        await page.setViewportSize(originalViewport);
      }
    } else if (command === "verify-locale") {
      fs.mkdirSync('output/playwright',{recursive:true});
      const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
      await page.evaluate(async()=>{
        const p=app.plugins.getPlugin('formula-library');
        window.__formulaLocaleOriginalLeaf=app.workspace.activeLeaf;
        window.__formulaLocaleMath=window.MathfieldElement?.locale;
        const clone=Object.assign(Object.create(p),{settings:{...p.settings,locale:'zh',drawingDraft:null},saveSettings:async()=>{},_editorModals:new Set()});
        window.__formulaLocalePlugin=clone;
        window.__formulaLocaleLeaf=app.workspace.getLeaf(true);
        await window.__formulaLocaleLeaf.setViewState({type:'formula-library-sidebar'});
        window.__formulaLocaleLeaf.view.plugin=clone;
        window.__formulaLocaleModal=clone.openEditor();
        window.__formulaLocaleModal.modalEl.dataset.qaLocale='editor';
        clone.refreshViews();
      });
      const editor=page.locator('[data-qa-locale="editor"]');
      try {
        await editor.locator('math-field').waitFor();
        await page.evaluate(()=>{window.__formulaLocalePlugin.settings.locale='en';window.__formulaLocalePlugin.refreshViews();});
        const sidebarText=await page.evaluate(()=>window.__formulaLocaleLeaf.view.containerEl.children[1].innerText);
        assert.equal(/[\u4e00-\u9fff]/.test(sidebarText),false,'all sidebar chrome should switch, not only category tabs');
        const sidebarControls=await page.evaluate(()=>Array.from(window.__formulaLocaleLeaf.view.containerEl.querySelectorAll('.fl-filter-btn')).map((button)=>button.getAttribute('aria-label')));
        assert.deepEqual(sidebarControls,['All','Favorites','Pinned','Recent','Hidden']);
        const button=await page.evaluate(()=>window.__formulaLocaleLeaf.view.openEditorButton.textContent);
        assert.equal(button,'Open Editor');
        assert.equal(/[\u4e00-\u9fff]/.test(await editor.innerText()),false,'editor buttons, status and hints should switch live');
        console.log('PASS sidebar/editor language refresh including filters, search, actions and accessibility names');
        await page.evaluate(()=>{
          window.__formulaLocaleModal.close();
          window.__formulaLocaleDiagram=window.__formulaLocalePlugin.openDrawing();
          window.__formulaLocaleDiagram.accepted=true;
          window.__formulaLocaleDiagram.modalEl.dataset.qaLocale='drawing';
        });
        const diagram=page.locator('[data-qa-locale="drawing"]');
        assert.equal(await diagram.getByRole('button',{name:'Insert diagram',exact:true}).count(),1);
        const keys=await diagram.locator('.fd-template-field option').evaluateAll((options)=>options.map((option)=>option.value));
        for(const key of keys){
          await diagram.locator('.fd-template-field select').selectOption(key);
          const source=await diagram.locator('.fd-source').inputValue();
          assert.equal(/[\u4e00-\u9fff]/.test(source),false,key+' sample should be English');
        }
        await diagram.locator('.fd-template-field select').selectOption('flowchart');
        await diagram.getByRole('button',{name:'Visual',exact:true}).click();
        assert.equal(await diagram.getByLabel('Node label',{exact:true}).first().inputValue(),'Start');
        assert.equal(await page.evaluate(()=>window.__formulaLocaleDiagram.visualGraph.nodes.find((node)=>node.id==='B').shape),'diamond');
        await diagram.locator('.fd-preview svg').waitFor();
        if(!process.argv.includes('--no-screenshots')) await page.screenshot({path:'output/playwright/english-flowchart.png',timeout:12000});
        await page.evaluate(()=>{
          window.__formulaLocaleDiagram.close();
          window.__formulaLocaleDiagram=window.__formulaLocalePlugin.openDrawing('flowchart LR\n A[用户原文] --> B[保留]');
          window.__formulaLocaleDiagram.accepted=true;
        });
        assert.equal(await page.evaluate(()=>window.__formulaLocaleDiagram.source.value),'flowchart LR\n A[用户原文] --> B[保留]');
        console.log('PASS all eleven English samples, visual labels/shapes and preservation of existing Chinese content');
        assert.deepEqual(errors,[],'no renderer exceptions');
      } finally {
        await page.evaluate(()=>{
          window.__formulaLocaleModal?.close();window.__formulaLocaleDiagram?.close();window.__formulaLocaleLeaf?.detach();
          if(window.MathfieldElement && window.__formulaLocaleMath) window.MathfieldElement.locale=window.__formulaLocaleMath;
          if(window.__formulaLocaleOriginalLeaf)app.workspace.setActiveLeaf(window.__formulaLocaleOriginalLeaf,{focus:true});
          for(const key of ['__formulaLocaleModal','__formulaLocaleMath','__formulaLocaleDiagram','__formulaLocaleLeaf','__formulaLocaleOriginalLeaf','__formulaLocalePlugin'])delete window[key];
        });
      }
    } else if (command === "verify") {
      fs.mkdirSync("output/playwright", { recursive: true });
      const errors = [];
      const captureSession = await page.context().newCDPSession(page);
      const testModal = page.locator('[data-qa-active="true"]');
      page.on("pageerror", (error) => errors.push(error.stack || error.message));
      const originalViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      const originalTheme = await page.evaluate(() => document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light');
      const originalThemeConfig = await page.evaluate(() => app.vault.getConfig('theme'));
      const theme = process.argv[3] === 'dark' ? 'theme-dark' : originalTheme;
      if (process.argv[3] === 'dark') {
        await page.evaluate(() => app.changeTheme('obsidian'));
        await page.waitForFunction(() => document.body.classList.contains('theme-dark'));
      }
      await page.evaluate(async () => {
        window.__formulaQaOriginalLeaf = app.workspace.activeLeaf;
        window.__formulaQaLocale = app.plugins.getPlugin("formula-library").settings.locale;
        app.plugins.getPlugin("formula-library").settings.locale = "zh";
        const file = app.vault.getAbstractFileByPath("Formula Library QA 1.4.0.md");
        if (!file) throw new Error("QA note was not detected by the vault");
        window.__formulaQaLeaf = app.workspace.getLeaf(true);
        await window.__formulaQaLeaf.openFile(file);
      });
      const open = async (id, selector) => {
        await page.evaluate((command) => {
          const p = app.plugins.getPlugin("formula-library");
          const methods = { "plot-function": "openFunctionPlot", "paste-matrix-data": "openMatrixPaste", "open-param-templates": "openParamTemplates", "open-editor": "openEditor", "open-mermaid-diagram": "openDrawing" };
          window.__formulaQaModal = p[methods[command]]();
          if (!window.__formulaQaModal) throw new Error("Test modal was not opened");
          window.__formulaQaModal.plugin = Object.assign(Object.create(p), { settings: { ...JSON.parse(JSON.stringify(p.settings)), rememberDrafts: false }, saveSettings: async () => {} });
          // Do not save this test diagram over the user's draft.
          if (command === "open-mermaid-diagram") window.__formulaQaModal.accepted = true;
          window.__formulaQaModal.modalEl.dataset.qaActive = "true";
        }, id);
        await page.locator(selector + '[data-qa-active="true"]').waitFor();
      };
      const close = async () => {
        await page.evaluate(() => { window.__formulaQaModal?.close(); delete window.__formulaQaModal; });
        await page.locator('[data-qa-active="true"]').waitFor({ state: "detached" });
      };
      const checkLayout = async (selector, name) => {
        const issues = await page.locator(selector + '[data-qa-active="true"]').evaluate((root) => {
          const viewport = { width: innerWidth, height: innerHeight };
          const rect = root.getBoundingClientRect();
          const problems = [];
          if (rect.left < -1 || rect.top < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1) problems.push("modal outside viewport");
          const footer = root.querySelector(".ft-footer");
          if (footer) {
            const bounds = footer.getBoundingClientRect();
            if (bounds.bottom > rect.bottom + 1 || bounds.top < rect.top) problems.push("footer clipped");
          }
          if (root.scrollWidth > root.clientWidth + 2) problems.push("horizontal overflow");
          return problems;
        });
        assert.deepEqual(issues, [], name);
        // Native Electron windows may suppress compositor frames in the
        // background. Capture their viewport directly, without font/frame waits.
        if (!process.argv.includes('--no-screenshots')) {
          const capture = await captureSession.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});
          fs.writeFileSync("output/playwright/" + (theme === 'theme-dark' ? 'dark-' : '') + name + ".png",Buffer.from(capture.data,'base64'));
        }
        console.log("PASS " + name);
      };
      try {
        await page.setViewportSize({ width: 1280, height: 900 });
        await open("plot-function", ".formula-plot-modal");
        await testModal.getByLabel("函数表达式", { exact: true }).fill("a*x^2+b");
        await testModal.getByLabel("a=2, b=-1", { exact: true }).fill("a=max(1,2), b=-1");
        await testModal.locator(".fd-preview svg").waitFor();
        assert.equal(await testModal.locator(".ft-param").count(), 0, "local constants should not also become sliders");
        await testModal.getByLabel("x 最小", { exact: true }).fill("20");
        assert.match(await testModal.locator(".ft-status").innerText(), /最大值/);
        assert.equal(await testModal.getByRole("button", { name: "插入 SVG", exact: true }).isDisabled(), true);
        await testModal.getByLabel("x 最小", { exact: true }).fill("-10");
        await testModal.locator(".fd-preview svg").waitFor();
        await checkLayout(".formula-plot-modal", "plot-desktop");
        await page.setViewportSize({ width: 390, height: 844 });
        await checkLayout(".formula-plot-modal", "plot-portrait");
        await close();

        await open("paste-matrix-data", ".formula-matrix-modal");
        await testModal.getByLabel("从粘贴数据生成矩阵", { exact: true }).fill("1\t2\n3\t4");
        await testModal.getByRole("button", { name: "增加列", exact: true }).click();
        await testModal.getByRole("button", { name: "增加行", exact: true }).click();
        assert.match(await testModal.locator(".ft-status").innerText(), /3 行 × 3 列/);
        await testModal.locator('mjx-container').waitFor();
        assert.equal(await testModal.locator('mjx-c').first().evaluate((el) => getComputedStyle(el).boxSizing), 'content-box');
        await checkLayout(".formula-matrix-modal", "matrix-portrait");
        await testModal.getByLabel("从粘贴数据生成矩阵", { exact: true }).fill("2 3 4\n4 5 7");
        await testModal.getByLabel("环境", { exact: true }).selectOption('Vmatrix');
        await testModal.getByLabel("从粘贴数据生成矩阵", { exact: true }).focus();
        const focusStyle = await testModal.locator('textarea').evaluate((el) => ({offset:getComputedStyle(el).outlineOffset, shadow:getComputedStyle(el).boxShadow}));
        assert.equal(focusStyle.offset, '-2px');
        assert.match(focusStyle.shadow, /inset/);
        await page.setViewportSize({ width: 1280, height: 900 });
        await checkLayout(".formula-matrix-modal", "matrix-desktop");
        await page.setViewportSize({ width: 390, height: 844 });
        await close();

        await open("open-param-templates", ".formula-parameter-modal");
        await testModal.getByLabel("公式模板", { exact: true }).selectOption({ label: "匀变速位移（物理）" });
        await testModal.locator('.ft-preview mjx-container').waitFor();
        await checkLayout(".formula-parameter-modal", "parameters-portrait");
        await page.setViewportSize({ width: 1280, height: 900 });
        await checkLayout(".formula-parameter-modal", "parameters-desktop");
        // Use an isolated settings object: native CRUD tests must not persist QA
        // templates or presets into the user's actual plugin configuration.
        await page.evaluate(() => {
          const m = window.__formulaQaModal;
          m.plugin = Object.assign(Object.create(m.plugin), { settings:JSON.parse(JSON.stringify(m.plugin.settings)), saveSettings:async () => {} });
          window.__formulaQaCustom = m.editTemplate(null);
          m.modalEl.dataset.qaActive = 'false';
          window.__formulaQaCustom.modalEl.dataset.qaActive = 'true';
        });
        await testModal.locator('mjx-container').waitFor();
        assert.equal(await testModal.locator('.fl-field-error').innerText(),'','an unnamed draft should still preview without a name error');
        await testModal.getByRole('button',{name:'保存',exact:true}).click();
        assert.match(await testModal.locator('.fl-field-error').innerText(),/名称/);
        await testModal.getByLabel('模板名称', {exact:true}).fill('QA 平方');
        await testModal.getByLabel('分类（可选）', {exact:true}).fill('QA');
        await testModal.getByLabel('LaTeX', {exact:true}).fill(String.raw`y = \frac{ {{a}}^{2} }{ {{b}} }`);
        await testModal.getByLabel('默认值 · a', {exact:true}).fill('-2');
        await testModal.getByLabel('默认值 · b', {exact:true}).fill('3');
        await testModal.locator('mjx-container').waitFor();
        await checkLayout('.formula-template-editor','custom-template-desktop');
        await page.setViewportSize({width:390,height:844});
        await checkLayout('.formula-template-editor','custom-template-portrait');
        await testModal.getByRole('button',{name:'保存',exact:true}).click();
        await page.locator('.formula-template-editor').waitFor({state:'detached'});
        await page.evaluate(() => {window.__formulaQaModal.modalEl.dataset.qaActive='true';delete window.__formulaQaCustom;});
        assert.match(await testModal.getByLabel('公式模板',{exact:true}).inputValue(), /^custom-/);
        await testModal.getByLabel('a',{exact:true}).fill('4');
        assert.match(await testModal.locator('.ft-latex').innerText(), /4\^\{2\}/);
        await testModal.getByRole('button',{name:'删除模板',exact:true}).click();
        await testModal.getByRole('button',{name:'再次点击确认删除',exact:true}).click();
        assert.equal(await testModal.getByLabel('公式模板',{exact:true}).inputValue(),'quadratic-roots');
        assert.equal(await testModal.getByRole('button',{name:'编辑我的模板',exact:true}).isDisabled(),true);
        console.log('PASS custom template create, substitute and delete without changing user data');
        await page.setViewportSize({ width: 390, height: 844 });
        await close();

        await open("open-editor", ".formula-library-modal");
        await testModal.locator("math-field").waitFor();
        await checkLayout(".formula-library-modal", "editor-portrait");
        await page.setViewportSize({ width: 1280, height: 900 });
        await checkLayout(".formula-library-modal", "editor-desktop");
        assert.equal(await testModal.getByRole("button", { name: "已隐藏", exact: true }).count(), 1);
        await close();

        await open("open-mermaid-diagram", ".formula-drawing-modal");
        await testModal.locator(".fd-preview svg").waitFor();
        await page.evaluate(() => {
          const m=window.__formulaQaModal;
          m.templateSelect.value='flowchart';m.templateSelect.dispatchEvent(new Event('change'));
          m.setMode('visual');
        });
        await testModal.locator('.fd-template-field select').selectOption('er');
        await testModal.locator('.fd-template-field select').selectOption('state');
        await testModal.getByRole('button',{name:'撤销',exact:true}).click();
        assert.equal(await testModal.locator('.fd-template-field select').inputValue(),'er');
        assert.equal(await testModal.getByRole('button',{name:'可视化',exact:true}).isDisabled(),true);
        assert.equal(await testModal.locator('.fd-source').isVisible(),true);
        await testModal.getByRole('button',{name:'撤销',exact:true}).click();
        assert.equal(await testModal.locator('.fd-template-field select').inputValue(),'flowchart');
        assert.equal(await testModal.locator('.fd-visual-editor').isVisible(),true);
        await testModal.getByRole('button',{name:'重做',exact:true}).click();
        assert.equal(await testModal.locator('.fd-template-field select').inputValue(),'er');
        console.log('PASS cross-template undo and redo keeps compatible mode');
        await page.waitForFunction(() => {
          const m=window.__formulaQaModal;
          const svg=m.preview.querySelector('svg');
          return !m.renderTimer && svg?.textContent.includes('USER') && svg.getBoundingClientRect().width>0;
        });
        const beforeZoom = await testModal.locator('.fd-preview svg').evaluate((el) => el.getBoundingClientRect().width);
        await testModal.getByRole('button', { name: '放大', exact: true }).click();
        await page.waitForFunction((width) => window.__formulaQaModal.preview.querySelector('svg')?.getBoundingClientRect().width > width*1.15,beforeZoom);
        const afterZoom = await testModal.locator('.fd-preview svg').evaluate((el) => el.getBoundingClientRect().width);
        assert.ok(afterZoom > beforeZoom * 1.15, 'zoom must change SVG dimensions, not just its percentage label');
        await testModal.getByRole('button', { name: '缩小', exact: true }).click();
        await page.waitForFunction((width) => {
          const current=window.__formulaQaModal.preview.querySelector('svg')?.getBoundingClientRect().width;
          return current>0 && current<width;
        },afterZoom);
        await testModal.getByRole('button', { name: '适配视图', exact: true }).click();
        await testModal.getByRole('button', { name: '重置缩放', exact: true }).click();
        await checkLayout(".formula-drawing-modal", "mermaid-desktop");
        await page.setViewportSize({ width: 390, height: 844 });
        await checkLayout(".formula-drawing-modal", "mermaid-portrait");
        await close();

        await page.evaluate(async () => {
          const p = app.plugins.getPlugin("formula-library");
          const saved = p.settings.builtinLibraryEnabled;
          try {
            p.settings.builtinLibraryEnabled = false;
            await p.reloadFormulas();
            const modal = p.openEditor();
            window.__formulaQaEmpty = modal.modalEl.querySelector(".fl-grid")?.textContent;
            modal.close();
          } finally {
            p.settings.builtinLibraryEnabled = saved;
            await p.reloadFormulas();
          }
        });
        console.log("PASS library toggle and editor refresh");
        assert.equal(errors.length, 0, errors.join("\n"));
        console.log("PASS no renderer exceptions");
      } finally {
        await page.evaluate(() => {
          const p = app.plugins.getPlugin("formula-library");
          p.settings.locale = window.__formulaQaLocale;
          window.__formulaQaLeaf?.detach();
          if (window.__formulaQaOriginalLeaf) app.workspace.setActiveLeaf(window.__formulaQaOriginalLeaf, { focus: true });
          delete window.__formulaQaOriginalLeaf;
          delete window.__formulaQaLeaf;
          delete window.__formulaQaLocale;
          window.__formulaQaModal?.close();
          window.__formulaQaCustom?.close();
          delete window.__formulaQaCustom;
          delete window.__formulaQaModal;
        });
        await page.setViewportSize(originalViewport);
        if (process.argv[3] === 'dark') await page.evaluate((value) => app.changeTheme(value || 'moonstone'),originalThemeConfig);
        await captureSession.detach();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
