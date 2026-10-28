const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR, PSICOLOGA } = require('./dashboard_harness');

const QUEUE = [
  {
    id: 142,
    estudante: { id: 25, nome: 'Lucas Mendes de Oliveira', matricula: '2026.01.0001', turma: '1º Ano A' },
    solicitante: { id: 4, nome: 'Prof. Carlos Souza' },
    designado: { id: 8, nome: 'Psicóloga Amanda Costa' },
    motivo: 'Estudante tem se isolado frequentemente dos colegas.',
    observacoes_coordenacao: 'Conversei com o professor e o caso requer atenção prioritária devido à recorrência de crises.',
    prioridade: 'Alta',
    status: 'Em Atendimento',
    created_at: '2026-09-12T10:15:00Z'
  },
  {
    id: 143,
    estudante: { id: 26, nome: 'Ana Beatriz Santos', matricula: '2026.01.0002', turma: '1º Ano A' },
    solicitante: { id: 5, nome: 'Profa. Marina Lopes' },
    designado: null,
    motivo: 'Faltas recorrentes.',
    observacoes_coordenacao: null,
    prioridade: 'Média',
    status: 'Aguardando Triagem',
    created_at: '2026-09-13T02:30:00Z'
  },
  {
    id: 144,
    estudante: { id: 27, nome: 'Gabriel Silva Costa', matricula: '2026.02.0001', turma: '2º Ano A' },
    solicitante: { id: 4, nome: 'Prof. Carlos Souza' },
    designado: { id: 9, nome: 'Assistente Social Rita Lima' },
    motivo: 'Situação familiar delicada.',
    observacoes_coordenacao: null,
    prioridade: 'Baixa',
    status: 'Concluído',
    created_at: '2026-08-30T15:00:00Z'
  }
];

const QUEUE_ROUTE = 'GET /api/gestao/encaminhamentos';

function rows(document) {
  return [...document.querySelectorAll('#referral-queue-tbody tr')];
}

async function openQueue(routes) {
  const ctx = loadDashboard({ usuario: GESTOR, routes: routes });
  await settle();
  ctx.document.getElementById('btn-gestor-tab-encaminhamentos').click();
  await settle();
  return ctx;
}

test('coordinator opens the queue tab and the referrals are fetched with the token', async () => {
  const { document, calls } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });

  const call = calls.find(c => c.url === '/api/gestao/encaminhamentos');
  assert.deepStrictEqual(call.headers, { Authorization: 'Bearer jwt_test' });
  assert.strictEqual(document.getElementById('gestor-tab-encaminhamentos').style.display, 'block');
  assert.strictEqual(document.getElementById('btn-gestor-tab-encaminhamentos').getAttribute('aria-selected'), 'true');
  assert.strictEqual(document.getElementById('gestor-tab-credenciamento').style.display, 'none');
  assert.strictEqual(rows(document).length, 3);
});

test('each row shows student, class, date, requester, priority and status', async () => {
  const { document } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });
  const cells = rows(document)[0].querySelectorAll('td');

  assert.match(cells[0].textContent, /^Lucas Mendes de Oliveira \(1º Ano A\)/);
  assert.strictEqual(cells[1].textContent, '12/09/2026');
  assert.strictEqual(cells[2].textContent, 'Prof. Carlos Souza');
  assert.strictEqual(cells[3].textContent, 'Alta');
  assert.strictEqual(cells[4].querySelector('.status-badge').textContent, 'Em Atendimento');
  assert.match(cells[4].textContent, /Designado: Psicóloga Amanda Costa/);
  assert.strictEqual(cells[5].querySelector('button').textContent, 'Avaliar');
});

test('dates are shown in Brasília time', async () => {
  const { document } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });

  // 2026-09-13T02:30Z is still the 12th in Brasília (UTC-3).
  assert.strictEqual(rows(document)[1].querySelectorAll('td')[1].textContent, '12/09/2026');
});

test('priority and status badges carry their color classes', async () => {
  const { document } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });
  const badges = rows(document).map(row => {
    const cells = row.querySelectorAll('td');
    return [cells[3].querySelector('.status-badge').className, cells[4].querySelector('.status-badge').className];
  });

  assert.deepStrictEqual(badges, [
    ['status-badge priority-alta', 'status-badge status-atendimento'],
    ['status-badge priority-media', 'status-badge status-triagem'],
    ['status-badge priority-baixa', 'status-badge status-concluido']
  ]);
});

test('coordinator notes are truncated in the table and kept whole in the tooltip', async () => {
  const { document } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });
  const notes = rows(document)[0].querySelector('.referral-meta');

  assert.strictEqual(notes.textContent, '📝 Conversei com o professor e o caso requer atenção prioritár…');
  assert.strictEqual(notes.getAttribute('title'), QUEUE[0].observacoes_coordenacao);
  assert.strictEqual(rows(document)[1].querySelector('td').querySelector('.referral-meta'), null);
});

test('filters are sent as query parameters', async () => {
  const { window, document, calls } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: QUEUE } } });

  document.getElementById('referral-filter-status').value = 'Aguardando Triagem';
  document.getElementById('referral-filter-status').dispatchEvent(new window.Event('change'));
  document.getElementById('referral-filter-prioridade').value = 'Alta';
  document.getElementById('referral-filter-prioridade').dispatchEvent(new window.Event('change'));
  await settle();

  const urls = calls.filter(c => c.url.startsWith('/api/gestao/encaminhamentos')).map(c => c.url);
  assert.deepStrictEqual(urls, [
    '/api/gestao/encaminhamentos',
    '/api/gestao/encaminhamentos?status=Aguardando+Triagem',
    '/api/gestao/encaminhamentos?status=Aguardando+Triagem&prioridade=Alta'
  ]);
});

test('empty queue and loading failure show a message instead of rows', async () => {
  const empty = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: [] } } });
  assert.match(empty.document.getElementById('referral-queue-tbody').textContent, /Nenhum encaminhamento encontrado/);

  const failed = await openQueue({ [QUEUE_ROUTE]: { status: 500, body: null } });
  assert.match(failed.document.getElementById('referral-queue-tbody').textContent, /Erro ao carregar a fila de encaminhamentos/);
});

test('student names from the API are rendered as text, not HTML', async () => {
  const hostile = { ...QUEUE[1], estudante: { ...QUEUE[1].estudante, nome: '<img src=x onerror="window.pwned=1">' } };
  const { window, document } = await openQueue({ [QUEUE_ROUTE]: { status: 200, body: { encaminhamentos: [hostile] } } });

  assert.strictEqual(document.querySelector('#referral-queue-tbody img'), null);
  assert.strictEqual(window.pwned, undefined);
  assert.match(rows(document)[0].textContent, /<img src=x/);
});

test('multidisciplinary login shows only the assigned cases panel', async () => {
  const { document } = loadDashboard({ usuario: PSICOLOGA });
  await settle();

  assert.strictEqual(document.getElementById('panel-saude').style.display, 'block');
  assert.strictEqual(document.getElementById('panel-gestor').style.display, 'none');
  assert.strictEqual(document.getElementById('panel-docente').style.display, 'none');
  assert.strictEqual(document.getElementById('rbac-switcher-box'), null);
  assert.strictEqual(document.getElementById('dashboard-title').textContent, 'Casos Designados');
});
