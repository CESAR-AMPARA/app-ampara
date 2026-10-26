const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/cadastro.html');
const jsPath = path.resolve(__dirname, '../public/js/main.js');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
// jsdom cannot navigate, so redirects are captured in window.__mock_location_href.
const jsContent = fs.readFileSync(jsPath, 'utf-8').replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

function setupDOM(cadastroResponse) {
  const dom = new JSDOM(htmlContent, {
    url: 'http://localhost/cadastro',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const window = dom.window;
  window.scrollTo = () => {};
  window.fetchCalls = [];
  window.fetch = async (url, options) => {
    window.fetchCalls.push({ url: url, body: options && JSON.parse(options.body) });
    if (url === '/api/schools') {
      return { json: async () => ({ schools: [{ id: 'tenant_escola_joao_de_barro', nome: 'Escola Estadual João de Barro' }] }) };
    }
    return { json: async () => cadastroResponse || { sucesso: true, mensagem: 'Cadastro enviado para análise da gestão escolar.' } };
  };

  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = jsContent;
  window.document.body.appendChild(scriptEl);
  return window;
}

function settle() {
  return new Promise(resolve => setTimeout(resolve, 20));
}

function activePanel(document) {
  return Number(document.querySelector('.panel.active').getAttribute('data-panel'));
}

function isHidden(document, id) {
  return document.getElementById(id).classList.contains('hidden');
}

function fillStepsOneToThree(document, role) {
  document.getElementById('escola_id').value = 'tenant_escola_joao_de_barro';
  document.querySelector('[data-next="1"]').click();
  document.getElementById('nome').value = 'Maria Silva';
  document.getElementById('telefone').value = '(11) 99999-9999';
  document.getElementById('email').value = 'maria.silva@escola.gov.br';
  document.querySelector('[data-next="2"]').click();
  document.querySelector('.rbac-card[data-role="' + role + '"]').click();
  document.getElementById('matricula').value = '123456';
  document.getElementById('cargo').value = 'Professor de Matemática';
}

function fillStepFour(document) {
  document.getElementById('senha').value = 'SenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'SenhaSegura123!';
  document.getElementById('aceite_lgpd').checked = true;
  document.getElementById('aceite_sigilo').checked = true;
}

function submit(window) {
  window.document.getElementById('wizard').dispatchEvent(
    new window.Event('submit', { cancelable: true, bubbles: true })
  );
}

test('step 1 lists the active schools from the backend', async () => {
  const window = setupDOM();
  await settle();

  const options = [...window.document.querySelectorAll('#escola_id option')].map(o => o.value);
  assert.strictEqual(window.fetchCalls[0].url, '/api/schools');
  assert.deepStrictEqual(options, ['', 'tenant_escola_joao_de_barro']);
});

test('step transitions occur only when the current step is valid', async () => {
  const window = setupDOM();
  const document = window.document;
  await settle();

  document.querySelector('[data-next="1"]').click();
  assert.strictEqual(isHidden(document, 'error-escola_id'), false);
  assert.strictEqual(activePanel(document), 1);

  document.getElementById('escola_id').value = 'tenant_escola_joao_de_barro';
  document.querySelector('[data-next="1"]').click();
  assert.strictEqual(activePanel(document), 2);
  assert.strictEqual(document.getElementById('progressText').textContent, 'Passo 2 de 4');

  document.getElementById('nome').value = 'Maria Silva';
  document.getElementById('telefone').value = '(11) 9999';
  document.getElementById('email').value = 'maria.silva';
  document.querySelector('[data-next="2"]').click();
  assert.strictEqual(isHidden(document, 'error-nome'), true);
  assert.strictEqual(isHidden(document, 'error-telefone'), false);
  assert.strictEqual(isHidden(document, 'error-email'), false);
  assert.strictEqual(activePanel(document), 2);

  document.getElementById('telefone').value = '(11) 99999-9999';
  document.getElementById('email').value = 'maria.silva@escola.gov.br';
  document.querySelector('[data-next="2"]').click();
  assert.strictEqual(activePanel(document), 3);

  document.querySelector('[data-next="3"]').click();
  assert.strictEqual(isHidden(document, 'error-perfil'), false);
  assert.strictEqual(isHidden(document, 'error-matricula'), false);
  assert.strictEqual(isHidden(document, 'error-cargo'), false);
  assert.strictEqual(activePanel(document), 3);
});

test('pressing Enter on an earlier step advances instead of submitting', async () => {
  const window = setupDOM();
  const document = window.document;
  await settle();

  submit(window);
  assert.strictEqual(activePanel(document), 1);

  document.getElementById('escola_id').value = 'tenant_escola_joao_de_barro';
  submit(window);
  assert.strictEqual(activePanel(document), 2);
  assert.strictEqual(window.fetchCalls.some(c => c.url === '/api/cadastro'), false);
});

test('phone input is masked in the Brazilian format', () => {
  const window = setupDOM();
  const tel = window.document.getElementById('telefone');

  tel.value = '11999999999';
  tel.dispatchEvent(new window.Event('input'));

  assert.strictEqual(tel.value, '(11) 99999-9999');
});

test('professional registration field only shows for Equipe Multidisciplinar', () => {
  const window = setupDOM();
  const document = window.document;

  document.querySelector('.rbac-card[data-role="equipe_multidisciplinar"]').click();
  assert.strictEqual(isHidden(document, 'field-registro'), false);

  document.getElementById('registro_profissional').value = 'CRP 06/12345';
  document.querySelector('.rbac-card[data-role="docente"]').click();
  assert.strictEqual(document.querySelector('.rbac-card[data-role="docente"]').getAttribute('aria-pressed'), 'true');
  assert.strictEqual(isHidden(document, 'field-registro'), true);
  assert.strictEqual(document.getElementById('registro_profissional').value, '');
});

test('step 4 requires matching passwords and both mandatory terms', async () => {
  const window = setupDOM();
  const document = window.document;
  await settle();
  fillStepsOneToThree(document, 'docente');
  document.querySelector('[data-next="3"]').click();
  assert.strictEqual(activePanel(document), 4);

  document.getElementById('senha').value = 'SenhaSegura123!';
  document.getElementById('senha_confirmacao').value = 'Outra123!';
  submit(window);
  assert.strictEqual(isHidden(document, 'error-senha'), false);
  assert.strictEqual(isHidden(document, 'error-termos'), false);

  document.getElementById('senha_confirmacao').value = 'SenhaSegura123!';
  document.getElementById('aceite_lgpd').checked = true;
  submit(window);
  await settle();
  assert.strictEqual(isHidden(document, 'error-termos'), false);
  assert.strictEqual(window.fetchCalls.some(c => c.url === '/api/cadastro'), false);
});

test('docente submission sends the contract payload and shows the review page', async () => {
  const window = setupDOM();
  const document = window.document;
  await settle();
  fillStepsOneToThree(document, 'docente');
  document.querySelector('[data-next="3"]').click();
  fillStepFour(document);

  submit(window);
  await settle();

  const call = window.fetchCalls.find(c => c.url === '/api/cadastro');
  assert.deepStrictEqual(call.body, {
    escola_id: 'tenant_escola_joao_de_barro',
    nome: 'Maria Silva',
    telefone: '(11) 99999-9999',
    email: 'maria.silva@escola.gov.br',
    perfil: 'docente',
    matricula: '123456',
    cargo: 'Professor de Matemática',
    registro_profissional: null,
    senha: 'SenhaSegura123!',
    aceite_lgpd: true,
    aceite_sigilo: true
  });
  assert.strictEqual(window.__mock_location_href, '/conta_pendente');
});

test('equipe multidisciplinar submission sends the CRP/CRESS registration', async () => {
  const window = setupDOM();
  const document = window.document;
  await settle();
  fillStepsOneToThree(document, 'equipe_multidisciplinar');
  document.getElementById('registro_profissional').value = 'CRP 06/12345';
  document.querySelector('[data-next="3"]').click();
  fillStepFour(document);

  submit(window);
  await settle();

  const call = window.fetchCalls.find(c => c.url === '/api/cadastro');
  assert.strictEqual(call.body.perfil, 'equipe_multidisciplinar');
  assert.strictEqual(call.body.registro_profissional, 'CRP 06/12345');
});

test('rejected submission keeps the user on the form', async () => {
  const window = setupDOM({ sucesso: false, mensagem: 'E-mail já cadastrado.' });
  const document = window.document;
  await settle();
  fillStepsOneToThree(document, 'docente');
  document.querySelector('[data-next="3"]').click();
  fillStepFour(document);

  submit(window);
  await settle();

  assert.strictEqual(window.__mock_location_href, undefined);
  assert.strictEqual(document.getElementById('submitBtn').disabled, false);
});
