// Execute the exact vendored binary, not a mocked converter or another checkout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const vendor = path.resolve(__dirname, '../vendor/core');
const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
const initialized = (async () => {
  const glue = fs.readFileSync(path.join(vendor, 'latexsnipper_wasm.js'));
  const bytes = fs.readFileSync(path.join(vendor, 'latexsnipper_wasm_bg.wasm'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files['latexsnipper_wasm_bg.wasm']);
  assert.equal(createHash('sha256').update(glue).digest('hex'), manifest.files['latexsnipper_wasm.js']);
  const core = await import('data:text/javascript;base64,' + glue.toString('base64'));
  await core.default({ module_or_path: bytes });
  return core;
})();

test('pinned WASM preserves Typst adjacent operands and nested calls', async () => {
  const core = await initialized;
  for (const [source, expected] of [
    ['frac(a+b,c)+z', '\\frac{a+b}{c}+z'],
    ['frac(a,b)+sqrt(x)+z', '\\frac{a}{b}+\\sqrt{x}+z'],
    ['frac(frac(a,b),root(3,x))+z', '\\frac{\\frac{a}{b}}{\\sqrt[3]{x}}+z'],
  ]) {
    const result = core.convert_formula_fragment_v3(source, 'typst', 'best-effort');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.contentKind, 'latex-fragment');
    assert.equal(result.data.content.trim(), expected);
  }
});

test('pinned WASM preserves explicit min/max limit placement', async () => {
  const core = await initialized;
  for (const operator of ['min', 'max']) for (const [modifier, tag] of [['limits', 'munderover'], ['nolimits', 'msubsup']]) {
    const source = `\\${operator}\\${modifier}_{i}^{n}`;
    const result = core.convert_formula_v3(source, 'latex', 'mathml', 'best-effort');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(result.data.content.includes(`<${tag}>`), result.data.content);
    assert.ok(!result.data.content.includes('\\'), result.data.content);
  }
});

test('pinned WASM keeps middle delimiters structural rather than literal commands', async () => {
  const core = await initialized;
  const result = core.convert_formula_v3('\\left(a\\middle|b\\right)', 'latex', 'mathml', 'best-effort');
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(!result.data.content.includes('\\middle'), result.data.content);
  assert.match(result.data.content, /separator="true"/);
  for (const token of ['>a<', '>b<', '>|<']) assert.ok(result.data.content.includes(token), result.data.content);
});

test('pinned WASM preserves every OMML run in a bounded formula fragment', async () => {
  const core = await initialized;
  for (const source of ['<r><t>x</t></r><r><t>y</t></r>', '<oMath><r><t>x</t></r><r><t>y</t></r></oMath>']) {
    const result = core.convert_formula_fragment_v3(source, 'omml', 'best-effort');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.content, 'xy');
  }
});

test('pinned WASM imports and exports both bounded linear formats', async () => {
  const core = await initialized;
  for (const format of ['ascii-math', 'unicode-math']) {
    const imported = core.convert_formula_fragment_v3('(a+b)/c', format, 'best-effort');
    assert.equal(imported.ok, true, JSON.stringify(imported));
    assert.equal(imported.data.content.trim(), '\\frac{a+b}{c}');
    const exported = core.convert_formula_v3('\\frac{a+b}{c}', 'latex', format, 'best-effort');
    assert.equal(exported.ok, true, JSON.stringify(exported));
    assert.equal(exported.data.capability.output, format);
    const readback = core.convert_formula_fragment_v3(exported.data.content, format, 'best-effort');
    assert.equal(readback.ok, true, JSON.stringify(readback));
    // AsciiMath canonical output retains an explicit grouping node and spacing.
    assert.equal(readback.data.content.trim(), format === 'ascii-math' ? '\\frac{{a + b}}{c}' : '\\frac{a+b}{c}');
  }
});

test('pinned WASM rejects unsupported linear syntax and keeps MTEF unavailable', async () => {
  const core = await initialized;
  for (const [format, content] of [['ascii-math', 'a nnn b'], ['unicode-math', 'a⁄b']]) {
    const result = core.convert_formula_fragment_v3(content, format, 'best-effort');
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.ok(result.error?.code);
  }
  const mtef = core.formula_capabilities_v3().data.filter(row => row.input === 'mtef');
  assert.ok(mtef.length > 0);
  assert.ok(mtef.every(row => row.available === false));
});
