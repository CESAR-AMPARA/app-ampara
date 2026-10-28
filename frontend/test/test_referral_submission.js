const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, DOCENTE } = require('./dashboard_harness');

const ROUTES = {
  'GET /api/turmas': { status: 200, body: { turmas: [{ id: 1, nome: '1º Ano A', turno: 'matutino', total_estudantes: 1 }] } },
  'GET /api/estudantes?turma_id=1': {
    status: 200,
    body: { estudantes: [{ id: 25, nome: 'Lucas Mendes de Oliveira', matricula: '2026.01.0001', turma: { id: 1, nome: '1º Ano A' } }] }
  }
};

async function openStudentModal(extraRoutes) {
  const ctx = loadDashboard({ usuario: DOCENTE, routes: { ...ROUTES, ...extraRoutes } });
  await settle();
  ctx.document.querySelector('#teacher-class-cards [data-class="1"]').click();
  await settle();
  ctx.document.querySelector('.btn-open-modal[data-student-id="25"]').click();
  return ctx;
}

function submitReferral(document) {
  document.getElementById('referral-form').dispatchEvent(
    new document.defaultView.Event('submit', { cancelable: true, bubbles: true })
  );
  return settle();
}

test('the referral form starts hidden and opens from the student modal', async () => {
  const { document } = await openStudentModal();
  const openBtn = document.getElementById('btn-open-referral');

  assert.strictEqual(openBtn.textContent.trim(), 'Encaminhar para Equipe Multidisciplinar');
  assert.strictEqual(document.getElementById('referral-form').hidden, true);

  openBtn.click();

  assert.strictEqual(document.getElementById('referral-form').hidden, false);
  assert.strictEqual(openBtn.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(document.activeElement.id, 'referral-motivo');
  assert.strictEqual(document.getElementById('referral-motivo-hint').textContent, 'Descreva o comportamento observado, sem diagnósticos.');
});

test('an empty reason is blocked before anything is sent', async () => {
  const { document, calls, toasts } = await openStudentModal();
  document.getElementById('btn-open-referral').click();
  document.getElementById('referral-motivo').value = '   ';

  await submitReferral(document);

  assert.strictEqual(calls.some(c => c.method === 'POST'), false);
  assert.deepStrictEqual(toasts, ['Descreva o motivo do encaminhamento.']);
  assert.strictEqual(document.activeElement.id, 'referral-motivo');
});

test('a valid reason sends the referral payload and shows the backend message', async () => {
  const { document, calls, toasts } = await openStudentModal({
    'POST /api/encaminhamentos': { status: 201, body: { sucesso: true, mensagem: 'Encaminhamento registrado com sucesso.', id: 142 } }
  });
  document.getElementById('btn-open-referral').click();
  document.getElementById('referral-motivo').value = '  Estudante tem se isolado dos colegas no intervalo.  ';

  await submitReferral(document);

  const post = calls.find(c => c.method === 'POST');
  assert.strictEqual(post.url, '/api/encaminhamentos');
  assert.deepStrictEqual(post.body, { estudante_id: 25, motivo: 'Estudante tem se isolado dos colegas no intervalo.' });
  assert.deepStrictEqual(post.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer jwt_test' });
  assert.deepStrictEqual(toasts, ['Encaminhamento registrado com sucesso.']);
  assert.strictEqual(document.getElementById('referral-form').hidden, true);
  assert.strictEqual(document.getElementById('referral-motivo').value, '');
});

test('a refused referral keeps the form open with the backend message', async () => {
  const { document, toasts } = await openStudentModal({
    'POST /api/encaminhamentos': { status: 404, body: { sucesso: false, mensagem: 'Estudante não encontrado.' } }
  });
  document.getElementById('btn-open-referral').click();
  document.getElementById('referral-motivo').value = 'Motivo.';

  await submitReferral(document);

  assert.deepStrictEqual(toasts, ['Estudante não encontrado.']);
  assert.strictEqual(document.getElementById('referral-form').hidden, false);
  assert.strictEqual(document.getElementById('referral-motivo').value, 'Motivo.');
  assert.strictEqual(document.getElementById('btn-submit-referral').disabled, false);
});

test('reopening the modal resets the referral form', async () => {
  const { document } = await openStudentModal();
  document.getElementById('btn-open-referral').click();
  document.getElementById('referral-motivo').value = 'Rascunho';

  document.getElementById('btn-close-modal').click();
  document.querySelector('.btn-open-modal[data-student-id="25"]').click();

  assert.strictEqual(document.getElementById('referral-form').hidden, true);
  assert.strictEqual(document.getElementById('referral-motivo').value, '');
});
