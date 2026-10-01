/* ==========================================================================
   A.M.P.A.R.A. — main.js
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

  /* -------------------- Redirecionamento RBAC -------------------- */
  function routeByProfile(perfil) {
    if (perfil === 'gestor_escolar') return 'dashboard_gestao.html';
    if (perfil === 'equipe_multidisciplinar') return 'dashboard_saude.html';
    return 'dashboard.html';
  }

  /* -------------------- Login Flow -------------------- */
  var loginForm = document.getElementById('loginForm');
  var mfaForm = document.getElementById('mfaForm');
  var credentialsContainer = document.getElementById('credentialsContainer');
  var mfaContainer = document.getElementById('mfaContainer');
  var currentSessionToken = null;

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }

      var email = document.getElementById('email').value.trim();
      var senha = document.getElementById('senha').value;

      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, senha: senha })
      })
      .then(function(res) {
        if (res.status === 403) {
           return res.json().then(function(data) {
             if (data.status === 'pendente') {
               window.location.href = 'conta_pendente.html';
             } else {
               toast(data.mensagem || 'Conta bloqueada.');
             }
             throw new Error('Forbidden');
           });
        }
        return res.json();
      })
      .then(function(data) {
        if (!data.sucesso) {
          if (data.status === 'pendente') {
            window.location.href = 'conta_pendente.html';
          } else {
            toast(data.mensagem || 'E-mail ou senha incorretos.');
          }
          return;
        }

        if (data.mfa_required) {
          currentSessionToken = data.session_token;
          credentialsContainer.classList.add('hidden');
          mfaContainer.classList.remove('hidden');
          document.getElementById('mfa_code').focus();
        } else {
          localStorage.setItem('token', data.token);
          localStorage.setItem('usuario', JSON.stringify(data.usuario));
          window.location.href = routeByProfile(data.usuario.perfil);
        }
      })
      .catch(function(err) {
        if (err.message !== 'Forbidden') toast('Erro ao conectar ao servidor.');
      });
    });
  }

  if (mfaForm) {
    mfaForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = document.getElementById('mfa_code').value.trim();
      if (!code) return;

      fetch('/api/login/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: currentSessionToken, mfa_code: code })
      })
      .then(function(res) {
        if (res.status === 403) {
           window.location.href = 'conta_pendente.html';
           throw new Error('Forbidden');
        }
        return res.json();
      })
      .then(function(data) {
        if (!data.sucesso) {
          toast(data.mensagem || 'Código inválido.');
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        window.location.href = routeByProfile(data.usuario.perfil);
      })
      .catch(function(err) {
        if (err.message !== 'Forbidden') toast('Erro ao verificar código.');
      });
    });
  }

  /* -------------------- Wizard de cadastro -------------------- */
  var wizard = document.getElementById('wizard');
  if (wizard) initWizard(wizard);

  function initWizard(form) {
    var TOTAL = 4;
    var current = 1;
    var chosenRole = null;

    // Carregar Escolas
    var selectEscola = document.getElementById('escola_id');
    if (selectEscola) {
      fetch('/api/schools')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          selectEscola.innerHTML = '<option value="" selected disabled>Selecione sua escola...</option>';
          if (data.schools) {
            data.schools.forEach(function(s) {
              var opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.nome;
              selectEscola.appendChild(opt);
            });
          }
        })
        .catch(function() {
          selectEscola.innerHTML = '<option value="" selected disabled>Erro ao carregar escolas</option>';
        });
    }

    // Seleção de perfil RBAC
    var roleCards = form.querySelectorAll('.rbac-card');
    roleCards.forEach(function (card) {
      card.addEventListener('click', function () {
        roleCards.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        card.setAttribute('aria-pressed', 'true');
        chosenRole = card.getAttribute('data-role');
        hideError('error-perfil');
        
        var regField = document.getElementById('field-registro');
        if (regField) {
          if (chosenRole === 'equipe_multidisciplinar') {
            regField.classList.remove('hidden');
          } else {
            regField.classList.add('hidden');
            document.getElementById('registro_profissional').value = '';
          }
        }
      });
    });

    // Telefone Mask
    var telInput = document.getElementById('telefone');
    if (telInput) {
      telInput.addEventListener('input', function(e) {
        var x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
      });
    }

    // Força de senha
    var pass1 = document.getElementById('senha');
    var pass2 = document.getElementById('senha_confirmacao');
    var fill = document.getElementById('strengthFill');
    var strengthLabel = document.getElementById('strengthLabel');
    var matchMsg = document.getElementById('matchMsg');
    var submitBtn = document.getElementById('submitBtn');
    
    if (pass1) {
      pass1.addEventListener('input', function () { renderStrength(); checkMatch(); });
      pass2.addEventListener('input', function () { checkMatch(); });
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

    // Erros helper
    function showError(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }
    function hideError(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    }
    document.querySelectorAll('input, select').forEach(function(el) {
      el.addEventListener('input', function() { hideError('error-' + el.id); });
      el.addEventListener('change', function() { hideError('error-' + el.id); });
    });

    // Navegação
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
      if (!validateStep(4)) return;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      var payload = {
        escola_id: document.getElementById('escola_id').value,
        nome: document.getElementById('nome').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        email: document.getElementById('email').value.trim(),
        perfil: chosenRole,
        matricula: document.getElementById('matricula').value.trim(),
        cargo: document.getElementById('cargo').value.trim(),
        registro_profissional: document.getElementById('registro_profissional') ? document.getElementById('registro_profissional').value.trim() : null,
        senha: pass1.value,
        aceite_lgpd: document.getElementById('aceite_lgpd').checked,
        aceite_sigilo: document.getElementById('aceite_sigilo').checked
      };

      fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.sucesso || data.status === 'pendente') {
          window.location.href = 'conta_pendente.html';
        } else {
          toast(data.mensagem || 'Erro ao realizar cadastro.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Concluir Cadastro';
        }
      })
      .catch(function() {
        toast('Erro ao conectar ao servidor.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Concluir Cadastro';
      });
    });

    function validateStep(step) {
      var valid = true;
      if (step === 1) {
        var esc = document.getElementById('escola_id');
        if (!esc.value) { showError('error-escola_id'); valid = false; }
      }
      else if (step === 2) {
        var nome = document.getElementById('nome');
        var tel = document.getElementById('telefone');
        var email = document.getElementById('email');
        if (!nome.value.trim()) { showError('error-nome'); valid = false; }
        if (!tel.value.trim() || tel.value.length < 14) { showError('error-telefone'); valid = false; }
        if (!email.value.trim() || !email.checkValidity()) { showError('error-email'); valid = false; }
      }
      else if (step === 3) {
        if (!chosenRole) { showError('error-perfil'); valid = false; }
        var mat = document.getElementById('matricula');
        var cargo = document.getElementById('cargo');
        if (!mat.value.trim()) { showError('error-matricula'); valid = false; }
        if (!cargo.value.trim()) { showError('error-cargo'); valid = false; }
      }
      else if (step === 4) {
        if (!pass1.value || pass1.value.length < 8 || pass1.value !== pass2.value) {
          showError('error-senha'); valid = false;
        }
        var c1 = document.getElementById('aceite_lgpd');
        var c2 = document.getElementById('aceite_sigilo');
        if (!c1.checked || !c2.checked) { showError('error-termos'); valid = false; }
      }
      return valid;
    }

    function goTo(step) {
      current = Math.max(1, Math.min(TOTAL, step));
      // Painéis
      form.querySelectorAll('.panel').forEach(function (p) {
        p.classList.toggle('active', +p.getAttribute('data-panel') === current);
      });
      // Progress track
      var pct = (current / TOTAL) * 100;
      var pfill = document.getElementById('progressFill');
      var ptext = document.getElementById('progressText');
      if (pfill) pfill.style.width = pct + '%';
      if (ptext) ptext.textContent = 'Passo ' + current + ' de ' + TOTAL;

      // Steps
      document.querySelectorAll('#steps .step').forEach(function (s) {
        var n = +s.getAttribute('data-step');
        s.classList.remove('active', 'done');
        if (n < current) s.classList.add('done');
        else if (n === current) s.classList.add('active');
        var num = s.querySelector('.num');
        if (num) num.textContent = (n < current) ? '✓' : String(n);
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