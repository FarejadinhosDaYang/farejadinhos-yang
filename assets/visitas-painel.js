/* Caixinha "👀 Visitas do site" nos painéis.
 * Uso: <div id="visitasBox"></div><script src="../assets/visitas-painel.js"></script>
 * Lê os números do Worker farejadinhos-contador (cloudflare/contador-worker.js).
 */
(function () {
    var CONTADOR_URL = "https://farejadinhos-contador.bernard-shimizu.workers.dev";
    var box = document.getElementById("visitasBox");
    if (!box) return;

    var css = document.createElement("style");
    css.textContent =
        "#visitasBox{background:var(--cream-2,#FFFAF1);border:1.5px solid var(--line,#F0DFC4);border-radius:14px;padding:14px 16px;margin-bottom:18px;box-shadow:0 6px 20px rgba(43,27,18,.08);font-family:'Work Sans',sans-serif;color:var(--ink,#2B1B12)}" +
        "#visitasBox h3{margin:0 0 10px;font:800 16px 'Baloo 2','Work Sans',sans-serif}" +
        "#visitasBox .vis-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}" +
        "#visitasBox .vis-num{background:#fff;border:1px solid var(--line,#F0DFC4);border-radius:10px;padding:8px;text-align:center}" +
        "#visitasBox .vis-num b{display:block;font:800 22px 'Baloo 2','Work Sans',sans-serif;color:var(--red-dark,#C21A24);line-height:1.1}" +
        "#visitasBox .vis-num span{font-size:11.5px;color:var(--muted,#8A7563)}" +
        "#visitasBox .vis-hoje{margin:10px 0 6px;font-size:13px;color:var(--muted,#8A7563)}" +
        "#visitasBox .vis-hoje b{color:var(--ink,#2B1B12)}" +
        "#visitasBox .vis-barras{display:flex;align-items:flex-end;gap:3px;height:54px;margin-top:4px}" +
        "#visitasBox .vis-barra{flex:1;background:var(--orange,#F7941D);border-radius:3px 3px 0 0;min-height:2px;position:relative}" +
        "#visitasBox .vis-barra.hoje{background:var(--red,#E5232E)}" +
        "#visitasBox .vis-legenda{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted,#8A7563);margin-top:3px}" +
        "#visitasBox .vis-obs{font-size:11.5px;color:var(--muted,#8A7563);margin-top:8px}";
    document.head.appendChild(css);

    function fmt(n) { return Number(n || 0).toLocaleString("pt-BR"); }
    function dataBR(iso) { var p = String(iso).split("-"); return p[2] + "/" + p[1]; }

    box.innerHTML = "<h3>👀 Visitas do site</h3><div class='vis-obs'>Carregando...</div>";

    fetch(CONTADOR_URL + "/numeros?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (n) {
            if (n.erro) throw new Error(n.erro);
            var dias = n.dias || [];
            var max = Math.max.apply(null, dias.map(function (d) { return d.visitas; }).concat([1]));
            box.innerHTML =
                "<h3>👀 Visitas do site</h3>" +
                "<div class='vis-nums'>" +
                "<div class='vis-num'><b>" + fmt(n.total.pessoas) + "</b><span>pessoas diferentes</span></div>" +
                "<div class='vis-num'><b>" + fmt(n.total.visitas) + "</b><span>visitas</span></div>" +
                "<div class='vis-num'><b>" + fmt(n.total.paginas) + "</b><span>páginas vistas</span></div>" +
                "</div>" +
                "<div class='vis-hoje'>Hoje: <b>" + fmt(n.hoje.pessoas) + "</b> pessoas · <b>" + fmt(n.hoje.visitas) + "</b> visitas · <b>" + fmt(n.hoje.paginas) + "</b> páginas</div>" +
                "<div class='vis-barras'>" + dias.map(function (d, i) {
                    return "<div class='vis-barra" + (i === dias.length - 1 ? " hoje" : "") + "' style='height:" + Math.round(d.visitas / max * 100) + "%' title='" + dataBR(d.dia) + ": " + d.visitas + " visitas, " + d.pessoas + " pessoas'></div>";
                }).join("") + "</div>" +
                "<div class='vis-legenda'><span>" + (dias[0] ? dataBR(dias[0].dia) : "") + "</span><span>últimos 14 dias</span><span>hoje</span></div>" +
                "<div class='vis-obs'>Contando desde " + (n.desde ? dataBR(n.desde) + "/" + n.desde.slice(0, 4) : "agora") + ". Suas próprias visitas (com a senha do painel salva) não entram.</div>";
        })
        .catch(function (e) {
            box.innerHTML = "<h3>👀 Visitas do site</h3><div class='vis-obs'>O contador ainda não está ligado na Cloudflare (ou está fora do ar agora). " +
                (e && e.message ? "Detalhe: " + String(e.message).replace(/</g, "&lt;") : "") + "</div>";
        });
})();
