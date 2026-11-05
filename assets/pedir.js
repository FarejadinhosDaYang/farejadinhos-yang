/**
 * Farejadinhos da Yang — "🐶 Pede pra Yang farejar"
 *
 * A pessoa escreve o que procura; primeiro aparecem as ofertas do site
 * que batem, depois a Yang busca na Shopee (Worker farejadinhos-shopee,
 * rota pública /buscar): só produtos com nota boa e muitas vendas, e
 * nada da lista do que não pode (adulto, armas, remédios, bebida, comida,
 * réplicas...). Os links são de afiliado — isso é dito com todas as letras.
 *
 * Uso:
 *   <div id="pedirYang"></div>
 *   <script src="assets/pedir.js" data-base=""></script>
 *   FarejadinhosPedir.montar(elemento, { termo, compacto, semSite })
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";
    var URL_SHOPEE = "https://farejadinhos-shopee.bernard-shimizu.workers.dev";

    var css = document.createElement("style");
    css.textContent =
        ".pedir-box{background:#fff;border:1.5px solid #F0DFC4;border-radius:20px;padding:18px 18px 14px;box-shadow:0 8px 24px rgba(43,27,18,.07);font-family:'Work Sans',Arial,sans-serif;color:#2B1B12}" +
        ".pedir-topo{display:flex;align-items:center;gap:12px;margin-bottom:12px}" +
        ".pedir-topo img{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 3px #FFF1DE}" +
        ".pedir-topo h2{margin:0;font:800 21px/1.15 'Baloo 2',sans-serif;color:#C21A24}" +
        ".pedir-topo p{margin:2px 0 0;font-size:13.5px;color:#8A7563}" +
        ".pedir-form{display:flex;gap:8px}" +
        ".pedir-form input{flex:1;min-width:0;padding:12px 14px;border:2px solid #F0DFC4;border-radius:12px;font:500 15px 'Work Sans',Arial,sans-serif;background:#FFFAF1;color:#2B1B12}" +
        ".pedir-form input:focus{outline:none;border-color:#F7941D;background:#fff}" +
        ".pedir-form button{flex:none;border:0;border-radius:12px;padding:0 16px;background:linear-gradient(135deg,#E5232E,#C21A24);color:#fff;font:800 15px 'Baloo 2',sans-serif;cursor:pointer;white-space:nowrap}" +
        ".pedir-form button:disabled{opacity:.6;cursor:wait}" +
        ".pedir-dicas{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}" +
        ".pedir-dicas button{border:1.5px solid #F0DFC4;background:#fff;border-radius:999px;padding:4px 11px;font:600 12.5px 'Work Sans',Arial,sans-serif;color:#5C4636;cursor:pointer}" +
        ".pedir-status{margin-top:12px;font-size:14px;color:#5C4636}" +
        ".pedir-status.erro{color:#C21A24;font-weight:600}" +
        ".pedir-farejando{display:inline-block;animation:pedirFareja 1s ease-in-out infinite}" +
        "@keyframes pedirFareja{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}" +
        ".pedir-titulo{margin:16px 0 8px;font:800 16px 'Baloo 2',sans-serif;color:#2B1B12}" +
        ".pedir-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}" +
        ".pedir-card{display:flex;flex-direction:column;background:#fff;border:1.5px solid #F0DFC4;border-radius:14px;overflow:hidden;text-decoration:none;color:#2B1B12;transition:transform .15s,box-shadow .15s}" +
        ".pedir-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(43,27,18,.1)}" +
        ".pedir-card .pc-img{position:relative;aspect-ratio:1;background:#fff;display:flex;align-items:center;justify-content:center}" +
        ".pedir-card .pc-img img{width:100%;height:100%;object-fit:contain}" +
        ".pedir-card .pc-desc{position:absolute;top:8px;left:8px;background:#E5232E;color:#fff;font:800 12px 'Work Sans',Arial,sans-serif;padding:3px 7px;border-radius:7px}" +
        ".pedir-card .pc-info{padding:9px 10px 11px;display:flex;flex-direction:column;gap:4px;flex:1}" +
        ".pedir-card .pc-nome{font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
        ".pedir-card .pc-preco{font:800 18px 'Baloo 2',sans-serif;color:#C21A24;line-height:1.1}" +
        ".pedir-card .pc-preco small{font:600 11.5px 'Work Sans',Arial,sans-serif;color:#8A7563}" +
        ".pedir-card .pc-de{font-size:11.5px;color:#8A7563;text-decoration:line-through}" +
        ".pedir-card .pc-prova{font-size:11.5px;color:#5C4636}" +
        ".pedir-card .pc-ver{margin-top:auto;padding-top:6px;font:800 13px 'Work Sans',Arial,sans-serif;color:#EE4D2D}" +
        ".pedir-obs{margin-top:12px;font-size:12px;color:#8A7563;line-height:1.45}" +
        ".pedir-box.compacto{padding:14px}" +
        ".pedir-box.compacto .pedir-topo img{width:42px;height:42px}" +
        ".pedir-box.compacto .pedir-topo h2{font-size:18px}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function milhar(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + " mil" : String(n); }

    var catalogo = null;
    function lerCatalogo() {
        if (catalogo) return catalogo;
        catalogo = fetch(base + "ofertas.json?t=" + Math.floor(Date.now() / 300000), { cache: "no-store" })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var V = window.FarejadinhosVitrine;
                return V ? V.selecionar(d, new Date()).visiveis : d;
            })
            .catch(function () { return []; });
        return catalogo;
    }
    function noSite(termo) {
        var palavras = norm(termo).split(/\s+/).filter(function (p) { return p.length > 2; });
        if (!palavras.length) return Promise.resolve([]);
        return lerCatalogo().then(function (lista) {
            return lista.filter(function (o) {
                var n = norm(o.produto);
                return palavras.every(function (p) { return n.indexOf(p.replace(/s$/, "")) >= 0; });
            }).slice(0, 6);
        });
    }

    function cardSite(o) {
        var img = o.imagem ? base + "assets/" + encodeURIComponent(o.imagem) : "";
        return '<a class="pedir-card" href="' + base + "ofertas/" + encodeURIComponent(o.slug) + '/">' +
            '<div class="pc-img">' + (img ? '<img src="' + img + '" alt="" loading="lazy">' : "") + "</div>" +
            '<div class="pc-info"><div class="pc-nome">' + esc(o.produto) + "</div>" +
            '<div class="pc-preco">' + esc(o.preco) + "</div>" +
            '<div class="pc-prova">✅ já conferido pela Yang</div>' +
            '<div class="pc-ver">Ver oferta →</div></div></a>';
    }
    function cardShopee(p) {
        return '<a class="pedir-card" href="' + esc(p.afiliado) + '" target="_blank" rel="sponsored nofollow noopener">' +
            '<div class="pc-img">' + (p.imagemUrl ? '<img src="' + esc(p.imagemUrl) + '" alt="" loading="lazy">' : "") +
            (p.desconto >= 5 ? '<span class="pc-desc">-' + p.desconto + "%</span>" : "") + "</div>" +
            '<div class="pc-info"><div class="pc-nome">' + esc(p.produto) + "</div>" +
            (p.precoAntigo ? '<div class="pc-de">' + esc(p.precoAntigo) + "</div>" : "") +
            '<div class="pc-preco">' + (p.variacoes ? "<small>a partir de </small>" : "") + esc(p.preco) + "</div>" +
            '<div class="pc-prova">⭐ ' + String(p.nota).replace(".", ",") + " · " + milhar(p.vendas) + " vendidos</div>" +
            '<div class="pc-ver">Ver na Shopee ↗</div></div></a>';
    }

    function montar(el, opcoes) {
        if (!el) return;
        opcoes = opcoes || {};
        el.innerHTML =
            '<div class="pedir-box' + (opcoes.compacto ? " compacto" : "") + '">' +
            '<div class="pedir-topo"><img src="' + base + 'assets/yang-badge.png" alt="">' +
            "<div><h2>" + (opcoes.compacto ? "Não achou? Pede pra Yang farejar!" : "Pede pra Yang farejar 🐾") + "</h2>" +
            "<p>Diz o que você procura e ela fareja os mais vendidos e bem avaliados na Shopee.</p></div></div>" +
            '<form class="pedir-form"><input type="search" maxlength="60" placeholder="Ex.: pipoqueira elétrica" aria-label="O que você procura?">' +
            '<button type="submit">🔎 Farejar</button></form>' +
            (opcoes.compacto ? "" : '<div class="pedir-dicas">' + ["pipoqueira elétrica", "garrafa térmica", "organizador de geladeira", "fone bluetooth", "luminária de mesa"].map(function (d) {
                return '<button type="button">' + d + "</button>";
            }).join("") + "</div>") +
            '<div class="pedir-status" aria-live="polite"></div><div class="pedir-res"></div>' +
            '<div class="pedir-obs">🐾 Os produtos da Shopee vêm direto da loja (nota 4,5+ e muitas vendas), com <b>link de afiliado</b>: você paga o mesmo preço e uma parte vira comissão pro Farejadinhos. Preço e estoque podem mudar na loja — confira lá antes de comprar.</div>' +
            "</div>";
        var form = el.querySelector("form"), input = el.querySelector("input"), botao = el.querySelector("button[type=submit]");
        var status = el.querySelector(".pedir-status"), res = el.querySelector(".pedir-res");

        function farejar(termo) {
            termo = String(termo || "").trim();
            if (termo.length < 3) { status.className = "pedir-status erro"; status.textContent = "Escreve um pouquinho mais (ex.: pipoqueira elétrica)."; return; }
            input.value = termo;
            botao.disabled = true;
            status.className = "pedir-status";
            status.innerHTML = '<span class="pedir-farejando">🐶</span> A Yang tá farejando “' + esc(termo) + "”…";
            res.innerHTML = "";
            var site = opcoes.semSite ? Promise.resolve([]) : noSite(termo);
            var shopee = fetch(URL_SHOPEE + "/buscar", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ termo: termo }) })
                .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && !j.produtos) throw new Error(j.erro || "Não deu pra farejar agora."); return j; }); });
            Promise.all([site, shopee.catch(function (e) { return { erro: e.message }; })]).then(function (x) {
                var doSite = x[0], j = x[1] || {};
                var html = "";
                if (doSite.length) html += '<div class="pedir-titulo">✅ Já tem no site</div><div class="pedir-grade">' + doSite.map(cardSite).join("") + "</div>";
                if (j.produtos && j.produtos.length) html += '<div class="pedir-titulo">🐶 A Yang farejou na Shopee</div><div class="pedir-grade">' + j.produtos.map(cardShopee).join("") + "</div>";
                res.innerHTML = html;
                if (j.bloqueado) { status.className = "pedir-status erro"; status.textContent = "🙅 Esse tipo de produto a Yang não fareja por aqui."; }
                else if (j.erro && !doSite.length) { status.className = "pedir-status erro"; status.textContent = "😕 " + j.erro; }
                else if (!html) { status.className = "pedir-status"; status.textContent = "A Yang não achou nada bem avaliado com esse nome. Tenta escrever de outro jeito (ex.: só “pipoqueira”)."; }
                else status.textContent = "";
            }).then(function () { botao.disabled = false; });
        }
        form.addEventListener("submit", function (e) { e.preventDefault(); farejar(input.value); });
        el.querySelectorAll(".pedir-dicas button").forEach(function (b) { b.onclick = function () { farejar(b.textContent); }; });
        if (opcoes.termo) farejar(opcoes.termo);
        return { farejar: farejar };
    }

    window.FarejadinhosPedir = { montar: montar };
})();
