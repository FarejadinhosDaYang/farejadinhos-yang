/* Caixa "🐶 Pedidos dos visitantes" no painel.
 * Uso: <div id="pedidosBox"></div><script src="../assets/pedidos-painel.js"></script>
 * Lê do Worker farejadinhos-shopee (rota /pedidos, com a senha do painel) o que
 * as pessoas pediram em "Pede pra Yang farejar" e o que a Yang achou. Cada
 * produto achado pode ir pra fila do site com "📌 Pôr no site".
 */
(function () {
    var URL_SHOPEE = "https://farejadinhos-shopee.bernard-shimizu.workers.dev";
    var URL_PAINEL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev";
    var box = document.getElementById("pedidosBox");
    if (!box) return;
    var css = document.createElement("style");
    css.textContent =
        "#pedidosBox{background:var(--cream-2,#FFFAF1);border:1.5px solid var(--line,#F0DFC4);border-radius:14px;padding:14px 16px;margin-bottom:18px;box-shadow:0 6px 20px rgba(43,27,18,.08);font-family:'Work Sans',sans-serif;color:var(--ink,#2B1B12);font-size:13.5px}" +
        "#pedidosBox h3{margin:0 0 4px;font:800 16px 'Baloo 2','Work Sans',sans-serif}" +
        "#pedidosBox .pd-obs{font-size:12px;color:var(--muted,#8A7563)}" +
        "#pedidosBox details{background:#fff;border:1px solid var(--line,#F0DFC4);border-radius:10px;margin-top:6px;padding:7px 10px}" +
        "#pedidosBox summary{cursor:pointer;display:flex;justify-content:space-between;gap:8px;font-weight:700}" +
        "#pedidosBox summary small{font-weight:600;color:var(--muted,#8A7563);white-space:nowrap}" +
        "#pedidosBox .pd-prod{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed var(--line,#F0DFC4);margin-top:6px}" +
        "#pedidosBox .pd-prod img{width:42px;height:42px;object-fit:contain;border-radius:7px;border:1px solid var(--line,#F0DFC4);flex:none}" +
        "#pedidosBox .pd-prod div{flex:1;min-width:0}" +
        "#pedidosBox .pd-prod b{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        "#pedidosBox .pd-prod span{font-size:11.5px;color:var(--muted,#8A7563)}" +
        "#pedidosBox .pd-prod button{flex:none;border:1.5px solid #EE4D2D;background:#fff;color:#C2381F;border-radius:8px;padding:6px 9px;font:800 12px 'Work Sans',sans-serif;cursor:pointer}" +
        "#pedidosBox .pd-prod button:disabled{opacity:.7;cursor:default}" +
        "#pedidosBox .pd-zero{color:var(--red-dark,#C21A24)}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function senha() {
        var c = document.getElementById("senha");
        var v = c && c.value.trim();
        if (!v) { try { v = localStorage.getItem("farejadinhos_admin_senha") || ""; } catch (e) {} }
        return v;
    }
    function quando(iso) {
        var h = (Date.now() - new Date(iso)) / 3600e3;
        return h < 1 ? "agora há pouco" : h < 24 ? "há " + Math.round(h) + "h" : "há " + Math.round(h / 24) + " dia(s)";
    }

    function postar(p, botao) {
        var s = senha();
        if (!s) { alert("Digite a senha do painel."); return; }
        var nome = window.FarejadinhosNomes ? FarejadinhosNomes.encurtar(p.produto) : p.produto;
        var cat = window.FarejadinhosCategorias ? (FarejadinhosCategorias.sugerir(p.produto) || "") : "";
        if (!confirm("Colocar na fila do site?\n\n" + nome + "\n" + p.preco + (p.precoAntigo ? " (de " + p.precoAntigo + ")" : "") + "\nCategoria: " + (cat || "sem categoria"))) return;
        botao.disabled = true; botao.textContent = "Enviando...";
        var dados = new FormData();
        dados.append("senha", s);
        dados.append("itens", JSON.stringify([{ produto: nome, preco: p.preco, precoAntigo: p.precoAntigo || "", cupom: "", categoria: cat,
            destaque: false, link: p.afiliado, imagemUrl: p.imagemUrl, agendaInicio: "", agendaPorDia: "0" }]));
        fetch(URL_PAINEL + "/lote", { method: "POST", body: dados }).then(function (r) {
            return r.text().then(function (t) { if (r.status === 401) throw new Error("Senha recusada."); if (!r.ok) throw new Error(t); });
        }).then(function () { botao.textContent = "✅ Na fila"; })
          .catch(function (e) { alert("Não deu: " + e.message); botao.disabled = false; botao.textContent = "📌 Pôr no site"; });
    }

    function montar(lista, aviso) {
        // junta os pedidos iguais (mesmo termo)
        var grupos = {};
        (lista || []).forEach(function (p) {
            var k = String(p.termo || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            if (!k) return;
            var g = grupos[k] = grupos[k] || { termo: p.termo, n: 0, ultimo: p.quando, produtos: p.produtos || [], achados: p.achados };
            g.n++;
            if (p.quando > g.ultimo) { g.ultimo = p.quando; g.produtos = p.produtos || g.produtos; g.achados = p.achados; }
        });
        var gs = Object.keys(grupos).map(function (k) { return grupos[k]; }).sort(function (a, b) { return b.n - a.n || (b.ultimo > a.ultimo ? 1 : -1); });
        box.innerHTML = "<h3>🐶 Pedidos dos visitantes</h3>" +
            '<div class="pd-obs">' + (aviso || "O que as pessoas pediram em “Pede pra Yang farejar” (mais pedidos primeiro). Toque num pedido pra ver o que a Yang achou e pôr no site.") + "</div>" +
            (gs.length ? gs.slice(0, 40).map(function (g, i) {
                return "<details><summary><span>" + esc(g.termo) + (g.n > 1 ? " ×" + g.n : "") + "</span><small" + (g.achados ? "" : ' class="pd-zero"') + ">" +
                    (g.achados ? g.achados + " achado(s)" : "nada achado") + " · " + quando(g.ultimo) + "</small></summary>" +
                    (g.produtos || []).map(function (p, j) {
                        return '<div class="pd-prod"><img src="' + esc(p.imagemUrl) + '" alt="" loading="lazy"><div><b>' + esc(p.produto) + "</b><span>" + esc(p.preco) +
                            " · ⭐ " + esc(p.nota) + " · " + esc(p.vendas) + ' vendidos · <a href="' + esc(p.afiliado) + '" target="_blank" rel="noopener">abrir ↗</a></span></div>' +
                            '<button type="button" data-g="' + i + '" data-p="' + j + '">📌 Pôr no site</button></div>';
                    }).join("") + "</details>";
            }).join("") : '<div class="pd-obs" style="margin-top:6px">Nenhum pedido ainda.</div>');
        box.querySelectorAll("button[data-g]").forEach(function (b) {
            b.onclick = function () { postar(gs[+b.dataset.g].produtos[+b.dataset.p], b); };
        });
    }

    function carregar() {
        var s = senha();
        if (!s) { box.innerHTML = "<h3>🐶 Pedidos dos visitantes</h3><div class='pd-obs'>Digite a senha do painel pra ver os pedidos.</div>"; return; }
        fetch(URL_SHOPEE + "/pedidos", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ senha: s }) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j.erro) throw new Error(j.erro);
                montar(j.pedidos, j.semBanco ? "Pra guardar os pedidos, ligue o banco no Worker farejadinhos-shopee (Settings → Bindings → D1 → Variable name: DB → farejadinhos-contador)." : "");
            })
            .catch(function (e) { box.innerHTML = "<h3>🐶 Pedidos dos visitantes</h3><div class='pd-obs'>Não consegui ler os pedidos (" + esc(e.message) + "). O Worker da Shopee já foi atualizado?</div>"; });
    }
    function iniciar() {
        carregar();
        var c = document.getElementById("senha");
        if (c) c.addEventListener("change", carregar);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
