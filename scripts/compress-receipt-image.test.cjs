const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the browser helper with controlled canvas/decoder boundaries, without
// adding a test framework or requiring a DOM in Node.
const source = fs.readFileSync(require.resolve('../lib/client/compress-receipt-image.ts'), 'utf8');
const exportsObject = {};
const context = vm.createContext({ exports: exportsObject, File, Blob });
vm.runInContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { compressReceiptImage } = exportsObject;
const original = () => new File([new Uint8Array(2 * 1024 * 1024)], 'receipt.JPG', {
  type: 'image/jpeg', lastModified: 1234,
});

function browser({ width = 1800, height = 6000, size = 400_000, type = 'image/webp', onEncode } = {}) {
  const state = { closed: false, encoded: false };
  context.createImageBitmap = async () => ({ width, height, close() { state.closed = true; } });
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob(callback, mime, quality) {
      state.encoded = true;
      state.dimensions = [canvas.width, canvas.height];
      assert.equal(mime, 'image/webp');
      assert.equal(quality, 0.85);
      onEncode?.();
      callback(size === null ? null : new Blob([new Uint8Array(size)], { type }));
    },
  };
  context.document = { createElement: () => canvas };
  state.canvas = canvas;
  return state;
}

afterEach(() => {
  delete context.createImageBitmap;
  delete context.document;
});

test('compresses large photos without downscaling long receipts; releases resources', async () => {
  const state = browser();
  const result = await compressReceiptImage(original());
  assert.equal(result.type, 'image/webp');
  assert.equal(result.name, 'receipt.webp');
  assert.equal(result.size, 400_000);
  assert.equal(result.lastModified, 1234);
  assert.deepEqual(state.dimensions, [1800, 6000]);
  assert.equal(state.closed, true);
  assert.equal(state.canvas.width, 0);
});

test('keeps original when savings are too small, encoder fails, or WebP is unsupported', async () => {
  for (const options of [{ size: 2_000_000 }, { size: 0 }, { size: null }, { type: 'image/png' }]) {
    const state = browser(options);
    const file = original();
    assert.equal(await compressReceiptImage(file), file);
    assert.equal(state.closed, true);
  }
});

test('preserves small files and unsupported formats without decoding', async () => {
  context.createImageBitmap = () => { throw new Error('Should not decode'); };
  for (const file of [
    new File(['small'], 'small.jpg', { type: 'image/jpeg' }),
    new File([original()], 'photo.heic', { type: 'image/heic' }),
    new File([original()], 'animation.gif', { type: 'image/gif' }),
    new File([original()], 'photo.webp', { type: 'image/webp' }),
  ]) assert.equal(await compressReceiptImage(file), file);
});

test('preserves original if decoder or canvas is unavailable', async () => {
  const file = original();
  assert.equal(await compressReceiptImage(file), file);
  context.createImageBitmap = async () => { throw new Error('Cannot decode'); };
  assert.equal(await compressReceiptImage(file), file);
  const state = browser();
  state.canvas.getContext = () => null;
  assert.equal(await compressReceiptImage(file), file);
  assert.equal(state.closed, true);
});

test('avoids excessive canvas memory without downscaling the original', async () => {
  const state = browser({ width: 6000, height: 6000 });
  const file = original();
  assert.equal(await compressReceiptImage(file), file);
  assert.equal(state.encoded, false);
  assert.equal(state.closed, true);
});

test('cancellation before decode and during encoding prevents an upload', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(compressReceiptImage(original(), controller.signal), { name: 'AbortError' });
  const during = new AbortController();
  const state = browser({ onEncode: () => during.abort() });
  await assert.rejects(compressReceiptImage(original(), during.signal), { name: 'AbortError' });
  assert.equal(state.closed, true);
  assert.equal(state.canvas.width, 0);
});
