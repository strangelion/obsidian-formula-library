// Isolated browser regression gate. The adapter is in-memory; no user vault is accessed.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const { build } = require('esbuild');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const obsidianStub = `
const make=(tag,opts={})=>{const el=document.createElement(tag); if(opts.cls)el.className=opts.cls; if(opts.text)el.textContent=opts.text; if(opts.value!==undefined)el.value=opts.value; for(const [key,value]of Object.entries(opts.attr||{}))el.setAttribute(key,value); return el;};
HTMLElement.prototype.createEl=function(tag,opts){const el=make(tag,opts);this.appendChild(el);return el;};
HTMLElement.prototype.createDiv=function(opts){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);};
HTMLElement.prototype.createSpan=function(opts){return this.createEl('span',opts);};
HTMLElement.prototype.empty=function(){this.replaceChildren();};
HTMLElement.prototype.setText=function(text){this.textContent=text;};
HTMLElement.prototype.addClass=function(name){this.classList.add(name);};
HTMLElement.prototype.removeClass=function(name){this.classList.remove(name);};
HTMLElement.prototype.toggleClass=function(name,value){this.classList.toggle(name,value);};
export class Modal { constructor(app){this.app=app;this.containerEl=make('div',{cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.titleEl=this.modalEl.createDiv({cls:'modal-title'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});} open(){document.body.appendChild(this.containerEl);return this.onOpen();}close(){this.onClose?.();this.containerEl.remove();} }
export class Plugin {} export class PluginSettingTab {} export class ItemView {} export class MarkdownView {} export class Component {load(){}unload(){}}
export class Notice {constructor(text){console.log(text);}} export const getLanguage=()=> 'en'; export const setIcon=(el,icon)=>el.setAttribute('data-icon',icon);
export class Menu {addItem(){return this;}addSeparator(){}showAtMouseEvent(){}showAtPosition(){}}
export const renderMath=(latex)=>{const el=make('span');el.textContent=latex;return el;}; export const finishRenderMath=()=>{};
`;
const bundleOptions = { stdin: { contents: ['core','plot','backup','ui','typography','workspace-state','formula-details'].map((name)=>`export * from './src/${name}.js';`).join('\n'), resolveDir: process.cwd() }, bundle:true,write:false,format:'iife',globalName:'qa', platform:'browser',plugins:[{name:'obsidian-stub',setup(build){build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:obsidianStub,loader:'js'}));}}]};

(async()=>{
  const bundle = (await build(bundleOptions)).outputFiles[0].text;
  const browser=await chromium.launch({executablePath:process.env.FORMULA_TEST_BROWSER_PATH || undefined,headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
    await page.setContent('<style>:root{--background-primary:#1e2026;--background-secondary:#252833;--background-modifier-border:#4b4e58;--background-modifier-hover:#303540;--interactive-accent:#d05c64;--text-normal:#e5e7eb;--text-muted:#a0a6b2;--text-error:#ff8a8a;--font-text-size:18px;--font-ui-medium:16px;--font-monospace:monospace}*{box-sizing:border-box}body{margin:0;background:#17191e;color:var(--text-normal);font-family:system-ui}button,input,select,textarea{font:inherit;background:var(--background-secondary);color:inherit;border:1px solid var(--background-modifier-border);border-radius:6px}button{cursor:pointer}.modal-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.modal-title{font-size:22px;font-weight:600;padding-bottom:16px}.modal{background:var(--background-primary);border:1px solid var(--background-modifier-border)}</style>');
    await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
    await page.addScriptTag({content:bundle});
    await page.evaluate(async()=>{
      const files=new Map();
      const adapter={exists:async(path)=>files.has(path),read:async(path)=>files.get(path),write:async(path,value)=>files.set(path,value),remove:async(path)=>files.delete(path),mkdir:async(path)=>files.set(path,''),list:async(folder)=>({files:[...files.keys()].filter((path)=>path.startsWith(folder+'/') && path.endsWith('.json'))})};
      window.p={settings:JSON.parse(JSON.stringify(qa.DEFAULT_SETTINGS)),manifest:{id:'formula-library'},app:{vault:{adapter},workspace:{getLeavesOfType:()=>[]}},saveSettings:async()=>{},reloadFormulas:async()=>qa.loadFormulas(p)};
      p.settings.locale='en';await p.reloadFormulas();
      window.m=new qa.PlotFunctionModal(p.app,p,{});m.open();
    });
    await page.locator('.ft-input-row input').first().fill('a*x^2+b');
    assert.equal(await page.locator('.ft-param').count(),2);
    await page.locator('.ft-param').first().locator('input[type=number]').first().fill('2.5');
    await page.locator('.ft-preset-bar input').fill('Quadratic QA');
    await page.locator('.ft-preset-bar button').filter({hasText:/^Save$/}).click();
    assert.equal(await page.evaluate(()=>p.settings.plotPresets[0].config.parameters.a.value),2.5);
    await page.locator('.ft-input-row input').first().fill('sin(x)');
    await page.locator('.ft-preset-bar select').selectOption('');
    await page.locator('.ft-preset-bar select').selectOption('Quadratic QA');
    assert.equal(await page.locator('.ft-input-row input').first().inputValue(),'a*x^2+b');
    await page.locator('.ft-param').first().locator('summary').click();
    await page.locator('.ft-param-range-grid').first().locator('input').last().fill('0');
    assert.equal(await page.locator('.ft-actions button').first().isDisabled(),true);
    await page.locator('.ft-param-range-grid').first().locator('input').last().fill('0.25');
    assert.equal(await page.locator('.ft-actions button').first().isDisabled(),false);

    fs.mkdirSync('output/playwright',{recursive:true});
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      const clipped=await page.locator('.formula-plot-modal').evaluate((root)=>[...root.querySelectorAll('input,select,button')].filter((el)=>el.getBoundingClientRect().width && (el.getBoundingClientRect().left<root.getBoundingClientRect().left-1 || el.getBoundingClientRect().right>root.getBoundingClientRect().right+1)).map((el)=>el.outerHTML.slice(0,100)));
      assert.deepEqual(clipped,[],`plot controls clipped at ${width}px`);
      await page.screenshot({path:`output/playwright/workspace-plot-${width}.png`});
    }
    await page.evaluate(()=>{m.close();m=new qa.PlotFunctionModal(p.app,p,{});m.open();});
    await page.getByRole('button',{name:'Restore draft',exact:true}).click();
    assert.equal(await page.locator('.ft-input-row input').first().inputValue(),'a*x^2+b');
    await page.evaluate(()=>{m.close();m=new qa.WorkspaceBackupModal(p.app,p);m.open();});
    assert.equal(await page.getByRole('button',{name:'Confirm restore',exact:true}).isDisabled(),true);
    await page.locator('.fl-import-textarea').fill('{bad json');
    await page.getByRole('button',{name:'Validate and preview',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Confirm restore',exact:true}).isDisabled(),true);
    const backup=await page.evaluate(()=>qa.buildWorkspaceBackup(p));
    await page.locator('.fl-import-textarea').fill(backup);
    await page.getByRole('button',{name:'Validate and preview',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Confirm restore',exact:true}).isDisabled(),false);
    await page.getByRole('button',{name:'Confirm restore',exact:true}).click();
    await page.getByText('Restored; unmatched existing content was kept',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Confirm restore',exact:true}).isDisabled(),true);
    await page.screenshot({path:'output/playwright/workspace-backup-390.png'});

    await page.evaluate(()=>{
      m.close(); const root=document.body.createDiv({cls:'formula-library-sidebar'});root.style.width='300px';
      window.search=root.createEl('input',{attr:{placeholder:'Search'}});window.list=root.createDiv({cls:'fl-list'});
      window.inserted=0; for(let i=0;i<3;i++){const item=list.createEl('button',{cls:'fl-list-item',text:'Formula '+i});item.addEventListener('click',()=>inserted++);}
      qa.wireSearchNavigation(search,list,'.fl-list-item');
      window.star=list.children[0].createSpan({attr:{role:'button',tabindex:'0'}});star.textContent='Favorite';qa.keyboardButton(star);window.favorites=0;star.addEventListener('click',(event)=>{event.stopPropagation();favorites++;});
    });
    await page.locator('.formula-library-sidebar input').fill('formula');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.fl-keyboard-active').innerText(),'Formula 1');
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>inserted),1);
    await page.getByRole('button',{name:'Favorite',exact:true}).focus();await page.keyboard.press('Space');
    assert.equal(await page.evaluate(()=>favorites),1);assert.equal(await page.evaluate(()=>inserted),1);
    const heights=await page.evaluate(()=>{
      const root=document.querySelector('.formula-library-sidebar'); const card=root.querySelector('.fl-list-item');
      return ['compact','comfortable','spacious'].map((libraryDensity)=>{qa.applyLibraryTypography(root,{libraryDensity,libraryFontFollowObsidian:false,libraryFontSize:18});const style=getComputedStyle(card);return {height:card.getBoundingClientRect().height,min:style.minHeight,font:style.getPropertyValue('--fl-library-font-size'),density:style.getPropertyValue('--fl-density-height')};});
    });
    assert.ok(heights[0].height<heights[1].height && heights[1].height<heights[2].height,JSON.stringify(heights));
    assert.deepEqual(errors,[]);
    console.log('PASS isolated browser: plot preset/range/draft, backup validation/restore, 1280/390px control bounds, keyboard actions and density');
  } finally {await browser.close();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
