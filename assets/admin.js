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
    // A barra só aparece quando você LIGA o modo admin (?admin no endereço).
    // Ter a senha salva pelo painel não basta — senão o site sempre abria
    // em modo admin no seu navegador.
    var CHAVE_MODO = "farejadinhos_admin_modo";
    function modoLigado() { try { return localStorage.getItem(CHAVE_MODO) === "1"; } catch (e) { return false; } }
    function ligarModo(v) { try { if (v) localStorage.setItem(CHAVE_MODO, "1"); else localStorage.removeItem(CHAVE_MODO); } catch (e) {} }
    function gravar(v) { try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch (e) {} }
    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

    // ---------- estilos ----------
    var css = document.createElement("style");
    css.textContent = [
        ".adm-barra{position:fixed;left:12px;bottom:12px;z-index:90;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#2B1B12;color:#fff;border-radius:14px;padding:8px 10px;font:600 13px 'Work Sans',Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.28);max-width:calc(100vw - 24px)}",
        ".adm-barra b{color:#F7941D;margin-right:4px}",
        ".yt-lat-lista a{position:relative}",
        ".adm-cat-btn{flex:none;margin-left:2px;border:0;background:#FFF1DE;border-radius:7px;width:24px;height:24px;font-size:12px;cursor:pointer;line-height:1}",
        ".adm-cat-btn:hover{background:#F7941D}",
        ".adm-cat-nova{display:block;width:100%;margin-top:8px;padding:9px;border:1.5px dashed #F7941D;border-radius:11px;background:#FFF6E9;color:#C21A24;font:800 13px 'Work Sans',Arial,sans-serif;cursor:pointer}",
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
        ".adm-org-barra{position:sticky;top:8px;z-index:60;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#2B1B12;color:#fff;border-radius:14px;padding:10px 12px;margin:0 0 12px;font:600 13px 'Work Sans',Arial,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.2)}",
        ".adm-org-barra .adm-org-txt{flex:1 1 220px;line-height:1.35}",
        ".adm-org-barra .adm-org-txt b{color:#F7941D}",
        ".adm-org-barra button{font:700 12.5px 'Work Sans',Arial,sans-serif;border:0;border-radius:9px;padding:8px 11px;cursor:pointer;background:#4a362a;color:#fff}",
        ".adm-org-barra .adm-principal{background:#F7941D;color:#2B1B12}",
        ".adm-org .oferta-card{cursor:grab;outline:2px dashed #F7941D;outline-offset:-2px;user-select:none;-webkit-user-select:none;touch-action:pan-y}",
        ".adm-org .oferta-card a{pointer-events:none}",
        ".adm-org .oferta-card .pegar-oferta,.adm-org .adm-lapis{display:none}",
        ".adm-org .oferta-card img{-webkit-user-drag:none}",
        ".adm-org-num{position:absolute;top:8px;left:8px;z-index:6;min-width:30px;height:30px;padding:0 6px;border-radius:999px;background:#2B1B12;color:#F7941D;font:800 14px 'Baloo 2',Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.25)}",
        ".adm-org-alca{position:absolute;top:8px;right:8px;z-index:6;width:30px;height:30px;border-radius:9px;background:#F7941D;color:#2B1B12;font:900 16px Arial;display:flex;align-items:center;justify-content:center}",
        ".adm-org-fantasma{opacity:.3}",
        ".adm-org-voando{position:fixed;left:0;top:0;z-index:200;pointer-events:none;margin:0;box-shadow:0 18px 40px rgba(0,0,0,.3);outline:3px solid #E5232E;border-radius:16px;opacity:.95;background:#fff}",
        ".adm-org-escolhido{outline:3px solid #E5232E !important;box-shadow:0 14px 30px rgba(0,0,0,.25)}",
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
        ligarModo(false);   // esconde a barra; a senha continua salva pro painel
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

    function carregarScript(caminho, global) {
        if (window[global]) return Promise.resolve();
        return new Promise(function (ok, erro) {
            var s = document.createElement("script");
            s.src = base + caminho;
            s.onload = function () { window[global] ? ok() : erro(); };
            s.onerror = erro;
            document.head.appendChild(s);
        });
    }

    function carregarCategorias() {
        if (window.FarejadinhosCategorias) return Promise.resolve(window.FarejadinhosCategorias.LISTA);
        if (!window.FarejadinhosConfigCategorias && !carregarCategorias.tentou) {
            carregarCategorias.tentou = true;
            return carregarScript("assets/categorias-config.js", "FarejadinhosConfigCategorias").catch(function () {}).then(carregarCategorias);
        }
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

        // 🏪 Outros anúncios / cores deste produto (mesmo editor do painel)
        var anc = document.createElement("div");
        extra.appendChild(anc);
        carregarScript("assets/categorias-config.js", "FarejadinhosConfigCategorias").catch(function () {})
            .then(function () { return carregarScript("assets/vitrine.js", "FarejadinhosVitrine"); })
            .then(function () { return carregarScript("assets/anuncios-painel.js", "FarejadinhosAnunciosPainel"); })
            .then(function () { window.FarejadinhosAnunciosPainel.montar(oferta, anc); })
            .catch(function () { anc.textContent = "Não consegui carregar o editor de outros anúncios."; });

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
    // ---------- ➕ categorias e subcategorias na barra lateral ----------
    // Cria/edita pelo /lote (acao "categorias" -> gerador/categorias_config.py,
    // que grava assets/categorias-config.js). Vale pro site e pro painel.
    function pedirCategorias(item, ok) {
        var dados = new FormData();
        dados.append("senha", ler());
        dados.append("itens", JSON.stringify([Object.assign({ acao: "categorias" }, item)]));
        return fetch(WORKER_URL + "/lote", { method: "POST", body: dados })
            .then(function (r) { return r.text().then(function (t) { if (r.status === 401) throw new Error("Senha recusada."); if (!r.ok) throw new Error(t); }); })
            .then(function () { aviso(ok + " Aparece no site em 1–2 minutos (atualize a página)."); })
            .catch(function (e) { aviso("❌ " + e.message, true); });
    }
    function palavrasDaSub(cat, nome) {
        var c = window.FarejadinhosConfigCategorias || {};
        var s = ((c.subcategorias || {})[cat] || []).filter(function (x) { return x.nome === nome; })[0];
        return s ? (s.palavras || []).join(", ") : "";
    }
    function novaSub(cat) {
        var nome = prompt("Nova subcategoria dentro de \"" + cat + "\"\n\nNome (ex.: Panela de Arroz):", "");
        if (!nome || !nome.trim()) return;
        var pal = prompt("Palavras que aparecem no NOME dos produtos dessa subcategoria, separadas por vírgula.\nOs produtos com essas palavras entram nela sozinhos.\n\nEx.: panela de arroz, rice", nome.trim().toLowerCase());
        if (pal === null) return;
        // quantos produtos vão cair nela? se estiverem em OUTRA categoria, oferece mover
        var V = window.FarejadinhosVitrine, lista = (typeof ofertas !== "undefined" && Array.isArray(ofertas)) ? ofertas : [];
        var termos = pal.split(",").map(function (s) { return " " + s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " "; })
            .filter(function (s) { return s.trim(); });
        var bate = function (o) {
            var n = " " + String(o.produto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
            return termos.some(function (w) { return n.indexOf(w) >= 0 || n.indexOf(w.replace(/ $/, "s ")) >= 0; });
        };
        var principal = function (o) { return V && V.categoriaPrincipal ? V.categoriaPrincipal(o) : String(o.categoria || "").split(",")[0].trim(); };
        var aqui = lista.filter(function (o) { return o && bate(o) && principal(o) === cat; });
        var fora = lista.filter(function (o) { return o && bate(o) && principal(o) !== cat; });
        var mover = false;
        if (fora.length) {
            var onde = {};
            fora.forEach(function (o) { var c = principal(o); onde[c] = (onde[c] || 0) + 1; });
            mover = confirm((aqui.length ? aqui.length + " produto(s) de " + cat + " vão entrar nela.\n\n" : "Nenhum produto de " + cat + " tem essas palavras no nome.\n\n") +
                fora.length + " produto(s) com essas palavras estão em OUTRA categoria (" +
                Object.keys(onde).map(function (c) { return c + ": " + onde[c]; }).join(", ") + ").\n\n" +
                "Mover esses " + fora.length + " pra " + cat + " → " + nome.trim() + "?\n(OK = mover · Cancelar = só criar a subcategoria)");
        }
        pedirCategorias({ op: "add-sub", categoria: cat, nome: nome.trim(), palavras: pal },
            "✅ Subcategoria \"" + nome.trim() + "\" criada em " + cat + (mover ? " e " + fora.length + " produto(s) movidos pra ela." : (aqui.length ? " (" + aqui.length + " produto(s) já caem nela)." : ".")));
        if (mover) {
            var dados = new FormData();
            dados.append("senha", ler());
            dados.append("itens", JSON.stringify(fora.map(function (o) {
                var resto = String(o.categoria || "").split(",").map(function (s) { return s.trim(); }).filter(function (s) { return /^v[ií]deos?$/i.test(s); });
                return { acao: "anuncios", op: "categoria", slug: o.slug, categoria: [cat].concat(resto).join(", ") };
            }).concat(fora.map(function (o) { return { acao: "anuncios", op: "sub", slug: o.slug, sub: nome.trim() }; }))));
            fetch(WORKER_URL + "/lote", { method: "POST", body: dados }).catch(function (e) { aviso("❌ Não consegui mover: " + e.message, true); });
        }
    }
    function editarSub(cat, nome) {
        if (/^Outr/.test(nome)) { aviso("\"" + nome + "\" é automática: junta o que não caiu em nenhuma subcategoria.", true); return; }
        if (cat === "Celulares") { aviso("As subcategorias de Celulares são automáticas (marca do aparelho e Acessórios).", true); return; }
        var novo = prompt("Editar subcategoria \"" + nome + "\" (" + cat + ")\n\nNome — deixe VAZIO pra APAGAR a subcategoria:", nome);
        if (novo === null) return;
        if (!novo.trim()) {
            if (confirm("Apagar a subcategoria \"" + nome + "\"? Os produtos dela vão pra outra subcategoria ou pra \"Outros\".")) pedirCategorias({ op: "del-sub", categoria: cat, nome: nome }, "🗑️ Subcategoria apagada.");
            return;
        }
        var pal = prompt("Palavras que aparecem no nome dos produtos (separadas por vírgula):", palavrasDaSub(cat, nome));
        if (pal === null) return;
        pedirCategorias({ op: "edit-sub", categoria: cat, nome: nome, novoNome: novo.trim(), palavras: pal }, "✅ Subcategoria atualizada.");
    }
    function novaCategoria() {
        var nome = prompt("Nova categoria\n\nNome (ex.: Brinquedos):", "");
        if (!nome || !nome.trim()) return;
        var icone = prompt("Um emoji pra ela (ex.: 🧸):", "🏷️");
        if (icone === null) return;
        var pal = prompt("Palavras que aparecem no nome dos produtos dessa categoria, separadas por vírgula (ajuda o painel a sugerir sozinho). Pode deixar vazio.", "");
        if (pal === null) return;
        pedirCategorias({ op: "add-cat", nome: nome.trim(), icone: icone.trim(), palavras: pal },
            "✅ Categoria \"" + nome.trim() + "\" criada — já aparece na lista de categorias do Editar e do painel; no menu, assim que tiver oferta nela.");
    }
    function adminCategorias() {
        var lista = document.querySelector(".yt-lat-lista");
        if (!lista || !lista.querySelector("a[data-cat]") || lista.querySelector(".adm-cat-nova")) return;
        lista.querySelectorAll("a[data-cat]").forEach(function (a) {
            var cat = a.getAttribute("data-cat");
            if (!cat || a.querySelector(".adm-cat-btn")) return;
            var b = document.createElement("button");
            b.type = "button";
            b.className = "adm-cat-btn";
            var i = cat.indexOf("/");
            if (i > 0) {
                b.textContent = "✏️"; b.title = "Editar subcategoria";
                b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); editarSub(cat.slice(0, i), cat.slice(i + 1)); };
            } else {
                b.textContent = "➕"; b.title = "Nova subcategoria em " + cat;
                b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); novaSub(cat); };
            }
            a.appendChild(b);
        });
        var nova = document.createElement("button");
        nova.type = "button";
        nova.className = "adm-cat-nova";
        nova.textContent = "➕ Nova categoria";
        nova.onclick = novaCategoria;
        lista.appendChild(nova);
    }


    // ---------- ↕️ Organizar: arrastar os cards pra ordem certa ----------
    // Numa categoria (ou subcategoria) com a ordem padrão, o botão
    // "↕️ Organizar" deixa arrastar os cards. "💾 Salvar ordem" grava em cada
    // oferta (campo "ordem", lote acao "anuncios" op "ordem"); oferta nova
    // entra no lugar automático dela. "↩️ Automática" desfaz.
    var orgLista = window.farejaUltimaLista || null, orgAtivo = false, orgSort = null;
    function nomeChave(c) { var i = c.indexOf("/"); return i > 0 ? c.slice(0, i) + " · " + c.slice(i + 1) : c; }
    // arrastar: mouse arrasta na hora; no celular, segura ~0,25s e arrasta
    function arrastavel(grid, aoSoltar) {
        var arr = null, timer = null, inicio = null, rolar = 0, raf = 0;
        function cards() { return Array.prototype.slice.call(grid.querySelectorAll(".oferta-card")); }
        function comecar(card, x, y) {
            var r = card.getBoundingClientRect();
            var fant = card.cloneNode(true);
            fant.classList.add("adm-org-voando");
            fant.style.width = r.width + "px"; fant.style.height = r.height + "px";
            document.body.appendChild(fant);
            card.classList.add("adm-org-fantasma");
            arr = { card: card, fant: fant, dx: x - r.left, dy: y - r.top };
            mover(x, y);
            if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
        }
        function mover(x, y) {
            arr.fant.style.transform = "translate(" + (x - arr.dx) + "px," + (y - arr.dy) + "px) rotate(1.5deg)";
            var alvo = null, depois = false;
            cards().forEach(function (c) {
                if (c === arr.card || alvo) return;
                var r = c.getBoundingClientRect();
                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                    alvo = c;
                    depois = (x - r.left) / r.width > .5;
                }
            });
            if (alvo) {
                var ref = depois ? alvo.nextSibling : alvo;
                if (ref !== arr.card) grid.insertBefore(arr.card, ref);
            }
            var h = window.innerHeight;
            rolar = y < 80 ? -14 : y > h - 80 ? 14 : 0;
            if (rolar && !raf) raf = requestAnimationFrame(function passo() {
                if (!arr || !rolar) { raf = 0; return; }
                window.scrollBy(0, rolar); raf = requestAnimationFrame(passo);
            });
        }
        function terminar() {
            clearTimeout(timer); timer = null; inicio = null;
            if (!arr) return;
            arr.fant.remove(); arr.card.classList.remove("adm-org-fantasma");
            arr = null; rolar = 0;
            aoSoltar();
        }
        function down(e) {
            var card = e.target.closest && e.target.closest(".oferta-card");
            if (!card || !grid.contains(card) || e.button > 0) return;
            inicio = { x: e.clientX, y: e.clientY, card: card };
            if (e.pointerType === "mouse") { e.preventDefault(); return; }
            timer = setTimeout(function () { if (inicio) comecar(card, inicio.x, inicio.y); }, 250);
        }
        function move(e) {
            if (arr) { e.preventDefault(); mover(e.clientX, e.clientY); return; }
            if (!inicio) return;
            var d = Math.abs(e.clientX - inicio.x) + Math.abs(e.clientY - inicio.y);
            if (e.pointerType === "mouse") { if (d > 5) comecar(inicio.card, inicio.x, inicio.y); }
            else if (d > 10) { clearTimeout(timer); inicio = null; }   // estava rolando a página
        }
        function tocar(e) { if (arr) e.preventDefault(); }   // segura a página parada enquanto arrasta
        grid.addEventListener("pointerdown", down);
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", terminar);
        window.addEventListener("pointercancel", terminar);
        grid.addEventListener("touchmove", tocar, { passive: false });
        grid.addEventListener("contextmenu", tocar);
        return { destroy: function () {
            terminar();
            grid.removeEventListener("pointerdown", down);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", terminar);
            window.removeEventListener("pointercancel", terminar);
            grid.removeEventListener("touchmove", tocar);
            grid.removeEventListener("contextmenu", tocar);
        } };
    }
    function botaoOrganizar() {
        var b = document.querySelector(".adm-barra");
        if (!b) return;
        var btn = b.querySelector("[data-org]");
        var pode = orgLista && orgLista.chave && orgLista.slugs && orgLista.slugs.length > 1;
        if (!pode) { if (btn) btn.remove(); return; }
        if (!btn) {
            btn = document.createElement("button");
            btn.setAttribute("data-org", "");
            btn.className = "adm-principal";
            btn.onclick = entrarOrganizar;
            b.insertBefore(btn, b.children[1] || null);
        }
        btn.textContent = "↕️ Organizar " + nomeChave(orgLista.chave);
    }
    function numerar(grid) {
        Array.prototype.forEach.call(grid.querySelectorAll(".oferta-card"), function (c, i) {
            var n = c.querySelector(".adm-org-num");
            if (!n) {
                n = document.createElement("span"); n.className = "adm-org-num"; c.appendChild(n);
                var h = document.createElement("span"); h.className = "adm-org-alca"; h.textContent = "⠿"; h.title = "Arrastar"; c.appendChild(h);
                if (getComputedStyle(c).position === "static") c.style.position = "relative";
            }
            n.textContent = i + 1;
        });
    }
    function bloquearClique(e) { if (orgAtivo) { e.preventDefault(); e.stopPropagation(); } }
    function sairOrganizar(redesenhar) {
        var grid = document.getElementById("grid");
        orgAtivo = false;
        if (orgSort) { orgSort.destroy(); orgSort = null; }
        var barra = document.querySelector(".adm-org-barra");
        if (barra) barra.remove();
        if (grid) {
            grid.classList.remove("adm-org");
            grid.removeEventListener("click", bloquearClique, true);
            grid.querySelectorAll(".adm-org-num,.adm-org-alca").forEach(function (x) { x.remove(); });
        }
        if (redesenhar && typeof aplicarFiltros === "function") aplicarFiltros();
    }
    function mandarOrdem(chave, slugs, ok) {
        var dados = new FormData();
        dados.append("senha", ler());
        dados.append("itens", JSON.stringify([{ acao: "anuncios", op: "ordem", chave: chave, slugs: slugs }]));
        return fetch(WORKER_URL + "/lote", { method: "POST", body: dados })
            .then(function (r) { return r.text().then(function (t) { if (r.status === 401) throw new Error("Senha recusada."); if (!r.ok) throw new Error(t); }); })
            .then(function () {
                // já vale nesta página (o site publica em 1–2 minutos)
                if (typeof ofertas !== "undefined" && Array.isArray(ofertas)) {
                    var pos = {}; slugs.forEach(function (s, i) { pos[s] = i; });
                    ofertas.forEach(function (o) {
                        if (!o) return;
                        var m = o.ordem && typeof o.ordem === "object" ? o.ordem : {};
                        if (o.slug in pos) m[chave] = pos[o.slug]; else delete m[chave];
                        o.ordem = m;
                    });
                }
                aviso(ok);
            });
    }
    function entrarOrganizar() {
        var grid = document.getElementById("grid");
        if (!grid || !orgLista || !orgLista.chave || orgAtivo) return;
        var chave = orgLista.chave;
        (function () {
            orgAtivo = true;
            grid.classList.add("adm-org");
            grid.addEventListener("click", bloquearClique, true);
            var barra = document.createElement("div");
            barra.className = "adm-org-barra";
            barra.innerHTML = '<span class="adm-org-txt">↕️ Organizando <b>' + esc(nomeChave(chave)) + '</b> — arraste os produtos pro lugar certo' +
                ' <span style="opacity:.75">(no celular: segure o card um instante e arraste)</span></span>' +
                '<button class="adm-principal" data-ok>💾 Salvar ordem</button><button data-auto>↩️ Automática</button><button data-x>Cancelar</button>';
            grid.parentNode.insertBefore(barra, grid);
            numerar(grid);
            orgSort = arrastavel(grid, function () { numerar(grid); });
            barra.querySelector("[data-x]").onclick = function () { sairOrganizar(true); };
            barra.querySelector("[data-ok]").onclick = function () {
                var btn = this; btn.disabled = true; btn.textContent = "⏳ Salvando...";
                var slugs = Array.prototype.map.call(grid.querySelectorAll(".oferta-card"), function (c) { return c.getAttribute("data-slug"); }).filter(Boolean);
                mandarOrdem(chave, slugs, "✅ Ordem de " + nomeChave(chave) + " salva! O site atualiza em 1–2 minutos.")
                    .then(function () { sairOrganizar(true); })
                    .catch(function (e) { btn.disabled = false; btn.textContent = "💾 Salvar ordem"; aviso("❌ " + e.message, true); });
            };
            barra.querySelector("[data-auto]").onclick = function () {
                if (!confirm("Voltar " + nomeChave(chave) + " pra ordem automática (parecidos juntos)?")) return;
                var btn = this; btn.disabled = true;
                mandarOrdem(chave, [], "↩️ " + nomeChave(chave) + " voltou pra ordem automática.")
                    .then(function () { sairOrganizar(true); })
                    .catch(function (e) { btn.disabled = false; aviso("❌ " + e.message, true); });
            };
            barra.scrollIntoView({ behavior: "smooth", block: "start" });
        })();
    }
    document.addEventListener("fareja:lista", function (e) {
        orgLista = e.detail || null;
        if (orgAtivo) sairOrganizar(false);
        botaoOrganizar();
    });

    function ligar() {
        // barra lateral de categorias: aparece um pouco depois (topo.js)
        adminCategorias();
        new MutationObserver(function () { adminCategorias(); }).observe(document.body, { childList: true, subtree: true });
        var slug = slugAtual();
        if (slug) {
            carregarOferta(slug).then(function () {
                montarBarra();
                if (location.hash === "#editar") comecarEdicao();
            });
        } else {
            montarBarra();
            botaoOrganizar();
            lapisNosCards();
            new MutationObserver(lapisNosCards).observe(document.body, { childList: true, subtree: true });
        }
    }

    function iniciar() {
        var pediu = /[?&]admin\b/.test(location.search) || location.hash === "#admin" || location.hash === "#editar";
        if (pediu) {
            ligarModo(true);
            if (ler()) ligar(); else pedirSenha(ligar);
        } else if (modoLigado() && ler()) ligar();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
