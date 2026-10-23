const test = require('node:test');
const assert = require('node:assert');
const { MESSAGES, getExtension, readFile } = require('../js/fileReader.js');

test('getExtension', () => {
  assert.strictEqual(getExtension('NOTES.TXT'), '.txt');
  assert.strictEqual(getExtension('report.txt.pdf'), '.pdf');
  assert.strictEqual(getExtension('noext'), '');
});
test('reads .txt regardless of extension case', async () => {
  assert.strictEqual(await readFile(new File(['He left.'], 'A.TXT')), 'He left.');
});
test('unsupported formats are rejected', async () => {
  for (const n of ['a.rtf', 'a.doc', 'noext'])
    await assert.rejects(readFile(new File(['x'], n)), { message: MESSAGES.UNSUPPORTED });
});
test('empty and whitespace-only files are rejected', async () => {
  await assert.rejects(readFile(new File([''], 'e.txt')), { message: MESSAGES.EMPTY });
  await assert.rejects(readFile(new File([' \r\n\t'], 'w.txt')), { message: MESSAGES.EMPTY });
});
test('parser failures become UNREADABLE', async () => {
  globalThis.mammoth = { extractRawText: () => Promise.reject(new Error('bad zip')) };
  await assert.rejects(readFile(new File(['x'], 'a.docx')), { message: MESSAGES.UNREADABLE });
  globalThis.pdfjsLib = { getDocument: () => ({ promise: Promise.reject(new Error('bad pdf')) }) };
  await assert.rejects(readFile(new File(['x'], 'a.pdf')), { message: MESSAGES.UNREADABLE });
});
test('docx text comes from mammoth', async () => {
  globalThis.mammoth = { extractRawText: async () => ({ value: 'The chairman' }) };
  assert.strictEqual(await readFile(new File(['x'], 'a.docx')), 'The chairman');
});
