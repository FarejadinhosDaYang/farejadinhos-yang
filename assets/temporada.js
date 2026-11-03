/**
 * Farejadinhos da Yang — TEMPORADA ESPECIAL: "Black November"
 *
 * Durante a janela abaixo o site inteiro entra no clima: fundo escuro,
 * cabeçalho preto com laranja/dourado, banner com contagem até a Black
 * Friday e selo BLACK nas ofertas Black (regra em assets/vitrine.js:
 * desconto grande OU marcada no painel). Fora da janela, nada muda —
 * em 1º/12 o site volta sozinho ao normal.
 *
 * Carregado pelo topo.js em todas as páginas; na página inicial também
 * vem direto (antes do carrossel), pra entrar como 1º slide.
 * Pra testar fora de novembro: ?black=1 no endereço.
 */
(function () {
    if (window.FarejadinhosTemporada) return;

    var BLACK = {
        inicio: "2026-11-01T03:00:00Z",      // 1º/11 00h (Brasília)
        fim: "2026-12-01T03:00:00Z",         // 1º/12 00h — volta ao normal
        sextaFeira: "2026-11-27T03:00:00Z",  // Black Friday
        cyberMonday: "2026-11-30T03:00:00Z"
    };

    function ativa(agora) {
        if (/[?&]black=1\b/.test(location.search)) return true;
        if (/[?&]black=0\b/.test(location.search)) return false;
        var t = (agora || new Date()).getTime();
        return t >= Date.parse(BLACK.inicio) && t < Date.parse(BLACK.fim);
    }

    // "Faltam 25 dias pra Black Friday" / "É HOJE" / "Últimos dias"
    function contagem(agora) {
        var t = (agora || new Date()).getTime();
        var sexta = Date.parse(BLACK.sextaFeira), fimSexta = sexta + 24 * 3600e3;
        var cyber = Date.parse(BLACK.cyberMonday);
        if (t < sexta) {
            var dias = Math.ceil((sexta - t) / (24 * 3600e3));
            return { grande: dias === 1 ? "É AMANHÃ" : dias + " dias", pequeno: dias === 1 ? "a Black Friday começa à meia-noite" : "pra Black Friday (27/11)" };
        }
        if (t < fimSexta) return { grande: "É HOJE", pequeno: "Black Friday — corre que acaba!" };
        if (t < cyber) return { grande: "Últimos dias", pequeno: "segunda é Cyber Monday (30/11)" };
        return { grande: "Cyber Monday", pequeno: "último dia da Black November" };
    }

    var script0 = document.currentScript;
    var base0 = (script0 && script0.getAttribute("data-base")) || "";
    // lista dos descontos de verdade (gerador/black_lista.py); quem monta a
    // vitrine espera por ela (no máximo 2,5s) antes de desenhar
    var pronto = !ativa() ? Promise.resolve({}) : Promise.race([
        fetch(base0 + "temporada/black.json?t=" + Math.floor(Date.now() / 600000), { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (d) { window.FarejadinhosBlackLista = (d && d.ofertas) || {}; return window.FarejadinhosBlackLista; })
            .catch(function () { return {}; }),
        new Promise(function (ok) { setTimeout(function () { ok({}); }, 2500); })
    ]);

    window.FarejadinhosTemporada = { BLACK: BLACK, ativa: ativa, contagem: contagem, pronto: pronto };
    if (!ativa()) return;

    document.documentElement.classList.add("black-nov");

    var css = document.createElement("style");
    css.id = "estilo-black-november";
    css.textContent = [
        // fundo e cabeçalho
        "html.black-nov body{background:#0E0B0A!important;color:#F3E7D9}",
        "html.black-nov header.yang-topo{background:#0E0B0A;box-shadow:0 1px 0 #F7941D, 0 6px 22px rgba(0,0,0,.55)}",
        "html.black-nov .topo-atalhos{background:#1A1411}",
        "html.black-nov .topo-atalhos a.destaque{color:#FFB547}",
        "html.black-nov .topo-atalhos a.black-link{color:#111;background:linear-gradient(135deg,#FFC24A,#F7941D);border-radius:999px;font-weight:800}",
        // textos que ficam direto no fundo (cards continuam claros)
        "html.black-nov .secao-head h2, html.black-nov .barra-todas h2, html.black-nov .prateleira-titulo, html.black-nov .rel-topo h2{color:#FFB547!important}",
        "html.black-nov .contagem, html.black-nov .cupons-lojas .rotulo, html.black-nov footer, html.black-nov .barra-todas .direita, html.black-nov .barra-todas label, html.black-nov .lojas-filtro span, html.black-nov .rotulo-loja{color:#B9A898!important}",
        "html.black-nov .ver-todas, html.black-nov .rel-topo a, html.black-nov footer a{color:#FFB547!important}",
        "html.black-nov .barra-todas, html.black-nov .rel-topo{border-color:#3A2D25!important}",
        "html.black-nov .cup-secao .secao-head h2{color:#FFB547}",
        "html.black-nov .back{color:#FFB547!important}",
        // página da oferta: o cartão claro ganha um contorno dourado
        "html.black-nov .card{box-shadow:0 0 0 1.5px #3A2D25, 0 18px 50px rgba(0,0,0,.5)}",
        // selo BLACK
        "#blackSecao{scroll-margin-top:150px}",
        ".badge-black{position:absolute;bottom:8px;right:8px;z-index:3;background:#0E0B0A;color:#FFC24A;font:800 11px 'Work Sans',Arial,sans-serif;letter-spacing:1.2px;padding:4px 8px;border-radius:7px;box-shadow:0 0 0 1.5px #FFC24A}",
        ".selo-black-oferta{display:inline-flex;align-items:center;gap:6px;background:#0E0B0A;color:#FFC24A;font:800 12.5px 'Work Sans',Arial,sans-serif;letter-spacing:1px;padding:6px 12px;border-radius:999px;box-shadow:0 0 0 1.5px #FFC24A;margin:4px 0 8px}",
        // slide do banner
        ".hero-slide.s-black{background:radial-gradient(120% 140% at 85% 10%,#3B2412 0%,#140E0B 45%,#0A0807 100%);color:#F7EBDD}",
        ".hero-slide.s-black .hero-texto h2 .linha.ouro{background:linear-gradient(90deg,#FFD27A,#F7941D);-webkit-background-clip:text;background-clip:text;color:transparent}",
        ".hero-slide.s-black .hero-cta{background:linear-gradient(135deg,#FFC24A,#F7941D);color:#140E0B}",
        ".black-contagem{display:inline-flex;align-items:baseline;gap:10px;margin:0 0 18px;padding:10px 16px;border-radius:14px;background:rgba(255,194,74,.08);box-shadow:inset 0 0 0 1.5px rgba(255,194,74,.35)}",
        ".black-contagem b{font:800 clamp(26px,3.6vw,38px) 'Baloo 2',sans-serif;color:#FFC24A;line-height:1}",
        ".black-contagem span{font-size:14px;color:#E8D7C4}",
        ".black-visual{position:relative;display:flex;align-items:center;justify-content:center;width:300px;height:260px}",
        ".black-visual .etiqueta{position:absolute;inset:auto;transform:rotate(-8deg);background:#0E0B0A;color:#FFC24A;font:800 64px/0.9 'Baloo 2',sans-serif;letter-spacing:2px;padding:22px 26px 16px;border-radius:18px;box-shadow:0 0 0 3px #FFC24A, 0 20px 40px rgba(0,0,0,.5);text-align:center}",
        ".black-visual .etiqueta small{display:block;font:800 18px 'Work Sans',Arial,sans-serif;letter-spacing:6px;color:#F7EBDD;margin-top:6px}",
        ".black-visual .furo{position:absolute;top:50%;left:12px;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#0A0807;box-shadow:inset 0 0 0 3px #FFC24A}",
        "@media(max-width:720px){.black-visual{display:none}}",
        // prateleira Black
        ".prateleira.black-prateleira{background:linear-gradient(180deg,#1A120D,#120D0A);border-radius:22px;padding:14px 14px 6px;box-shadow:inset 0 0 0 1.5px #3A2D25}",
        ".prateleira.black-prateleira .prateleira-titulo{color:#FFC24A!important}",
        ".prateleira.black-prateleira .prateleira-titulo .ic{background:#0E0B0A!important;box-shadow:0 0 0 1.5px #FFC24A}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(css);

    // ---------- atalho no menu de cima ----------
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";
    function atalho() {
        var nav = document.querySelector(".topo-atalhos nav");
        if (!nav || nav.querySelector(".black-link")) return;
        var a = document.createElement("a");
        a.className = "black-link";
        a.href = (document.getElementById("heroSlides") ? "" : base + "index.html") + "#blackSecao";
        a.textContent = "🖤 Black November";
        nav.insertBefore(a, nav.firstChild);
    }
    if (document.querySelector(".topo-atalhos nav")) atalho();
    else document.addEventListener("DOMContentLoaded", atalho);

    // ---------- banner: 1º slide (só na página inicial) ----------
    function slide() {
        var slides = document.getElementById("heroSlides");
        if (!slides || slides.querySelector(".s-black")) return;
        var c = contagem();
        var s = document.createElement("section");
        s.className = "hero-slide s-black";
        s.setAttribute("aria-label", "Black November da Yang");
        s.innerHTML =
            '<div class="hero-texto">' +
            '<h2><span class="linha">Black November</span><span class="linha ouro">da Yang.</span></h2>' +
            '<div class="black-contagem"><b>' + c.grande + "</b><span>" + c.pequeno + "</span></div>" +
            "<p>O mês inteiro a Yang fareja os maiores descontos — e confere se o preço caiu de verdade antes de mostrar.</p>" +
            '<a class="hero-cta" href="#blackSecao">🖤 Ver as ofertas Black</a>' +
            "</div>" +
            '<div class="hero-visual black-visual" aria-hidden="true"><div class="etiqueta">BLACK<small>NOVEMBER</small></div></div>';
        slides.insertBefore(s, slides.firstChild);
    }
    if (document.getElementById("heroSlides")) slide();
    else document.addEventListener("DOMContentLoaded", slide);
})();
