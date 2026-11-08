/* Caixinha "🔎 Mais do tipo" no painel: pede pra Yang procurar na Shopee
 * os mais vendidos de um tipo (ex.: liquidificador) que ainda não estão no
 * site e já subir com o seu link de afiliado (lote acao "mais-do-tipo",
 * gerador/mais_do_tipo.py). Uso: <div id="maisTipoBox"></div> + este script.
 */
(function () {
    var WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev";
    var box = document.getElementById("maisTipoBox");
    if (!box) return;
    var css = document.createElement("style");
    css.textContent =
        "#maisTipoBox{background:var(--cream-2,#FFFAF1);border:1.5px solid var(--line,#F0DFC4);border-radius:14px;padding:14px 16px;margin-bottom:18px;box-shadow:0 6px 20px rgba(43,27,18,.08);font-family:'Work Sans',sans-serif;color:var(--ink,#2B1B12)}" +
        "#maisTipoBox h3{margin:0 0 4px;font:800 16px 'Baloo 2','Work Sans',sans-serif}" +
        "#maisTipoBox p{margin:0 0 10px;font-size:13px;color:var(--muted,#8A7563);line-height:1.45}" +
        "#maisTipoBox .mt-linha{display:flex;gap:8px;flex-wrap:wrap}" +
        "#maisTipoBox input,#maisTipoBox select{padding:10px 11px;border:1.5px solid var(--line,#F0DFC4);border-radius:10px;font:500 14px 'Work Sans',Arial,sans-serif;background:#fff;color:inherit}" +
        "#maisTipoBox .mt-tipos{flex:1 1 240px}" +
        "#maisTipoBox button{font:800 14px 'Baloo 2','Work Sans',sans-serif;border:0;border-radius:10px;padding:10px 14px;background:var(--red,#E5232E);color:#fff;cursor:pointer}" +
        "#maisTipoBox button:disabled{opacity:.6}" +
        "#maisTipoBox .mt-msg{margin-top:8px;font-size:13px;font-weight:600}" +
        "#maisTipoBox .mt-msg.erro{color:var(--red-dark,#C21A24)}";
    document.head.appendChild(css);
    var cats = [];
    try { cats = (window.FarejadinhosCategorias && window.FarejadinhosCategorias.lista) || []; } catch (e) {}
    if (!cats.length) cats = ["Eletrodomésticos", "Cozinha", "Casa", "Utilidades", "Eletrônicos", "Celulares", "Beleza", "Skincare", "Pet", "Academia", "Moda", "Ferramentas", "Automação", "Natal"];
    box.innerHTML =
        "<h3>🔎 Mais do tipo (Shopee)</h3>" +
        "<p>Escreva tipos de produto separados por vírgula. A Yang pega os mais vendidos de cada um na Shopee (nota 4,5+, 100+ vendas, que ainda não estão no site) e sobe com o seu link de afiliado.</p>" +
        "<div class='mt-linha'><input class='mt-tipos' placeholder='Ex.: liquidificador, chaleira elétrica, garrafa térmica'>" +
        "<select class='mt-qtd' title='Quantos de cada'><option value='3'>3 de cada</option><option value='5' selected>5 de cada</option><option value='8'>8 de cada</option><option value='12'>12 de cada</option></select>" +
        "<select class='mt-cat' title='Categoria'><option value=''>Categoria automática</option>" + cats.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</select>" +
        "<button type='button' class='mt-ir'>🐶 Farejar</button></div><div class='mt-msg' hidden></div>";
    var q = function (s) { return box.querySelector(s); };
    function msg(t, erro) { var m = q(".mt-msg"); m.hidden = false; m.className = "mt-msg" + (erro ? " erro" : ""); m.textContent = t; }
    q(".mt-ir").onclick = function () {
        var tipos = q(".mt-tipos").value.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 3; }).slice(0, 10);
        if (!tipos.length) { msg("Escreva pelo menos um tipo (ex.: liquidificador).", true); return; }
        var senha = "";
        try { senha = localStorage.getItem("farejadinhos_admin_senha") || ""; } catch (e) {}
        var campo = document.getElementById("senha");
        if (!senha && campo) senha = campo.value.trim();
        if (!senha) { msg("Digite a senha do painel no campo de senha lá em cima primeiro.", true); return; }
        var b = this; b.disabled = true; b.textContent = "⏳ Enviando...";
        var dados = new FormData();
        dados.append("senha", senha);
        dados.append("itens", JSON.stringify([{ acao: "mais-do-tipo", tipos: tipos, porTipo: Number(q(".mt-qtd").value), categoria: q(".mt-cat").value }]));
        fetch(WORKER_URL + "/lote", { method: "POST", body: dados })
            .then(function (r) { return r.text().then(function (t) { if (r.status === 401) throw new Error("Senha recusada."); if (!r.ok) throw new Error(t.slice(0, 200)); }); })
            .then(function () { msg("✅ Pedido enviado! Em uns 5 minutos os produtos de " + tipos.join(", ") + " aparecem no site."); q(".mt-tipos").value = ""; })
            .catch(function (e) { msg("❌ " + e.message, true); })
            .then(function () { b.disabled = false; b.textContent = "🐶 Farejar"; });
    };
})();
