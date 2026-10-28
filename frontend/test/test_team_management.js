const test = require('node:test');
const assert = require('node:assert');
const { settle } = require('./dashboard_harness');
const { PENDING_ROUTE, ACTIVE_ROUTE, membro, EU, equipe, openTeam, openActiveTeam, row, actions } = require('./team_fixtures');

const RESUMO = { total: 18, ativos: 14, pendentes: 3, suspensos: 1 };

test('the tab opens on pending registrations with counters for the whole school', async () => {
  const { document, calls } = await openTeam({
    [PENDING_ROUTE]: equipe([membro(12, 'docente', 'Pendente')], RESUMO)
  });

  const teamCalls = calls.filter(c => c.url.startsWith('/api/gestao/equipe'));
  assert.deepStrictEqual(teamCalls.map(c => c.url), ['/api/gestao/equipe?status=Pendente']);
  assert.deepStrictEqual(teamCalls[0].headers, { Authorization: 'Bearer jwt_test' });
  assert.strictEqual(calls.some(c => c.url === '/api/gestao/pendentes'), false);
  assert.strictEqual(document.getElementById('team-filter-status').value, 'Pendente');
  assert.strictEqual(document.getElementById('stat-active').textContent, '14');
  assert.strictEqual(document.getElementById('stat-pending').textContent, '3');
  assert.strictEqual(document.getElementById('stat-suspended').textContent, '1');
  assert.match(document.querySelector('#gestor-tab-credenciamento h2').textContent, /Equipe da Escola/);
});

test('without pending registrations the tab opens on the active team', async () => {
  const { document, calls } = await openTeam({
    [PENDING_ROUTE]: equipe([], { total: 2, ativos: 2, pendentes: 0, suspensos: 0 }),
    [ACTIVE_ROUTE]: equipe([EU, membro(12, 'docente', 'Ativo')])
  });

  assert.deepStrictEqual(
    calls.filter(c => c.url.startsWith('/api/gestao/equipe')).map(c => c.url),
    ['/api/gestao/equipe?status=Pendente', '/api/gestao/equipe?status=Ativo']
  );
  assert.strictEqual(document.getElementById('team-filter-status').value, 'Ativo');
  assert.ok(row(document, 12));
});

test('the filters re-request the team with status and profile', async () => {
  const { document, calls } = await openTeam({ [PENDING_ROUTE]: equipe([membro(12, 'docente', 'Pendente')]) });
  const status = document.getElementById('team-filter-status');
  const perfil = document.getElementById('team-filter-perfil');

  status.value = 'Suspenso';
  status.dispatchEvent(new document.defaultView.Event('change'));
  perfil.value = 'equipe_multidisciplinar';
  perfil.dispatchEvent(new document.defaultView.Event('change'));
  status.value = '';
  status.dispatchEvent(new document.defaultView.Event('change'));
  await settle();

  assert.deepStrictEqual(calls.filter(c => c.url.startsWith('/api/gestao/equipe')).map(c => c.url).slice(1), [
    '/api/gestao/equipe?status=Suspenso',
    '/api/gestao/equipe?status=Suspenso&perfil=equipe_multidisciplinar',
    '/api/gestao/equipe?perfil=equipe_multidisciplinar'
  ]);
});

test('each status shows exactly its actions, labelled with the person', async () => {
  const { document } = await openTeam({
    [PENDING_ROUTE]: equipe([
      EU,
      membro(12, 'docente', 'Pendente', { nome: 'Maria Silva' }),
      membro(13, 'docente', 'Ativo', { nome: 'Carlos Souza' }),
      membro(14, 'equipe_multidisciplinar', 'Suspenso', { nome: 'Amanda Costa' })
    ])
  });

  assert.deepStrictEqual(actions(document, 12), ['Aprovar', 'Recusar']);
  assert.deepStrictEqual(actions(document, 13), ['Suspender']);
  assert.deepStrictEqual(actions(document, 14), ['Reativar']);
  assert.strictEqual(row(document, 12).querySelector('[data-team-action="recusar"]').getAttribute('aria-label'), 'Recusar cadastro de Maria Silva');
  assert.strictEqual(row(document, 13).querySelector('[data-team-action="suspender"]').getAttribute('aria-label'), 'Suspender acesso de Carlos Souza');
  assert.strictEqual(row(document, 14).querySelector('[data-team-action="reativar"]').getAttribute('aria-label'), 'Reativar acesso de Amanda Costa');
});

test('the coordinator cannot suspend themselves or the last active manager', async () => {
  let ctx = await openActiveTeam([EU]);
  assert.deepStrictEqual(actions(ctx.document, EU.id), []);

  ctx = await openActiveTeam([EU, membro(2, 'gestor_escolar', 'Ativo')]);
  assert.deepStrictEqual(actions(ctx.document, EU.id), []);
  assert.deepStrictEqual(actions(ctx.document, 2), ['Suspender']);

  // Another school manager shown alone (the logged one is suspended elsewhere) is the last active one.
  ctx = await openActiveTeam([membro(2, 'gestor_escolar', 'Ativo')]);
  assert.deepStrictEqual(actions(ctx.document, 2), []);
});

test('rows show profile labels, cargo, status and the date access last changed', async () => {
  const { document } = await openTeam({
    [PENDING_ROUTE]: equipe([
      membro(12, 'docente', 'Pendente'),
      membro(13, 'equipe_multidisciplinar', 'Suspenso', { registro_profissional: 'CRP 06/12345', status_alterado_em: '2026-10-20T13:00:00Z' }),
      membro(14, 'gestor_escolar', 'Ativo')
    ])
  });
  const cells = id => [...row(document, id).querySelectorAll('td')].map(td => td.textContent.trim());

  assert.match(cells(12)[0], /Profissional 12\s*prof12@escola\.gov\.br/);
  assert.strictEqual(cells(12)[1], 'Docente');
  assert.strictEqual(cells(12)[3], 'Aguardando Aprovação');
  assert.strictEqual(cells(12)[4], '12/09/2026');
  assert.strictEqual(cells(13)[1], 'Equipe Multidisciplinar');
  assert.match(cells(13)[2], /Cargo 13\s*CRP 06\/12345/);
  assert.strictEqual(cells(13)[3], 'Suspenso');
  assert.strictEqual(cells(13)[4], '20/10/2026');
  assert.strictEqual(cells(14)[1], 'Gestão / Coordenação');
  assert.strictEqual(cells(14)[3], 'Ativo');
});

test('approving acts at once, shows the backend message and reloads the team', async () => {
  const { document, calls, toasts } = await openTeam({
    [PENDING_ROUTE]: [equipe([membro(12, 'docente', 'Pendente')]), equipe([])],
    'POST /api/gestao/usuarios/12/aprovar': { status: 200, body: { sucesso: true, mensagem: 'Usuário aprovado com sucesso.' } }
  });

  const btn = row(document, 12).querySelector('[data-team-action="aprovar"]');
  btn.click();
  assert.strictEqual(btn.disabled, true);
  await settle();

  const post = calls.find(c => c.method === 'POST');
  assert.strictEqual(post.url, '/api/gestao/usuarios/12/aprovar');
  assert.deepStrictEqual(post.headers, { Authorization: 'Bearer jwt_test' });
  assert.deepStrictEqual(toasts, ['Usuário aprovado com sucesso.']);
  assert.strictEqual(row(document, 12), null);
  assert.match(document.getElementById('users-tbody').textContent, /Nenhum profissional encontrado com estes filtros/);
});

test('reactivating acts at once without a confirmation', async () => {
  const { document, calls, toasts } = await openTeam({
    [PENDING_ROUTE]: equipe([membro(14, 'docente', 'Suspenso')], { total: 1, ativos: 0, pendentes: 1, suspensos: 1 }),
    'POST /api/gestao/usuarios/14/reativar': { status: 200, body: { sucesso: true, mensagem: 'Acesso do usuário reativado.' } }
  });

  row(document, 14).querySelector('[data-team-action="reativar"]').click();
  await settle();

  assert.strictEqual(document.getElementById('access-confirm-modal').style.display, 'none');
  assert.ok(calls.some(c => c.method === 'POST' && c.url === '/api/gestao/usuarios/14/reativar'));
  assert.deepStrictEqual(toasts, ['Acesso do usuário reativado.']);
});

test('refusing asks for confirmation and sends nothing on cancel', async () => {
  const { document, calls } = await openTeam({ [PENDING_ROUTE]: equipe([membro(12, 'docente', 'Pendente', { nome: 'Maria Silva' })]) });

  row(document, 12).querySelector('[data-team-action="recusar"]').click();

  assert.strictEqual(document.getElementById('access-confirm-modal').style.display, 'flex');
  assert.strictEqual(document.getElementById('access-confirm-title').textContent, 'Recusar solicitação de cadastro?');
  assert.strictEqual(document.getElementById('access-confirm-body').textContent, 'Os dados enviados por Maria Silva serão excluídos. A pessoa poderá se cadastrar novamente.');
  assert.strictEqual(document.getElementById('btn-access-confirm').textContent, 'Recusar cadastro');

  document.getElementById('btn-cancel-access-confirm').click();
  await settle();
  assert.strictEqual(document.getElementById('access-confirm-modal').style.display, 'none');
  assert.strictEqual(calls.some(c => c.method === 'POST'), false);
});

test('confirming a refusal sends the POST, reloads the team and closes the dialog', async () => {
  const { document, calls, toasts } = await openTeam({
    [PENDING_ROUTE]: [equipe([membro(12, 'docente', 'Pendente')]), equipe([])],
    'POST /api/gestao/usuarios/12/recusar': { status: 200, body: { sucesso: true, mensagem: 'Solicitação de cadastro recusada.' } }
  });

  row(document, 12).querySelector('[data-team-action="recusar"]').click();
  document.getElementById('btn-access-confirm').click();
  assert.strictEqual(document.getElementById('btn-access-confirm').disabled, true);
  await settle();

  assert.ok(calls.some(c => c.method === 'POST' && c.url === '/api/gestao/usuarios/12/recusar'));
  assert.deepStrictEqual(toasts, ['Solicitação de cadastro recusada.']);
  assert.strictEqual(document.getElementById('access-confirm-modal').style.display, 'none');
  assert.strictEqual(row(document, 12), null);
  assert.strictEqual(document.activeElement.id, 'team-filter-status');
});

test('suspending warns about open cases only when there are some', async () => {
  const { document } = await openActiveTeam([
    membro(8, 'equipe_multidisciplinar', 'Ativo', { nome: 'Amanda Costa', casos_abertos: 2 }),
    membro(9, 'equipe_multidisciplinar', 'Ativo', { nome: 'Bruno Lima', casos_abertos: 0 })
  ]);
  const body = () => document.getElementById('access-confirm-body').textContent;

  row(document, 8).querySelector('[data-team-action="suspender"]').click();
  assert.strictEqual(document.getElementById('access-confirm-title').textContent, 'Suspender acesso?');
  assert.strictEqual(document.getElementById('btn-access-confirm').textContent, 'Suspender acesso');
  assert.match(body(), /Amanda Costa perderá o acesso imediatamente, inclusive em sessões já abertas\./);
  assert.match(body(), /Esta pessoa tem 2 caso\(s\) em aberto na Fila de Encaminhamentos\. Redesigne-os após a suspensão\./);

  document.getElementById('btn-cancel-access-confirm').click();
  row(document, 9).querySelector('[data-team-action="suspender"]').click();
  assert.doesNotMatch(body(), /caso\(s\) em aberto/);
});

test('a 409 shows the backend message and keeps the list', async () => {
  const mensagem = 'A escola precisa manter ao menos um gestor ativo.';
  const { document, toasts } = await openActiveTeam([EU, membro(2, 'gestor_escolar', 'Ativo')], {
    'POST /api/gestao/usuarios/2/suspender': { status: 409, body: { sucesso: false, mensagem: mensagem } }
  });

  row(document, 2).querySelector('[data-team-action="suspender"]').click();
  document.getElementById('btn-access-confirm').click();
  await settle();

  assert.deepStrictEqual(toasts, [mensagem]);
  assert.strictEqual(document.getElementById('access-confirm-modal').style.display, 'none');
  assert.ok(row(document, 2));
  assert.strictEqual(document.getElementById('btn-access-confirm').disabled, false);
});

test('a failed load offers a retry that requests the team again', async () => {
  const { document, calls } = await openTeam({
    [PENDING_ROUTE]: [{ fail: true }, equipe([membro(12, 'docente', 'Pendente')])]
  });

  assert.match(document.getElementById('users-tbody').textContent, /Não foi possível carregar a equipe\. Tente novamente\./);
  document.getElementById('btn-retry-team').click();
  await settle();

  assert.strictEqual(calls.filter(c => c.url === '/api/gestao/equipe?status=Pendente').length, 2);
  assert.ok(row(document, 12));
});

test('names are escaped in rows and in the confirmation dialog', async () => {
  const nome = '<img src=x onerror=alert(1)>';
  const { document } = await openTeam({ [PENDING_ROUTE]: equipe([membro(12, 'docente', 'Pendente', { nome: nome })]) });

  assert.strictEqual(document.querySelector('#users-tbody img'), null);
  row(document, 12).querySelector('[data-team-action="recusar"]').click();
  assert.strictEqual(document.querySelector('#access-confirm-body img'), null);
  assert.match(document.getElementById('access-confirm-body').textContent, /<img src=x/);
});

test('the tab explains the registration link and copies it', async () => {
  const { window, document, toasts } = await openTeam({ [PENDING_ROUTE]: equipe([]) });
  let copied = null;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { copied = text; } }
  });

  assert.strictEqual(
    document.getElementById('registration-note-text').textContent,
    'Novos profissionais solicitam acesso pelo cadastro em http://localhost/cadastro e aparecem aqui para aprovação.'
  );
  document.getElementById('btn-copy-registration-link').click();
  await settle();

  assert.strictEqual(copied, 'http://localhost/cadastro');
  assert.deepStrictEqual(toasts, ['Link de cadastro copiado.']);
  assert.strictEqual(document.getElementById('btn-open-add-teacher'), null);
});
