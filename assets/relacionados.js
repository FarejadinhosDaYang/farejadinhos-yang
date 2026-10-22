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
        if (window.FarejadinhosVitrine && window.FarejadinhosVitrine.comMelhorAnuncio) o = window.FarejadinhosVitrine.comMelhorAnuncio(o);
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

    function haQuanto(iso) {
        var d = new Date(iso);
        if (!iso || isNaN(d)) return "";
        var h = (Date.now() - d) / 3600000;
        if (h < 1) return "agora há pouco";
        if (h < 24) return "há " + Math.round(h) + "h";
        var dias = Math.round(h / 24);
        return dias === 1 ? "ontem" : "há " + dias + " dias";
    }

    // "Este produto em outras lojas": quando a oferta tem mais de um anúncio,
    // o preço/botão do topo passam a ser do MENOR preço confiável, e a
    // lista completa aparece embaixo do botão.
    function montarAnuncios(atual) {
        var V = window.FarejadinhosVitrine;
        if (!atual || !V || !V.anunciosDe) return;
        var lista = V.anunciosDe(atual, new Date());
        if (lista.length < 2) return;
        var melhor = lista.filter(function (a) { return a.confiavel; })[0] || lista[0];
        var btn = document.querySelector(".card a.btn, a.btn");
        var preco = document.querySelector(".price");
        if (!melhor.principal) {
            var copia = V.comMelhorAnuncio(atual, new Date());
            if (preco) preco.textContent = copia.preco;
            if (btn) btn.href = melhor.link;
            var old = document.querySelector(".old");
            if (old) old.style.display = "none";
        }
        var confiaveis = lista.filter(function (a) { return a.confiavel; });
        var sec = document.createElement("div");
        sec.className = "anc-box";
        sec.innerHTML =
            (confiaveis.length > 1 ? '<div class="anc-selo">🏆 Menor preço entre ' + confiaveis.length + " anúncios" +
                (melhor.loja ? " · " + esc(melhor.loja) : "") + "</div>" : "") +
            '<div class="anc-titulo">🏪 Este produto em outros anúncios</div>' +
            lista.map(function (a) {
                var m = a === melhor;
                var preco = a.valor ? "R$ " + a.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                var quando = haQuanto(a.conferido);
                return '<a class="anc-item' + (m ? " melhor" : "") + (a.confiavel ? "" : " duvida") + '" href="' + esc(a.link) + '" target="_blank" rel="nofollow sponsored noopener">' +
                    '<span class="anc-loja ' + esc(a.lojaId) + '">' + esc(a.loja) + "</span>" +
                    '<span class="anc-preco">' + (a.confiavel ? preco : "preço a conferir") + "</span>" +
                    '<span class="anc-quando">' + (m ? "✅ mais barato" : a.confiavel ? (quando ? "conferido " + quando : "") : "abrir pra ver") + "</span>" +
                    '<span class="anc-ver">Ver ↗</span></a>';
            }).join("") +
            '<div class="anc-obs">Preços conferidos automaticamente; podem mudar na loja. Vale sempre o preço de lá.</div>';
        var depois = btn || preco;
        if (depois && depois.parentNode) depois.parentNode.insertBefore(sec, depois.nextSibling);
    }

    function montar(todas) {
        var slug = slugAtual();
        var atual = todas.filter(function (o) { return o && o.slug === slug; })[0];
        try { montarAnuncios(atual); } catch (e) {}
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
