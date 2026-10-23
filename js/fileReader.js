(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DocReader = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MESSAGES = {
    UNSUPPORTED: 'Unsupported file format. Please upload a .txt, .docx, or .pdf file.',
    EMPTY: 'The file is empty. Please upload a file that contains text.',
    UNREADABLE: 'The file could not be read. It may be damaged or password-protected.',
    NO_TERMS: 'No predefined gender-specific terms were detected.',
  };

  function getExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot).toLowerCase();
  }

  async function readDocx(file) {
    const result = await globalThis.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }

  async function readPdf(file) {
    const pdf = await globalThis.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n');
  }

  async function readFile(file) {
    const ext = getExtension(file.name);
    if (ext !== '.txt' && ext !== '.docx' && ext !== '.pdf') throw new Error(MESSAGES.UNSUPPORTED);
    if (file.size === 0) throw new Error(MESSAGES.EMPTY);
    let text;
    try {
      if (ext === '.txt') text = await file.text();
      else if (ext === '.docx') text = await readDocx(file);
      else text = await readPdf(file);
    } catch (err) {
      throw new Error(MESSAGES.UNREADABLE);
    }
    if (text.trim() === '') throw new Error(MESSAGES.EMPTY);
    return text;
  }

  return { MESSAGES, getExtension, readFile };
});
