/* ==========================================================================
A.M.P.A.R.A. - main.js
Integração com Flask
========================================================================== */

(function () {

```
'use strict';

/* ==========================================================
   ACESSIBILIDADE
   ========================================================== */

const STORE = "ampara.a11y";

let state = loadState();

applyState();

function loadState() {
    try {
        return JSON.parse(
            localStorage.getItem(STORE)
        ) || {};
    } catch {
        return {};
    }
}

function saveState() {
    localStorage.setItem(
        STORE,
        JSON.stringify(state)
    );
}

function applyState() {

    document.documentElement.style.setProperty(
        "--fs-scale",
        state.font || 1
    );

    document.body.classList.toggle(
        "high-contrast",
        !!state.contrast
    );

    document
        .querySelectorAll('[data-action="contrast"]')
        .forEach(btn => {

            btn.setAttribute(
                "aria-pressed",
                state.contrast ? "true" : "false"
            );

        });

}

document
    .querySelectorAll(".a11y-btn[data-action]")
    .forEach(btn => {

        btn.addEventListener("click", () => {

            const action =
                btn.getAttribute("data-action");

            if (action === "font") {

                const steps = [1, 1.15, 1.3];

                const idx =
                    steps.indexOf(state.font || 1);

                state.font =
                    steps[(idx + 1) % steps.length];

            }

            if (action === "contrast") {
                state.contrast = !state.contrast;
            }

            if (action === "reader") {

                toast(
                    "Compatível com leitores de tela."
                );

                return;
            }

            saveState();
            applyState();

        });

    });

/* ==========================================================
   LOGIN
   ========================================================== */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (e) {

            e.preventDefault();

            try {

                const email =
                    document.getElementById("email").value;

                const senha =
                    document.getElementById("senha").value;

                const resposta = await fetch(
                    "/api/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email,
                            senha
                        })
                    }
                );

                const resultado =
                    await resposta.json();

                if (resultado.sucesso) {

                    toast("Login realizado.");

                    setTimeout(() => {

                        window.location.href =
                            "/dashboard";

                    }, 1000);

                } else {

                    toast(resultado.mensagem);

                }

            } catch (erro) {

                console.error(erro);

                toast(
                    "Erro ao conectar ao servidor."
                );

            }

        }
    );

}

/* ==========================================================
   CADASTRO
   ========================================================== */

const wizard =
    document.getElementById("wizard");

if (wizard) {
    initWizard(wizard);
}

function initWizard(form) {

    let current = 1;
    let chosenRole = null;

    const roleCards =
        form.querySelectorAll(".rbac-card");

    roleCards.forEach(card => {

        card.addEventListener("click", () => {

            roleCards.forEach(c => {
                c.setAttribute(
                    "aria-pressed",
                    "false"
                );
            });

            card.setAttribute(
                "aria-pressed",
                "true"
            );

            chosenRole =
                card.dataset.role;

        });

    });

    const estado =
        document.getElementById("estado");

    const municipio =
        document.getElementById("municipio");

    const escola =
        document.getElementById("escola");

    if (estado) {

        estado.addEventListener(
            "change",
            () => {

                municipio.disabled = false;
                escola.disabled = false;

            }
        );

    }

    const pass1 =
        document.getElementById("pass1");

    const pass2 =
        document.getElementById("pass2");

    const submitBtn =
        document.getElementById("submitBtn");

    const fill =
        document.getElementById("strengthFill");

    const strengthLabel =
        document.getElementById("strengthLabel");

    const matchMsg =
        document.getElementById("matchMsg");

    const t1 =
        document.getElementById("t1");

    const t2 =
        document.getElementById("t2");

    function scorePassword(v) {

        let s = 0;

        if (v.length >= 8) s++;
        if (v.length >= 12) s++;
        if (/[A-Z]/.test(v)) s++;
        if (/\d/.test(v)) s++;
        if (/[^A-Za-z0-9]/.test(v)) s++;

        return Math.min(s, 4);

    }

    function renderStrength() {

        const value =
            pass1.value;

        if (!value) {

            fill.style.width = "0%";

            strengthLabel.textContent =
                "Força: —";

            return;
        }

        const score =
            scorePassword(value);

        const labels = [
            "",
            "Fraca",
            "Razoável",
            "Boa",
            "Forte"
        ];

        fill.style.width =
            (score * 25) + "%";

        strengthLabel.textContent =
            "Força: " + labels[score];

    }

    function checkMatch() {

        if (!pass2.value) {

            matchMsg.hidden = true;

            return;
        }

        matchMsg.hidden = false;

        const ok =
            pass1.value === pass2.value;

        matchMsg.textContent =
            ok
                ? "✓ As senhas coincidem"
                : "✗ As senhas não coincidem";

        matchMsg.classList.toggle(
            "bad",
            !ok
        );

    }

    function refreshSubmit() {

        submitBtn.disabled = !(
            pass1.value.length >= 8 &&
            pass1.value === pass2.value &&
            t1.checked &&
            t2.checked
        );

    }

    pass1?.addEventListener(
        "input",
        () => {

            renderStrength();
            checkMatch();
            refreshSubmit();

        }
    );

    pass2?.addEventListener(
        "input",
        () => {

            checkMatch();
            refreshSubmit();

        }
    );

    [t1, t2].forEach(c => {

        c?.addEventListener(
            "change",
            refreshSubmit
        );

    });

    form
        .querySelectorAll("[data-next]")
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    if (
                        !validateStep(current)
                    ) return;

                    goTo(current + 1);

                }
            );

        });

    form
        .querySelectorAll("[data-prev]")
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    goTo(current - 1);

                }
            );

        });

    form.addEventListener(
        "submit",
        async function (e) {

            e.preventDefault();

            if (current !== 3 || (submitBtn && submitBtn.disabled)) {
                return;
            }

            try {

                const dados = {

                    perfil: chosenRole,

                    nome:
                        document.getElementById("nome").value,

                    telefone:
                        document.getElementById("tel").value,

                    email:
                        document.getElementById("email").value,

                    matricula:
                        document.getElementById("matricula").value,

                    estado:
                        document.getElementById("estado").value,

                    municipio:
                        document.getElementById("municipio").value,

                    escola:
                        document.getElementById("escola").value,

                    senha:
                        document.getElementById("pass1").value

                };

                const resposta =
                    await fetch(
                        "/api/cadastro",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(dados)
                        }
                    );

                const resultado =
                    await resposta.json();

                if (resultado.sucesso) {

                    goTo(4);

                } else {

                    toast(
                        resultado.mensagem
                    );

                }

            } catch (erro) {

                console.error(erro);

                toast(
                    "Erro ao conectar ao servidor."
                );

            }

        }
    );

    function validateStep(step) {

        if (step === 1) {

            if (!chosenRole) {

                toast(
                    "Selecione um perfil."
                );

                return false;
            }

            return requireFields([
                "nome",
                "tel",
                "email"
            ]);

        }

        if (step === 2) {

            return requireFields([
                "matricula",
                "estado",
                "municipio",
                "escola"
            ]);

        }

        return true;

    }

    function requireFields(ids) {

        for (const id of ids) {

            const el =
                document.getElementById(id);

            if (
                el &&
                !el.disabled &&
                !el.value.trim()
            ) {

                el.focus();

                return false;

            }

        }

        return true;

    }

    function goTo(step) {

        current = step;

        form
            .querySelectorAll(".panel")
            .forEach(panel => {

                panel.classList.toggle(
                    "active",
                    Number(
                        panel.dataset.panel
                    ) === current
                );

            });

        document
            .querySelectorAll(
                "#steps .step"
            )
            .forEach(item => {

                const n =
                    Number(
                        item.dataset.step
                    );

                item.classList.remove(
                    "active",
                    "done"
                );

                if (n < current)
                    item.classList.add("done");

                if (n === current)
                    item.classList.add("active");

            });

    }

}

/* ==========================================================
   TOAST
   ========================================================== */

let toastEl;

function toast(msg) {

    if (!toastEl) {

        toastEl =
            document.createElement("div");

        toastEl.style.cssText =
            "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2c3e50;color:#fff;padding:12px 18px;border-radius:10px;z-index:9999;";

        document.body.appendChild(
            toastEl
        );

    }

    toastEl.textContent = msg;

    clearTimeout(
        toastEl.timer
    );

    toastEl.style.display =
        "block";

    toastEl.timer =
        setTimeout(() => {

            toastEl.style.display =
                "none";

        }, 3000);

}
```

})();
