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
    // Preto só como DESTAQUE: o site continua creme, com as cores da marca.
    // Preto + dourado ficam no cabeçalho, na faixa, no slide e na vitrine Black.
    var PATAS = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 40 40'><g fill='%23FFC24A' fill-opacity='.05' transform='rotate(-25 20 20)'><ellipse cx='20' cy='27' rx='10' ry='8.5'/><ellipse cx='8.5' cy='15' rx='4.2' ry='5.2'/><ellipse cx='16' cy='9' rx='4.2' ry='5.4'/><ellipse cx='24.5' cy='9' rx='4.2' ry='5.4'/><ellipse cx='31.5' cy='15' rx='4.2' ry='5.2'/></g></svg>\")";
    css.textContent = [
        // cabeçalho preto com fio dourado
        "html.black-nov header.yang-topo{background:#15100D;box-shadow:0 2px 0 #E9A93A, 0 6px 18px rgba(43,27,18,.25)}",
        "html.black-nov .topo-atalhos{background:#1F1713}",
        "html.black-nov .topo-atalhos a.destaque{color:#FFC86B}",
        "html.black-nov .topo-atalhos a.black-link{color:#15100D;background:linear-gradient(135deg,#FFD27A,#F2A33A);border-radius:999px;font-weight:800}",
        // faixa que corre embaixo do cabeçalho
        ".black-faixa{position:relative;overflow:hidden;background:linear-gradient(90deg,#F2A33A,#FFD27A 50%,#F2A33A);color:#15100D;font:800 12.5px 'Work Sans',Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;white-space:nowrap;height:30px;display:flex;align-items:center}",
        ".black-faixa .trilho-faixa{display:inline-flex;gap:28px;padding-left:28px;animation:blackCorre 38s linear infinite}",
        ".black-faixa .trilho-faixa span:before{content:'🐾';margin-right:10px;letter-spacing:0}",
        "@keyframes blackCorre{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
        "@media (prefers-reduced-motion:reduce){.black-faixa .trilho-faixa{animation:none}}",
        // selos
        "#blackSecao{scroll-margin-top:170px}",
        ".badge-black{position:absolute;bottom:8px;right:8px;z-index:3;background:#15100D;color:#FFC86B;font:800 10.5px 'Work Sans',Arial,sans-serif;letter-spacing:1.2px;padding:4px 8px;border-radius:7px;box-shadow:0 0 0 1.5px #E9A93A, 0 3px 8px rgba(0,0,0,.25)}",
        ".selo-black-oferta{display:inline-flex;align-items:center;gap:6px;background:#15100D;color:#FFC86B;font:800 12.5px 'Work Sans',Arial,sans-serif;letter-spacing:1px;padding:6px 12px;border-radius:999px;box-shadow:0 0 0 1.5px #E9A93A;margin:4px 0 8px}",
        // slide do banner: preto quentinho, patinhas douradas e a Yang
        ".hero-slide.s-black{background:radial-gradient(90% 120% at 80% 30%,#4A2A12 0%,#21140D 42%,#120C09 100%);color:#F7EBDD}",
        ".hero-slide.s-black:before{content:'';position:absolute;inset:0;background-image:" + PATAS + ";background-size:72px 72px;pointer-events:none}",
        ".hero-slide.s-black .hero-texto h2 .linha.ouro{background:linear-gradient(90deg,#FFD27A,#F2A33A);-webkit-background-clip:text;background-clip:text;color:transparent}",
        ".hero-slide.s-black .hero-cta{background:linear-gradient(135deg,#FFD27A,#F2A33A);color:#15100D;box-shadow:0 8px 24px rgba(242,163,58,.35)}",
        ".black-contagem{display:inline-flex;align-items:baseline;gap:10px;margin:0 0 16px;padding:9px 16px;border-radius:14px;background:rgba(255,200,107,.08);box-shadow:inset 0 0 0 1.5px rgba(255,200,107,.35)}",
        ".black-contagem b{font:800 clamp(26px,3.6vw,38px) 'Baloo 2',sans-serif;color:#FFC86B;line-height:1}",
        ".black-contagem span{font-size:14px;color:#EAD8C3}",
        ".black-visual{position:relative;width:300px;height:290px;display:flex;align-items:flex-end;justify-content:center}",
        ".black-visual:before{content:'';position:absolute;left:50%;top:52%;width:270px;height:270px;margin:-135px 0 0 -135px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,107,.38) 0%,rgba(255,200,107,.08) 55%,transparent 70%)}",
        ".black-visual img{position:relative;width:240px;height:auto;filter:drop-shadow(0 18px 28px rgba(0,0,0,.45))}",
        ".black-visual .etiqueta{position:absolute;top:14px;right:6px;transform:rotate(10deg);background:#15100D;color:#FFC86B;font:800 26px/1 'Baloo 2',sans-serif;letter-spacing:1px;padding:9px 13px 7px;border-radius:12px;box-shadow:0 0 0 2px #E9A93A, 0 10px 22px rgba(0,0,0,.4);text-align:center}",
        ".black-visual .etiqueta small{display:block;font:800 9.5px 'Work Sans',Arial,sans-serif;letter-spacing:3px;color:#F7EBDD;margin-top:2px}",
        ".black-visual .etiqueta:before{content:'';position:absolute;top:-11px;left:50%;width:2px;height:12px;background:#E9A93A}",
        "@media(max-width:720px){.black-visual{display:none}}",
        // vitrine Black: o único bloco escuro no meio do site creme
        ".prateleira.black-prateleira{position:relative;background:radial-gradient(120% 140% at 0% 0%,#3A2210 0%,#1A110C 45%,#120C09 100%);border-radius:24px;padding:16px 16px 8px;box-shadow:0 14px 34px rgba(43,27,18,.22), inset 0 0 0 1.5px rgba(233,169,58,.35);overflow:hidden}",
        ".prateleira.black-prateleira:before{content:'';position:absolute;inset:0;background-image:" + PATAS + ";background-size:72px 72px;pointer-events:none}",
        ".prateleira.black-prateleira > *{position:relative}",
        ".prateleira.black-prateleira .prateleira-titulo{color:#FFC86B!important}",
        ".prateleira.black-prateleira .prateleira-titulo .ic{background:#15100D!important;box-shadow:0 0 0 1.5px #E9A93A;overflow:hidden;padding:0}",
        ".prateleira.black-prateleira .prateleira-titulo .ic img{width:100%;height:100%;object-fit:cover;border-radius:50%}",
        ".prateleira.black-prateleira .contagem{color:#D9C4AD!important}",
        ".prateleira.black-prateleira .trilho-seta{background:#FFC86B;color:#15100D}"
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

    // ---------- faixa dourada embaixo do cabeçalho ----------
    function faixa() {
        var topo = document.querySelector("header.yang-topo");
        if (!topo || document.querySelector(".black-faixa")) return;
        var c = contagem();
        var itens = ["Black November da Yang", c.grande + " " + c.pequeno, "Só desconto de verdade", "Preço conferido todo dia", "Cupons de hoje no site"];
        var html = itens.concat(itens).map(function (t) { return "<span>" + t + "</span>"; }).join("");
        var f = document.createElement("a");
        f.className = "black-faixa";
        f.href = (document.getElementById("heroSlides") ? "" : base + "index.html") + "#blackSecao";
        f.style.textDecoration = "none";
        f.innerHTML = '<div class="trilho-faixa">' + html + html + "</div>";
        topo.appendChild(f);
    }
    if (document.querySelector("header.yang-topo")) faixa();
    else document.addEventListener("DOMContentLoaded", faixa);

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
            "<p>O mês inteiro a Yang fareja os maiores descontos — e só mostra quando o preço caiu de verdade. 🐾</p>" +
            '<a class="hero-cta" href="#blackSecao">🖤 Ver as ofertas Black</a>' +
            "</div>" +
            '<figure class="hero-visual black-visual" aria-hidden="true">' +
            '<picture><source srcset="assets/yang-ilustrada.webp" type="image/webp"><img src="assets/yang-ilustrada.png" alt="" width="532" height="640"></picture>' +
            '<div class="etiqueta">BLACK<small>NOVEMBER</small></div></figure>';
        slides.insertBefore(s, slides.firstChild);
    }
    if (document.getElementById("heroSlides")) slide();
    else document.addEventListener("DOMContentLoaded", slide);
})();
