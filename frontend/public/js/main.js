/* ==========================================================================
   A.M.P.A.R.A. — Comportamento das telas
   Sem dependências externas. Roda em qualquer página que inclua os elementos.
   ========================================================================== */
(function () {
  'use strict';

  /* -------------------- Acessibilidade (persistente) -------------------- */
  var STORE = 'ampara.a11y';
  var state = loadState();
  applyState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; }
    catch (e) { return {}; }
  }
  function saveState() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }
  function applyState() {
    // Escala de fonte: 1 / 1.15 / 1.3
    document.documentElement.style.setProperty('--fs-scale', state.font || 1);
    document.body.classList.toggle('high-contrast', !!state.contrast);
    document.querySelectorAll('[data-action="contrast"]').forEach(function (b) {
      b.setAttribute('aria-pressed', state.contrast ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.a11y-btn[data-action]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action');
      if (action === 'font') {
        var steps = [1, 1.15, 1.3];
        var i = steps.indexOf(state.font || 1);
        state.font = steps[(i + 1) % steps.length];
      } else if (action === 'contrast') {
        state.contrast = !state.contrast;
      } else if (action === 'reader') {
        toast('Leitor de tela: use as teclas do seu leitor (NVDA/JAWS/VoiceOver). A página é totalmente navegável por teclado.');
        return;
      }
      saveState();
      applyState();
    });
  });

  /* -------------------- Mostrar / ocultar senha -------------------- */
  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Mostrar';
    });
  });

  /* -------------------- Login (demo) -------------------- */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    // Limpar cache atual para simulação limpa
    sessionStorage.clear();
    localStorage.clear();

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }
      
      var email = document.getElementById('email').value.trim();
      var senha = document.getElementById('senha').value;

      var mockCreds = {
        "professor@ampara.gov.br": {
          "nome": "Prof. Ricardo Souza",
          "perfil": "docente",
          "escola": "Escola Estadual Castro Alves",
          "senha": "senha123"
        },
        "coordenador@ampara.gov.br": {
          "nome": "Coordenadora Márcia Silva",
          "perfil": "gestao",
          "escola": "Escola Estadual Castro Alves",
          "senha": "senha123"
        }
      };

      if (email in mockCreds) {
        var user = mockCreds[email];
        if (user.senha === senha) {
          sessionStorage.setItem("usuarioLogado", JSON.stringify({
            "nome": user.nome,
            "email": email,
            "perfil": user.perfil,
            "escola": user.escola
          }));
          toast('Login realizado. Redirecionando…');
          setTimeout(function() {
            window.location.href = 'dashboard.html';
          }, 1000);
        } else {
          toast('Senha inválida.');
        }
      } else {
        toast('E-mail ou senha inválidos.');
      }
    });
  }

  /* -------------------- Wizard de cadastro -------------------- */
  var wizard = document.getElementById('wizard');
  if (wizard) initWizard(wizard);

  function initWizard(form) {
    var TOTAL = 3;
    var current = 1;
    var chosenRole = null;

    // Seleção de perfil RBAC
    var roleCards = form.querySelectorAll('.rbac-card');
    roleCards.forEach(function (card) {
      card.addEventListener('click', function () {
        roleCards.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        card.setAttribute('aria-pressed', 'true');
        chosenRole = card.getAttribute('data-role');
      });
    });

    // Encadeamento Estado → Município → Escola
    var estado = document.getElementById('estado');
    var municipio = document.getElementById('municipio');
    var escola = document.getElementById('escola');
    if (estado) {
      estado.addEventListener('change', function () {
        var has = !!estado.value;
        municipio.disabled = !has;
        municipio.placeholder = has ? 'Digite o município...' : 'Selecione o estado primeiro';
        escola.disabled = !has;
      });
    }

    // Força de senha
    var pass1 = document.getElementById('pass1');
    var pass2 = document.getElementById('pass2');
    var fill = document.getElementById('strengthFill');
    var strengthLabel = document.getElementById('strengthLabel');
    var matchMsg = document.getElementById('matchMsg');
    var submitBtn = document.getElementById('submitBtn');
    var t1 = document.getElementById('t1');
    var t2 = document.getElementById('t2');

    if (pass1) {
      pass1.addEventListener('input', function () { renderStrength(); checkMatch(); refreshSubmit(); });
      pass2.addEventListener('input', function () { checkMatch(); refreshSubmit(); });
      [t1, t2].forEach(function (c) { c.addEventListener('change', refreshSubmit); });
    }

    function scoreOf(v) {
      var s = 0;
      if (v.length >= 8) s++;
      if (v.length >= 12) s++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
      if (/\d/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v)) s++;
      return Math.min(s, 4);
    }
    function renderStrength() {
      var v = pass1.value;
      if (!v) { fill.style.width = '0'; strengthLabel.textContent = 'Força: —'; strengthLabel.style.color = ''; return; }
      var levels = [
        { w: '25%',  t: 'Fraca',    c: '#c0492e' },
        { w: '50%',  t: 'Razoável', c: '#c79a2a' },
        { w: '75%',  t: 'Boa',      c: '#6f918a' },
        { w: '100%', t: 'Forte',    c: '#4f8a6b' }
      ];
      var lv = levels[Math.max(0, scoreOf(v) - 1)];
      fill.style.width = lv.w;
      fill.style.background = lv.c;
      strengthLabel.textContent = 'Força: ' + lv.t;
      strengthLabel.style.color = lv.c;
    }
    function checkMatch() {
      if (!pass2.value) { matchMsg.hidden = true; return; }
      matchMsg.hidden = false;
      var ok = pass1.value === pass2.value;
      matchMsg.textContent = ok ? '✓ As senhas coincidem.' : '✗ As senhas não coincidem.';
      matchMsg.classList.toggle('bad', !ok);
    }
    function refreshSubmit() {
      var ok = pass1.value.length >= 8 &&
               pass1.value === pass2.value &&
               t1.checked && t2.checked;
      submitBtn.disabled = !ok;
    }

    // Navegação entre etapas
    form.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!validateStep(current)) return;
        goTo(current + 1);
      });
    });
    form.querySelectorAll('[data-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(current - 1); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;
      goTo(4); // tela de sucesso
    });

    function validateStep(step) {
      if (step === 1) {
        if (!chosenRole) { toast('Selecione um perfil profissional para continuar.'); return false; }
        return requireFields(['nome', 'tel', 'email']);
      }
      if (step === 2) {
        return requireFields(['matricula', 'estado', 'municipio', 'escola']);
      }
      return true;
    }
    function requireFields(ids) {
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el && !el.disabled && !String(el.value).trim()) {
          el.focus();
          el.reportValidity ? el.reportValidity() : toast('Preencha os campos obrigatórios.');
          return false;
        }
      }
      return true;
    }

    function goTo(step) {
      current = Math.max(1, Math.min(4, step));
      // Painéis
      form.querySelectorAll('.panel').forEach(function (p) {
        p.classList.toggle('active', +p.getAttribute('data-panel') === current);
      });
      // Indicador de etapas
      document.querySelectorAll('#steps .step').forEach(function (s) {
        var n = +s.getAttribute('data-step');
        s.classList.remove('active', 'done');
        if (n < current) s.classList.add('done');
        else if (n === current) s.classList.add('active');
        // etapa "num" vira ✓ quando concluída
        var num = s.querySelector('.num');
        num.textContent = (n < current) ? '✓' : String(n);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* -------------------- Toast simples -------------------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);' +
        'background:#34495f;color:#fff;padding:13px 20px;border-radius:12px;' +
        'box-shadow:0 12px 30px -12px rgba(0,0,0,.5);z-index:200;max-width:90vw;' +
        'font-size:.92rem;opacity:0;transition:opacity .2s,transform .2s;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () {
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.style.opacity = '0'; }, 3800);
  }
})();
