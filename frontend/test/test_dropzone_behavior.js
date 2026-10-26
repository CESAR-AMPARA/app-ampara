const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const jsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/main.js'), 'utf-8');

const PAGES = [
  { page: 'cadastro_turma', kind: 'turma', url: '/api/turmas/import', singular: 'turma cadastrada', plural: 'turmas cadastradas' },
  { page: 'cadastro_estudante', kind: 'estudante', url: '/api/estudantes/import', singular: 'estudante cadastrado', plural: 'estudantes cadastrados' }
];

function setupDOM(page, responses) {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/' + page + '.html'), 'utf-8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + page,
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.localStorage.setItem('token', 'jwt_gestor');
  window.fetchCalls = [];
  window.fetch = async (url, options) => {
    window.fetchCalls.push({ url: url, options: options || {} });
    // The class list request on the student page is not part of these tests.
    if (url === '/api/turmas' && !(options && options.method)) {
      return { status: 200, json: async () => ({ turmas: [{ id: 1, nome: '1º Ano A' }] }) };
    }
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { status: next.status, json: async () => next.body };
  };

  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = jsContent;
  window.document.body.appendChild(scriptEl);
  return window;
}

function settle() {
  return new Promise(resolve => setTimeout(resolve, 20));
}

function makeFile(window, name, size) {
  return new window.File(['x'.repeat(size)], name);
}

function drop(window, kind, file) {
  const zone = window.document.getElementById('drop-zone-' + kind);
  const event = new window.Event('drop', { bubbles: true, cancelable: true });
  event.dataTransfer = { files: [file] };
  zone.dispatchEvent(event);
}

function pick(window, kind, file) {
  const input = window.document.getElementById('file-input-' + kind);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change'));
}

function importCalls(window) {
  return window.fetchCalls.filter(c => c.url.endsWith('/import'));
}

for (const { page, kind, url, singular, plural } of PAGES) {
  test(`${page}: dragover highlights the drop zone and dragleave clears it`, () => {
    const window = setupDOM(page, []);
    const zone = window.document.getElementById('drop-zone-' + kind);

    const over = new window.Event('dragover', { bubbles: true, cancelable: true });
    zone.dispatchEvent(over);
    assert.strictEqual(zone.classList.contains('dragover'), true);
    assert.strictEqual(over.defaultPrevented, true);

    zone.dispatchEvent(new window.Event('dragleave', { bubbles: true }));
    assert.strictEqual(zone.classList.contains('dragover'), false);
  });

  test(`${page}: dropping a CSV enables the import button`, () => {
    const window = setupDOM(page, []);
    const document = window.document;

    drop(window, kind, makeFile(window, 'lista.csv', 2048));

    assert.strictEqual(document.getElementById('btn-importar-' + kind).disabled, false);
    assert.strictEqual(document.getElementById('file-name-' + kind).textContent, 'lista.csv (2.0 KB)');
    assert.strictEqual(document.getElementById('drop-zone-' + kind).classList.contains('dragover'), false);
  });

  test(`${page}: selecting an .xlsx file enables the import button`, () => {
    const window = setupDOM(page, []);

    pick(window, kind, makeFile(window, 'Lista.XLSX', 10));

    assert.strictEqual(window.document.getElementById('btn-importar-' + kind).disabled, false);
  });

  test(`${page}: unsupported format keeps the import button disabled`, () => {
    const window = setupDOM(page, []);
    const document = window.document;

    drop(window, kind, makeFile(window, 'lista.csv', 10));
    drop(window, kind, makeFile(window, 'lista.pdf', 10));

    assert.strictEqual(document.getElementById('btn-importar-' + kind).disabled, true);
    assert.strictEqual(document.getElementById('file-info-' + kind).style.display, 'none');
  });

  test(`${page}: file over 5MB keeps the import button disabled`, () => {
    const window = setupDOM(page, []);

    drop(window, kind, makeFile(window, 'lista.csv', 5 * 1024 * 1024 + 1));

    assert.strictEqual(window.document.getElementById('btn-importar-' + kind).disabled, true);
  });

  test(`${page}: import uploads the file and lists the skipped lines`, async () => {
    const window = setupDOM(page, [{
      status: 200,
      body: { sucesso: true, mensagem: 'Planilha importada com sucesso.', importados: 120, erros: [{ linha: 4, motivo: 'Matrícula 2026.01.0001 já cadastrada.' }] }
    }]);
    const document = window.document;
    const file = makeFile(window, 'lista.csv', 64);

    drop(window, kind, file);
    document.getElementById('btn-importar-' + kind).click();
    assert.strictEqual(document.getElementById('progress-container-' + kind).style.display, 'block');
    await settle();

    const [call] = importCalls(window);
    assert.strictEqual(call.url, url);
    assert.strictEqual(call.options.method, 'POST');
    assert.deepStrictEqual({ ...call.options.headers }, { Authorization: 'Bearer jwt_gestor' });
    assert.strictEqual(call.options.body.get('file').name, 'lista.csv');

    const summary = document.getElementById('import-summary-' + kind);
    assert.strictEqual(summary.classList.contains('hidden'), false);
    assert.strictEqual(summary.querySelector('p').textContent, `Importação concluída: 120 ${plural} com sucesso. 1 registro ignorado.`);
    assert.deepStrictEqual([...summary.querySelectorAll('li')].map(li => li.textContent), ['Linha 4: Matrícula 2026.01.0001 já cadastrada.']);
    assert.strictEqual(document.getElementById('progress-fill-' + kind).style.width, '100%');
    assert.strictEqual(document.getElementById('btn-importar-' + kind).disabled, true);
  });

  test(`${page}: single imported row uses the singular label`, async () => {
    const window = setupDOM(page, [{ status: 200, body: { sucesso: true, importados: 1, erros: [] } }]);
    const document = window.document;

    drop(window, kind, makeFile(window, 'lista.csv', 64));
    document.getElementById('btn-importar-' + kind).click();
    await settle();

    const summary = document.getElementById('import-summary-' + kind);
    assert.strictEqual(summary.querySelector('p').textContent, `Importação concluída: 1 ${singular} com sucesso.`);
    assert.strictEqual(summary.querySelector('ul'), null);
  });

  test(`${page}: rejected upload resets the progress and allows a retry`, async () => {
    const window = setupDOM(page, [{
      status: 400,
      body: { sucesso: false, mensagem: 'Erro: Formato de arquivo não suportado. Use apenas planilhas CSV ou Excel.' }
    }]);
    const document = window.document;

    drop(window, kind, makeFile(window, 'lista.csv', 64));
    document.getElementById('btn-importar-' + kind).click();
    await settle();

    assert.strictEqual(document.getElementById('progress-container-' + kind).style.display, 'none');
    assert.strictEqual(document.getElementById('import-summary-' + kind).classList.contains('hidden'), true);
    assert.strictEqual(document.getElementById('btn-importar-' + kind).disabled, false);
  });
}
