/**
 * Farejadinhos da Yang — "🏷️ Cupons de hoje" (área de cupons do site)
 *
 * Lê cupons.json (publicado pelo painel: painel/cupons.html) e mostra:
 *   - na página inicial: faixa de cupons em <section id="cuponsSecao">;
 *   - na página da oferta: os cupons da loja daquele produto, pra testar.
 * Cupom vencido (campo "ate") some sozinho.
 *
 * Uso: <script src="assets/cupons-vitrine.js" data-base=""></script>
 *   (data-base = caminho até a raiz do site)
 * FarejadinhosCuponsVitrine.naOferta(oferta, elementoDepois) — usado pelo relacionados.js
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";

    var LOJAS = {
        "Shopee": { id: "shopee", cor: "#EE4D2D", texto: "#fff" },
        "Mercado Livre": { id: "ml", cor: "#FFE600", texto: "#2D3277" },
        "Amazon": { id: "amazon", cor: "#232F3E", texto: "#fff" }
    };

    var css = document.createElement("style");
    css.textContent =
        ".cup-secao{margin-top:24px;scroll-margin-top:150px}" +
        ".cup-secao .secao-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px}" +
        ".cup-secao .secao-head h2{margin:0}" +
        ".cup-sub{margin:0 0 10px;font:500 13px 'Work Sans',Arial,sans-serif;color:#8A7563}" +
        ".cup-abas{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}" +
        ".cup-abas::-webkit-scrollbar{display:none}" +
        ".cup-aba{flex:0 0 auto;border:1.5px solid #F0DFC4;background:#fff;border-radius:999px;padding:5px 12px;font:700 12.5px 'Work Sans',Arial,sans-serif;color:#5C4636;cursor:pointer}" +
        ".cup-aba.ativa{background:#2B1B12;border-color:#2B1B12;color:#fff}" +
        // celular: carrossel com o próximo aparecendo; computador: grade
        ".cup-faixa{display:flex;align-items:stretch;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 12px;scrollbar-width:none}" +
        ".cup-faixa::-webkit-scrollbar{display:none}" +
        "@media (min-width:760px){.cup-secao .cup-faixa{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));overflow:visible}}" +
        // ticket: desconto em destaque, regra, código, botão da loja
        ".cup-card{flex:0 0 76%;max-width:280px;scroll-snap-align:start;position:relative;background:#fff;border:1.5px solid #F0DFC4;border-radius:16px;display:flex;flex-direction:column;font-family:'Work Sans',Arial,sans-serif;color:#2B1B12;box-shadow:0 4px 14px rgba(43,27,18,.06);overflow:hidden}" +
        "@media (min-width:760px){.cup-secao .cup-card{max-width:none}}" +
        ".cup-topo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 12px;background:var(--cor);color:var(--txt);font:800 12.5px 'Work Sans',Arial,sans-serif}" +
        ".cup-topo a{color:inherit;text-decoration:none}" +
        ".cup-serve{background:#E6F4EA;color:#1F7A44;border-radius:999px;padding:1px 8px;font-size:11px}" +
        ".cup-corpo{display:flex;flex-direction:column;gap:8px;padding:11px 12px 12px;flex:1}" +
        ".cup-valor{font:800 26px/1 'Baloo 2',Arial,sans-serif;color:#C21A24;letter-spacing:-.3px}" +
        ".cup-valor.sem{font-size:19px;color:#2B1B12}" +
        ".cup-regra{font-size:12.5px;color:#5C4636;line-height:1.35;min-height:17px}" +
        ".cup-cod{display:flex;align-items:stretch;border:1.5px dashed #E2CFAE;border-radius:10px;background:#FFFAF1;overflow:hidden;margin-top:auto}" +
        ".cup-cod code{flex:1;min-width:0;padding:8px 4px 8px 10px;font:800 14px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".cup-cod code.longo{font-size:12px}" +
        ".cup-copiar{border:0;border-left:1.5px dashed #E2CFAE;background:transparent;padding:0 11px;font:800 12.5px 'Work Sans',Arial,sans-serif;color:#C21A24;cursor:pointer;white-space:nowrap}" +
        ".cup-copiar:hover{background:#FFF1DE}" +
        ".cup-copiar.ok{color:#1F7A44}" +
        ".cup-ir{display:block;text-align:center;border-radius:10px;padding:9px 8px;font:800 13px 'Work Sans',Arial,sans-serif;text-decoration:none;background:var(--cor);color:var(--txt);cursor:pointer;border:0;width:100%}" +
        ".cup-ir:hover{filter:brightness(.95)}" +
        ".cup-mais{display:block;margin:2px auto 0;border:1.5px solid #F0DFC4;background:#fff;border-radius:999px;padding:7px 16px;font:700 13px 'Work Sans',Arial,sans-serif;color:#5C4636;cursor:pointer}" +
        ".cup-como{margin:6px 0 0;font:500 12px 'Work Sans',Arial,sans-serif;color:#8A7563;text-align:center}" +
        // na página da oferta
        ".cup-oferta{margin:14px 0 4px;text-align:left}" +
        ".cup-oferta h3{font:800 15px 'Baloo 2',Arial,sans-serif;margin:0 0 6px;color:#2B1B12}" +
        ".cup-oferta .cup-faixa{padding-bottom:6px}" +
        ".cup-oferta .cup-card{flex-basis:230px}" +
        ".cup-card.serve{border-color:#9ED3B1}";
    document.head.appendChild(css);

    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function dinheiro(n) { return "R$ " + Number(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/,00$/, ""); }
    function numeroBR(t) {
        var s = String(t == null ? "" : t).replace(/[^\d.,]/g, "");
        if (!s) return 0;
        if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
        else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
        var n = parseFloat(s); return isFinite(n) ? n : 0;
    }

    var dados = null;
    function carregar() {
        if (dados) return dados;
        dados = fetch(base + "cupons.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; })
            .then(function (d) {
                var agora = Date.now();
                d = d || {};
                d.cupons = (d.cupons || []).filter(function (c) {
                    var ate = Date.parse(c.ate || "");
                    return c && (c.codigo || c.link || c.titulo) && (!isFinite(ate) || ate > agora);
                });
                return d;
            });
        return dados;
    }

    function lojaDoLink(link) {
        var l = String(link || "").toLowerCase();
        if (/shopee|shp\.ee/.test(l)) return "Shopee";
        if (/mercadoli[bv]re|meli\.la/.test(l)) return "Mercado Livre";
        if (/amazon\.|amzn|a\.co\/|link\.amazon/.test(l)) return "Amazon";
        return "";
    }
    // cupom "arrumado" pra mostrar: loja pelo link; desconto absurdo (>= 90%) = sem regra
    function limpo(c) {
        var x = {};
        for (var k in c) x[k] = c[k];
        x.loja = x.loja || lojaDoLink(x.link);
        if (x.tipo === "%" && !(x.valor > 0 && x.valor < 90)) { x.tipo = ""; x.valor = 0; }
        if (x.tipo === "R$" && !(x.valor > 0)) x.tipo = "";
        return x;
    }
    // quanto o cupom vale "no máximo" (pra pôr os melhores primeiro)
    function peso(c) {
        if (c.tipo === "R$") return c.valor;
        if (c.tipo === "%") return c.teto || c.valor * 5;
        return 0;
    }
    function valorTxt(c) {
        if (c.tipo === "%") return c.valor + "% OFF";
        if (c.tipo === "R$") return dinheiro(c.valor) + " OFF";
        if (c.tipo === "frete") return "Frete grátis";
        return "";
    }
    function regraTxt(c) {
        var r = [];
        if (c.minimo > 1) r.push("em compras a partir de " + dinheiro(c.minimo));
        if (c.tipo === "%" && c.teto) r.push("até " + dinheiro(c.teto) + " de desconto");
        if (!c.tipo) r.push(c.codigo ? "o desconto aparece no carrinho" : "toque e resgate na loja");
        var obs = /^cupom do produto/i.test(c.obs || "") ? "" : (c.obs || "");
        if (obs) r.push(obs);
        var s = r.join(" · ");
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function copiar(texto, botao, depois) {
        var ok = function () {
            if (botao) { var t = botao.textContent; botao.textContent = "Copiado ✓"; botao.classList.add("ok"); setTimeout(function () { botao.textContent = t; botao.classList.remove("ok"); }, 1600); }
            if (depois) depois();
        };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copie o cupom:", texto); if (depois) depois(); });
        else { prompt("Copie o cupom:", texto); if (depois) depois(); }
    }

    function cartao(c0, paginas, serve) {
        var c = limpo(c0);
        var lj = LOJAS[c.loja] || { id: "outra", cor: "#5C4636", texto: "#fff" };
        var link = c.link || (paginas && paginas[c.loja]) || "";
        var valor = c.titulo && !valorTxt(c) ? c.titulo : valorTxt(c);
        var nomeLoja = esc(c.loja || "Cupom");
        var irTxt = c.codigo ? "Copiar e ir " + (c.loja ? "pra " + esc(c.loja) : "pra loja") + " ↗" : "🎟️ Resgatar " + (c.loja ? "na " + esc(c.loja) : "na loja") + " ↗";
        return '<div class="cup-card' + (serve ? " serve" : "") + '" data-loja="' + esc(c.loja || "") + '" style="--cor:' + lj.cor + ";--txt:" + lj.texto + '">' +
            '<div class="cup-topo"><span>' + nomeLoja + "</span>" +
            (serve ? '<span class="cup-serve">✓ serve aqui</span>' : (c.titulo && valorTxt(c) ? "<span>" + esc(c.titulo) + "</span>" : "")) + "</div>" +
            '<div class="cup-corpo">' +
            '<div class="cup-valor' + (valor ? "" : " sem") + '">' + esc(valor || (c.codigo ? "Cupom de desconto" : "Cupons pra resgatar")) + "</div>" +
            '<div class="cup-regra">' + esc(regraTxt(c)) + "</div>" +
            (c.codigo ? '<div class="cup-cod"><code' + (c.codigo.length > 13 ? ' class="longo"' : "") + ' title="' + esc(c.codigo) + '">' + esc(c.codigo) + '</code><button type="button" class="cup-copiar" data-codigo="' + esc(c.codigo) + '">Copiar</button></div>' : "") +
            (link ? '<a class="cup-ir" href="' + esc(link) + '" target="_blank" rel="sponsored noopener"' + (c.codigo ? ' data-codigo="' + esc(c.codigo) + '"' : "") + ">" + irTxt + "</a>" : "") +
            "</div></div>";
    }

    function ligarCopiar(raiz) {
        raiz.querySelectorAll(".cup-copiar").forEach(function (b) {
            b.onclick = function () { copiar(b.getAttribute("data-codigo"), b); };
        });
        // "Copiar e ir pra loja": copia o código e abre a loja (o link é de afiliado)
        raiz.querySelectorAll(".cup-ir[data-codigo]").forEach(function (a) {
            a.addEventListener("click", function () {
                try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(a.getAttribute("data-codigo")); } catch (e) {}
                var bt = a.parentNode.querySelector(".cup-copiar");
                if (bt) { bt.textContent = "Copiado ✓"; bt.classList.add("ok"); }
            });
        });
    }

    // ---------- página inicial ----------
    function naHome(secao) {
        carregar().then(function (d) {
            var cupons = (d.cupons || []).map(limpo);
            if (!cupons.length) { secao.hidden = true; return; }
            // os que valem mais primeiro; os sem regra no fim
            cupons.sort(function (a, b) { return peso(b) - peso(a); });
            var lojas = [];
            cupons.forEach(function (c) { if (c.loja && lojas.indexOf(c.loja) < 0) lojas.push(c.loja); });
            var MOSTRA = 8;
            secao.hidden = false;
            secao.className = "cup-secao";
            secao.innerHTML =
                '<div class="secao-head"><h2>🏷️ Cupons de hoje</h2>' +
                (lojas.length > 1 ? '<div class="cup-abas"><button type="button" class="cup-aba ativa" data-l="">Todos</button>' +
                    lojas.map(function (l) { return '<button type="button" class="cup-aba" data-l="' + esc(l) + '">' + esc(l) + "</button>"; }).join("") + "</div>" : "") +
                "</div>" +
                '<p class="cup-sub">Copie o código e cole na hora de pagar. Vale por pouco tempo — a Yang troca todo dia 🐶</p>' +
                '<div class="cup-faixa">' + cupons.map(function (c, i) { return cartao(c, d.paginas).replace('class="cup-card', 'data-i="' + i + '" class="cup-card'); }).join("") + "</div>" +
                (cupons.length > MOSTRA ? '<button type="button" class="cup-mais">Ver todos os ' + cupons.length + " cupons</button>" : "");
            ligarCopiar(secao);
            var todos = false, lojaSel = "";
            function mostrar() {
                var n = 0;
                secao.querySelectorAll(".cup-card").forEach(function (c) {
                    var ok = !lojaSel || c.getAttribute("data-loja") === lojaSel;
                    if (ok) n++;
                    // no computador (grade) mostra 8 até pedir mais; no celular o carrossel mostra todos
                    c.style.display = ok && (todos || lojaSel || n <= MOSTRA || window.innerWidth < 760) ? "" : "none";
                });
                var m = secao.querySelector(".cup-mais");
                if (m) m.style.display = todos || lojaSel || window.innerWidth < 760 ? "none" : "";
            }
            mostrar();
            var mais = secao.querySelector(".cup-mais");
            if (mais) mais.onclick = function () { todos = true; mostrar(); };
            secao.querySelectorAll(".cup-aba").forEach(function (a) {
                a.onclick = function () {
                    secao.querySelectorAll(".cup-aba").forEach(function (x) { x.classList.toggle("ativa", x === a); });
                    lojaSel = a.getAttribute("data-l");
                    mostrar();
                    secao.querySelector(".cup-faixa").scrollLeft = 0;
                };
            });
        });
    }

    // ---------- página da oferta: cupons da mesma loja ----------
    function naOferta(oferta, depois) {
        if (!oferta || !depois || !depois.parentNode) return;
        if (/^\s*celulares?\s*(,|$)/i.test(String(oferta.categoria || "").normalize("NFD").replace(/[̀-ͯ]/g, ""))) return;
        var loja = lojaDoLink(oferta.link);
        if (!loja) return;
        carregar().then(function (d) {
            var preco = numeroBR(oferta.preco);
            var da = (d.cupons || []).map(limpo).filter(function (c) { return c.loja === loja; });
            if (!da.length) return;
            // os que cabem no preço primeiro (pelas regras escritas; o carrinho é quem decide)
            var serve = function (c) { return (c.tipo === "%" || c.tipo === "R$") && (!c.minimo || preco >= c.minimo); };
            da.sort(function (a, b) { return serve(b) - serve(a); });
            var box = document.createElement("div");
            box.className = "cup-oferta";
            box.innerHTML = "<h3>🏷️ Cupons da " + esc(loja) + " pra testar no carrinho</h3>" +
                '<div class="cup-faixa">' + da.map(function (c) { return cartao(c, d.paginas, serve(c)); }).join("") + "</div>";
            depois.parentNode.insertBefore(box, depois.nextSibling);
            ligarCopiar(box);
        });
    }

    window.FarejadinhosCuponsVitrine = { carregar: carregar, naOferta: naOferta, cartao: cartao, ligarCopiar: ligarCopiar };

    // Botões/links "🏷️ Cupons de hoje" (menu de cima e menu lateral):
    // a faixa só aparece depois que os cupons carregam e some quando a
    // vitrine está filtrada — então o clique é tratado aqui.
    function irParaCupons(e) {
        if (e) e.preventDefault();
        var fechar = document.querySelector(".yang-nav-close");
        if (fechar && document.querySelector(".yang-nav-open")) fechar.click();
        var secao = document.getElementById("cuponsSecao");
        var filtrada = /[?&](q|categoria|loja)=/.test(location.search);
        if (!secao || filtrada) { location.href = base + "index.html#cuponsSecao"; return; }
        carregar().then(function (d) {
            if (!(d.cupons || []).length) { avisoSemCupons(); return; }
            setTimeout(function () {
                if (secao.offsetParent === null) { location.href = base + "index.html#cuponsSecao"; return; }
                secao.scrollIntoView({ behavior: "smooth", block: "start" });
                if (history.replaceState) history.replaceState(null, "", location.pathname + location.search + "#cuponsSecao");
            }, 60);
        });
    }
    function avisoSemCupons() {
        var a = document.createElement("div");
        a.textContent = "🏷️ Ainda não tem cupons hoje — volte mais tarde!";
        a.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2B1B12;color:#fff;padding:12px 16px;border-radius:12px;font:600 14px 'Work Sans',Arial,sans-serif;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center";
        document.body.appendChild(a);
        setTimeout(function () { a.remove(); }, 3500);
    }
    document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href$="#cuponsSecao"]');
        if (a) irParaCupons(e);
    });

    function iniciar() {
        var secao = document.getElementById("cuponsSecao");
        if (secao) {
            naHome(secao);
            // chegou de outra página pelo link "Cupons de hoje": rola quando a faixa aparecer
            if (location.hash === "#cuponsSecao") {
                carregar().then(function (d) {
                    if (!(d.cupons || []).length) { avisoSemCupons(); return; }
                    setTimeout(function () { secao.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
                });
            }
        }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
