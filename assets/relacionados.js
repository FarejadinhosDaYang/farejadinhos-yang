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
            '<div class="rel-img"><img src="' + (o.imagemUrl ? esc(o.imagemUrl) : base + "assets/" + encodeURIComponent(o.imagem || "")) + '" alt="" loading="lazy">' +
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

    function reais(v) {
        return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // "Este produto em outros anúncios" + variações (cores):
    // - o preço/botão do topo são do MENOR preço confiável;
    // - com 2+ variações, aparecem bolinhas ao lado da foto; tocar numa
    //   cor troca foto, preço, botão e a lista de lojas daquela cor.
    function montarAnuncios(atual) {
        var V = window.FarejadinhosVitrine;
        if (!atual || !V || !V.anunciosDe) return;
        var todos = V.anunciosDe(atual, new Date());
        if (todos.length < 2) return;
        var vars = V.variacoesDe ? V.variacoesDe(atual, new Date()) : [];

        var btn = document.querySelector(".card a.btn, a.btn");
        var preco = document.querySelector(".price");
        var old = document.querySelector(".old");
        var foto = document.querySelector("img.product");
        var fotoPrincipal = foto ? foto.getAttribute("src") : "";
        var precoPrincipalTxt = preco ? preco.textContent.trim() : "";

        var box = document.createElement("div");
        box.className = "anc-box";
        var depois = btn || preco;
        if (depois && depois.parentNode) depois.parentNode.insertBefore(box, depois.nextSibling);

        var rotulo = null;
        if (vars.length > 1 && preco) {
            rotulo = document.createElement("div");
            rotulo.className = "var-rotulo";
            preco.parentNode.insertBefore(rotulo, preco);
        }

        function mostrarLista(lista, nomeVar) {
            var melhor = lista.filter(function (a) { return a.confiavel; })[0] || lista[0];
            var confiaveis = lista.filter(function (a) { return a.confiavel; });
            // topo: preço, botão, "de R$"
            if (preco) preco.textContent = melhor.principal ? precoPrincipalTxt : (melhor.valor ? reais(melhor.valor) : "Preço a conferir");
            if (btn) btn.href = melhor.link;
            if (old) old.style.display = melhor.principal ? "" : "none";
            box.innerHTML =
                (confiaveis.length > 1 ? '<div class="anc-selo">🏆 Menor preço entre ' + confiaveis.length + " anúncios" +
                    (nomeVar ? " de " + esc(nomeVar) : "") + " · " + esc(melhor.loja) + "</div>" : "") +
                (lista.length > 1 ? '<div class="anc-titulo">🏪 ' + (nomeVar ? esc(nomeVar) + " em outros anúncios" : "Este produto em outros anúncios") + "</div>" +
                lista.map(function (a) {
                    var m = a === melhor;
                    var quando = haQuanto(a.conferido);
                    return '<a class="anc-item' + (m ? " melhor" : "") + (a.confiavel ? "" : " duvida") + '" href="' + esc(a.link) + '" target="_blank" rel="nofollow sponsored noopener">' +
                        '<span class="anc-loja ' + esc(a.lojaId) + '">' + esc(a.loja) + "</span>" +
                        '<span class="anc-preco">' + (a.confiavel ? reais(a.valor) : "preço a conferir") + "</span>" +
                        '<span class="anc-quando">' + (m ? "✅ mais barato" : a.confiavel ? (quando ? "conferido " + quando : "") : "abrir pra ver") + "</span>" +
                        '<span class="anc-ver">Ver ↗</span></a>';
                }).join("") +
                '<div class="anc-obs">Preços conferidos automaticamente; podem mudar na loja. Vale sempre o preço de lá.</div>' : "");
        }

        if (vars.length < 2) { mostrarLista(todos, ""); return; }

        // bolinhas ao lado da foto
        var trilho = document.createElement("div");
        trilho.className = "var-trilho";
        trilho.setAttribute("role", "radiogroup");
        trilho.setAttribute("aria-label", "Escolher cor");
        if (foto) {
            var moldura = document.createElement("div");
            moldura.className = "var-moldura";
            foto.parentNode.insertBefore(moldura, foto);
            moldura.appendChild(foto);
            moldura.appendChild(trilho);
        } else if (preco) preco.parentNode.insertBefore(trilho, preco);

        function escolher(i) {
            var v = vars[i];
            Array.prototype.forEach.call(trilho.children, function (b, k) {
                b.classList.toggle("ativa", k === i);
                b.setAttribute("aria-checked", k === i ? "true" : "false");
            });
            if (foto) {
                var nova = v.imagem && v.imagem !== "principal" ? v.imagem : fotoPrincipal;
                if (foto.getAttribute("src") !== nova) {
                    foto.classList.add("trocando");
                    foto.onload = function () { foto.classList.remove("trocando"); };
                    foto.src = nova;
                    setTimeout(function () { foto.classList.remove("trocando"); }, 600);
                }
            }
            if (rotulo) rotulo.innerHTML = "Cor: <b>" + esc(v.nome) + "</b>" +
                (i === 0 && v.confiavel ? ' <span class="var-mais-barata">a mais barata agora</span>' : "");
            mostrarLista(v.lista, v.nome);
        }

        vars.forEach(function (v, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "var-bolinha" + (v.cor ? "" : " texto");
            b.setAttribute("role", "radio");
            b.title = v.nome + (v.confiavel ? " · " + reais(v.melhor.valor) : " · preço a conferir");
            b.setAttribute("aria-label", b.title);
            b.innerHTML = v.cor
                ? '<span class="var-cor" style="background:' + esc(v.cor) + '"></span>'
                : '<span class="var-txt">' + esc(v.nome.slice(0, 6)) + "</span>";
            b.onclick = function () { escolher(i); };
            trilho.appendChild(b);
        });
        escolher(0);
    }

    function montar(todas) {
        var slug = slugAtual();
        var atual = todas.filter(function (o) { return o && o.slug === slug; })[0];
        try { montarAnuncios(atual); } catch (e) {}
        // 🏷️ cupons da loja desse produto (área de cupons do site)
        try {
            var depoisCupom = document.querySelector(".anc-box") || document.querySelector(".card a.btn, a.btn");
            var cs = document.createElement("script");
            cs.src = base + "assets/cupons-vitrine.js";
            cs.setAttribute("data-base", base);
            cs.onload = function () { if (window.FarejadinhosCuponsVitrine) window.FarejadinhosCuponsVitrine.naOferta(atual, depoisCupom); };
            document.head.appendChild(cs);
        } catch (e) {}
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
