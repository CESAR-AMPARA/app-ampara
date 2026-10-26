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
  // Clean URLs resolve both on Flask routes and on nginx (try_files $uri.html).
  var PENDING_URL = '/conta_pendente';
  // Every profile lands on the same dashboard, which picks its panel from usuarioLogado.perfil.
  var DASHBOARD_URL = '/dashboard';

  function startSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    // dashboard.html still reads the logged user from sessionStorage.
    sessionStorage.setItem('usuarioLogado', JSON.stringify(data.usuario));
    window.location.href = DASHBOARD_URL;
  }

  /* -------------------- Login Flow -------------------- */
  var loginForm = document.getElementById('loginForm');
  var mfaForm = document.getElementById('mfaForm');
  var credentialsContainer = document.getElementById('credentialsContainer');
  var mfaContainer = document.getElementById('mfaContainer');
  var resendMfaLink = document.getElementById('resendMfaLink');
  var currentSessionToken = null;

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }
      submitCredentials();
    });
  }

  if (resendMfaLink) {
    resendMfaLink.addEventListener('click', function (e) {
      e.preventDefault();
      submitCredentials(function () { toast('Enviamos um novo código de verificação.'); });
    });
  }

  function submitCredentials(onMfaSent) {
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
             window.location.href = PENDING_URL;
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
          window.location.href = PENDING_URL;
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
        if (onMfaSent) onMfaSent();
      } else {
        startSession(data);
      }
    })
    .catch(function(err) {
      if (err.message !== 'Forbidden') toast('Erro ao conectar ao servidor.');
    });
  }

  if (mfaForm) {
    mfaForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = document.getElementById('mfa_code').value.trim();
      if (!/^\d{6}$/.test(code)) {
        toast('Informe o código de 6 dígitos enviado para você.');
        return;
      }

      fetch('/api/login/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: currentSessionToken, mfa_code: code })
      })
      .then(function(res) {
        if (res.status === 403) {
           return res.json().then(function(data) {
             if (data.status === 'suspenso') {
               toast(data.mensagem || 'Conta bloqueada.');
             } else {
               window.location.href = PENDING_URL;
             }
             throw new Error('Forbidden');
           });
        }
        return res.json();
      })
      .then(function(data) {
        if (!data.sucesso) {
          toast(data.mensagem || 'Código inválido.');
          return;
        }
        startSession(data);
      })
      .catch(function(err) {
        if (err.message !== 'Forbidden') toast('Erro ao verificar código.');
      });
    });
  }

  /* -------------------- Esqueci minha senha -------------------- */
  var recoverForm = document.getElementById('recoverForm');
  if (recoverForm) {
    var recoverEmail = document.getElementById('email');
    var recoverBtn = document.getElementById('recoverBtn');
    var recoverError = document.getElementById('error-email');
    recoverEmail.addEventListener('input', function () { recoverError.classList.add('hidden'); });

    recoverForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = recoverEmail.value.trim();
      if (!email || !recoverEmail.checkValidity()) { recoverError.classList.remove('hidden'); return; }
      recoverError.classList.add('hidden');

      recoverBtn.disabled = true;
      fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.sucesso) {
          document.getElementById('recoverContainer').classList.add('hidden');
          document.getElementById('recoverDone').classList.remove('hidden');
        } else {
          toast(data.mensagem || 'Informe um e-mail válido.');
          recoverBtn.disabled = false;
        }
      })
      .catch(function () {
        toast('Erro ao conectar ao servidor.');
        recoverBtn.disabled = false;
      });
    });
  }

  /* -------------------- Redefinir senha -------------------- */
  var resetForm = document.getElementById('resetForm');
  if (resetForm) {
    var resetToken = new URLSearchParams(window.location.search).get('token');
    var resetBtn = document.getElementById('resetBtn');
    var resetError = document.getElementById('error-senha');

    var showResetState = function (id) {
      ['resetContainer', 'resetInvalid', 'resetDone'].forEach(function (panel) {
        document.getElementById(panel).classList.toggle('hidden', panel !== id);
      });
    };

    if (!resetToken) showResetState('resetInvalid');

    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var senha = document.getElementById('senha').value;
      var confirmacao = document.getElementById('senha_confirmacao').value;
      if (senha.length < 8 || senha !== confirmacao) { resetError.classList.remove('hidden'); return; }
      resetError.classList.add('hidden');

      resetBtn.disabled = true;
      fetch('/api/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, senha: senha })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // The password length is checked above, so a refusal here means the token is no longer valid.
        showResetState(data.sucesso ? 'resetDone' : 'resetInvalid');
      })
      .catch(function () {
        toast('Erro ao conectar ao servidor.');
        resetBtn.disabled = false;
      });
    });
  }

  /* -------------------- API autenticada -------------------- */
  function authHeaders(headers) {
    headers = headers || {};
    var token = localStorage.getItem('token');
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  function apiRequest(url, options) {
    options = options || {};
    options.headers = authHeaders(options.headers);
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      return res.json();
    });
  }

  function jsonPost(url, payload) {
    return apiRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /* -------------------- Abas de cadastro (turmas / estudantes) -------------------- */
  var registrationTabs = document.querySelectorAll('.registration-container [role="tab"]');
  registrationTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      registrationTabs.forEach(function (t) {
        var selected = t === tab;
        t.classList.toggle('active', selected);
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).classList.toggle('active', selected);
      });
    });
  });

  // Whitespace-only values pass the `required` check, so trim before validating.
  function validateRequired(form) {
    form.querySelectorAll('input[type="text"]').forEach(function (input) { input.value = input.value.trim(); });
    if (form.checkValidity()) return true;
    form.reportValidity();
    return false;
  }

  function submitRegistration(form, url, payload, successMessage) {
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    jsonPost(url, payload)
      .then(function (data) {
        if (data.sucesso) {
          toast(successMessage);
          form.reset();
        } else {
          toast(data.mensagem || 'Não foi possível concluir o cadastro.');
        }
      })
      .catch(function (err) {
        if (err.message !== 'Unauthorized') toast('Erro ao conectar ao servidor.');
      })
      .then(function () { btn.disabled = false; });
  }

  /* -------------------- Cadastro de turma -------------------- */
  var turmaForm = document.getElementById('form-cadastro-turma');
  if (turmaForm) {
    turmaForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateRequired(turmaForm)) return;
      submitRegistration(turmaForm, '/api/turmas', {
        nome: document.getElementById('nome-turma').value,
        turno: document.getElementById('turno-turma').value
      }, 'Turma cadastrada com sucesso!');
    });
  }

  /* -------------------- Cadastro de estudante -------------------- */
  var estudanteForm = document.getElementById('form-cadastro-estudante');
  if (estudanteForm) {
    var turmaSelect = document.getElementById('turma-estudante');

    apiRequest('/api/turmas')
      .then(function (data) {
        var turmas = data.turmas || [];
        if (!turmas.length) {
          turmaSelect.innerHTML = '<option value="" selected disabled>Nenhuma turma cadastrada</option>';
          toast('Aviso: Nenhuma turma cadastrada. Por favor, crie uma turma primeiro.');
          setTimeout(function () { window.location.href = '/cadastro_turma'; }, 3000);
          return;
        }
        turmaSelect.innerHTML = '<option value="" selected disabled>Selecione a turma...</option>';
        turmas.forEach(function (turma) {
          var opt = document.createElement('option');
          opt.value = turma.id;
          opt.textContent = turma.nome;
          turmaSelect.appendChild(opt);
        });
      })
      .catch(function (err) {
        if (err.message !== 'Unauthorized') {
          turmaSelect.innerHTML = '<option value="" selected disabled>Erro ao carregar turmas</option>';
        }
      });

    estudanteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateRequired(estudanteForm)) return;
      submitRegistration(estudanteForm, '/api/estudantes', {
        nome: document.getElementById('nome-estudante').value,
        matricula: document.getElementById('matricula-estudante').value,
        turma_id: Number(turmaSelect.value)
      }, 'Estudante cadastrado com sucesso!');
    });
  }

  /* -------------------- Importação em lote (planilhas) -------------------- */
  var MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  var IMPORT_LABELS = {
    turmas: ['turma cadastrada', 'turmas cadastradas'],
    estudantes: ['estudante cadastrado', 'estudantes cadastrados']
  };

  document.querySelectorAll('.drop-zone[data-import-url]').forEach(initSpreadsheetImport);

  function initSpreadsheetImport(dropZone) {
    var card = dropZone.closest('.form-card');
    var fileInput = dropZone.querySelector('input[type="file"]');
    var fileInfo = card.querySelector('.file-info');
    var fileName = fileInfo.querySelector('span');
    var progress = card.querySelector('.progress-bar-container');
    var progressFill = card.querySelector('.progress-bar-fill');
    var summary = card.querySelector('.import-summary');
    var submitBtn = card.querySelector('button.btn-primary');
    var labels = IMPORT_LABELS[dropZone.getAttribute('data-import-kind')];
    var selectedFile = null;

    dropZone.addEventListener('click', function (e) {
      if (e.target !== fileInput) fileInput.click();
    });
    dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) selectFile(fileInput.files[0]);
    });

    function selectFile(file) {
      summary.classList.add('hidden');
      resetProgress();
      var error = null;
      if (!/\.(csv|xlsx)$/i.test(file.name)) {
        error = 'Erro: Formato de arquivo não suportado. Use apenas planilhas CSV ou Excel.';
      } else if (file.size > MAX_IMPORT_BYTES) {
        error = 'Erro: O arquivo excede o tamanho máximo de 5MB.';
      }
      if (error) {
        toast(error);
        clearSelection();
        return;
      }
      selectedFile = file;
      fileName.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
      fileInfo.style.display = 'block';
      submitBtn.disabled = false;
    }

    function clearSelection() {
      selectedFile = null;
      fileInput.value = '';
      fileInfo.style.display = 'none';
      submitBtn.disabled = true;
    }

    function resetProgress() {
      progress.style.display = 'none';
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
    }

    submitBtn.addEventListener('click', function () {
      if (!selectedFile) return;
      var body = new FormData();
      body.append('file', selectedFile);
      submitBtn.disabled = true;

      // The backend reports no upload progress: ease towards 90% while waiting, finish on response.
      progress.style.display = 'block';
      void progressFill.offsetWidth;
      progressFill.style.transition = 'width 1.5s ease-out';
      progressFill.style.width = '90%';

      apiRequest(dropZone.getAttribute('data-import-url'), { method: 'POST', body: body })
        .then(function (data) {
          if (!data.sucesso) {
            toast(data.mensagem || 'Não foi possível importar a planilha.');
            resetProgress();
            submitBtn.disabled = false;
            return;
          }
          progressFill.style.transition = 'width .3s ease-out';
          progressFill.style.width = '100%';
          renderSummary(data.importados || 0, data.erros || []);
          clearSelection();
        })
        .catch(function (err) {
          if (err.message === 'Unauthorized') return;
          toast('Erro ao conectar ao servidor.');
          resetProgress();
          submitBtn.disabled = false;
        });
    });

    function renderSummary(importados, erros) {
      var text = 'Importação concluída: ' + importados + ' ' + labels[importados === 1 ? 0 : 1] + ' com sucesso.';
      if (erros.length) {
        text += ' ' + erros.length + (erros.length === 1 ? ' registro ignorado.' : ' registros ignorados.');
      }
      summary.innerHTML = '';
      var headline = document.createElement('p');
      headline.textContent = text;
      summary.appendChild(headline);
      if (erros.length) {
        var list = document.createElement('ul');
        erros.forEach(function (erro) {
          var item = document.createElement('li');
          item.textContent = 'Linha ' + erro.linha + ': ' + erro.motivo;
          list.appendChild(item);
        });
        summary.appendChild(list);
      }
      summary.classList.remove('hidden');
    }
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
      // Pressing Enter inside an earlier step submits the form; treat it as "Próximo".
      if (current < TOTAL) {
        if (validateStep(current)) goTo(current + 1);
        return;
      }
      if (!validateStep(4)) return;

      var registro = document.getElementById('registro_profissional').value.trim();

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
        registro_profissional: (chosenRole === 'equipe_multidisciplinar' && registro) ? registro : null,
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
          window.location.href = PENDING_URL;
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

  // dashboard.html's inline script calls these as globals.
  window.toast = toast;
  window.apiRequest = apiRequest;
})();