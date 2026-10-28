const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadDashboard, settle, pressEscape, GESTOR, DOCENTE } = require('./dashboard_harness');

const publicDir = path.resolve(__dirname, '../public');
const pages = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));
const TAGLINE = 'Apoio, Monitoramento Psicológico e Acolhimento Responsável ao Aluno';

for (const page of pages) {
  test(`${page} has the accessibility bar, loads main.js and shows the shared tagline`, () => {
    const { document } = new JSDOM(fs.readFileSync(path.join(publicDir, page), 'utf-8')).window;

    assert.ok(document.querySelector('.a11y-bar [data-action="font"]'), 'accessibility bar');
    assert.ok(document.querySelector('script[src="/js/main.js"]'), 'main.js');
    assert.strictEqual(document.querySelector('.tagline').textContent, TAGLINE);
  });
}

test('the toast keeps its natural width and stays inside the screen', () => {
  const mainJs = fs.readFileSync(path.join(publicDir, 'js/main.js'), 'utf-8');
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(mainJs);

  dom.window.toast('Salvo.');
  const el = dom.window.document.querySelector('[role="status"]');

  assert.strictEqual(el.style.width, 'max-content');
  assert.strictEqual(el.style.maxWidth, 'calc(100vw - 32px)');
});

const TURMAS = { status: 200, body: { turmas: [{ id: 1, nome: '1º Ano A', turno: 'matutino', total_estudantes: 1 }] } };
const ESTUDANTES = {
  status: 200,
  body: { estudantes: [{ id: 25, nome: 'Lucas Mendes de Oliveira', matricula: '2026.01.0001', turma: { id: 1, nome: '1º Ano A' } }] }
};

test('the student modal is a dialog that closes on Escape and on the backdrop, returning focus', async () => {
  const { window, document } = loadDashboard({
    usuario: DOCENTE,
    routes: { 'GET /api/turmas': TURMAS, 'GET /api/estudantes?turma_id=1': ESTUDANTES }
  });
  await settle();
  document.querySelector('#teacher-class-cards [data-class="1"]').click();
  await settle();
  const modal = document.getElementById('student-modal');
  const opener = document.querySelector('.btn-open-modal[data-student-id="25"]');

  assert.strictEqual(modal.getAttribute('role'), 'dialog');
  assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
  assert.strictEqual(document.getElementById(modal.getAttribute('aria-labelledby')).id, 'modal-student-name');

  opener.focus();
  opener.click();
  assert.strictEqual(modal.style.display, 'flex');
  assert.strictEqual(document.activeElement.id, 'behavior-type');

  pressEscape(window);
  assert.strictEqual(modal.style.display, 'none');
  assert.strictEqual(document.activeElement, opener);

  opener.click();
  modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.strictEqual(modal.style.display, 'none');
  assert.strictEqual(document.activeElement, opener);
});

test('the occurrence modal is a dialog that closes on Escape and returns focus', async () => {
  const { window, document } = loadDashboard({ usuario: GESTOR, routes: { 'GET /api/turmas': TURMAS, 'GET /api/estudantes': ESTUDANTES } });
  await settle();
  document.getElementById('btn-gestor-tab-ocorrencias').click();
  const modal = document.getElementById('occurrence-modal');
  const opener = document.getElementById('btn-open-occurrence');

  assert.strictEqual(modal.getAttribute('role'), 'dialog');
  assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
  assert.strictEqual(document.getElementById(modal.getAttribute('aria-labelledby')).textContent, 'Registrar Intervenção da Coordenação');

  opener.focus();
  opener.click();
  assert.strictEqual(modal.style.display, 'flex');
  assert.strictEqual(document.activeElement.id, 'occurrence-type');

  pressEscape(window);
  assert.strictEqual(modal.style.display, 'none');
  assert.strictEqual(document.activeElement, opener);
});

test('the dashboard modal close buttons are labelled for screen readers', () => {
  const { document } = loadDashboard({ usuario: GESTOR });

  for (const id of ['btn-close-modal', 'btn-close-occurrence-modal', 'btn-close-triage-modal']) {
    assert.strictEqual(document.getElementById(id).getAttribute('aria-label'), 'Fechar', id);
  }
});
