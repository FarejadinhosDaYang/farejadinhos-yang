/* Caixinha "🔔 Avisos (notificações)" no painel.
 * Uso: <div id="pushBox"></div><script src="../assets/push-painel.js"></script>
 * Mostra quantas pessoas ativaram os avisos e o que pediram, e deixa
 * mandar um aviso na mão. Serviço: cloudflare/push-worker.js
 */
(function () {
    var PUSH_URL = "https://farejadinhos-push.bernard-shimizu.workers.dev";
    var SITE = "https://farejadinhosdayang.com.br";
    var box = document.getElementById("pushBox");
    if (!box) return;

    var css = document.createElement("style");
    css.textContent =
        "#pushBox{background:var(--cream-2,#FFFAF1);border:1.5px solid var(--line,#F0DFC4);border-radius:14px;padding:14px 16px;margin-bottom:18px;box-shadow:0 6px 20px rgba(43,27,18,.08);font-family:'Work Sans',sans-serif;color:var(--ink,#2B1B12);font-size:13.5px}" +
        "#pushBox h3{margin:0 0 8px;font:800 16px 'Baloo 2','Work Sans',sans-serif}" +
        "#pushBox .pb-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}" +
        "#pushBox .pb-num{background:#fff;border:1px solid var(--line,#F0DFC4);border-radius:10px;padding:8px;text-align:center}" +
        "#pushBox .pb-num b{display:block;font:800 22px 'Baloo 2','Work Sans',sans-serif;color:var(--red-dark,#C21A24);line-height:1.1}" +
        "#pushBox .pb-num span{font-size:11.5px;color:var(--muted,#8A7563)}" +
        "#pushBox .pb-tags{margin:4px 0 8px;line-height:1.9}" +
        "#pushBox .pb-tag{display:inline-block;background:#fff;border:1px solid var(--line,#F0DFC4);border-radius:999px;padding:1px 9px;margin:0 4px 0 0;font-size:12px}" +
        "#pushBox details{margin-top:8px}#pushBox summary{cursor:pointer;font-weight:700;color:var(--red-dark,#C21A24)}" +
        "#pushBox label{display:block;font-weight:700;margin:8px 0 3px;font-size:12.5px}" +
        "#pushBox input,#pushBox select{width:100%;box-sizing:border-box;padding:9px 10px;border:1.5px solid var(--line,#F0DFC4);border-radius:9px;font:500 14px 'Work Sans',sans-serif;background:#fff}" +
        "#pushBox button{margin-top:10px;width:100%;padding:11px;border:0;border-radius:10px;background:var(--red,#E5232E);color:#fff;font:800 15px 'Baloo 2','Work Sans',sans-serif;cursor:pointer}" +
        "#pushBox button:disabled{opacity:.6}" +
        "#pushBox .pb-msg{margin-top:8px;font-weight:600}#pushBox .pb-msg.erro{color:var(--red-dark,#C21A24)}" +
        "#pushBox .pb-obs{font-size:11.5px;color:var(--muted,#8A7563);margin-top:6px}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function senha() {
        var campo = document.getElementById("senha");
        var v = campo && campo.value.trim();
        if (!v) { try { v = localStorage.getItem("farejadinhos_admin_senha") || ""; } catch (e) {} }
        return v;
    }
    function post(rota, dados) {
        return fetch(PUSH_URL + rota, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(dados) })
            .then(function (r) { return r.json().then(function (j) { if (r.status === 401) throw new Error("Senha do painel recusada."); if (!r.ok) throw new Error(j.erro || "erro " + r.status); return j; }); });
    }

    var form =
        "<details><summary>📣 Mandar um aviso agora</summary>" +
        "<label>Oferta (opcional — preenche tudo sozinho)</label><select data-oferta><option value=''>— escolher uma oferta no ar —</option></select>" +
        "<label>Título</label><input data-titulo maxlength='90' placeholder='🔥 Air Fryer Mondial com 40% OFF'>" +
        "<label>Mensagem</label><input data-mensagem maxlength='180' placeholder='Só hoje, corre que acaba!'>" +
        "<label>Link (abre ao tocar)</label><input data-url placeholder='" + SITE + "/'>" +
        "<label>Pra quem</label><select data-para>" +
        "<option value='melhores'>🔥 Quem quer as melhores do dia</option>" +
        "<option value='cupons'>🏷️ Quem quer os cupons do dia</option>" +
        "<option value='todos'>Todo mundo que ativou os avisos</option></select>" +
        "<button data-enviar>📣 Enviar aviso</button><div class='pb-msg' data-msg></div>" +
        "<button data-rodar style='background:var(--orange,#F7941D);color:var(--ink,#2B1B12)'>⚡ Rodar os avisos automáticos agora</button><div class='pb-msg' data-msg-rodar></div>" +
        "<div class='pb-obs'>Os avisos de categorias, palavras e cupons do dia saem sozinhos (das 8h às 22h, no máximo 3 por pessoa por dia). Use este só pra algo especial.</div>" +
        "</details>";

    function montar(r) {
        var tags = function (l) { return (l || []).map(function (x) { return "<span class='pb-tag'>" + esc(x.nome) + " · " + x.n + "</span>"; }).join("") || "<span class='pb-obs'>ninguém ainda</span>"; };
        box.innerHTML = "<h3>🔔 Avisos (notificações)</h3>" +
            (r ? "<div class='pb-nums'>" +
                "<div class='pb-num'><b>" + r.total + "</b><span>ativaram</span></div>" +
                "<div class='pb-num'><b>" + r.melhores + "</b><span>melhores do dia</span></div>" +
                "<div class='pb-num'><b>" + (r.cupons || 0) + "</b><span>cupons do dia</span></div></div>" +
                "<div><b>Categorias mais pedidas:</b><div class='pb-tags'>" + tags(r.categorias) + "</div></div>" +
                "<div><b>Palavras mais pedidas:</b><div class='pb-tags'>" + tags(r.palavras) + "</div></div>"
              : "<div class='pb-obs'>Digite a senha do painel pra ver quantas pessoas ativaram os avisos.</div>") +
            form;
        ligarForm();
    }

    function ligarForm() {
        var q = function (s) { return box.querySelector(s); };
        var ofertas = [];
        fetch("../ofertas.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (todas) {
            ofertas = window.FarejadinhosVitrine ? window.FarejadinhosVitrine.selecionar(todas, new Date()).visiveis : todas;
            q("[data-oferta]").innerHTML += ofertas.map(function (o, i) {
                return "<option value='" + i + "'>" + esc(String(o.produto || "").slice(0, 60)) + " — " + esc(o.preco || "") + "</option>";
            }).join("");
        }).catch(function () {});
        q("[data-oferta]").onchange = function () {
            var o = ofertas[Number(this.value)];
            if (!o) return;
            q("[data-titulo]").value = ("🔥 " + (o.produto || "")).slice(0, 90);
            q("[data-mensagem]").value = [o.preco ? "Por " + (/^R\$/.test(o.preco) ? o.preco : "R$ " + o.preco) : "", o.cupom ? "cupom " + o.cupom : ""].filter(Boolean).join(" · ") || "Toque pra ver a oferta";
            q("[data-url]").value = SITE + "/ofertas/" + encodeURIComponent(o.slug) + "/";
            q("[data-url]").dataset.imagem = o.imagem ? SITE + "/assets/" + encodeURIComponent(o.imagem) : "";
        };
        q("[data-rodar]").onclick = function () {
            var btn = this, msg = q("[data-msg-rodar]");
            var s = senha();
            if (!s) { msg.className = "pb-msg erro"; msg.textContent = "Digite a senha do painel."; return; }
            btn.disabled = true; btn.textContent = "Rodando...";
            post("/rodar-agora", { senha: s }).then(function (r) {
                msg.className = "pb-msg";
                if (r.pulou) msg.textContent = "⏸️ Fora do horário (os avisos automáticos só saem das 8h às 22h).";
                else if (r.iniciado) msg.textContent = "✅ Primeira rodada: as ofertas que já estavam no ar foram anotadas (sem avisar ninguém). Daqui pra frente, as novas avisam.";
                else msg.textContent = "✅ " + (r.novas || 0) + " oferta(s) nova(s) conferida(s) · " + (r.ok || 0) + " aviso(s) enviado(s)" +
                    (r.cupons && r.cupons.ok ? " · " + r.cupons.ok + " aviso(s) de cupom" : "") + ".";
            }).catch(function (e) { msg.className = "pb-msg erro"; msg.textContent = "❌ " + e.message; })
              .then(function () { btn.disabled = false; btn.textContent = "⚡ Rodar os avisos automáticos agora"; });
        };
        q("[data-enviar]").onclick = function () {
            var btn = this, msg = q("[data-msg]");
            var s = senha();
            if (!s) { msg.className = "pb-msg erro"; msg.textContent = "Digite a senha do painel."; return; }
            var titulo = q("[data-titulo]").value.trim();
            if (!titulo) { msg.className = "pb-msg erro"; msg.textContent = "Escreva um título."; return; }
            var para = q("[data-para]");
            if (!confirm("Enviar o aviso \"" + titulo + "\" para: " + para.options[para.selectedIndex].text + "?")) return;
            btn.disabled = true; btn.textContent = "Enviando...";
            post("/enviar", { senha: s, titulo: titulo, mensagem: q("[data-mensagem]").value.trim(), url: q("[data-url]").value.trim(), imagem: q("[data-url]").dataset.imagem || "", para: para.value })
                .then(function (r) {
                    msg.className = "pb-msg";
                    msg.textContent = "✅ Enviado pra " + r.ok + " de " + r.alvo + " pessoa(s)" + (r.removidos ? " · " + r.removidos + " já tinham desligado (saíram da lista)" : "") + (r.falhas ? " · " + r.falhas + " falharam" : "") + ".";
                })
                .catch(function (e) { msg.className = "pb-msg erro"; msg.textContent = "❌ " + e.message; })
                .then(function () { btn.disabled = false; btn.textContent = "📣 Enviar aviso"; });
        };
    }

    function carregar() {
        var s = senha();
        if (!s) { montar(null); return; }
        post("/resumo", { senha: s }).then(montar).catch(function (e) {
            montar(null);
            box.querySelector(".pb-obs").textContent = /fetch|Failed|NetworkError/i.test(e.message)
                ? "O serviço de avisos ainda não está ligado na Cloudflare."
                : e.message;
        });
    }
    function iniciar() {
        carregar();
        var campo = document.getElementById("senha");
        if (campo) campo.addEventListener("change", carregar);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
