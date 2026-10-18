/**
 * Farejadinhos da Yang — "A Yang também farejou"
 *
 * Na página de uma oferta, mostra embaixo outras ofertas que estão no
 * ar: primeiro as da mesma categoria, depois as de maior desconto.
 * Uso (no fim da página da oferta):
 *   <script src="../../assets/vitrine.js"></script>
 *   <script src="../../assets/relacionados.js" data-base="../../"></script>
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "../../";
    var MAX = 8;

    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = base + "assets/relacionados.css";
    document.head.appendChild(css);

    // Histórico de preço (gráfico abaixo do botão) — carregado daqui pra valer
    // em todas as páginas de oferta, inclusive as já geradas.
    if (!window.FarejadinhosHistorico && !document.querySelector('script[src*="historico.js"]')) {
        var hs = document.createElement("script");
        hs.src = base + "assets/historico.js";
        hs.setAttribute("data-base", base);
        document.head.appendChild(hs);
    }

    function slugAtual() {
        var partes = location.pathname.split("/").filter(Boolean);
        var i = partes.lastIndexOf("ofertas");
        return i >= 0 && partes[i + 1] ? decodeURIComponent(partes[i + 1]) : "";
    }

    function numero(p) {
        var s = String(p || "").replace(/[^\d.,]/g, "");
        if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
        var n = parseFloat(s);
        return isFinite(n) ? n : 0;
    }

    function desconto(o) {
        var a = numero(o.precoAntigo), p = numero(o.preco);
        return a > p && p > 0 ? Math.round((1 - p / a) * 100) : 0;
    }

    function esc(t) {
        var d = document.createElement("div");
        d.textContent = t == null ? "" : String(t);
        return d.innerHTML;
    }

    function loja(link) {
        var l = String(link || "");
        if (/shopee|shp\.ee/i.test(l)) return ["shopee", "Shopee"];
        if (/mercadoli[vb]re|meli\.la/i.test(l)) return ["ml", "Mercado Livre"];
        if (/amazon\.|amzn\./i.test(l)) return ["amazon", "Amazon"];
        return null;
    }

    function card(o) {
        var pct = desconto(o);
        var lj = loja(o.link);
        return '<a class="rel-card" href="' + base + "ofertas/" + encodeURIComponent(o.slug) + '/">' +
            '<div class="rel-img"><img src="' + base + "assets/" + encodeURIComponent(o.imagem || "") + '" alt="" loading="lazy">' +
            (pct >= 5 ? '<span class="rel-off">-' + pct + "%</span>" : "") + "</div>" +
            '<div class="rel-info">' +
            (lj ? '<span class="rel-loja ' + lj[0] + '">' + lj[1] + "</span>" : "") +
            '<div class="rel-nome">' + esc(o.produto) + "</div>" +
            (o.precoAntigo ? '<div class="rel-old">' + esc(o.precoAntigo) + "</div>" : "") +
            '<div class="rel-preco">' + esc(o.preco) + "</div>" +
            (o.cupom ? '<div class="rel-cupom">🏷️ ' + esc(o.cupom) + "</div>" : "") +
            "</div></a>";
    }

    function montar(todas) {
        var slug = slugAtual();
        var atual = todas.filter(function (o) { return o && o.slug === slug; })[0];
        var visiveis = window.FarejadinhosVitrine
            ? window.FarejadinhosVitrine.selecionar(todas, new Date()).visiveis
            : todas;
        var outras = visiveis.filter(function (o) { return o && o.slug && o.slug !== slug; });
        if (!outras.length) return;

        var cat = atual && atual.categoria ? atual.categoria : "";
        var mesma = outras.filter(function (o) { return cat && o.categoria === cat; })
            .sort(function (a, b) { return desconto(b) - desconto(a); });
        var resto = outras.filter(function (o) { return !(cat && o.categoria === cat); })
            .sort(function (a, b) { return desconto(b) - desconto(a); });
        var lista = mesma.slice(0, MAX);
        if (lista.length < MAX) lista = lista.concat(resto.slice(0, MAX - lista.length));

        var sec = document.createElement("section");
        sec.className = "rel-secao";
        sec.innerHTML =
            '<div class="rel-topo"><h2>🐾 A Yang também farejou</h2>' +
            (cat && mesma.length ? '<a href="' + base + "index.html?categoria=" + encodeURIComponent(cat) + '#tituloGrid">Ver tudo de ' + esc(cat) + " →</a>" : "") +
            "</div>" +
            '<div class="rel-grid">' + lista.map(card).join("") + "</div>";

        var alvo = document.querySelector(".wrap") || document.body;
        alvo.parentNode.insertBefore(sec, alvo.nextSibling);
    }

    function iniciar() {
        fetch(base + "ofertas.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
            .then(function (r) { return r.json(); })
            .then(function (d) { montar(Array.isArray(d) ? d : [d]); })
            .catch(function () {});
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
