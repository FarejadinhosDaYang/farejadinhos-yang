/**
 * Farejadinhos da Yang — modo administrador no próprio site
 *
 * Entrar: abrir o site com ?admin no endereço (ex.: .../?admin) e digitar
 * a senha do painel. A senha fica guardada só neste navegador.
 * Com o modo ligado:
 *   - página da oferta: botão "✏️ Editar" — nome, preço, preço antigo e
 *     cupom ficam editáveis ali mesmo; categoria, link e destaque numa
 *     barrinha. Salvar usa a mesma rota do painel (/editar).
 *   - página inicial: um ✏️ em cada card, que abre a oferta já editando.
 *
 * Uso: <script src="assets/admin.js" data-base=""></script>
 * (data-base = caminho até a raiz do site)
 */
(function () {
    var WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev";
    var CHAVE = "farejadinhos_admin_senha";
    var script = document.currentScript;
    var base = (script && script.getAttribute("data-base")) || "";

    function ler() { try { return localStorage.getItem(CHAVE) || ""; } catch (e) { return ""; } }
    function gravar(v) { try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch (e) {} }
    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

    // ---------- estilos ----------
    var css = document.createElement("style");
    css.textContent = [
        ".adm-barra{position:fixed;left:12px;bottom:12px;z-index:90;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#2B1B12;color:#fff;border-radius:14px;padding:8px 10px;font:600 13px 'Work Sans',Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.28);max-width:calc(100vw - 24px)}",
        ".adm-barra b{color:#F7941D;margin-right:4px}",
        ".adm-barra button,.adm-barra a{font:700 12.5px 'Work Sans',Arial,sans-serif;border:0;border-radius:9px;padding:7px 10px;cursor:pointer;text-decoration:none;background:#4a362a;color:#fff}",
        ".adm-barra .adm-principal{background:#F7941D;color:#2B1B12}",
        ".adm-barra .adm-perigo{background:#7a1a1f}",
        ".adm-editavel{outline:2px dashed #F7941D;outline-offset:3px;border-radius:6px;cursor:text;min-height:1em}",
        ".adm-cupom.adm-editavel{display:inline-block;min-width:80px}",
        ".adm-editavel:focus{outline-style:solid;background:#fffaf1}",
        ".adm-editavel:empty::before{content:attr(data-vazio);color:#c9b8a6;font-weight:500;text-decoration:none}",
        ".adm-extra{margin-top:16px;padding:14px;border:2px dashed #F7941D;border-radius:14px;background:#fff6e9;display:grid;gap:10px;font:600 13px 'Work Sans',Arial,sans-serif;color:#2B1B12}",
        ".adm-extra label{display:grid;gap:4px}",
        ".adm-extra input[type=text],.adm-extra select{font:500 14px 'Work Sans',Arial,sans-serif;padding:9px 10px;border:1.5px solid #F0DFC4;border-radius:10px;background:#fff;width:100%;box-sizing:border-box}",
        ".adm-extra .adm-linha{display:flex;align-items:center;gap:8px}",
        ".adm-dica{font-weight:500;color:#8A7563;font-size:12px}",
        ".adm-lapis{position:absolute;top:8px;left:8px;z-index:5;width:34px;height:34px;border-radius:50%;border:0;background:#2B1B12;color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 4px 10px rgba(0,0,0,.25)}",
        ".adm-aviso{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:95;background:#1d6b33;color:#fff;padding:11px 16px;border-radius:12px;font:600 13.5px 'Work Sans',Arial,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center}",
        ".adm-aviso.erro{background:#a3141c}",
        ".adm-modal{position:fixed;inset:0;z-index:100;background:rgba(43,27,18,.5);display:flex;align-items:center;justify-content:center;padding:16px}",
        ".adm-modal form{background:#FFFAF1;border-radius:18px;padding:22px;width:100%;max-width:340px;display:grid;gap:12px;font:600 14px 'Work Sans',Arial,sans-serif;color:#2B1B12}",
        ".adm-modal h3{margin:0;font:800 20px 'Baloo 2',sans-serif;color:#C21A24}",
        ".adm-modal input{font:500 15px 'Work Sans',Arial,sans-serif;padding:11px;border:1.5px solid #F0DFC4;border-radius:10px}",
        ".adm-modal .adm-botoes{display:flex;gap:8px;justify-content:flex-end}",
        ".adm-modal button{font:700 14px 'Work Sans',Arial,sans-serif;border:0;border-radius:10px;padding:10px 14px;cursor:pointer}",
        ".adm-modal button[type=submit]{background:#E5232E;color:#fff}"
    ].join("\n");
    document.head.appendChild(css);

    function aviso(texto, erro) {
        var a = document.createElement("div");
        a.className = "adm-aviso" + (erro ? " erro" : "");
        a.textContent = texto;
        document.body.appendChild(a);
        setTimeout(function () { a.remove(); }, erro ? 6000 : 4500);
    }

    function pedirSenha(depois) {
        var m = document.createElement("div");
        m.className = "adm-modal";
        m.innerHTML = '<form><h3>🐾 Modo administrador</h3>' +
            '<label>Senha do painel<input type="password" autocomplete="current-password" required></label>' +
            '<div class="adm-botoes"><button type="button" data-x>Cancelar</button><button type="submit">Entrar</button></div></form>';
        document.body.appendChild(m);
        var input = m.querySelector("input");
        setTimeout(function () { input.focus(); }, 30);
        m.querySelector("[data-x]").onclick = function () { m.remove(); };
        m.querySelector("form").onsubmit = function (e) {
            e.preventDefault();
            gravar(input.value.trim());
            m.remove();
            if (depois) depois();
        };
    }

    function sair() {
        gravar("");
        location.href = location.pathname;
    }

    // ---------- página da oferta ----------
    function slugAtual() {
        var partes = location.pathname.split("/").filter(Boolean);
        var i = partes.lastIndexOf("ofertas");
        return i >= 0 && partes[i + 1] ? decodeURIComponent(partes[i + 1]) : "";
    }

    var oferta = null;
    var editando = false;

    function carregarOferta(slug) {
        return fetch(base + "ofertas.json?t=" + Date.now(), { cache: "no-store" })
            .then(function (r) { return r.json(); })
            .then(function (d) { oferta = (Array.isArray(d) ? d : [d]).filter(function (o) { return o && o.slug === slug; })[0] || null; return oferta; });
    }

    function carregarCategorias() {
        if (window.FarejadinhosCategorias) return Promise.resolve(window.FarejadinhosCategorias.LISTA);
        return new Promise(function (ok) {
            var s = document.createElement("script");
            s.src = base + "assets/categorias.js";
            s.onload = function () { ok(window.FarejadinhosCategorias ? window.FarejadinhosCategorias.LISTA : []); };
            s.onerror = function () { ok([]); };
            document.head.appendChild(s);
        });
    }

    function tornarEditavel(el) {
        el.textContent = el.textContent.replace(/\s+/g, " ").trim();
        el.setAttribute("contenteditable", "plaintext-only");
        if (el.getAttribute("contenteditable") !== "plaintext-only") el.setAttribute("contenteditable", "true");
        el.classList.add("adm-editavel");
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    }

    function textoDe(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }

    function comecarEdicao() {
        if (editando || !oferta) return;
        editando = true;
        var card = document.querySelector(".card .content") || document.querySelector(".card") || document.body;

        var h1 = card.querySelector("h1");
        var preco = card.querySelector(".price");
        var old = card.querySelector(".old");
        if (!old && preco) {
            old = document.createElement("div");
            old.className = "old";
            preco.parentNode.insertBefore(old, preco);
        }
        if (old) old.setAttribute("data-vazio", "preço antigo");

        var cupomBox = card.querySelector(".coupon");
        if (!cupomBox && preco) {
            cupomBox = document.createElement("div");
            cupomBox.className = "coupon";
            preco.parentNode.insertBefore(cupomBox, preco.nextSibling);
        }
        if (cupomBox) cupomBox.innerHTML = "<b>🏷 CUPOM:</b> <span class='adm-cupom' data-vazio='sem cupom'>" + esc(oferta.cupom || "") + "</span>";

        [h1, preco, old, cupomBox && cupomBox.querySelector(".adm-cupom")].forEach(function (el) { if (el) tornarEditavel(el); });
        if (old && !textoDe(old)) old.textContent = "";

        var extra = document.createElement("div");
        extra.className = "adm-extra";
        extra.innerHTML =
            '<div class="adm-dica">✏️ Clique no nome, no preço, no preço antigo ou no cupom pra trocar. Deixe o preço antigo ou o cupom vazio pra tirar.</div>' +
            '<label>Categoria<select data-cat></select></label>' +
            '<label class="adm-linha"><input type="checkbox" data-video> 🎬 Também em Vídeos (fica sempre no site)</label>' +
            '<label>Link da oferta (afiliado)<input type="text" data-link></label>' +
            '<label class="adm-linha"><input type="checkbox" data-dest> ⭐ Destacar na página inicial</label>';
        var btnLoja = card.querySelector("a.btn");
        (btnLoja ? btnLoja.parentNode : card).insertBefore(extra, btnLoja || null);
        extra.querySelector("[data-link]").value = oferta.link || "";
        extra.querySelector("[data-dest]").checked = !!oferta.destaque;

        // "Cozinha, Vídeos" -> principal "Cozinha" + caixinha de Vídeos marcada
        var partesCat = String(oferta.categoriaCompleta || oferta.categoria || "").split(",").map(function (c) { return c.trim(); }).filter(Boolean);
        var ehVideo = function (c) { return c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "videos"; };
        var catPrincipal = partesCat.filter(function (c) { return !ehVideo(c); })[0] || "";
        extra.querySelector("[data-video]").checked = partesCat.some(ehVideo);

        carregarCategorias().then(function (lista) {
            var sel = extra.querySelector("[data-cat]");
            lista = lista.filter(function (c) { return !ehVideo(c); });
            if (catPrincipal && lista.indexOf(catPrincipal) < 0) lista.unshift(catPrincipal);
            sel.innerHTML = '<option value="">Sem categoria</option>' + lista.map(function (c) {
                return '<option' + (c === catPrincipal ? " selected" : "") + ">" + esc(c) + "</option>";
            }).join("");
        });

        montarBarra();
        (h1 || preco).focus();
    }

    function salvar(btn) {
        var card = document.querySelector(".card .content") || document.querySelector(".card") || document.body;
        var produto = textoDe(card.querySelector("h1"));
        var preco = textoDe(card.querySelector(".price"));
        if (!produto || !preco) { aviso("Nome e preço não podem ficar vazios.", true); return; }
        var dados = new FormData();
        dados.append("senha", ler());
        dados.append("slug", oferta.slug);
        dados.append("produto", produto);
        dados.append("preco", preco);
        dados.append("precoAntigo", textoDe(card.querySelector(".old")));
        dados.append("cupom", textoDe(card.querySelector(".adm-cupom")).toUpperCase());
        var catSel = card.querySelector("[data-cat]").value;
        var comVideo = card.querySelector("[data-video]").checked;
        dados.append("categoria", comVideo ? (catSel ? catSel + ", Vídeos" : "Vídeos") : catSel);
        dados.append("precoAVista", oferta.precoAVista ? preco : "");
        dados.append("precoAPrazo", oferta.precoAPrazo || "");
        dados.append("link", card.querySelector("[data-link]").value.trim());
        dados.append("destaque", card.querySelector("[data-dest]").checked ? "true" : "false");

        btn.disabled = true; btn.textContent = "Salvando...";
        fetch(WORKER_URL + "/editar", { method: "POST", body: dados })
            .then(function (r) { return r.text().then(function (t) { if (r.status === 401) throw new Error("401"); if (!r.ok) throw new Error(t); }); })
            .then(function () { aviso("✅ Salvo! O site atualiza em 1–2 minutos."); btn.textContent = "✅ Salvo"; })
            .catch(function (e) {
                btn.disabled = false; btn.textContent = "💾 Salvar";
                if (e.message === "401") { gravar(""); aviso("Senha recusada. Entre de novo.", true); pedirSenha(function () { salvar(btn); }); }
                else aviso("❌ " + e.message, true);
            });
    }

    function tirarDoAr(btn) {
        if (!confirm("Tirar esta oferta do site? O link dela continua funcionando, mas ela some da vitrine.")) return;
        var dados = new FormData();
        dados.append("senha", ler());
        dados.append("slug", oferta.slug);
        btn.disabled = true;
        fetch(WORKER_URL + "/remover", { method: "POST", body: dados })
            .then(function (r) { return r.text().then(function (t) { if (r.status === 401) throw new Error("Senha recusada."); if (!r.ok) throw new Error(t); }); })
            .then(function () { aviso("✅ Oferta tirada do ar."); setTimeout(function () { location.href = base + "index.html"; }, 1500); })
            .catch(function (e) { btn.disabled = false; aviso("❌ " + e.message, true); });
    }

    // ---------- barra do admin ----------
    function montarBarra() {
        var velha = document.querySelector(".adm-barra");
        if (velha) velha.remove();
        var b = document.createElement("div");
        b.className = "adm-barra";
        var html = "<b>🐾 Admin</b>";
        if (oferta && !editando) html += '<button class="adm-principal" data-ed>✏️ Editar esta oferta</button>';
        if (oferta && editando) html += '<button class="adm-principal" data-salvar>💾 Salvar</button><button data-cancelar>Cancelar</button><button class="adm-perigo" data-remover>🗑️ Tirar do ar</button>';
        html += '<a href="' + base + 'painel/ofertas.html">Painel</a><button data-sair>Sair</button>';
        b.innerHTML = html;
        document.body.appendChild(b);
        var q = function (s) { return b.querySelector(s); };
        if (q("[data-ed]")) q("[data-ed]").onclick = comecarEdicao;
        if (q("[data-salvar]")) q("[data-salvar]").onclick = function () { salvar(this); };
        if (q("[data-cancelar]")) q("[data-cancelar]").onclick = function () { location.hash = ""; location.reload(); };
        if (q("[data-remover]")) q("[data-remover]").onclick = function () { tirarDoAr(this); };
        q("[data-sair]").onclick = sair;
    }

    // ---------- página inicial: lápis nos cards ----------
    function lapisNosCards() {
        document.querySelectorAll(".oferta-card, .podio-card").forEach(function (c) {
            if (c.querySelector(".adm-lapis")) return;
            var link = c.querySelector("a[href*='ofertas/']");
            if (!link) return;
            var a = document.createElement("a");
            a.className = "adm-lapis";
            a.href = link.getAttribute("href").replace(/#.*$/, "") + "#editar";
            a.title = "Editar oferta";
            a.textContent = "✏️";
            if (getComputedStyle(c).position === "static") c.style.position = "relative";
            c.appendChild(a);
        });
    }

    // ---------- início ----------
    function ligar() {
        var slug = slugAtual();
        if (slug) {
            carregarOferta(slug).then(function () {
                montarBarra();
                if (location.hash === "#editar") comecarEdicao();
            });
        } else {
            montarBarra();
            lapisNosCards();
            new MutationObserver(lapisNosCards).observe(document.body, { childList: true, subtree: true });
        }
    }

    function iniciar() {
        var pediu = /[?&]admin\b/.test(location.search) || location.hash === "#admin";
        if (ler()) ligar();
        else if (pediu) pedirSenha(ligar);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
