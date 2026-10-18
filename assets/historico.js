/**
 * Farejadinhos da Yang — Histórico de preços
 *
 * Lê historico-precos.json (atualizado sozinho pelo GitHub Actions) e:
 *  - na página de uma oferta: mostra o selo + gráfico "📈 Histórico de preço"
 *    logo abaixo do botão PEGAR OFERTA (é carregado pelo relacionados.js);
 *  - no painel (data-modo="painel"): só expõe window.FarejadinhosHistorico
 *    (carregar, achar, grafico, moeda, data) pra página painel/precos.html usar.
 */
(function () {
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "../../";
    var modo = (script && script.getAttribute("data-modo")) || "oferta";
    var NS = "http://www.w3.org/2000/svg";
    var TZ = "America/Sao_Paulo";

    if (!document.querySelector('link[data-historico-css]')) {
        var css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = base + "assets/historico.css";
        css.setAttribute("data-historico-css", "");
        document.head.appendChild(css);
    }

    function moeda(v) {
        return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    function data(iso, comAno) {
        var o = { timeZone: TZ, day: "2-digit", month: "2-digit" };
        if (comAno) o.year = "numeric";
        return new Date(iso).toLocaleDateString("pt-BR", o);
    }
    function dataHora(iso) {
        return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    }
    function numero(p) {
        var s = String(p || "").replace(/[^\d.,]/g, "");
        if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
        var n = parseFloat(s);
        return isFinite(n) ? n : 0;
    }
    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }
    function sv(tag, attrs) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    }

    var cache = null;
    function carregar() {
        if (!cache) {
            cache = fetch(base + "historico-precos.json?t=" + Math.floor(Date.now() / 600000), { cache: "no-store" })
                .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
        }
        return cache;
    }

    // acha o produto do histórico pelo link de afiliado (ou pelo slug)
    function achar(hist, link, slug) {
        var ps = hist && hist.produtos || {};
        var achado = null;
        Object.keys(ps).forEach(function (id) {
            var p = ps[id];
            if (achado) return;
            if (link && (p.links || []).indexOf(link) >= 0) achado = p;
        });
        if (!achado && slug) {
            Object.keys(ps).forEach(function (id) { if (!achado && ps[id].slug === slug) achado = ps[id]; });
        }
        return achado;
    }

    /**
     * Gráfico em degraus (o preço vale do momento em que mudou até a próxima mudança).
     * pontos: [[iso, valor], ...]  ·  opts: { ate: iso|null, altura: px }
     */
    function grafico(caixa, pontos, opts) {
        opts = opts || {};
        caixa.innerHTML = "";
        caixa.classList.add("hp-graf");
        if (!pontos || !pontos.length) return;
        var W = Math.max(240, caixa.clientWidth || 320);
        var H = opts.altura || 120;
        var M = { t: 12, r: 14, b: 22, l: 62 };
        var iw = W - M.l - M.r, ih = H - M.t - M.b;

        var t0 = Date.parse(pontos[0][0]);
        var tFim = Math.max(Date.parse(opts.ate || pontos[pontos.length - 1][0]), Date.parse(pontos[pontos.length - 1][0]));
        if (tFim - t0 < 864e5) tFim = t0 + 864e5;
        var vals = pontos.map(function (p) { return p[1]; });
        var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
        var folga = (vmax - vmin) * 0.18 || vmax * 0.1 || 1;
        var y0 = Math.max(0, vmin - folga), y1 = vmax + folga;
        function X(t) { return M.l + (t - t0) / (tFim - t0) * iw; }
        function Y(v) { return M.t + (1 - (v - y0) / (y1 - y0)) * ih; }

        var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
            "aria-label": "Histórico de preço: de " + moeda(vals[0]) + " a " + moeda(vals[vals.length - 1]) });
        // grade: linhas finas no menor e no maior preço
        var niveis = vmin === vmax ? [vmin] : [vmax, vmin];
        niveis.forEach(function (v) {
            svg.appendChild(sv("line", { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), "class": "hp-grade" }));
            var tx = sv("text", { x: M.l - 8, y: Y(v) + 4, "text-anchor": "end", "class": "hp-eixo" });
            tx.textContent = moeda(v);
            svg.appendChild(tx);
        });
        // eixo x: primeira data e fim
        [[t0, "start", data(pontos[0][0])], [tFim, "end", opts.ate ? "hoje" : data(new Date(tFim).toISOString())]].forEach(function (a) {
            var tx = sv("text", { x: X(a[0]), y: H - 5, "text-anchor": a[1], "class": "hp-eixo" });
            tx.textContent = a[2];
            svg.appendChild(tx);
        });

        // degraus
        var d = "", area = "";
        pontos.forEach(function (p, i) {
            var x = X(Date.parse(p[0])), y = Y(p[1]);
            if (i === 0) { d = "M" + x + "," + y; }
            else { d += " H" + x + " V" + y; }
        });
        d += " H" + X(tFim);
        area = d + " V" + (M.t + ih) + " H" + X(t0) + " Z";
        svg.appendChild(sv("path", { d: area, "class": "hp-area" }));
        svg.appendChild(sv("path", { d: d, "class": "hp-linha" }));

        // marcadores nas mudanças + ponto final
        pontos.forEach(function (p) {
            svg.appendChild(sv("circle", { cx: X(Date.parse(p[0])), cy: Y(p[1]), r: 4, "class": "hp-ponto" }));
        });
        var ult = pontos[pontos.length - 1];
        svg.appendChild(sv("circle", { cx: X(tFim), cy: Y(ult[1]), r: 4.5, "class": "hp-ponto hp-fim" }));

        // camada de passar o dedo / mouse
        var mira = sv("line", { y1: M.t, y2: M.t + ih, "class": "hp-mira", visibility: "hidden" });
        var foco = sv("circle", { r: 6, "class": "hp-foco", visibility: "hidden" });
        svg.appendChild(mira); svg.appendChild(foco);
        var alvo = sv("rect", { x: M.l - 12, y: 0, width: iw + 24, height: H, fill: "transparent", tabindex: "0",
            "aria-label": "Passe o dedo pra ver cada preço" });
        svg.appendChild(alvo);
        var dica = el("div", "hp-dica");
        dica.hidden = true;
        caixa.appendChild(svg);
        caixa.appendChild(dica);

        var atualI = -1;
        function mostrar(i) {
            atualI = i;
            var p = pontos[i], prox = pontos[i + 1];
            var x = X(Date.parse(p[0])), y = Y(p[1]);
            mira.setAttribute("x1", x); mira.setAttribute("x2", x); mira.setAttribute("visibility", "visible");
            foco.setAttribute("cx", x); foco.setAttribute("cy", y); foco.setAttribute("visibility", "visible");
            dica.innerHTML = "";
            dica.appendChild(el("b", null, moeda(p[1])));
            dica.appendChild(el("span", null, prox ? data(p[0]) + " até " + data(prox[0]) : "desde " + dataHora(p[0])));
            dica.hidden = false;
            var px = x / W * caixa.clientWidth;
            dica.style.left = Math.min(Math.max(px, 70), caixa.clientWidth - 70) + "px";
            dica.style.top = (y / H * svg.getBoundingClientRect().height - 8) + "px";
        }
        function esconder() {
            mira.setAttribute("visibility", "hidden"); foco.setAttribute("visibility", "hidden"); dica.hidden = true; atualI = -1;
        }
        function perto(ev) {
            var r = svg.getBoundingClientRect();
            var x = (ev.clientX - r.left) / r.width * W;
            var melhor = 0, dist = Infinity;
            pontos.forEach(function (p, i) {
                var dd = Math.abs(X(Date.parse(p[0])) - x);
                if (dd < dist) { dist = dd; melhor = i; }
            });
            mostrar(melhor);
        }
        alvo.addEventListener("pointermove", perto);
        alvo.addEventListener("pointerdown", perto);
        alvo.addEventListener("pointerleave", esconder);
        alvo.addEventListener("blur", esconder);
        alvo.addEventListener("focus", function () { mostrar(pontos.length - 1); });
        alvo.addEventListener("keydown", function (ev) {
            if (ev.key === "ArrowLeft") { mostrar(Math.max(0, atualI - 1)); ev.preventDefault(); }
            if (ev.key === "ArrowRight") { mostrar(Math.min(pontos.length - 1, atualI + 1)); ev.preventDefault(); }
        });

        if (!caixa._hpResize) {
            var pend;
            caixa._hpResize = true;
            window.addEventListener("resize", function () {
                clearTimeout(pend);
                pend = setTimeout(function () { if (caixa.isConnected) grafico(caixa, pontos, opts); }, 150);
            });
        }
    }

    // lista de mudanças (versão em texto do gráfico)
    function tabela(pontos) {
        var det = el("details", "hp-tabela");
        det.appendChild(el("summary", null, "Ver todas as mudanças de preço"));
        var ul = el("ul");
        pontos.slice().reverse().forEach(function (p) {
            var li = el("li");
            li.appendChild(el("span", null, data(p[0], true)));
            li.appendChild(el("b", null, moeda(p[1])));
            ul.appendChild(li);
        });
        det.appendChild(ul);
        return det;
    }

    // resumo em uma frase pro visitante
    function selo(p, atual) {
        var pts = p.pontos, n = pts.length;
        if (n < 2) return null;
        var min = p.min, ptMin = pts.filter(function (x) { return x[1] === min; })[0];
        if (atual <= min + 0.005) return { tipo: "bom", txt: "🐾 Menor preço que a Yang já farejou!" };
        var ant = pts[n - 2][1];
        if (atual < ant - 0.005) return { tipo: "baixou", txt: "⬇️ Baixou " + moeda(ant - atual) + " desde " + data(pts[n - 1][0]) };
        return { tipo: "neutro", txt: "Já esteve " + moeda(min) + " em " + data(ptMin[0]) };
    }

    function montarNaOferta() {
        var btn = document.querySelector(".content a.btn");
        var conteudo = document.querySelector(".card .content");
        if (!btn || !conteudo) return;
        var partes = location.pathname.split("/").filter(Boolean);
        var i = partes.lastIndexOf("ofertas");
        var slug = i >= 0 && partes[i + 1] ? decodeURIComponent(partes[i + 1]) : "";
        var link = btn.getAttribute("href");
        var precoEl = document.querySelector(".content .price");

        carregar().then(function (hist) {
            var p = achar(hist, link, slug);
            if (!p || !p.pontos || !p.pontos.length) return;
            var atual = numero(precoEl && precoEl.textContent) || p.atual;
            var caixa = el("section", "hp-caixa");
            caixa.setAttribute("aria-label", "Histórico de preço");
            var topo = el("div", "hp-topo");
            topo.appendChild(el("h2", null, "📈 Histórico de preço"));
            caixa.appendChild(topo);

            if (p.pontos.length < 2) {
                var hoje = Date.now() - Date.parse(p.primeiro || p.pontos[0][0]) < 864e5;
                caixa.appendChild(el("p", "hp-frase", hoje
                    ? "🐾 A Yang começou a acompanhar esse preço hoje. Se ele mudar, aparece aqui."
                    : "🐾 A Yang acompanha esse preço desde " + data(p.pontos[0][0]) + " e ele não mudou."));
            } else {
                var s = selo(p, atual);
                if (s) caixa.appendChild(el("div", "hp-selo hp-" + s.tipo, s.txt));
                var info = el("div", "hp-info");
                info.appendChild(el("span", null, "Menor " + moeda(p.min)));
                info.appendChild(el("span", null, "Maior " + moeda(p.max)));
                info.appendChild(el("span", null, "desde " + data(p.pontos[0][0])));
                caixa.appendChild(info);
                var g = el("div");
                caixa.appendChild(g);
                caixa.appendChild(tabela(p.pontos));
                btn.parentNode.insertBefore(caixa, btn.nextSibling);
                grafico(g, p.pontos, { ate: p.noAr ? new Date().toISOString() : p.ultimo, altura: 120 });
                caixa.appendChild(el("p", "hp-nota", "Preços registrados nas conferências do site. Vale sempre o preço da loja."));
                return;
            }
            btn.parentNode.insertBefore(caixa, btn.nextSibling);
        }).catch(function () {});
    }

    window.FarejadinhosHistorico = { carregar: carregar, achar: achar, grafico: grafico, tabela: tabela, selo: selo, moeda: moeda, data: data, dataHora: dataHora };

    if (modo === "oferta") {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarNaOferta);
        else montarNaOferta();
    }
})();
