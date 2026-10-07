// Browser-only selector check: no access to Obsidian or a user's vault.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.FORMULA_TEST_BROWSER_PATH || undefined,headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="formula-library-modal"><input><mjx-container jax="CHTML"><mjx-math><mjx-c>x</mjx-c></mjx-math></mjx-container></div><div class="formula-custom-modal"><mjx-container jax="SVG"><svg><g></g></svg></mjx-container></div>');
    await page.addStyleTag({content:'.formula-library-modal *, .formula-custom-modal * {box-sizing:border-box;}'});
    await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
    // Compare in-page identities, not serialized DOM objects.
    assert.equal(await page.evaluate(()=>{
      const old=Array.from(document.querySelectorAll('.formula-library-modal mjx-container, .formula-library-modal mjx-container *, .formula-custom-modal mjx-container, .formula-custom-modal mjx-container *'));
      const current=Array.from(document.querySelectorAll('.formula-library-modal [jax], .formula-library-modal [jax] *, .formula-custom-modal [jax], .formula-custom-modal [jax] *'));
      return old.length===current.length && old.every((node,index)=>node===current[index]) && current.every((node)=>getComputedStyle(node).boxSizing==='content-box');
    }),true,'both renderer modes must retain the same content-box scope');
    assert.equal(await page.locator('input').evaluate((node)=>getComputedStyle(node).boxSizing),'border-box');
    console.log('PASS MathJax CHTML/SVG selector equivalence and content-box protection; native controls remain border-box');
  } finally {await browser.close();}
})().catch((error)=>{console.error(error.message);process.exitCode=1;});
