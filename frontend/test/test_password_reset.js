const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const jsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/main.js'), 'utf-8');

function setupDOM(page, url, responses) {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/' + page), 'utf-8');
  const dom = new JSDOM(html, {
    url: url,
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.fetchCalls = [];
  window.fetch = async (fetchUrl, options) => {
    window.fetchCalls.push({ url: fetchUrl, body: options && JSON.parse(options.body) });
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

function submit(window, formId) {
  window.document.getElementById(formId).dispatchEvent(
    new window.Event('submit', { cancelable: true, bubbles: true })
  );
  return settle();
}

function isHidden(document, id) {
  return document.getElementById(id).classList.contains('hidden');
}

const RECOVER_OK = {
  status: 200,
  body: { sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.' }
};

test('login page links to the password recovery page', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/login.html'), 'utf-8');
  const window = new JSDOM(html).window;
  const link = [...window.document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Esqueci minha senha');

  assert.strictEqual(link.getAttribute('href'), '/recuperar_senha');
});

test('recovery request with an invalid e-mail is not sent', async () => {
  const window = setupDOM('recuperar_senha.html', 'http://localhost/recuperar_senha', [RECOVER_OK]);
  const document = window.document;

  document.getElementById('email').value = 'maria.silva';
  await submit(window, 'recoverForm');

  assert.strictEqual(isHidden(document, 'error-email'), false);
  assert.strictEqual(window.fetchCalls.length, 0);
});

test('recovery request sends the e-mail and shows the neutral confirmation', async () => {
  const window = setupDOM('recuperar_senha.html', 'http://localhost/recuperar_senha', [RECOVER_OK]);
  const document = window.document;

  document.getElementById('email').value = ' maria.silva@escola.gov.br ';
  await submit(window, 'recoverForm');

  assert.deepStrictEqual(window.fetchCalls, [
    { url: '/api/recuperar-senha', body: { email: 'maria.silva@escola.gov.br' } }
  ]);
  assert.strictEqual(isHidden(document, 'recoverContainer'), true);
  assert.strictEqual(isHidden(document, 'recoverDone'), false);
});

test('recovery request rejected by the backend keeps the form', async () => {
  const window = setupDOM('recuperar_senha.html', 'http://localhost/recuperar_senha', [
    { status: 400, body: { sucesso: false, mensagem: 'Informe um e-mail válido.' } }
  ]);
  const document = window.document;

  document.getElementById('email').value = 'maria.silva@escola.gov.br';
  await submit(window, 'recoverForm');

  assert.strictEqual(isHidden(document, 'recoverContainer'), false);
  assert.strictEqual(isHidden(document, 'recoverDone'), true);
  assert.strictEqual(document.getElementById('recoverBtn').disabled, false);
});

test('reset page without a token shows the invalid link state', () => {
  const window = setupDOM('redefinir_senha.html', 'http://localhost/redefinir_senha', []);
  const document = window.document;

  assert.strictEqual(isHidden(document, 'resetContainer'), true);
  assert.strictEqual(isHidden(document, 'resetInvalid'), false);
});

test('reset requires matching passwords of at least 8 characters', async () => {
  const window = setupDOM('redefinir_senha.html', 'http://localhost/redefinir_senha?token=raw_token', []);
  const document = window.document;

  document.getElementById('senha').value = 'curta';
  document.getElementById('senha_confirmacao').value = 'curta';
  await submit(window, 'resetForm');
  assert.strictEqual(isHidden(document, 'error-senha'), false);

  document.getElementById('senha').value = 'NovaSenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'OutraSenha123!';
  await submit(window, 'resetForm');
  assert.strictEqual(isHidden(document, 'error-senha'), false);
  assert.strictEqual(window.fetchCalls.length, 0);
});

test('reset sends the token from the link with the new password', async () => {
  const window = setupDOM('redefinir_senha.html', 'http://localhost/redefinir_senha?token=raw_token', [
    { status: 200, body: { sucesso: true, mensagem: 'Senha redefinida com sucesso.' } }
  ]);
  const document = window.document;

  document.getElementById('senha').value = 'NovaSenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'NovaSenhaSegura123!';
  await submit(window, 'resetForm');

  assert.deepStrictEqual(window.fetchCalls, [
    { url: '/api/redefinir-senha', body: { token: 'raw_token', senha: 'NovaSenhaSegura123!' } }
  ]);
  assert.strictEqual(isHidden(document, 'resetContainer'), true);
  assert.strictEqual(isHidden(document, 'resetDone'), false);
});

test('expired token shows the invalid link state', async () => {
  const window = setupDOM('redefinir_senha.html', 'http://localhost/redefinir_senha?token=expired', [
    { status: 400, body: { sucesso: false, mensagem: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.' } }
  ]);
  const document = window.document;

  document.getElementById('senha').value = 'NovaSenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'NovaSenhaSegura123!';
  await submit(window, 'resetForm');

  assert.strictEqual(isHidden(document, 'resetInvalid'), false);
  assert.strictEqual(isHidden(document, 'resetDone'), true);
});

test('network failure keeps the reset form usable', async () => {
  const window = setupDOM('redefinir_senha.html', 'http://localhost/redefinir_senha?token=raw_token', [new Error('offline')]);
  const document = window.document;

  document.getElementById('senha').value = 'NovaSenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'NovaSenhaSegura123!';
  await submit(window, 'resetForm');

  assert.strictEqual(isHidden(document, 'resetContainer'), false);
  assert.strictEqual(document.getElementById('resetBtn').disabled, false);
});
