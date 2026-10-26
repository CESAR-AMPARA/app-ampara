const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR, PSICOLOGA } = require('./dashboard_harness');

function referral(id, status) {
  return {
    id: id,
    estudante: { nome: 'Estudante ' + id, turma: '1º Ano A' },
    motivo: 'Motivo do encaminhamento ' + id + '.',
    prioridade: 'Alta',
    status: status,
    created_at: '2026-09-12T10:15:00Z'
  };
}

const LIST_ROUTE = 'GET /api/multidisciplinar/encaminhamentos';

function list(...items) {
  return { status: 200, body: { encaminhamentos: items } };
}

async function openCases(routes) {
  const ctx = loadDashboard({ usuario: PSICOLOGA, routes: routes });
  await settle();
  return ctx;
}

function card(document, id) {
  return document.querySelector(`.assigned-referral-card[data-referral-id="${id}"]`);
}

function buttons(document, id) {
  return [...card(document, id).querySelectorAll('.referral-actions button')].map(b => b.textContent.trim());
}

test('assigned cases are listed with the action that matches their status', async () => {
  const { document, calls } = await openCases({
    [LIST_ROUTE]: list(referral(1, 'Aguardando Triagem'), referral(2, 'Em Atendimento'), referral(3, 'Concluído'))
  });

  const call = calls.find(c => c.url === '/api/multidisciplinar/encaminhamentos');
  assert.deepStrictEqual(call.headers, { Authorization: 'Bearer jwt_test' });
  assert.match(card(document, 1).querySelector('h3').textContent, /Estudante 1 \(1º Ano A\)/);
  assert.deepStrictEqual(buttons(document, 1), ['Iniciar Atendimento']);
  assert.deepStrictEqual(buttons(document, 2), ['Concluir Caso']);
  assert.deepStrictEqual(buttons(document, 3), []);
});

test('"Iniciar Atendimento" moves the case to "Em Atendimento" and swaps the button', async () => {
  const { document, calls, toasts } = await openCases({
    [LIST_ROUTE]: [list(referral(1, 'Aguardando Triagem')), list(referral(1, 'Em Atendimento'))],
    'PUT /api/multidisciplinar/encaminhamentos/1/status': {
      status: 200, body: { sucesso: true, mensagem: "Status do atendimento atualizado para 'Em Atendimento'." }
    }
  });

  card(document, 1).querySelector('[data-action="start"]').click();
  await settle();

  const put = calls.find(c => c.method === 'PUT');
  assert.deepStrictEqual(put.body, { status: 'Em Atendimento' });
  assert.deepStrictEqual(put.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer jwt_test' });
  assert.deepStrictEqual(toasts, ["Status do atendimento atualizado para 'Em Atendimento'."]);
  assert.strictEqual(card(document, 1).querySelector('.status-badge.status-atendimento').textContent, 'Em Atendimento');
  assert.deepStrictEqual(buttons(document, 1), ['Concluir Caso']);
});

test('"Concluir Caso" asks for a closing summary before sending anything', async () => {
  const { document, calls } = await openCases({ [LIST_ROUTE]: list(referral(2, 'Em Atendimento')) });

  card(document, 2).querySelector('[data-action="conclude"]').click();

  assert.strictEqual(document.activeElement.id, 'closing-summary-2');
  assert.deepStrictEqual(buttons(document, 2), ['Cancelar', 'Confirmar Conclusão']);
  assert.strictEqual(calls.some(c => c.method === 'PUT'), false);
});

test('confirming without a summary is blocked', async () => {
  const { document, calls, toasts } = await openCases({ [LIST_ROUTE]: list(referral(2, 'Em Atendimento')) });

  card(document, 2).querySelector('[data-action="conclude"]').click();
  document.getElementById('closing-summary-2').value = '   ';
  card(document, 2).querySelector('[data-action="confirm-conclude"]').click();
  await settle();

  assert.strictEqual(calls.some(c => c.method === 'PUT'), false);
  assert.deepStrictEqual(toasts, ['Informe um resumo do encerramento do caso.']);
});

test('confirming sends the conclusion with the summary and removes the actions', async () => {
  const { document, calls } = await openCases({
    [LIST_ROUTE]: [list(referral(2, 'Em Atendimento')), list(referral(2, 'Concluído'))],
    'PUT /api/multidisciplinar/encaminhamentos/2/status': { status: 200, body: { sucesso: true } }
  });

  card(document, 2).querySelector('[data-action="conclude"]').click();
  document.getElementById('closing-summary-2').value = ' Acompanhamento concluído; família orientada a procurar a UBS. ';
  card(document, 2).querySelector('[data-action="confirm-conclude"]').click();
  await settle();

  assert.deepStrictEqual(calls.find(c => c.method === 'PUT').body, {
    status: 'Concluído',
    resumo_encerramento: 'Acompanhamento concluído; família orientada a procurar a UBS.'
  });
  assert.deepStrictEqual(buttons(document, 2), []);
});

test('cancelling the conclusion restores the "Concluir Caso" button', async () => {
  const { document } = await openCases({ [LIST_ROUTE]: list(referral(2, 'Em Atendimento')) });

  card(document, 2).querySelector('[data-action="conclude"]').click();
  card(document, 2).querySelector('[data-action="cancel-conclude"]').click();

  assert.deepStrictEqual(buttons(document, 2), ['Concluir Caso']);
});

test('refused transition shows the backend message and keeps the case', async () => {
  const { document, toasts } = await openCases({
    [LIST_ROUTE]: list(referral(1, 'Aguardando Triagem')),
    'PUT /api/multidisciplinar/encaminhamentos/1/status': {
      status: 403, body: { sucesso: false, mensagem: 'Você não tem permissão para alterar o status deste caso.' }
    }
  });

  card(document, 1).querySelector('[data-action="start"]').click();
  await settle();

  assert.deepStrictEqual(toasts, ['Você não tem permissão para alterar o status deste caso.']);
  assert.deepStrictEqual(buttons(document, 1), ['Iniciar Atendimento']);
  assert.strictEqual(card(document, 1).querySelector('[data-action="start"]').disabled, false);
});

test('no assigned cases shows an empty message', async () => {
  const { document } = await openCases({ [LIST_ROUTE]: list() });

  assert.match(document.getElementById('assigned-referrals-list').textContent, /Nenhum caso designado a você no momento/);
});

test('developer switcher opens the multidisciplinary panel and the library keeps it hidden', async () => {
  const { document, calls } = loadDashboard({ usuario: GESTOR, routes: { [LIST_ROUTE]: list(referral(1, 'Aguardando Triagem')) } });
  await settle();

  document.getElementById('btn-rbac-saude').click();
  await settle();
  assert.strictEqual(document.getElementById('panel-saude').style.display, 'block');
  assert.strictEqual(document.getElementById('panel-gestor').style.display, 'none');
  assert.ok(calls.some(c => c.url === '/api/multidisciplinar/encaminhamentos'));

  document.getElementById('tab-btn-biblioteca').click();
  document.getElementById('btn-rbac-gestor').click();
  assert.strictEqual(document.getElementById('panel-gestor').style.display, 'none');
  assert.strictEqual(document.getElementById('panel-biblioteca').style.display, 'block');

  document.getElementById('tab-btn-painel').click();
  assert.strictEqual(document.getElementById('panel-gestor').style.display, 'block');
  assert.strictEqual(document.getElementById('panel-biblioteca').style.display, 'none');
});
