const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR } = require('./dashboard_harness');

const PENDING_ROUTE = 'GET /api/gestao/pendentes';

function pendente(id, perfil, nome) {
  return {
    id: id,
    nome: nome || 'Profissional ' + id,
    email: 'prof' + id + '@escola.gov.br',
    telefone: '+55 11 99999-9999',
    perfil: perfil,
    matricula: '1234' + id,
    cargo: 'Cargo ' + id,
    created_at: '2026-09-12T14:32:00Z'
  };
}

function pendentes(...items) {
  return { status: 200, body: { pendentes: items } };
}

async function openCredentialing(routes) {
  const ctx = loadDashboard({ usuario: GESTOR, routes: routes });
  await settle();
  return ctx;
}

function rows(document) {
  return [...document.querySelectorAll('#users-tbody tr[id^="user-row-"]')];
}

test('pending registrations load from the multi-tenant endpoint with the session token', async () => {
  const { document, calls } = await openCredentialing({
    [PENDING_ROUTE]: pendentes(pendente(12, 'docente', 'Maria Silva'), pendente(15, 'equipe_multidisciplinar'))
  });

  const call = calls.find(c => c.url === '/api/gestao/pendentes');
  assert.deepStrictEqual(call.headers, { Authorization: 'Bearer jwt_test' });
  assert.strictEqual(calls.some(c => c.url === '/api/usuarios'), false);

  const [first] = rows(document);
  const cells = [...first.querySelectorAll('td')].map(td => td.textContent.trim());
  assert.strictEqual(cells[0], 'Maria Silva');
  assert.strictEqual(cells[1], 'prof12@escola.gov.br');
  assert.strictEqual(cells[2], 'Docente');
  assert.match(cells[3], /Cargo 12/);
  assert.match(cells[3], /Matrícula 123412/);
  assert.strictEqual(cells[4], '12/09/2026');
  assert.strictEqual(document.getElementById('stat-pending').textContent, '2');
});

test('profiles use the multi-tenant labels', async () => {
  const { document } = await openCredentialing({
    [PENDING_ROUTE]: pendentes(pendente(1, 'gestor_escolar'), pendente(2, 'docente'), pendente(3, 'equipe_multidisciplinar'))
  });

  const labels = rows(document).map(tr => tr.querySelectorAll('td')[2].textContent);
  assert.deepStrictEqual(labels, ['Gestão / Coordenação', 'Docente', 'Equipe Multidisciplinar']);
});

test('the tab shows only the pending count, under its new title', async () => {
  const { document } = await openCredentialing({ [PENDING_ROUTE]: pendentes() });

  assert.strictEqual(document.getElementById('stat-total'), null);
  assert.strictEqual(document.getElementById('stat-approved'), null);
  assert.strictEqual(document.getElementById('stat-pending').textContent, '0');
  assert.match(document.querySelector('#gestor-tab-credenciamento h2').textContent, /Solicitações Pendentes/);
  assert.match(document.getElementById('users-tbody').textContent, /Nenhuma solicitação de cadastro pendente/);
});

test('approving sends the POST with the token and re-renders the list', async () => {
  const { document, calls, toasts } = await openCredentialing({
    [PENDING_ROUTE]: [pendentes(pendente(12, 'docente'), pendente(15, 'docente')), pendentes(pendente(15, 'docente'))],
    'POST /api/gestao/usuarios/12/aprovar': { status: 200, body: { sucesso: true, mensagem: 'Usuário aprovado com sucesso.' } }
  });

  document.querySelector('.btn-aprovar[data-id="12"]').click();
  await settle();

  const post = calls.find(c => c.method === 'POST');
  assert.strictEqual(post.url, '/api/gestao/usuarios/12/aprovar');
  assert.deepStrictEqual(post.headers, { Authorization: 'Bearer jwt_test' });
  assert.strictEqual(calls.some(c => c.url.startsWith('/api/aprovar')), false);
  assert.deepStrictEqual(toasts, ['Usuário aprovado com sucesso.']);
  assert.deepStrictEqual(rows(document).map(tr => tr.id), ['user-row-15']);
  assert.strictEqual(document.getElementById('stat-pending').textContent, '1');
});

test('a refused approval shows the backend message and re-enables the button', async () => {
  const { document, toasts } = await openCredentialing({
    [PENDING_ROUTE]: pendentes(pendente(12, 'docente')),
    'POST /api/gestao/usuarios/12/aprovar': { status: 404, body: { sucesso: false, mensagem: 'Usuário não encontrado.' } }
  });

  const btn = document.querySelector('.btn-aprovar[data-id="12"]');
  btn.click();
  await settle();

  assert.deepStrictEqual(toasts, ['Usuário não encontrado.']);
  assert.strictEqual(btn.disabled, false);
  assert.strictEqual(btn.textContent, 'Aprovar Cadastro');
});

test('a network failure while loading shows an error row', async () => {
  const { document } = await openCredentialing({ [PENDING_ROUTE]: { fail: true } });

  assert.match(document.getElementById('users-tbody').textContent, /Erro ao conectar ao servidor/);
});

test('names are escaped and the fake "Adicionar Professor" shortcut is gone', async () => {
  const { document } = await openCredentialing({
    [PENDING_ROUTE]: pendentes(pendente(12, 'docente', '<img src=x onerror=alert(1)>'))
  });

  assert.strictEqual(document.querySelector('#users-tbody img'), null);
  assert.strictEqual(document.getElementById('btn-open-add-teacher'), null);
  assert.strictEqual(document.getElementById('add-teacher-modal'), null);
});
