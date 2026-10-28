// Payloads of GET /api/gestao/equipe (todo/0011) shared by the team management tests.
const { loadDashboard, settle, GESTOR } = require('./dashboard_harness');

const PENDING_ROUTE = 'GET /api/gestao/equipe?status=Pendente';
const ACTIVE_ROUTE = 'GET /api/gestao/equipe?status=Ativo';

function membro(id, perfil, status, extra) {
  return {
    id: id,
    nome: 'Profissional ' + id,
    email: 'prof' + id + '@escola.gov.br',
    perfil: perfil,
    cargo: 'Cargo ' + id,
    registro_profissional: null,
    status: status,
    created_at: '2026-09-12T14:32:00Z',
    status_alterado_em: null,
    ...extra
  };
}

// The coordinator logged in through the harness; always listed with the active team.
const EU = membro(GESTOR.id, 'gestor_escolar', 'Ativo', { nome: GESTOR.nome });

function equipe(usuarios, resumo) {
  const contar = status => usuarios.filter(u => u.status === status).length;
  return {
    status: 200,
    body: {
      resumo: resumo || { total: usuarios.length, ativos: contar('Ativo'), pendentes: contar('Pendente'), suspensos: contar('Suspenso') },
      usuarios: usuarios
    }
  };
}

async function openTeam(routes) {
  const ctx = loadDashboard({ usuario: GESTOR, routes: routes });
  await settle();
  return ctx;
}

// With nothing pending the tab falls back to the active team, where most actions start.
function openActiveTeam(usuarios, routes) {
  return openTeam({
    [PENDING_ROUTE]: equipe([], { total: usuarios.length, ativos: usuarios.length, pendentes: 0, suspensos: 0 }),
    [ACTIVE_ROUTE]: equipe(usuarios),
    ...routes
  });
}

function row(document, id) {
  return document.getElementById('user-row-' + id);
}

function actions(document, id) {
  return [...row(document, id).querySelectorAll('[data-team-action]')].map(b => b.textContent);
}

module.exports = { PENDING_ROUTE, ACTIVE_ROUTE, membro, EU, equipe, openTeam, openActiveTeam, row, actions };
