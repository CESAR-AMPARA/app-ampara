const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/cadastro.html');
const jsPath = path.resolve(__dirname, '../public/js/main.js');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

function setupDOM() {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/cadastro.html',
    runScripts: 'dangerously'
  });
  
  // Mock localStorage & sessionStorage
  dom.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    clear: () => {}
  };
  dom.window.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    clear: () => {}
  };
  
  // Mock scrollTo
  dom.window.scrollTo = () => {};
  delete dom.window.location;
  dom.window.location = { href: 'http://localhost/cadastro.html' };

  // Mock fetch
  dom.window.fetch = async (url, options) => {
    if (url === '/api/schools') {
      return {
        json: async () => ({
          schools: [{ id: 'tenant_1', nome: 'Escola 1' }]
        })
      };
    }
    if (url === '/api/cadastro') {
      return {
        json: async () => ({ sucesso: true, status: 'pendente' })
      };
    }
    return { json: async () => ({}) };
  };

  // Run the main.js script in the JSDOM context
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = jsContent;
  dom.window.document.body.appendChild(scriptEl);

  return dom.window;
}

test('Step transitions occur only when inputs are valid', async (t) => {
  const window = setupDOM();
  const document = window.document;

  // Await fetch to populate schools
  await new Promise(resolve => setTimeout(resolve, 50));

  const next1 = document.querySelector('[data-next="1"]');
  const errorEscola = document.getElementById('error-escola_id');
  
  // 1. Try to go next without selecting school
  next1.click();
  assert.strictEqual(errorEscola.classList.contains('hidden'), false, 'Error should be visible when school is not selected');
  assert.strictEqual(document.querySelector('.panel[data-panel="1"]').classList.contains('active'), true);
  
  // Select school
  document.getElementById('escola_id').value = 'tenant_1';
  next1.click();
  
  // Should transition to step 2
  assert.strictEqual(document.querySelector('.panel[data-panel="2"]').classList.contains('active'), true);

  // 2. Try to go next without filling personal data
  const next2 = document.querySelector('[data-next="2"]');
  next2.click();
  assert.strictEqual(document.getElementById('error-nome').classList.contains('hidden'), false);
  assert.strictEqual(document.querySelector('.panel[data-panel="2"]').classList.contains('active'), true);
  
  // Fill data
  document.getElementById('nome').value = 'Maria Silva';
  document.getElementById('telefone').value = '(11) 99999-9999';
  document.getElementById('email').value = 'maria@edu.gov.br';
  next2.click();
  
  // Should transition to step 3
  assert.strictEqual(document.querySelector('.panel[data-panel="3"]').classList.contains('active'), true);
});

test('Dynamic role switching (Docente vs Equipe Multidisciplinar)', async (t) => {
  const window = setupDOM();
  const document = window.document;

  const btnDocente = document.querySelector('.rbac-card[data-role="docente"]');
  const btnEquipe = document.querySelector('.rbac-card[data-role="equipe_multidisciplinar"]');
  const fieldRegistro = document.getElementById('field-registro');

  // Click Equipe
  btnEquipe.click();
  assert.strictEqual(btnEquipe.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(fieldRegistro.classList.contains('hidden'), false, 'Registro field should be visible for Equipe');

  // Click Docente
  btnDocente.click();
  assert.strictEqual(btnDocente.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(fieldRegistro.classList.contains('hidden'), true, 'Registro field should be hidden for Docente');
});

test('Step 4 password confirmation and LGPD/secrecy validation', async (t) => {
  const window = setupDOM();
  const document = window.document;

  // Jump to step 4
  const form = document.getElementById('wizard');
  document.querySelector('.panel[data-panel="1"]').classList.remove('active');
  document.querySelector('.panel[data-panel="4"]').classList.add('active');

  const submitBtn = document.getElementById('submitBtn');
  const errorSenha = document.getElementById('error-senha');
  const errorTermos = document.getElementById('error-termos');
  
  // 1. Passwords don't match or < 8
  document.getElementById('senha').value = '123';
  document.getElementById('senha_confirmacao').value = '123';
  
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  assert.strictEqual(errorSenha.classList.contains('hidden'), false);
  
  document.getElementById('senha').value = 'senha_forte_123';
  document.getElementById('senha_confirmacao').value = 'senha_forte_123';
  
  // 2. Terms not checked
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  assert.strictEqual(errorTermos.classList.contains('hidden'), false);

  // 3. Valid submission
  document.getElementById('aceite_lgpd').checked = true;
  document.getElementById('aceite_sigilo').checked = true;
  
  // Ensure we selected a school and profile to pass full validation if needed, 
  // actually validateStep(4) only checks step 4 fields!
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  
  // Await fetch
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Check redirect
  assert.strictEqual(window.__mock_location_href.includes('conta_pendente.html'), true, 'Should redirect to conta_pendente.html on success/pending');
});
