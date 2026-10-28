O backend da equipe (spec 0011) ainda não existe, então o teste manual usa uma API simulada que colamos no console do navegador.

# Como testar o fluxo de frontend sem a API?

## 1. Pegar a branch da PR e subir o servidor

```bash
git fetch origin
```

```bash
git switch claude/todo-0012-access-management-frontend
```

```bash
./dev.sh serve
```

## 2. Entrar como coordenação

Abra http://localhost:5000/login, abra o console do navegador (F12 → Console) e rode:

```js
localStorage.setItem('token', 'dev');
sessionStorage.setItem('usuarioLogado', JSON.stringify({ id: 1, nome: 'Diretor João', email: 'joao@escola.gov.br', perfil: 'gestor_escolar' }));
location.href = '/dashboard';
```

A aba vai mostrar "Não foi possível carregar a equipe", porque a API não existe. É o esperado.

## 3. Colar a API simulada

No console do `/dashboard`, cole isto. Ele cria uma escola de mentira com 5 pessoas e recarrega a tabela:

```js
(() => {
  const equipe = [
    { id: 1, nome: 'Diretor João', email: 'joao@escola.gov.br', perfil: 'gestor_escolar', cargo: 'Diretor Escolar', status: 'Ativo' },
    { id: 12, nome: 'Maria Silva', email: 'maria@escola.gov.br', perfil: 'docente', cargo: 'Professora de Matemática', status: 'Pendente' },
    { id: 13, nome: 'Carlos Souza', email: 'carlos@escola.gov.br', perfil: 'docente', cargo: 'Professor de História', status: 'Ativo' },
    { id: 8, nome: 'Amanda Costa', email: 'amanda@escola.gov.br', perfil: 'equipe_multidisciplinar', cargo: 'Psicóloga Escolar', registro_profissional: 'CRP 06/12345', status: 'Ativo', casos_abertos: 2 },
    { id: 14, nome: 'Paula Rocha', email: 'paula@escola.gov.br', perfil: 'docente', cargo: 'Professora de Artes', status: 'Suspenso' }
  ].map(u => ({ registro_profissional: null, created_at: '2026-09-12T14:32:00Z', status_alterado_em: null, ...u }));
  const regras = {
    aprovar: ['Pendente', 'Ativo', 'Usuário aprovado com sucesso.'],
    recusar: ['Pendente', null, 'Solicitação de cadastro recusada.'],
    suspender: ['Ativo', 'Suspenso', 'Acesso do usuário suspenso.'],
    reativar: ['Suspenso', 'Ativo', 'Acesso do usuário reativado.']
  };
  const resposta = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const fetchReal = window.fetch;
  window.fetch = (url, opts = {}) => {
    const u = new URL(url, location.origin);
    if (u.pathname === '/api/gestao/equipe') {
      const st = u.searchParams.get('status'), pf = u.searchParams.get('perfil');
      const conta = s => equipe.filter(x => x.status === s).length;
      return resposta(200, {
        resumo: { total: equipe.length, ativos: conta('Ativo'), pendentes: conta('Pendente'), suspensos: conta('Suspenso') },
        usuarios: equipe.filter(x => (!st || x.status === st) && (!pf || x.perfil === pf))
      });
    }
    const m = u.pathname.match(/^\/api\/gestao\/usuarios\/(\d+)\/(aprovar|recusar|suspender|reativar)$/);
    if (m && opts.method === 'POST') {
      const user = equipe.find(x => x.id === Number(m[1]));
      if (!user) return resposta(404, { sucesso: false, mensagem: 'Usuário não encontrado.' });
      const [de, para, mensagem] = regras[m[2]];
      if (user.status !== de) return resposta(409, { sucesso: false, mensagem: 'Esta ação não se aplica ao status atual do usuário.' });
      if (para === null) equipe.splice(equipe.indexOf(user), 1);
      else { user.status = para; user.status_alterado_em = new Date().toISOString(); }
      return resposta(200, { sucesso: true, mensagem });
    }
    return fetchReal(url, opts);
  };
  const filtro = document.getElementById('team-filter-status');
  filtro.value = 'Pendente';
  filtro.dispatchEvent(new Event('change'));
  return 'API simulada ativa';
})();
```

A simulação vale só até recarregar a página. Se recarregar (F5), cole o passo 3 de novo.

## 4. Roteiro do fluxo

1. **Pendentes:** a tabela mostra só Maria Silva, com "Aprovar" e "Recusar". Os contadores mostram 3 ativos, 1 pendente e 1 suspenso.
2. **Recusar e cancelar:** clique em "Recusar". O diálogo "Recusar solicitação de cadastro?" abre com o foco em "Cancelar". Aperte Esc: o diálogo fecha e nada acontece com a Maria.
3. **Aprovar:** clique em "Aprovar". Aparece a mensagem "Usuário aprovado com sucesso." e a lista de pendentes fica vazia.
4. **Equipe inteira:** mude o filtro Status para "Todos".
   - Diretor João não tem botão: é a sua própria linha.
   - Maria, Carlos e Amanda têm "Suspender".
   - Paula tem "Reativar".
5. **Suspender com casos abertos:** em Amanda Costa, clique em "Suspender". O diálogo avisa que ela tem 2 casos em aberto. Confirme: Amanda passa para "Suspenso", os contadores mudam para 3/0/2 e o foco volta para o filtro.
6. **Reativar:** em Paula, clique em "Reativar". Funciona direto, sem confirmação.
7. **Filtro de perfil:** escolha "Equipe Multidisciplinar". Só a Amanda aparece.
8. **Link de cadastro:** clique em "Copiar link de cadastro" e cole em algum lugar. Deve sair `http://localhost:5000/cadastro`.
9. **Celular:** no DevTools, ative o modo dispositivo (Ctrl+Shift+M) com 375 px. A página não pode rolar para o lado.

## 5. Testes automatizados

Os testes cobrem esse mesmo fluxo e mais casos de erro (409, falha de rede, nomes com HTML). Para rodar:

```bash
cd frontend/test && npm ci && npm test
```

O resultado deve ser 142 testes passando.
