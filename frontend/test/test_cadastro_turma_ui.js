const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../public/cadastro_turma.html'), 'utf-8');
// jsdom cannot navigate, so redirects are captured in window.__mock_location_href.
const jsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/main.js'), 'utf-8')
  .replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

function setupDOM(responses) {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/cadastro_turma',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.localStorage.setItem('token', 'jwt_gestor');
  window.fetchCalls = [];
  window.fetch = async (url, options) => {
    window.fetchCalls.push({ url: url, headers: { ...options.headers }, body: JSON.parse(options.body) });
    const next = responses.shift();
    return { status: next.status, json: async () => next.body };
  };
  window.toasts = [];

  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = jsContent;
  window.document.body.appendChild(scriptEl);
  // Capture toasts without touching the shared toast implementation.
  new window.MutationObserver(() => {
    const el = window.document.querySelector('[role="status"][style]');
    if (el && el.textContent) window.toasts.push(el.textContent);
  }).observe(window.document.body, { childList: true, subtree: true, characterData: true });
  return window;
}

function settle() {
  return new Promise(resolve => setTimeout(resolve, 20));
}

function submit(window) {
  window.document.getElementById('form-cadastro-turma').dispatchEvent(
    new window.Event('submit', { cancelable: true, bubbles: true })
  );
  return settle();
}

test('empty fields trigger browser validation and block the request', async () => {
  const window = setupDOM([]);
  const document = window.document;
  const invalid = [];
  document.getElementById('form-cadastro-turma').addEventListener('invalid', e => invalid.push(e.target.id), true);

  document.getElementById('nome-turma').value = '   ';
  await submit(window);

  assert.deepStrictEqual([...new Set(invalid)], ['nome-turma', 'turno-turma']);
  assert.strictEqual(window.fetchCalls.length, 0);
});

test('valid class is sent with the bearer token and the form is cleared', async () => {
  const window = setupDOM([{ status: 201, body: { sucesso: true, mensagem: 'Turma cadastrada com sucesso.', id: 1 } }]);
  const document = window.document;

  document.getElementById('nome-turma').value = ' 1º Ano A ';
  document.getElementById('turno-turma').value = 'matutino';
  await submit(window);

  assert.deepStrictEqual(window.fetchCalls[0], {
    url: '/api/turmas',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt_gestor' },
    body: { nome: '1º Ano A', turno: 'matutino' }
  });
  assert.ok(window.toasts.includes('Turma cadastrada com sucesso!'));
  assert.strictEqual(document.getElementById('nome-turma').value, '');
  assert.strictEqual(document.getElementById('turno-turma').value, '');
});

test('duplicate class shows the backend message and keeps the data', async () => {
  const window = setupDOM([{ status: 400, body: { sucesso: false, mensagem: 'Turma já cadastrada.' } }]);
  const document = window.document;

  document.getElementById('nome-turma').value = '1º Ano A';
  document.getElementById('turno-turma').value = 'matutino';
  await submit(window);

  assert.ok(window.toasts.includes('Turma já cadastrada.'));
  assert.strictEqual(document.getElementById('nome-turma').value, '1º Ano A');
  assert.strictEqual(document.querySelector('#form-cadastro-turma button[type="submit"]').disabled, false);
});

test('expired session redirects to the login page', async () => {
  const window = setupDOM([{ status: 401, body: {} }]);
  const document = window.document;

  document.getElementById('nome-turma').value = '1º Ano A';
  document.getElementById('turno-turma').value = 'matutino';
  await submit(window);

  assert.strictEqual(window.__mock_location_href, '/login');
});

test('tabs switch between manual registration and batch import', () => {
  const window = setupDOM([]);
  const document = window.document;

  document.getElementById('tab-lote').click();

  assert.strictEqual(document.getElementById('tab-lote').getAttribute('aria-selected'), 'true');
  assert.strictEqual(document.getElementById('tab-manual').getAttribute('aria-selected'), 'false');
  assert.strictEqual(document.getElementById('panel-lote').classList.contains('active'), true);
  assert.strictEqual(document.getElementById('panel-manual').classList.contains('active'), false);
});
