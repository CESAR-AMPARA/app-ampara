const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/login.html');
const jsPath = path.resolve(__dirname, '../public/js/main.js');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

let fetchResponseMock = {};
let fetchStatusMock = 200;

function setupDOM() {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/login.html',
    runScripts: 'dangerously'
  });
  
  const storage = new Map();
  dom.window.localStorage = {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, String(v)),
    clear: () => storage.clear()
  };
  
  delete dom.window.location;
  dom.window.location = { href: 'http://localhost/login.html' };
  // Mock fetch
  dom.window.fetch = async (url, options) => {
    return {
      status: fetchStatusMock,
      json: async () => fetchResponseMock
    };
  };

  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = jsContent;
  dom.window.document.body.appendChild(scriptEl);

  return dom.window;
}

test('Verifies redirection based on RBAC and token storage', async (t) => {
  fetchStatusMock = 200;
  
  const profiles = [
    { perfil: 'gestor_escolar', expect: 'dashboard_gestao.html' },
    { perfil: 'docente', expect: 'dashboard.html' },
    { perfil: 'equipe_multidisciplinar', expect: 'dashboard_saude.html' }
  ];

  for (const { perfil, expect } of profiles) {
    fetchResponseMock = {
      sucesso: true,
      token: 'fake_jwt_token_' + perfil,
      usuario: { perfil: perfil }
    };
    
    const window = setupDOM();
    const document = window.document;
    const form = document.getElementById('loginForm');
    
    document.getElementById('email').value = 'test@edu.gov.br';
    document.getElementById('senha').value = 'senha123';
    
    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    assert.strictEqual(window.localStorage.getItem('token'), 'fake_jwt_token_' + perfil);
    assert.strictEqual(window.__mock_location_href.includes(expect), true, `Expected redirect to ${expect} for ${perfil}`);
  }
});

test('Verifies redirect to conta_pendente.html on pending status', async (t) => {
  // Test pending from 403 Forbidden
  fetchStatusMock = 403;
  fetchResponseMock = {
    sucesso: false,
    status: 'pendente',
    mensagem: 'Em análise'
  };

  const window = setupDOM();
  const document = window.document;
  const form = document.getElementById('loginForm');
  
  document.getElementById('email').value = 'pendente@edu.gov.br';
  document.getElementById('senha').value = 'senha123';
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  assert.strictEqual(window.__mock_location_href.includes('conta_pendente.html'), true);
});

test('Verifies MFA flow shows MFA container and handles verification', async (t) => {
  fetchStatusMock = 200;
  fetchResponseMock = {
    sucesso: true,
    mfa_required: true,
    session_token: 'mfa_token_123'
  };

  const window = setupDOM();
  const document = window.document;
  const loginForm = document.getElementById('loginForm');
  const mfaForm = document.getElementById('mfaForm');
  
  document.getElementById('email').value = 'mfa@edu.gov.br';
  document.getElementById('senha').value = 'senha123';
  loginForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Credentials container hidden, MFA shown
  assert.strictEqual(document.getElementById('credentialsContainer').classList.contains('hidden'), true);
  assert.strictEqual(document.getElementById('mfaContainer').classList.contains('hidden'), false);
  
  // Submit MFA form
  fetchResponseMock = {
    sucesso: true,
    token: 'jwt_after_mfa',
    usuario: { perfil: 'docente' }
  };
  
  document.getElementById('mfa_code').value = '123456';
  mfaForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  assert.strictEqual(window.localStorage.getItem('token'), 'jwt_after_mfa');
  assert.strictEqual(window.__mock_location_href.includes('dashboard.html'), true);
});