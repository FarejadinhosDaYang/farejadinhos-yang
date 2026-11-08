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
        if (/amazon\.|amzn\.|link\.amazon/i.test(l)) return ["amazon", "Amazon"];
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
        // níveis de escolha, como na Amazon: Tamanho → Cor → Configuração
        var agoraV = new Date();
        var nivel = function (c) { return V.nivelDe ? V.nivelDe(atual, agoraV, c) : 0; };
        var temTam = nivel("tamanho") >= 2, temCfg = nivel("configuracao") >= 2;
        var nCor = V.nivelDe ? nivel("variacao") : (V.variacoesDe ? V.variacoesDe(atual, agoraV).length : 0);
        var temCor = nCor >= 2 || (nCor >= 1 && (temTam || temCfg));

        var btn = document.querySelector(".card a.btn, a.btn");
        var preco = document.querySelector(".price");
        var old = document.querySelector(".old");
        var foto = document.querySelector("img.product");
        var fotoPrincipal = foto ? foto.getAttribute("src") : "";
        var precoPrincipalTxt = preco ? preco.textContent.trim() : "";
        var oldTxt = old ? old.textContent : "";

        var box = document.createElement("div");
        box.className = "anc-box";
        var depois = btn || preco;
        if (depois && depois.parentNode) depois.parentNode.insertBefore(box, depois.nextSibling);

        var rotulo = null;
        if (temCor && preco) {
            rotulo = document.createElement("div");
            rotulo.className = "var-rotulo";
            preco.parentNode.insertBefore(rotulo, preco);
        }

        // foto de cada anúncio: a dele; senão a da cor/versão; senão a principal
        function fotoDo(a, fotoVar) {
            if (a.imagem) return a.imagem;
            if (fotoVar) return fotoVar;
            return fotoPrincipal;
        }

        function mostrarLista(lista, nomeVar, fotoVar) {
            var melhor = lista.filter(function (a) { return a.confiavel; })[0] || lista[0];
            var confiaveis = lista.filter(function (a) { return a.confiavel; });
            // topo: preço, botão, "de R$"
            if (preco) preco.textContent = melhor.principal ? precoPrincipalTxt : (melhor.valor ? reais(melhor.valor) : "Preço a conferir");
            if (btn) btn.href = melhor.link;
            if (old) {
                if (melhor.principal) { old.textContent = oldTxt; old.style.display = ""; }
                else if (melhor.precoAntigo > melhor.valor) { old.textContent = oldTxt.replace(/R\$\s?[\d.,]+/, reais(melhor.precoAntigo)); old.style.display = ""; }
                else old.style.display = "none";
            }
            box.innerHTML =
                (confiaveis.length > 1 ? '<div class="anc-selo">🏆 Menor preço entre ' + confiaveis.length + " anúncios" +
                    (nomeVar ? " de " + esc(nomeVar) : "") + " · " + esc(melhor.loja) + "</div>" : "") +
                (lista.length > 1 || nomeVar ? '<div class="anc-titulo">🏪 ' + (nomeVar ? "Onde comprar: " + esc(nomeVar) : "Este produto em outros anúncios") + "</div>" +
                lista.map(function (a) {
                    var m = a === melhor;
                    var quando = haQuanto(a.conferido);
                    return '<a class="anc-item' + (m ? " melhor" : "") + (a.confiavel ? "" : " duvida") + '" href="' + esc(a.link) + '" target="_blank" rel="nofollow sponsored noopener">' +
                        '<span class="anc-foto"><img src="' + esc(fotoDo(a, fotoVar)) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"></span>' +
                        '<span class="anc-topo"><span class="anc-loja ' + esc(a.lojaId) + '">' + esc(a.loja) + "</span>" +
                        (a.variacao && !nomeVar ? '<span class="anc-var">' + (a.cor ? '<i style="background:' + esc(a.cor) + '"></i>' : "") + esc(a.variacao) + "</span>" : "") + "</span>" +
                        '<span class="anc-preco">' + (a.confiavel ? reais(a.valor) : "preço a conferir") + "</span>" +
                        '<span class="anc-quando">' + (m && lista.length > 1 ? "✅ mais barato" : a.confiavel ? (quando ? "conferido " + quando : "") : "abrir pra ver") + "</span>" +
                        '<span class="anc-ver">Ver ↗</span></a>';
                }).join("") +
                '<div class="anc-obs">Preços conferidos automaticamente; podem mudar na loja. Vale sempre o preço de lá.</div>' : "");
        }

        if (!temTam && !temCor && !temCfg) { mostrarLista(todos, ""); return; }
        if (rotulo) rotulo.parentNode.removeChild(rotulo);

        function trocarFoto(nova) {
            if (!foto || !nova || foto.getAttribute("src") === nova) return;
            foto.classList.add("trocando");
            foto.onload = function () { foto.classList.remove("trocando"); };
            foto.src = nova;
            setTimeout(function () { foto.classList.remove("trocando"); }, 600);
        }

        var niveis = [];
        if (temTam) niveis.push({ campo: "tamanho", titulo: "Tamanho" });
        if (temCor) niveis.push({ campo: "variacao", titulo: "Cor" });
        if (temCfg) niveis.push({ campo: "configuracao", titulo: "Configuração" });
        var ref = preco || btn;
        niveis.forEach(function (nv) {
            nv.rotulo = document.createElement("div");
            nv.rotulo.className = "var-rotulo";
            nv.caixa = document.createElement("div");
            nv.caixa.className = nv.campo === "variacao" ? "var-opcoes" : "var-tams";
            nv.caixa.setAttribute("role", "radiogroup");
            nv.caixa.setAttribute("aria-label", "Escolher " + nv.titulo.toLowerCase());
            if (ref && ref.parentNode) {
                ref.parentNode.insertBefore(nv.rotulo, ref.nextSibling);
                ref.parentNode.insertBefore(nv.caixa, nv.rotulo.nextSibling);
                ref = nv.caixa;
            }
        });
        var sel = {};

        function opcoes(nv, filtro) {
            if (nv.campo === "variacao") {
                return V.variacoesDe(atual, agoraV, filtro).map(function (v) {
                    return { nome: v.nome, valor: v.melhor.valor, confiavel: v.confiavel, lista: v.lista, cor: v.cor,
                        imagem: v.imagem, antigo: v.confiavel && v.melhor.precoAntigo > v.melhor.valor ? v.melhor.precoAntigo : 0 };
                });
            }
            return V.opcoesDe(atual, agoraV, nv.campo, filtro);
        }

        function desenhar(desde) {
            var filtro = {}, ultima = null, fotoCor = "";
            niveis.forEach(function (nv, idx) {
                if (idx < desde) {
                    if (sel[nv.campo] !== undefined) { filtro[nv.campo] = sel[nv.campo]; ultima = nv.atual || ultima; }
                    if (nv.campo === "variacao" && nv.atual) fotoCor = nv.atual.imagem;
                    return;
                }
                var ops = opcoes(nv, Object.assign({}, filtro));
                nv.caixa.innerHTML = "";
                if (!ops.length) {
                    nv.caixa.style.display = nv.rotulo.style.display = "none";
                    delete sel[nv.campo]; nv.atual = null;
                    return;
                }
                nv.caixa.style.display = nv.rotulo.style.display = "";
                var barata = ops.reduce(function (m, o) { return o.confiavel && (!m || o.valor < m.valor) ? o : m; }, null);
                var atualOp = ops.filter(function (o) { return o.nome === sel[nv.campo]; })[0] || barata || ops[0];
                sel[nv.campo] = atualOp.nome; nv.atual = atualOp;
                ops.forEach(function (op) {
                    var b = document.createElement("button");
                    b.type = "button";
                    b.setAttribute("role", "radio");
                    var ativa = op === atualOp;
                    b.setAttribute("aria-checked", ativa ? "true" : "false");
                    var precoO = op.confiavel ? reais(op.valor) : "a conferir";
                    var antigo = op.antigo ? '<s class="var-tile-antigo">' + reais(op.antigo) + "</s>" : "";
                    if (nv.campo === "variacao") {
                        b.className = "var-tile" + (ativa ? " ativa" : "");
                        var img = op.imagem && op.imagem !== "principal" ? op.imagem : (op.imagem === "principal" ? fotoPrincipal : "");
                        b.innerHTML =
                            '<span class="var-tile-foto">' + (img
                                ? '<img src="' + esc(img) + '" alt="" loading="lazy">'
                                : '<span class="var-cor" style="background:' + esc(op.cor || "#eee") + '"></span>') + "</span>" +
                            '<span class="var-tile-nome">' + (op.cor && img ? '<i style="background:' + esc(op.cor) + '"></i>' : "") + esc(op.nome) + "</span>" +
                            '<span class="var-tile-preco' + (op.confiavel ? "" : " duvida") + '">' + precoO + "</span>" + antigo;
                    } else {
                        b.className = "var-tam" + (ativa ? " ativa" : "");
                        b.innerHTML = "<b>" + esc(op.nome) + "</b><span class=\"var-tam-preco\">" + precoO + "</span>" + antigo;
                    }
                    b.setAttribute("aria-label", nv.titulo + " " + op.nome + " · " + precoO);
                    b.onclick = function () { sel[nv.campo] = op.nome; desenhar(idx); };
                    nv.caixa.appendChild(b);
                });
                nv.rotulo.innerHTML = nv.titulo + ": <b>" + esc(atualOp.nome) + "</b>" +
                    (atualOp === barata && ops.length > 1 && idx === niveis.length - 1 ? ' <span class="var-mais-barata">a mais barata</span>' : "");
                filtro[nv.campo] = atualOp.nome;
                if (nv.campo === "variacao") fotoCor = atualOp.imagem;
                ultima = atualOp;
            });
            var lista = ultima ? ultima.lista : todos;
            var fotoAnuncio = (lista.filter(function (a) { return a.imagem; })[0] || {}).imagem || "";
            var fotoV = fotoCor && fotoCor !== "principal" ? fotoCor : (fotoCor === "principal" ? "" : fotoAnuncio);
            trocarFoto(fotoV || fotoPrincipal);
            var nome = niveis.map(function (nv) { return sel[nv.campo]; }).filter(Boolean).join(" · ");
            mostrarLista(lista, nome, fotoV);
        }
        desenhar(0);
    }

    // 🎬 Reel da Yang ao lado da foto (ofertas com "video" no ofertas.json).
    // Toca sozinho, sem som e em loop; tocando nele abre em tela cheia com som.
    function montarVideo(atual) {
        if (!atual || !atual.video || document.querySelector(".oferta-midia")) return;
        var foto = document.querySelector("img.product");
        if (!foto) return;
        var alvo = foto.closest(".var-moldura") || foto;
        var linha = document.createElement("div");
        linha.className = "oferta-midia";
        alvo.parentNode.insertBefore(linha, alvo);
        var ladoFoto = document.createElement("div");
        ladoFoto.className = "midia-foto";
        ladoFoto.appendChild(alvo);
        linha.appendChild(ladoFoto);

        var caixa = document.createElement("button");
        caixa.type = "button";
        caixa.className = "midia-video";
        caixa.setAttribute("aria-label", "Ver o vídeo da Yang sobre este produto");
        var v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("preload", "none");
        if (atual.videoCapa) v.poster = base + atual.videoCapa;
        v.src = base + atual.video;
        caixa.appendChild(v);
        var selo = document.createElement("span");
        selo.className = "midia-selo";
        selo.textContent = "▶ Vídeo";
        caixa.appendChild(selo);
        linha.appendChild(caixa);

        // só começa a baixar/tocar quando aparece na tela
        function tocar() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (es) {
                es.forEach(function (e) { if (e.isIntersecting) tocar(); else v.pause(); });
            }, { threshold: .35 }).observe(caixa);
        } else tocar();

        caixa.onclick = function () { abrirVideo(base + atual.video, atual.videoCapa ? base + atual.videoCapa : ""); };
    }

    function abrirVideo(src, poster) {
        var fundo = document.createElement("div");
        fundo.className = "midia-tela";
        fundo.setAttribute("role", "dialog");
        fundo.setAttribute("aria-label", "Vídeo do produto");
        var v = document.createElement("video");
        v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
        v.setAttribute("playsinline", "");
        if (poster) v.poster = poster;
        var x = document.createElement("button");
        x.type = "button"; x.className = "midia-fechar"; x.textContent = "✕"; x.setAttribute("aria-label", "Fechar vídeo");
        fundo.appendChild(v); fundo.appendChild(x);
        document.body.appendChild(fundo);
        document.body.style.overflow = "hidden";
        var pequeno = document.querySelector(".midia-video video");
        if (pequeno) pequeno.pause();
        function fechar() {
            v.pause(); fundo.remove(); document.body.style.overflow = "";
            document.removeEventListener("keydown", tecla);
            if (pequeno) { var p = pequeno.play(); if (p && p.catch) p.catch(function () {}); }
        }
        function tecla(e) { if (e.key === "Escape") fechar(); }
        x.onclick = fechar;
        fundo.onclick = function (e) { if (e.target === fundo) fechar(); };
        document.addEventListener("keydown", tecla);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
    }

    function montar(todas) {
        var slug = slugAtual();
        var atual = todas.filter(function (o) { return o && o.slug === slug; })[0];
        try { montarAnuncios(atual); } catch (e) {}
        try { montarVideo(atual); } catch (e) {}
        // 🖤 selo Black November (a temporada.js pode chegar um pouco depois)
        (function seloBlack(tentativas) {
            var V = window.FarejadinhosVitrine;
            if (!window.FarejadinhosTemporada && tentativas > 0) { setTimeout(function () { seloBlack(tentativas - 1); }, 300); return; }
            if (window.FarejadinhosTemporada && window.FarejadinhosTemporada.pronto && !seloBlack.esperou) {
                seloBlack.esperou = true;
                window.FarejadinhosTemporada.pronto.then(function () { seloBlack(0); });
                return;
            }
            var preco = document.querySelector(".price");
            if (!atual || !V || !V.ehBlack || !V.ehBlack(atual) || !preco || document.querySelector(".selo-black-oferta")) return;
            var selo = document.createElement("div");
            selo.className = "selo-black-oferta";
            var pct = V.descontoPct(atual);
            selo.textContent = "🖤 OFERTA BLACK NOVEMBER" + (pct ? " · -" + pct + "%" : "");
            preco.parentNode.insertBefore(selo, preco);
        })(10);
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
