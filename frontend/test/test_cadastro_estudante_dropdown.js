const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync(path.resolve(__dirname, '../public/cadastro_estudante.html'), 'utf-8');
// jsdom cannot navigate, so redirects are captured in window.__mock_location_href.
const jsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/main.js'), 'utf-8')
  .replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

const TURMAS = {
  status: 200,
  body: {
    turmas: [
      { id: 1, nome: '1º Ano A', turno: 'matutino', total_estudantes: 34 },
      { id: 2, nome: '2º Ano B', turno: 'vespertino', total_estudantes: 0 }
    ]
  }
};

function setupDOM(responses) {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/cadastro_estudante',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.localStorage.setItem('token', 'jwt_gestor');
  window.fetchCalls = [];
  window.fetch = async (url, options) => {
    window.fetchCalls.push({ url: url, method: options.method, headers: { ...options.headers }, body: options.body && JSON.parse(options.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { status: next.status, json: async () => next.body };
  };
  // Run the 3-second redirect immediately so the test does not wait for it.
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms) => (ms === 3000 ? (window.__redirectDelay = ms, fn()) : realSetTimeout(fn, ms));

  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = jsContent;
  window.document.body.appendChild(scriptEl);
  return window;
}

function settle() {
  return new Promise(resolve => setTimeout(resolve, 20));
}

function options(document) {
  return [...document.querySelectorAll('#turma-estudante option')].map(o => [o.value, o.textContent]);
}

test('class dropdown is populated from /api/turmas with the bearer token', async () => {
  const window = setupDOM([TURMAS]);
  await settle();

  assert.deepStrictEqual(window.fetchCalls[0], {
    url: '/api/turmas',
    method: undefined,
    headers: { Authorization: 'Bearer jwt_gestor' },
    body: undefined
  });
  assert.deepStrictEqual(options(window.document), [
    ['', 'Selecione a turma...'],
    ['1', '1º Ano A'],
    ['2', '2º Ano B']
  ]);
});

test('empty class list warns and redirects to class registration after 3 seconds', async () => {
  const window = setupDOM([{ status: 200, body: { turmas: [] } }]);
  await settle();

  assert.deepStrictEqual(options(window.document), [['', 'Nenhuma turma cadastrada']]);
  assert.strictEqual(window.__redirectDelay, 3000);
  assert.strictEqual(window.__mock_location_href, '/cadastro_turma');
});

test('class loading failure is shown in the dropdown', async () => {
  const window = setupDOM([new Error('offline')]);
  await settle();

  assert.deepStrictEqual(options(window.document), [['', 'Erro ao carregar turmas']]);
  assert.strictEqual(window.__mock_location_href, undefined);
});

test('student without a class is blocked before the request', async () => {
  const window = setupDOM([TURMAS]);
  const document = window.document;
  await settle();

  document.getElementById('nome-estudante').value = 'Lucas Mendes de Oliveira';
  document.getElementById('matricula-estudante').value = '2026.01.0001';
  document.getElementById('form-cadastro-estudante').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await settle();

  assert.strictEqual(window.fetchCalls.length, 1);
});

test('valid student is sent with the numeric class id', async () => {
  const window = setupDOM([TURMAS, { status: 201, body: { sucesso: true, mensagem: 'Estudante cadastrado com sucesso.', id: 25 } }]);
  const document = window.document;
  await settle();

  document.getElementById('nome-estudante').value = 'Lucas Mendes de Oliveira';
  document.getElementById('matricula-estudante').value = '2026.01.0001';
  document.getElementById('turma-estudante').value = '1';
  document.getElementById('form-cadastro-estudante').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await settle();

  assert.deepStrictEqual(window.fetchCalls[1].body, {
    nome: 'Lucas Mendes de Oliveira',
    matricula: '2026.01.0001',
    turma_id: 1
  });
  assert.strictEqual(window.fetchCalls[1].url, '/api/estudantes');
  assert.strictEqual(document.getElementById('nome-estudante').value, '');
});
