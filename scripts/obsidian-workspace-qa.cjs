// Native Obsidian check with owned dialogs, cloned settings and a scratch editor.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async()=>{
  const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
  const page=browser.contexts().flatMap((context)=>context.pages()).find((entry)=>entry.url().startsWith('app://obsidian'));
  if(!page)throw Error('Obsidian page not available');
  const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
  const originalViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const noScreenshots=process.argv.includes('--no-screenshots');
  fs.mkdirSync('output/playwright',{recursive:true});
  const modal=page.locator('[data-workspace-qa="true"]');
  const capture=async(name)=>{if(!noScreenshots)await page.screenshot({path:'output/playwright/native-'+name+'.png',timeout:12000});};
  try {
    await page.evaluate(()=>{
      const real=app.plugins.getPlugin('formula-library');
      window.__wsQaOriginalSettings=JSON.stringify(real.settings);
      window.__wsQaMathLocale=window.MathfieldElement?.locale;
      const editor={text:'',getValue(){return this.text;},getCursor:()=>({line:0,ch:0}),posToOffset:(pos)=>pos.ch,offsetToPos:(offset)=>({line:0,ch:offset}),replaceRange(text,start,end){this.text=this.text.slice(0,start.ch)+text+this.text.slice(end?.ch ?? start.ch);},setCursor(){},setSelection(){},focus(){}};
      window.__wsQaEditor=editor;
      window.__wsQaPlugin=Object.assign(Object.create(real),{settings:{...JSON.parse(JSON.stringify(real.settings)),locale:'zh',formulaDraft:null,plotDraft:null,plotPresets:[]},saveSettings:async()=>{},findMarkdownEditor:()=>editor});
      window.__wsQaModal=__wsQaPlugin.openWorkspaceBackup();__wsQaModal.modalEl.dataset.workspaceQa='true';
    });
    const backup={format:'formula-library-workspace',version:1,groups:[],settings:{favorites:['x^2']}};
    await modal.getByLabel('备份内容',{exact:true}).fill(JSON.stringify(backup));
    await modal.getByRole('button',{name:'检查并预览',exact:true}).click();
    assert.equal(await modal.getByRole('button',{name:'确认恢复',exact:true}).isDisabled(),false);
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      const overflow=await modal.evaluate((el)=>el.scrollWidth>el.clientWidth+2 || el.getBoundingClientRect().right>innerWidth+1 || el.getBoundingClientRect().left<0);
      assert.equal(overflow,false);await capture('backup-'+width);
    }
    await page.evaluate(()=>{
      __wsQaModal.close();__wsQaModal=__wsQaPlugin.openFunctionPlot();__wsQaModal.modalEl.dataset.workspaceQa='true';
    });
    await modal.getByLabel('函数表达式',{exact:true}).fill('a*x^2+b');
    await modal.locator('.ft-param').first().locator('input[type=number]').first().fill('2.5');
    await modal.getByLabel('预设名称',{exact:true}).fill('Workspace QA');
    await modal.locator('.ft-preset-bar').getByRole('button',{name:'保存',exact:true}).click();
    assert.equal(await page.evaluate(()=>__wsQaPlugin.settings.plotPresets[0].config.parameters.a.value),2.5);
    await modal.locator('.ft-param').first().locator('summary').click();
    await modal.locator('.ft-param-range-grid').first().locator('input').last().fill('0');
    assert.equal(await modal.getByRole('button',{name:'插入 SVG',exact:true}).isDisabled(),true);
    await modal.locator('.ft-param-range-grid').first().locator('input').last().fill('0.25');
    await modal.locator('.fd-preview svg').waitFor();
    await capture('plot-390');
    await page.evaluate(()=>{__wsQaModal.close();__wsQaModal=__wsQaPlugin.openFunctionPlot();__wsQaModal.modalEl.dataset.workspaceQa='true';});
    await modal.getByRole('button',{name:'恢复草稿',exact:true}).click();
    assert.equal(await modal.getByLabel('函数表达式',{exact:true}).inputValue(),'a*x^2+b');
    await modal.getByRole('button',{name:'插入 SVG',exact:true}).click();
    assert.match(await page.evaluate(()=>__wsQaEditor.text),/formula-library-plot:/);
    assert.equal(await page.evaluate(()=>__wsQaPlugin.settings.plotDraft),null);

    await page.evaluate(()=>{__wsQaModal=__wsQaPlugin.openEditor('insert');__wsQaModal.modalEl.dataset.workspaceQa='true';});
    await modal.locator('math-field').waitFor();
    await page.waitForFunction(()=>!!__wsQaModal.ta);
    await modal.getByRole('button',{name:'源码',exact:true}).click();
    await modal.locator('.fe-source-pane textarea').fill(String.raw`\frac{x^2}{2}`);
    await page.evaluate(()=>{__wsQaModal.close();__wsQaModal=__wsQaPlugin.openEditor('insert');__wsQaModal.modalEl.dataset.workspaceQa='true';});
    await modal.getByRole('button',{name:'恢复草稿',exact:true}).waitFor();
    await modal.getByRole('button',{name:'恢复草稿',exact:true}).click();
    assert.equal(await modal.locator('.fe-source-pane textarea').inputValue(),String.raw`\frac{x^2}{2}`);
    const search=modal.locator('.fl-search-input');await search.fill('frac');await search.press('ArrowDown');
    assert.equal(await modal.locator('.fl-keyboard-active').count(),1);
    await search.press('Enter');assert.equal(await modal.locator('.fl-keyboard-active').count(),0);
    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(async()=>{
      __wsQaModal.close();__wsQaModal=__wsQaPlugin.openWorkspaceBackup();__wsQaModal.modalEl.dataset.workspaceQa='true';
      __wsQaModal.contentEl.empty();__wsQaModal.titleEl.setText('Settings QA');
      const realTab=app.setting.pluginTabs.find((tab)=>tab.id==='formula-library');
      const tab=new realTab.constructor(app,__wsQaPlugin);tab.containerEl=__wsQaModal.contentEl;await tab.display();window.__wsQaTab=tab;
    });
    await modal.getByRole('tab',{name:'公式库',exact:true}).click();
    const status=modal.locator('.fl-library-status');await status.scrollIntoViewIfNeeded();
    assert.match(await status.innerText(),/内置数据（无需额外文件夹）/);
    const aligned=await modal.locator('.fl-settings-sources').evaluate((root)=>{
      const heading=root.querySelector('h3'),desc=root.querySelector('.fl-settings-section-description'),status=root.querySelector('.fl-library-status');
      return Math.abs(heading.getBoundingClientRect().left-desc.getBoundingClientRect().left)<1 && Math.abs(desc.getBoundingClientRect().left-status.getBoundingClientRect().left)<1 && parseFloat(getComputedStyle(desc).marginBottom)>=12;
    });
    assert.equal(aligned,true);await capture('settings-1280');
    await page.setViewportSize({width:390,height:900});await status.scrollIntoViewIfNeeded();
    assert.equal(await status.evaluate((el)=>el.scrollWidth>el.clientWidth+2),false);await capture('settings-390');
    assert.equal(await page.evaluate(()=>JSON.stringify(app.plugins.getPlugin('formula-library').settings)===__wsQaOriginalSettings),true,'user settings must remain unchanged');
    assert.deepEqual(errors,[]);
    console.log('PASS native Obsidian: backup preview/layout, plot presets/ranges/draft/metadata insertion, formula draft recovery, keyboard navigation and source-settings alignment; user settings unchanged');
  } finally {
    await page.evaluate(()=>{
      __wsQaModal?.close();
      if(window.MathfieldElement && __wsQaMathLocale)window.MathfieldElement.locale=__wsQaMathLocale;
      for(const key of ['__wsQaModal','__wsQaTab','__wsQaPlugin','__wsQaEditor','__wsQaOriginalSettings','__wsQaMathLocale'])delete window[key];
    });
    await page.setViewportSize(originalViewport);await browser.close();
  }
})().catch((error)=>{console.error(error.stack);process.exitCode=1;});
