const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR } = require('./dashboard_harness');

const REFERRAL = {
  id: 142,
  estudante: { id: 25, nome: 'Lucas Mendes de Oliveira', matricula: '2026.01.0001', turma: '1º Ano A' },
  solicitante: { id: 4, nome: 'Prof. Carlos Souza' },
  designado: { id: 9, nome: 'Assistente Social Rita Lima' },
  motivo: 'Estudante tem se isolado frequentemente dos colegas e apresentou choro descontrolado na biblioteca.',
  observacoes_coordenacao: 'Família já foi contatada.',
  prioridade: 'Média',
  status: 'Aguardando Triagem',
  created_at: '2026-09-12T10:15:00Z'
};

const PROFESSIONALS = [
  { id: 8, nome: 'Psicóloga Amanda Costa', perfil: 'equipe_multidisciplinar', cargo: 'Psicóloga Escolar', status: 'Ativo' },
  { id: 9, nome: 'Assistente Social Rita Lima', perfil: 'equipe_multidisciplinar', cargo: '', status: 'Ativo' }
];

const PUT_ROUTE = 'PUT /api/gestao/encaminhamentos/142';

function baseRoutes(extra) {
  return {
    'GET /api/gestao/encaminhamentos': { status: 200, body: { encaminhamentos: [REFERRAL] } },
    'GET /api/usuarios?perfil=equipe_multidisciplinar': { status: 200, body: PROFESSIONALS },
    ...extra
  };
}

async function openModal(routes) {
  const ctx = loadDashboard({ usuario: GESTOR, routes: routes || baseRoutes() });
  await settle();
  ctx.document.getElementById('btn-gestor-tab-encaminhamentos').click();
  await settle();
  ctx.avaliar = ctx.document.querySelector('[data-referral-id="142"]');
  ctx.avaliar.click();
  await settle();
  return ctx;
}

function modal(document) {
  return document.getElementById('referral-triage-modal');
}

function submit(window) {
  window.document.getElementById('form-referral-triage').dispatchEvent(
    new window.Event('submit', { cancelable: true, bubbles: true })
  );
  return settle();
}

test('opening the modal fills the student details, reason and current triage', async () => {
  const { document } = await openModal();

  assert.strictEqual(modal(document).style.display, 'flex');
  assert.strictEqual(document.getElementById('triage-student-name').textContent, 'Lucas Mendes de Oliveira');
  assert.strictEqual(document.getElementById('triage-student-details').textContent,
    '1º Ano A · Matrícula 2026.01.0001 · Enviado por Prof. Carlos Souza em 12/09/2026');
  assert.strictEqual(document.getElementById('triage-motivo').textContent, REFERRAL.motivo);
  assert.strictEqual(document.getElementById('triage-prioridade').value, 'Média');
  assert.strictEqual(document.getElementById('triage-designado').value, '9');
  assert.strictEqual(document.getElementById('triage-observacoes').value, 'Família já foi contatada.');
  assert.strictEqual(document.activeElement.id, 'triage-prioridade');
});

test('professional dropdown lists the multidisciplinary team from the API', async () => {
  const { document, calls } = await openModal();
  const options = [...document.querySelectorAll('#triage-designado option')].map(o => [o.value, o.textContent]);

  assert.deepStrictEqual(options, [
    ['', 'Selecione o profissional...'],
    ['8', 'Psicóloga Amanda Costa — Psicóloga Escolar'],
    ['9', 'Assistente Social Rita Lima']
  ]);
  const call = calls.find(c => c.url === '/api/usuarios?perfil=equipe_multidisciplinar');
  assert.deepStrictEqual(call.headers, { Authorization: 'Bearer jwt_test' });
});

test('professionals are fetched once even when the modal is reopened', async () => {
  const { document, calls, avaliar } = await openModal();

  document.getElementById('btn-cancel-triage').click();
  avaliar.click();
  await settle();

  assert.strictEqual(calls.filter(c => c.url === '/api/usuarios?perfil=equipe_multidisciplinar').length, 1);
});

test('saving sends the triage with headers, closes the modal and reloads the queue', async () => {
  const ctx = await openModal(baseRoutes({ [PUT_ROUTE]: { status: 200, body: { sucesso: true, mensagem: 'Encaminhamento atualizado e designado com sucesso.' } } }));
  const { window, document, calls, toasts } = ctx;

  document.getElementById('triage-prioridade').value = 'Alta';
  document.getElementById('triage-designado').value = '8';
  document.getElementById('triage-observacoes').value = '  Caso requer atenção prioritária.  ';
  await submit(window);

  const put = calls.find(c => c.method === 'PUT');
  assert.deepStrictEqual(put, {
    method: 'PUT',
    url: '/api/gestao/encaminhamentos/142',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt_test' },
    body: { prioridade: 'Alta', designado_id: 8, observacoes_coordenacao: 'Caso requer atenção prioritária.' }
  });
  assert.strictEqual(modal(document).style.display, 'none');
  assert.deepStrictEqual(toasts, ['Encaminhamento designado com sucesso!']);
  assert.strictEqual(calls.filter(c => c.url === '/api/gestao/encaminhamentos').length, 2);
  assert.strictEqual(document.activeElement.textContent, 'Avaliar');
});

test('blank coordination notes are sent as null', async () => {
  const { window, document, calls } = await openModal(baseRoutes({ [PUT_ROUTE]: { status: 200, body: { sucesso: true } } }));

  document.getElementById('triage-observacoes').value = '   ';
  await submit(window);

  assert.strictEqual(calls.find(c => c.method === 'PUT').body.observacoes_coordenacao, null);
});

test('saving without a professional is blocked by validation', async () => {
  const { window, document, calls } = await openModal();

  document.getElementById('triage-designado').value = '';
  await submit(window);

  assert.strictEqual(calls.some(c => c.method === 'PUT'), false);
  assert.strictEqual(modal(document).style.display, 'flex');
});

test('backend refusal keeps the modal open with the message', async () => {
  const { window, document, toasts } = await openModal(baseRoutes({
    [PUT_ROUTE]: { status: 400, body: { sucesso: false, mensagem: 'O profissional designado deve pertencer à equipe multidisciplinar.' } }
  }));

  await submit(window);

  assert.strictEqual(modal(document).style.display, 'flex');
  assert.deepStrictEqual(toasts, ['O profissional designado deve pertencer à equipe multidisciplinar.']);
  assert.strictEqual(document.getElementById('btn-save-triage').disabled, false);
});

test('cancel, close button, Escape and backdrop close the modal without saving', async () => {
  const closers = [
    doc => doc.getElementById('btn-cancel-triage').click(),
    doc => doc.getElementById('btn-close-triage-modal').click(),
    (doc, win) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' })),
    (doc, win) => modal(doc).dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  ];

  for (const close of closers) {
    const { window, document, calls } = await openModal();
    close(document, window);
    assert.strictEqual(modal(document).style.display, 'none');
    assert.strictEqual(calls.some(c => c.method === 'PUT'), false);
  }
});
