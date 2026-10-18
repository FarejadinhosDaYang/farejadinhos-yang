/* Farejadinhos da Yang — convite e preferências dos AVISOS (notificações)
 *
 * Carregado pelo topo.js em todas as páginas. Mostra uma faixinha
 * discreta depois que a pessoa já navegou um pouco; só quem clicar em
 * "Quero!" vê o pedido de permissão do navegador. A janela de
 * preferências também abre pelo menu ("🔔 Avisos de ofertas") ou por
 * window.farejaAbrirAvisos().
 * Serviço: cloudflare/push-worker.js · receptor: /sw.js
 */
(function () {
    var PUSH_URL = "https://farejadinhos-push.bernard-shimizu.workers.dev";
    var script = document.currentScript;
    var base = script ? script.src.replace(/assets\/avisos-push\.js.*$/, "") : "/";
    var CATEGORIAS = ["Eletrônicos", "Eletrodomésticos", "Cozinha", "Casa", "Utilidades", "Beleza", "Skincare", "Moda", "Pet", "Academia", "Café", "Piscina", "Natal", "Vídeos"];

    var suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    var ehIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var instalado = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

    // ---------- estilo ----------
    var css = document.createElement("style");
    css.textContent = [
        ".yp-faixa{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(140%);z-index:85;width:min(520px,calc(100vw - 24px));background:#2B1B12;color:#FFFAF1;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 14px 34px rgba(0,0,0,.3);font:600 14px 'Work Sans',Arial,sans-serif;transition:transform .35s ease}",
        ".yp-faixa.mostrar{transform:translateX(-50%) translateY(0)}",
        ".yp-faixa img{width:42px;height:42px;border-radius:50%;flex:none;background:#FDF3E3}",
        ".yp-faixa p{margin:0;flex:1;line-height:1.35}",
        ".yp-faixa button{font:800 13.5px 'Baloo 2','Work Sans',sans-serif;border:0;border-radius:10px;padding:8px 12px;cursor:pointer}",
        ".yp-sim{background:#F7941D;color:#2B1B12}",
        ".yp-nao{background:transparent;color:#d9c6b4;padding:8px 6px!important}",
        ".yp-fundo{position:fixed;inset:0;z-index:95;background:rgba(43,27,18,.55);display:flex;align-items:center;justify-content:center;padding:16px}",
        ".yp-janela{background:#FFFAF1;color:#2B1B12;border-radius:18px;width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px;font:500 14px 'Work Sans',Arial,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.35)}",
        ".yp-janela h3{margin:0 0 4px;font:800 21px 'Baloo 2','Work Sans',sans-serif;color:#C21A24}",
        ".yp-janela .yp-sub{margin:0 0 14px;color:#8A7563;font-size:13.5px}",
        ".yp-janela h4{margin:14px 0 6px;font:800 14.5px 'Baloo 2','Work Sans',sans-serif}",
        ".yp-op{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1.5px solid #F0DFC4;border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer}",
        ".yp-op input{margin-top:3px;accent-color:#E5232E;width:17px;height:17px}",
        ".yp-op small{display:block;color:#8A7563;font-weight:500}",
        ".yp-cats{display:flex;flex-wrap:wrap;gap:6px}",
        ".yp-cats label{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1.5px solid #F0DFC4;border-radius:999px;padding:5px 11px;cursor:pointer;font-weight:600;font-size:13px;user-select:none}",
        ".yp-cats input{display:none}",
        ".yp-cats label.on{background:#E5232E;border-color:#E5232E;color:#fff}",
        ".yp-janela input[type=text]{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #F0DFC4;border-radius:10px;font:500 14px 'Work Sans',Arial,sans-serif;background:#fff}",
        ".yp-dica{font-size:12px;color:#8A7563;margin-top:4px}",
        ".yp-botoes{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}",
        ".yp-botoes button{flex:1;font:800 15px 'Baloo 2','Work Sans',sans-serif;border:0;border-radius:12px;padding:11px;cursor:pointer}",
        ".yp-ativar{background:#E5232E;color:#fff}",
        ".yp-fechar{background:#F0DFC4;color:#2B1B12}",
        ".yp-desativar{background:transparent;color:#8A7563;text-decoration:underline;flex:0 0 100%!important;padding:6px!important;font:600 13px 'Work Sans',Arial,sans-serif!important}",
        ".yp-msg{margin-top:10px;font-size:13.5px;font-weight:600}",
        ".yp-msg.erro{color:#C21A24}",
        ".yp-ios{background:#fff6e9;border:1.5px dashed #F7941D;border-radius:12px;padding:12px;line-height:1.5}"
    ].join("\n");
    document.head.appendChild(css);

    // ---------- inscrição ----------
    function chaveParaBytes(b64) {
        var p = "=".repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
        var out = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
    }
    function post(rota, dados) {
        return fetch(PUSH_URL + rota, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(dados) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || "erro " + r.status); return j; }); });
    }
    function registro() {
        return navigator.serviceWorker.register(base + "sw.js").then(function () { return navigator.serviceWorker.ready; });
    }
    function inscricaoAtual() {
        if (!suporta) return Promise.resolve(null);
        return navigator.serviceWorker.getRegistration(base).then(function (r) { return r ? r.pushManager.getSubscription() : null; }).catch(function () { return null; });
    }

    function ativar(prefs) {
        return Notification.requestPermission().then(function (perm) {
            if (perm !== "granted") throw new Error(perm === "denied"
                ? "O navegador bloqueou os avisos deste site. Pra liberar, toque no cadeado ao lado do endereço → Notificações → Permitir."
                : "Você não permitiu os avisos. Sem problema!");
            return Promise.all([registro(), fetch(PUSH_URL + "/chave").then(function (r) { return r.json(); })]);
        }).then(function (res) {
            var reg = res[0], chave = res[1].publica;
            return reg.pushManager.getSubscription().then(function (s) {
                return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
            });
        }).then(function (s) {
            return post("/inscrever", { inscricao: s.toJSON(), melhores: prefs.melhores, cupons: prefs.cupons, categorias: prefs.categorias, palavras: prefs.palavras });
        }).then(function () { set("fareja_push_ok", "1"); });
    }

    function desativar() {
        return inscricaoAtual().then(function (s) {
            if (!s) return;
            var ep = s.endpoint;
            return s.unsubscribe().then(function () { return post("/cancelar", { endpoint: ep }); });
        }).then(function () { set("fareja_push_ok", null); });
    }

    // ---------- janela de preferências ----------
    function abrir() {
        fecharFaixa(false);
        var fundo = document.createElement("div");
        fundo.className = "yp-fundo";
        var corpo;
        if (!suporta && ehIOS && !instalado) {
            corpo = "<h3>🔔 Avisos da Yang</h3>" +
                "<div class='yp-ios'>No iPhone, a Apple só deixa sites enviarem avisos quando eles estão na tela de início:<br><br>" +
                "1. Toque em <b>Compartilhar</b> (o quadradinho com a seta ⬆️)<br>2. Escolha <b>Adicionar à Tela de Início</b><br>" +
                "3. Abra o Farejadinhos pelo ícone novo e toque em <b>🔔 Avisos de ofertas</b> no menu.</div>" +
                "<div class='yp-botoes'><button class='yp-fechar' data-x>Entendi</button></div>";
        } else if (!suporta) {
            corpo = "<h3>🔔 Avisos da Yang</h3><p class='yp-sub'>Este navegador não aceita avisos de sites. Tente pelo Chrome, Edge ou Firefox.</p>" +
                "<div class='yp-botoes'><button class='yp-fechar' data-x>Fechar</button></div>";
        } else {
            corpo = "<h3>🔔 Avisos da Yang</h3>" +
                "<p class='yp-sub'>Escolha o que você quer que a Yang te avise. No máximo uns 3 avisos por dia, e dá pra mudar ou desligar quando quiser.</p>" +
                "<label class='yp-op'><input type='checkbox' data-melhores checked><span>🔥 <b>As melhores do dia</b><small>Só quando aparecer algo muito bom</small></span></label>" +
                "<label class='yp-op'><input type='checkbox' data-cupons checked><span>🏷️ <b>Cupons do dia</b><small>Os cupons da Shopee mudam todo dia — te aviso quando chegarem</small></span></label>" +
                "<h4>Categorias que você curte</h4><div class='yp-cats'>" +
                CATEGORIAS.map(function (c) { return "<label><input type='checkbox' value='" + esc(c) + "'>" + esc(c) + "</label>"; }).join("") +
                "</div>" +
                "<h4>Procurando algo específico?</h4><input type='text' data-palavras maxlength='120' placeholder='Ex.: celular, air fryer, tênis'>" +
                "<div class='yp-dica'>Separe por vírgula. Quando entrar uma oferta com essa palavra no nome, você é avisado.</div>" +
                "<div class='yp-msg' data-msg></div>" +
                "<div class='yp-botoes'><button class='yp-fechar' data-x>Agora não</button><button class='yp-ativar' data-ok>Ativar avisos</button>" +
                "<button class='yp-desativar' data-off hidden>Desligar meus avisos</button></div>";
        }
        fundo.innerHTML = "<div class='yp-janela' role='dialog' aria-modal='true'>" + corpo + "</div>";
        document.body.appendChild(fundo);
        var q = function (s) { return fundo.querySelector(s); };
        var fechar = function () { fundo.remove(); };
        fundo.addEventListener("click", function (e) { if (e.target === fundo) fechar(); });
        q("[data-x]").onclick = function () { if (!get("fareja_push_ok")) adiar(); fechar(); };
        if (!q("[data-ok]")) return;

        fundo.querySelectorAll(".yp-cats input").forEach(function (i) {
            i.addEventListener("change", function () { i.parentNode.classList.toggle("on", i.checked); });
        });
        var msg = q("[data-msg]");

        // já inscrito: carrega o que a pessoa tinha escolhido
        inscricaoAtual().then(function (s) {
            if (!s) return;
            q("[data-ok]").textContent = "Salvar";
            q("[data-off]").hidden = false;
            return post("/minhas", { endpoint: s.endpoint }).then(function (p) {
                if (!p.inscrito) return;
                q("[data-melhores]").checked = !!p.melhores;
                q("[data-cupons]").checked = !!p.cupons;
                q("[data-palavras]").value = (p.palavras || []).join(", ");
                fundo.querySelectorAll(".yp-cats input").forEach(function (i) {
                    i.checked = (p.categorias || []).indexOf(i.value) >= 0;
                    i.parentNode.classList.toggle("on", i.checked);
                });
            });
        }).catch(function () {});

        q("[data-ok]").onclick = function () {
            var btn = this;
            var prefs = {
                melhores: q("[data-melhores]").checked,
                cupons: q("[data-cupons]").checked,
                categorias: Array.prototype.map.call(fundo.querySelectorAll(".yp-cats input:checked"), function (i) { return i.value; }),
                palavras: q("[data-palavras]").value.split(",").map(function (p) { return p.trim(); }).filter(function (p) { return p.length >= 2; })
            };
            if (!prefs.melhores && !prefs.cupons && !prefs.categorias.length && !prefs.palavras.length) {
                msg.className = "yp-msg erro"; msg.textContent = "Escolha pelo menos uma opção 🙂"; return;
            }
            btn.disabled = true; btn.textContent = "Ativando...";
            msg.className = "yp-msg"; msg.textContent = "";
            ativar(prefs).then(function () {
                msg.className = "yp-msg"; msg.textContent = "✅ Pronto! A Yang vai te avisar. 🐶";
                btn.textContent = "Salvo"; setTimeout(fechar, 1600);
            }).catch(function (e) {
                msg.className = "yp-msg erro"; msg.textContent = e.message || "Não deu certo agora, tente de novo.";
                btn.disabled = false; btn.textContent = "Ativar avisos";
            });
        };
        q("[data-off]").onclick = function () {
            this.disabled = true;
            desativar().then(function () { msg.className = "yp-msg"; msg.textContent = "Avisos desligados."; setTimeout(fechar, 1200); })
                .catch(function () { msg.className = "yp-msg erro"; msg.textContent = "Não consegui desligar agora."; });
        };
    }
    window.farejaAbrirAvisos = abrir;

    // ---------- faixinha de convite ----------
    var faixa = null;
    function adiar() { set("fareja_push_adiado", String(Date.now())); }
    function fecharFaixa(adiando) {
        if (!faixa) return;
        if (adiando) adiar();
        faixa.classList.remove("mostrar");
        var f = faixa; faixa = null; setTimeout(function () { f.remove(); }, 400);
    }
    function podeConvidar() {
        if (/\/painel\//.test(location.pathname)) return false;
        if (get("fareja_push_ok")) return false;
        if (suporta && Notification.permission === "denied") return false;
        if (!suporta && !(ehIOS && !instalado)) return false;
        var adiado = Number(get("fareja_push_adiado") || 0);
        if (adiado && Date.now() - adiado < 7 * 24 * 3600 * 1000) return false;
        return true;
    }
    function convidar() {
        if (!podeConvidar() || faixa || document.querySelector(".yp-fundo")) return;
        faixa = document.createElement("div");
        faixa.className = "yp-faixa";
        faixa.innerHTML = "<img src='" + base + "assets/yang-badge.png' alt=''>" +
            "<p>🔔 Quer que a Yang te avise quando farejar uma oferta boa?</p>" +
            "<button class='yp-sim'>Quero!</button><button class='yp-nao' aria-label='Agora não'>Agora não</button>";
        document.body.appendChild(faixa);
        requestAnimationFrame(function () { requestAnimationFrame(function () { faixa && faixa.classList.add("mostrar"); }); });
        faixa.querySelector(".yp-sim").onclick = abrir;
        faixa.querySelector(".yp-nao").onclick = function () { fecharFaixa(true); };
    }

    // já tem inscrição mas o aparelho perdeu a marquinha? recoloca
    inscricaoAtual().then(function (s) { if (s) set("fareja_push_ok", "1"); });

    // convida na 2ª página vista da visita, ou depois de 25 s na primeira
    var vistas = 0;
    try { vistas = Number(sessionStorage.getItem("fareja_push_vistas") || 0) + 1; sessionStorage.setItem("fareja_push_vistas", String(vistas)); } catch (e) {}
    if (/[?&]avisos\b/.test(location.search) || location.hash === "#avisos") setTimeout(abrir, 300);
    else setTimeout(convidar, vistas >= 2 ? 4000 : 25000);
})();
