const test = require('node:test');
const assert = require('node:assert');
const { pressEscape } = require('./dashboard_harness');
const { PENDING_ROUTE, membro, equipe, openTeam, row } = require('./team_fixtures');

async function openRefusal() {
  const ctx = await openTeam({ [PENDING_ROUTE]: equipe([membro(12, 'docente', 'Pendente', { nome: 'Maria Silva' })]) });
  const opener = row(ctx.document, 12).querySelector('[data-team-action="recusar"]');
  opener.focus();
  opener.click();
  return { ...ctx, opener, modal: ctx.document.getElementById('access-confirm-modal') };
}

test('the confirmation is an accessible dialog that starts on "Cancelar"', async () => {
  const { document, modal } = await openRefusal();

  assert.strictEqual(modal.getAttribute('role'), 'dialog');
  assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
  assert.strictEqual(document.getElementById(modal.getAttribute('aria-labelledby')).textContent, 'Recusar solicitação de cadastro?');
  assert.strictEqual(modal.getAttribute('aria-describedby'), 'access-confirm-body');
  assert.strictEqual(document.activeElement.id, 'btn-cancel-access-confirm');
});

test('Escape cancels and returns focus to the button that opened the dialog', async () => {
  const { window, document, calls, opener, modal } = await openRefusal();

  pressEscape(window);

  assert.strictEqual(modal.style.display, 'none');
  assert.strictEqual(document.activeElement, opener);
  assert.strictEqual(calls.some(c => c.method === 'POST'), false);
});

test('a click on the backdrop cancels and returns focus', async () => {
  const { window, document, calls, opener, modal } = await openRefusal();

  modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  assert.strictEqual(modal.style.display, 'none');
  assert.strictEqual(document.activeElement, opener);
  assert.strictEqual(calls.some(c => c.method === 'POST'), false);
});

test('a click inside the dialog card does not close it', async () => {
  const { window, document, modal } = await openRefusal();

  document.getElementById('access-confirm-body').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  assert.strictEqual(modal.style.display, 'flex');
});
