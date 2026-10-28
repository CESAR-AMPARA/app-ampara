const test = require('node:test');
const assert = require('node:assert');
const { loadDashboard, settle, GESTOR, DOCENTE, PSICOLOGA } = require('./dashboard_harness');

const PANELS = ['panel-gestor', 'panel-docente', 'panel-saude'];

function visiblePanels(document) {
  return PANELS.filter(id => document.getElementById(id).style.display === 'block');
}

test('without a token the dashboard redirects to the login page and loads nothing', async () => {
  const { window, document, calls } = loadDashboard({ usuario: GESTOR, token: null });
  await settle();

  assert.strictEqual(window.__mock_location_href, '/login');
  assert.deepStrictEqual(calls, []);
  assert.deepStrictEqual(visiblePanels(document), []);
});

test('without a logged user the dashboard redirects to the login page', async () => {
  const { window, calls } = loadDashboard({ usuario: null });
  await settle();

  assert.strictEqual(window.__mock_location_href, '/login');
  assert.deepStrictEqual(calls, []);
});

test('an unknown profile redirects to the login page instead of defaulting to a panel', async () => {
  for (const perfil of ['gestao', 'equipe', 'super_admin']) {
    const { window, document } = loadDashboard({ usuario: { id: 1, nome: 'X', perfil: perfil } });
    await settle();

    assert.strictEqual(window.__mock_location_href, '/login', perfil);
    assert.deepStrictEqual(visiblePanels(document), [], perfil);
  }
});

test('each profile opens only its own panel', async () => {
  const expected = [
    [GESTOR, 'panel-gestor', 'Painel de Credenciamento'],
    [DOCENTE, 'panel-docente', 'Acompanhamento Comportamental'],
    [PSICOLOGA, 'panel-saude', 'Casos Designados']
  ];
  for (const [usuario, panel, title] of expected) {
    const { window, document } = loadDashboard({ usuario: usuario });
    await settle();

    assert.strictEqual(window.__mock_location_href, undefined, usuario.perfil);
    assert.deepStrictEqual(visiblePanels(document), [panel], usuario.perfil);
    assert.strictEqual(document.getElementById('dashboard-title').textContent, title);
  }
});

test('the simulated profile switcher no longer exists', async () => {
  const { document } = loadDashboard({ usuario: GESTOR });
  await settle();

  assert.strictEqual(document.getElementById('rbac-switcher-box'), null);
  for (const id of ['btn-rbac-gestor', 'btn-rbac-docente', 'btn-rbac-saude']) {
    assert.strictEqual(document.getElementById(id), null, id);
  }
  assert.doesNotMatch(document.body.textContent, /Seletor de Perfil Simulado/);
});

test('a 401 from a dashboard request sends the user to the login page', async () => {
  const cases = [
    [GESTOR, 'GET /api/gestao/equipe?status=Pendente'],
    [DOCENTE, 'GET /api/turmas'],
    [PSICOLOGA, 'GET /api/multidisciplinar/encaminhamentos']
  ];
  for (const [usuario, route] of cases) {
    const { window } = loadDashboard({
      usuario: usuario,
      routes: { [route]: { status: 401, body: { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' } } }
    });
    await settle();

    assert.strictEqual(window.__mock_location_href, '/login', route);
  }
});

test('"Sair" ends the session but keeps the accessibility preferences', async () => {
  const a11y = JSON.stringify({ font: 1.3, contrast: true });
  const { window, document } = loadDashboard({
    usuario: DOCENTE,
    storage: { usuario: JSON.stringify(DOCENTE), 'ampara.a11y': a11y }
  });
  await settle();

  document.getElementById('btn-logout').click();

  assert.strictEqual(window.localStorage.getItem('token'), null);
  assert.strictEqual(window.localStorage.getItem('usuario'), null);
  assert.strictEqual(window.sessionStorage.getItem('usuarioLogado'), null);
  assert.strictEqual(window.localStorage.getItem('ampara.a11y'), a11y);
  assert.strictEqual(window.__mock_location_href, '/login');
});
