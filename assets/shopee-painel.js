/* Shopee no painel (Worker farejadinhos-shopee — cloudflare/shopee-worker.js)
 *
 * window.FarejadinhosShopee:
 *   ehShopee(link)      -> é link da Shopee?
 *   ehAfiliado(link)    -> já é link curto de afiliado (s.shopee.com.br / shp.ee)?
 *   afiliar(links)      -> Promise<{ linkComum: linkAfiliado }>
 *   produto(link)       -> Promise<{ produto, preco, precoAntigo, imagemUrl, afiliado, ... }>
 *   afiliarCampo(input, aviso?) -> troca o link comum do campo pelo de afiliado
 *
 * Caixa "🔗 Gerar link de afiliado da Shopee": <div id="shopeeLinksBox"></div>
 */
(function () {
    var URL_SHOPEE = "https://farejadinhos-shopee.bernard-shimizu.workers.dev";

    function senha() {
        var c = document.getElementById("senha");
        var v = c && c.value.trim();
        if (!v) { try { v = localStorage.getItem("farejadinhos_admin_senha") || ""; } catch (e) {} }
        return v;
    }
    function ehShopee(l) { return /^https?:\/\/([a-z0-9-]+\.)*(shopee\.com\.br|shp\.ee)\//i.test(String(l || "").trim()); }
    function ehAfiliado(l) { return /^https?:\/\/(s\.shopee\.com\.br|shp\.ee)\//i.test(String(l || "").trim()); }

    function post(rota, dados) {
        var s = senha();
        if (!s) return Promise.reject(new Error("Digite a senha do painel primeiro."));
        dados.senha = s;
        return fetch(URL_SHOPEE + rota, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(dados) })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (r.status === 401) throw new Error("Senha do painel recusada.");
                    if (!r.ok) throw new Error(j.erro || "erro " + r.status);
                    return j;
                });
            }, function () { throw new Error("O Worker da Shopee não respondeu (já foi criado na Cloudflare?)."); });
    }

    function afiliar(links) {
        var comuns = (links || []).filter(function (l) { return ehShopee(l) && !ehAfiliado(l); });
        if (!comuns.length) return Promise.resolve({});
        var mapa = {};
        var lotes = [];
        for (var i = 0; i < comuns.length; i += 30) lotes.push(comuns.slice(i, i + 30));
        return lotes.reduce(function (p, lote) {
            return p.then(function () {
                return post("/link", { links: lote }).then(function (j) {
                    (j.resultados || []).forEach(function (r) { if (r.afiliado) mapa[r.link] = r.afiliado; });
                });
            });
        }, Promise.resolve()).then(function () { return mapa; });
    }

    function produto(link) { return post("/produto", { link: link }); }

    function afiliarCampo(input, aviso) {
        if (!input || !ehShopee(input.value) || ehAfiliado(input.value)) return Promise.resolve(false);
        var original = input.value.trim();
        return afiliar([original]).then(function (m) {
            if (m[original] && input.value.trim() === original) {
                input.value = m[original];
                if (aviso) aviso("🔗 Link trocado pelo seu link de afiliado da Shopee.");
                return true;
            }
            return false;
        }).catch(function (e) { if (aviso) aviso("⚠️ Não converti o link da Shopee: " + e.message, true); return false; });
    }

    window.FarejadinhosShopee = { URL: URL_SHOPEE, ehShopee: ehShopee, ehAfiliado: ehAfiliado, afiliar: afiliar, produto: produto, afiliarCampo: afiliarCampo };

    // ---------------- caixa do painel ----------------
    var box = document.getElementById("shopeeLinksBox");
    if (!box) return;
    var css = document.createElement("style");
    css.textContent =
        "#shopeeLinksBox{background:var(--cream-2,#FFFAF1);border:1.5px solid var(--line,#F0DFC4);border-radius:14px;padding:14px 16px;margin-bottom:18px;box-shadow:0 6px 20px rgba(43,27,18,.08);font-family:'Work Sans',sans-serif;color:var(--ink,#2B1B12);font-size:13.5px}" +
        "#shopeeLinksBox h3{margin:0 0 6px;font:800 16px 'Baloo 2','Work Sans',sans-serif}" +
        "#shopeeLinksBox .sl-obs{font-size:12px;color:var(--muted,#8A7563);margin-bottom:8px}" +
        "#shopeeLinksBox textarea{width:100%;box-sizing:border-box;min-height:80px;padding:9px 10px;border:1.5px solid var(--line,#F0DFC4);border-radius:9px;font:500 13.5px 'Work Sans',sans-serif;background:#fff;resize:vertical}" +
        "#shopeeLinksBox .sl-btn{margin-top:8px;width:100%;padding:11px;border:0;border-radius:10px;background:#EE4D2D;color:#fff;font:800 15px 'Baloo 2','Work Sans',sans-serif;cursor:pointer}" +
        "#shopeeLinksBox .sl-btn:disabled{opacity:.6}" +
        "#shopeeLinksBox .sl-msg{margin-top:8px;font-weight:600}#shopeeLinksBox .sl-msg.erro{color:var(--red-dark,#C21A24)}" +
        "#shopeeLinksBox .sl-item{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line,#F0DFC4);border-radius:10px;padding:7px 10px;margin-top:6px}" +
        "#shopeeLinksBox .sl-item code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}" +
        "#shopeeLinksBox .sl-item small{display:block;color:var(--muted,#8A7563);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        "#shopeeLinksBox .sl-item .sl-txt{flex:1;min-width:0}" +
        "#shopeeLinksBox .sl-copiar{border:0;border-radius:8px;padding:7px 10px;background:var(--orange,#F7941D);font-weight:800;cursor:pointer;white-space:nowrap}" +
        "#shopeeLinksBox .sl-item.erro{color:var(--red-dark,#C21A24)}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function copiar(texto, botao) {
        var ok = function () { var t = botao.textContent; botao.textContent = "✅ Copiado"; setTimeout(function () { botao.textContent = t; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copie o link:", texto); });
        else prompt("Copie o link:", texto);
    }

    box.innerHTML =
        "<h3>🔗 Gerar link de afiliado da Shopee</h3>" +
        "<div class='sl-obs'>Cole um ou vários links comuns da Shopee (produto ou loja), um por linha. Sai o seu link de afiliado, pronto pra copiar.</div>" +
        "<textarea data-links placeholder='https://shopee.com.br/...'></textarea>" +
        "<button class='sl-btn' data-gerar>🔗 Gerar links de afiliado</button>" +
        "<div class='sl-msg' data-msg></div><div data-lista></div>";

    var q = function (s) { return box.querySelector(s); };
    q("[data-gerar]").onclick = function () {
        var btn = this, msg = q("[data-msg]"), lista = q("[data-lista]");
        var links = q("[data-links]").value.split(/\s+/).map(function (l) { return l.trim(); }).filter(Boolean);
        lista.innerHTML = "";
        if (!links.length) { msg.className = "sl-msg erro"; msg.textContent = "Cole pelo menos um link."; return; }
        btn.disabled = true; btn.textContent = "Gerando..."; msg.className = "sl-msg"; msg.textContent = "";
        post("/link", { links: links.slice(0, 30) }).then(function (j) {
            var res = j.resultados || [];
            var ok = res.filter(function (r) { return r.afiliado; });
            msg.textContent = "✅ " + ok.length + " de " + res.length + " link(s) gerado(s)." + (links.length > 30 ? " (Só os 30 primeiros — gere o resto depois.)" : "");
            lista.innerHTML = res.map(function (r, i) {
                return r.afiliado
                    ? "<div class='sl-item'><div class='sl-txt'><code>" + esc(r.afiliado) + "</code><small>" + esc(r.link) + "</small></div><button class='sl-copiar' data-i='" + i + "'>📋 Copiar</button></div>"
                    : "<div class='sl-item erro'><div class='sl-txt'>❌ " + esc(r.erro) + "<small>" + esc(r.link) + "</small></div></div>";
            }).join("") + (ok.length > 1 ? "<button class='sl-btn' data-todos style='background:var(--orange,#F7941D);color:var(--ink,#2B1B12)'>📋 Copiar todos</button>" : "");
            lista.querySelectorAll(".sl-copiar").forEach(function (b) { b.onclick = function () { copiar(res[+b.dataset.i].afiliado, b); }; });
            var todos = lista.querySelector("[data-todos]");
            if (todos) todos.onclick = function () { copiar(ok.map(function (r) { return r.afiliado; }).join("\n"), todos); };
        }).catch(function (e) { msg.className = "sl-msg erro"; msg.textContent = "❌ " + e.message; })
          .then(function () { btn.disabled = false; btn.textContent = "🔗 Gerar links de afiliado"; });
    };
})();
