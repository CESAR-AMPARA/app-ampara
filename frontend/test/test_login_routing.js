const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/login.html');
const jsPath = path.resolve(__dirname, '../public/js/main.js');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
// jsdom cannot navigate, so redirects are captured in window.__mock_location_href.
const jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

function setupDOM(responses) {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/login',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.fetchCalls = [];
  window.fetch = async (url, options) => {
    window.fetchCalls.push({ url: url, body: options && JSON.parse(options.body) });
    const next = responses.shift() || { status: 200, body: {} };
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
}

function login(window) {
  window.document.getElementById('email').value = 'maria.silva@escola.gov.br';
  window.document.getElementById('senha').value = 'SenhaSegura123!';
  submit(window, 'loginForm');
  return settle();
}

test('active login stores the JWT and redirects to the profile dashboard', async () => {
  const profiles = [
    { perfil: 'gestor_escolar', expected: '/dashboard_gestao' },
    { perfil: 'docente', expected: '/dashboard' },
    { perfil: 'equipe_multidisciplinar', expected: '/dashboard_saude' }
  ];

  for (const { perfil, expected } of profiles) {
    const usuario = { id: 12, nome: 'Maria Silva', perfil: perfil };
    const window = setupDOM([{
      status: 200,
      body: { sucesso: true, status: 'ativo', token: 'jwt_' + perfil, usuario: usuario }
    }]);

    await login(window);

    assert.deepStrictEqual(window.fetchCalls[0], {
      url: '/api/login',
      body: { email: 'maria.silva@escola.gov.br', senha: 'SenhaSegura123!' }
    });
    assert.strictEqual(window.localStorage.getItem('token'), 'jwt_' + perfil);
    assert.deepStrictEqual(JSON.parse(window.localStorage.getItem('usuario')), usuario);
    assert.deepStrictEqual(JSON.parse(window.sessionStorage.getItem('usuarioLogado')), usuario);
    assert.strictEqual(window.__mock_location_href, expected);
  }
});

test('pending account is redirected to the review page', async () => {
  const window = setupDOM([{
    status: 403,
    body: { sucesso: false, status: 'pendente', mensagem: 'Sua conta está em análise pela gestão escolar.' }
  }]);

  await login(window);

  assert.strictEqual(window.__mock_location_href, '/conta_pendente');
  assert.strictEqual(window.localStorage.getItem('token'), null);
});

test('suspended account stays on the login page', async () => {
  const window = setupDOM([{
    status: 403,
    body: { sucesso: false, status: 'suspenso', mensagem: 'Sua conta está suspensa.' }
  }]);

  await login(window);

  assert.strictEqual(window.__mock_location_href, undefined);
  assert.strictEqual(window.localStorage.getItem('token'), null);
});

test('MFA challenge swaps the forms and verifies the code with the session token', async () => {
  const window = setupDOM([
    { status: 200, body: { sucesso: true, mfa_required: true, session_token: 'temp_mfa_token_abc123' } },
    { status: 200, body: { sucesso: true, status: 'ativo', token: 'jwt_after_mfa', usuario: { perfil: 'docente' } } }
  ]);
  const document = window.document;

  await login(window);

  assert.strictEqual(document.getElementById('credentialsContainer').classList.contains('hidden'), true);
  assert.strictEqual(document.getElementById('mfaContainer').classList.contains('hidden'), false);

  document.getElementById('mfa_code').value = '123456';
  submit(window, 'mfaForm');
  await settle();

  assert.deepStrictEqual(window.fetchCalls[1], {
    url: '/api/login/mfa-verify',
    body: { session_token: 'temp_mfa_token_abc123', mfa_code: '123456' }
  });
  assert.strictEqual(window.localStorage.getItem('token'), 'jwt_after_mfa');
  assert.strictEqual(window.__mock_location_href, '/dashboard');
});

test('MFA code that is not 6 digits is not sent', async () => {
  const window = setupDOM([
    { status: 200, body: { sucesso: true, mfa_required: true, session_token: 'temp_mfa_token_abc123' } }
  ]);

  await login(window);
  window.document.getElementById('mfa_code').value = '12a4';
  submit(window, 'mfaForm');
  await settle();

  assert.strictEqual(window.fetchCalls.length, 1);
});

test('MFA verification of a pending account redirects to the review page', async () => {
  const window = setupDOM([
    { status: 200, body: { sucesso: true, mfa_required: true, session_token: 'temp_mfa_token_abc123' } },
    { status: 403, body: { sucesso: false, status: 'pendente' } }
  ]);

  await login(window);
  window.document.getElementById('mfa_code').value = '123456';
  submit(window, 'mfaForm');
  await settle();

  assert.strictEqual(window.__mock_location_href, '/conta_pendente');
});

test('resend link requests a new MFA session token', async () => {
  const window = setupDOM([
    { status: 200, body: { sucesso: true, mfa_required: true, session_token: 'first_token' } },
    { status: 200, body: { sucesso: true, mfa_required: true, session_token: 'second_token' } },
    { status: 200, body: { sucesso: true, token: 'jwt', usuario: { perfil: 'docente' } } }
  ]);
  const document = window.document;

  await login(window);
  document.getElementById('resendMfaLink').click();
  await settle();
  document.getElementById('mfa_code').value = '654321';
  submit(window, 'mfaForm');
  await settle();

  assert.strictEqual(window.fetchCalls[1].url, '/api/login');
  assert.strictEqual(window.fetchCalls[2].body.session_token, 'second_token');
});
