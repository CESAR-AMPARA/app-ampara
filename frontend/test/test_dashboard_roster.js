const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR, DOCENTE } = require('./dashboard_harness');

const TURMAS = {
  status: 200,
  body: {
    turmas: [
      { id: 1, nome: '1º Ano A', turno: 'matutino', total_estudantes: 2 },
      { id: 7, nome: '3º Ano C', turno: 'noturno', total_estudantes: 1 }
    ]
  }
};

function estudante(id, nome, turma) {
  return { id: id, nome: nome, matricula: '2026.01.000' + id, turma: turma || { id: 1, nome: '1º Ano A' } };
}

function estudantes(...items) {
  return { status: 200, body: { estudantes: items } };
}

const CLASS_1 = estudantes(estudante(25, 'Lucas Mendes de Oliveira'), estudante(26, 'Ana Beatriz Santos'));

async function open(usuario, routes) {
  const ctx = loadDashboard({ usuario: usuario, routes: routes });
  await settle();
  return ctx;
}

test('the teacher sidebar and class cards come from GET /api/turmas', async () => {
  const { document, calls } = await open(DOCENTE, { 'GET /api/turmas': TURMAS });

  const call = calls.find(c => c.url === '/api/turmas');
  assert.deepStrictEqual(call.headers, { Authorization: 'Bearer jwt_test' });

  const sidebar = [...document.querySelectorAll('#sidebar-class-list .btn-sidebar')].map(b => b.textContent.trim());
  assert.deepStrictEqual(sidebar, ['🏫 1º Ano A', '🏫 3º Ano C']);

  const cards = [...document.querySelectorAll('#teacher-class-cards .class-select-card')];
  assert.strictEqual(cards.length, 2);
  assert.strictEqual(cards[0].tagName, 'BUTTON');
  assert.match(cards[0].textContent, /1º Ano A\s+2 estudantes matriculados/);
  assert.match(cards[1].textContent, /3º Ano C\s+1 estudante matriculado/);
});

test('no hardcoded classes or alert labels remain in the teacher panel', async () => {
  const { document } = await open(DOCENTE, { 'GET /api/turmas': TURMAS });
  const panel = document.getElementById('panel-docente');

  for (const key of ['1a', '1b', '2a', '2b']) {
    assert.strictEqual(panel.querySelector(`[data-class="${key}"]`), null, key);
  }
  assert.doesNotMatch(panel.textContent, /alertas? emociona(l|is) ativos?|Comportamento estável/);
});

test('opening a class lists its students from GET /api/estudantes?turma_id=', async () => {
  const { document, calls } = await open(DOCENTE, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes?turma_id=1': CLASS_1
  });

  document.querySelector('#teacher-class-cards [data-class="1"]').click();
  await settle();

  assert.ok(calls.some(c => c.url === '/api/estudantes?turma_id=1'));
  assert.strictEqual(document.getElementById('teacher-class-details').style.display, 'block');
  assert.strictEqual(document.getElementById('selected-class-title').textContent, 'Turma: 1º Ano A');
  const names = [...document.querySelectorAll('#students-grid-container .student-card strong')].map(s => s.textContent);
  assert.deepStrictEqual(names, ['Lucas Mendes de Oliveira', 'Ana Beatriz Santos']);
  assert.ok(document.querySelector('#sidebar-class-list [data-class="1"]').classList.contains('active'));
});

test('the student modal opens for a student loaded from the API', async () => {
  const { document } = await open(DOCENTE, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes?turma_id=1': CLASS_1
  });
  document.querySelector('#sidebar-class-list [data-class="1"]').click();
  await settle();

  document.querySelector('.btn-open-modal[data-student-id="26"]').click();

  assert.strictEqual(document.getElementById('student-modal').style.display, 'flex');
  assert.strictEqual(document.getElementById('modal-student-name').textContent, 'Ana Beatriz Santos');
  assert.strictEqual(document.getElementById('modal-student-matricula').textContent, 'Matrícula: 2026.01.00026');
});

test('empty and failed class lists show their own messages', async () => {
  let ctx = await open(DOCENTE, { 'GET /api/turmas': { status: 200, body: { turmas: [] } } });
  assert.match(ctx.document.getElementById('teacher-class-cards').textContent, /Nenhuma turma cadastrada na escola ainda/);

  ctx = await open(DOCENTE, { 'GET /api/turmas': { fail: true } });
  assert.match(ctx.document.getElementById('teacher-class-cards').textContent, /Não foi possível carregar as turmas/);
});

test('a class without students and a failed student list show their own messages', async () => {
  const { document } = await open(DOCENTE, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes?turma_id=1': estudantes(),
    'GET /api/estudantes?turma_id=7': { fail: true }
  });

  document.querySelector('#teacher-class-cards [data-class="1"]').click();
  await settle();
  assert.match(document.getElementById('students-grid-container').textContent, /Nenhum estudante cadastrado nesta turma/);

  document.querySelector('#sidebar-class-list [data-class="7"]').click();
  await settle();
  assert.match(document.getElementById('students-grid-container').textContent, /Não foi possível carregar os estudantes/);
});

function openSearchTab(document) {
  document.getElementById('btn-gestor-tab-busca').click();
  return settle();
}

test('the coordinator class search filters the roster classes and expands a class on demand', async () => {
  const { document, calls } = await open(GESTOR, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes': estudantes(),
    'GET /api/estudantes?turma_id=7': estudantes(estudante(40, 'Camila Ribeiro', { id: 7, nome: '3º Ano C' }))
  });
  await openSearchTab(document);

  const input = document.getElementById('search-classes-input');
  input.value = '3º';
  input.dispatchEvent(new document.defaultView.Event('input'));
  await settle();

  const boxes = [...document.querySelectorAll('#search-classes-results-container [data-turma-id]')];
  assert.deepStrictEqual(boxes.map(b => b.getAttribute('data-turma-id')), ['7']);

  const toggle = boxes[0].querySelector('.search-class-toggle');
  toggle.click();
  await settle();
  assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(calls.some(c => c.url === '/api/estudantes?turma_id=7'));
  assert.match(boxes[0].querySelector('.roster-collapsed').textContent, /Camila Ribeiro/);
});

test('the coordinator student search queries the API with q and opens the student record', async () => {
  const { document, calls } = await open(GESTOR, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes': CLASS_1,
    'GET /api/estudantes?q=Lucas': estudantes(estudante(25, 'Lucas Mendes de Oliveira'))
  });
  await openSearchTab(document);
  assert.strictEqual(document.querySelectorAll('#search-students-results-container .btn-ver-prontuario').length, 2);

  const input = document.getElementById('search-students-input');
  input.value = 'Lucas';
  input.dispatchEvent(new document.defaultView.Event('input'));
  await settle(400);

  assert.strictEqual(calls.filter(c => c.url === '/api/estudantes?q=Lucas').length, 1);
  const results = [...document.querySelectorAll('#search-students-results-container .btn-ver-prontuario')];
  assert.deepStrictEqual(results.map(b => b.getAttribute('data-student-id')), ['25']);

  results[0].click();
  assert.strictEqual(document.getElementById('search-student-timeline-box').style.display, 'block');
  assert.strictEqual(document.getElementById('search-timeline-student-name').textContent, 'Lucas Mendes de Oliveira');
});

test('the occurrence modal lists the school students and classes from the API', async () => {
  const { document } = await open(GESTOR, {
    'GET /api/turmas': TURMAS,
    'GET /api/estudantes': CLASS_1
  });
  document.getElementById('btn-gestor-tab-ocorrencias').click();
  document.getElementById('btn-open-occurrence').click();
  await settle();

  const students = [...document.querySelectorAll('#occurrence-target-student option')].map(o => [o.value, o.textContent]);
  assert.deepStrictEqual(students, [
    ['', 'Selecione o estudante...'],
    ['25', 'Lucas Mendes de Oliveira (1º Ano A)'],
    ['26', 'Ana Beatriz Santos (1º Ano A)']
  ]);
  const classes = [...document.querySelectorAll('#occurrence-target-class option')].map(o => o.value);
  assert.deepStrictEqual(classes, ['', '1', '7']);
});

test('training material recipients are the roster classes', async () => {
  const { document } = await open(GESTOR, { 'GET /api/turmas': TURMAS });
  document.getElementById('btn-gestor-tab-capacitacao').click();
  await settle();

  const recipients = [...document.querySelectorAll('input[name="destinatarios"]')].map(i => i.value);
  assert.deepStrictEqual(recipients, ['1', '7']);
});
