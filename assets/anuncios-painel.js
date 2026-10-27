/* Farejadinhos da Yang — "🏪 Outros anúncios deste produto" (comparador)
 * Usado no painel de ofertas (painel/ofertas.html) e no modo admin da
 * página da oferta (assets/admin.js). Precisa do assets/vitrine.js.
 *   FarejadinhosAnunciosPainel.montar(oferta, elemento)
 * Adicionar/remover/editar vai pelo /lote (acao "anuncios" ->
 * gerador/anuncios.py); o preço dos extras é conferido de hora em hora.
 */
(function(){
const WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev";
function esc(t){ const d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
function senhaPainel(){
  const c = document.getElementById("senha");
  let v = c && c.value.trim();
  if(!v){ try{ v = localStorage.getItem("farejadinhos_admin_senha") || ""; }catch(e){} }
  return v || "";
}
const css = document.createElement("style");
css.textContent = `.anunciosBox{margin-top:16px;padding-top:12px;border-top:1.5px dashed var(--line)}
.anunciosBox h4{margin:0 0 4px;font:800 15px 'Baloo 2',sans-serif}
.anunciosBox .ancObs{font-size:12px;color:var(--muted);margin-bottom:8px}
.anunciosBox .ancLinha{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:7px 10px;margin-bottom:6px;font-size:13px}
.anunciosBox .ancLinha.melhor{border-color:#2E9E5B;background:#F2FBF5}
.anunciosBox .ancLinha a{color:inherit;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.anunciosBox .ancLinha b{white-space:nowrap}
.anunciosBox .ancLinha small{color:var(--muted);white-space:nowrap}
.anunciosBox .ancTirar{border:0;background:none;cursor:pointer;font-size:15px;padding:0 4px}
.anunciosBox .ancNovo{display:flex;gap:6px;margin-top:8px}
.anunciosBox .ancNovo input{flex:1;margin:0}
.anunciosBox .ancNovo .ancPreco{flex:0 0 110px}
.anunciosBox .ancBtn{border:0;border-radius:9px;padding:9px 12px;background:var(--orange);color:var(--ink);font-weight:800;cursor:pointer;white-space:nowrap}
.anunciosBox .ancBtn:disabled{opacity:.6;cursor:wait}
.anunciosBox .ancCor{display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--c);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25);margin-right:3px;vertical-align:-1px}
.anunciosBox .ancMsg{font-size:12.5px;font-weight:600;margin-top:6px}
.anunciosBox{min-width:0;max-width:100%;grid-column:1/-1;--line:#F0DFC4;--muted:#8A7563;--orange:#F7941D;--ink:#2B1B12;--red-dark:#C21A24;color:var(--ink);font-family:'Work Sans',sans-serif;text-align:left}
.anunciosBox input{box-sizing:border-box;padding:9px 10px;border:1.5px solid #F0DFC4;border-radius:9px;font:500 13.5px 'Work Sans',sans-serif;background:#fff;min-width:0}
.anunciosBox .ancBtn{background:#F7941D}`;
css.textContent += `
.anunciosBox .ancJuntar{margin-top:14px;padding-top:10px;border-top:1px dashed var(--line)}
.anunciosBox .ancSub{font-size:13px;margin-bottom:6px}
.anunciosBox .ancBuscaOferta{width:100%}
.anunciosBox .ancOpcao{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-top:6px}
.anunciosBox .ancOpcao img{width:40px;height:40px;object-fit:contain;border-radius:6px;flex:0 0 40px}
.anunciosBox .ancOpcaoTxt{flex:1;min-width:0;font-size:13px}
.anunciosBox .ancOpcaoTxt b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.anunciosBox .ancOpcaoTxt small{color:var(--muted)}
.anunciosBox .ancJuntarBtn{flex:0 0 auto;padding:7px 10px!important;font-size:12.5px}`;
css.textContent += `
.anunciosBox .ancEdVar{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 8px;padding:8px;background:#FFF6E9;border:1px dashed var(--line);border-radius:10px}
.anunciosBox .ancEdVar[hidden]{display:none}
.anunciosBox .ancEdVar .edVar,.anunciosBox .ancEdVar .edFoto{flex:1 1 180px}
.anunciosBox .ancEdVar .edCor{flex:0 0 44px;height:38px;padding:2px}`;
document.head.appendChild(css);

// ============ Outros anúncios do mesmo produto (comparador) ============
// O site mostra sempre o MENOR preço confiável entre o link principal e
// estes anúncios (regra em assets/vitrine.js). Adicionar/remover vai pelo
// /lote (acao "anuncios" -> gerador/anuncios.py); o preço dos extras é
// conferido de hora em hora (gerador/conferir-anuncios.py).
async function pedirAnuncio(item){
  const senha = senhaPainel();
  if(!senha) throw new Error("Digite a senha do painel primeiro.");
  const dados = new FormData();
  dados.append("senha", senha);
  dados.append("itens", JSON.stringify([Object.assign({ acao: "anuncios" }, item)]));
  const r = await fetch(WORKER_URL + "/lote", { method: "POST", body: dados });
  const texto = await r.text();
  if(r.status === 401) throw new Error("Senha incorreta.");
  if(!r.ok) throw new Error(texto);
}

function montarAnunciosPainel(o, box){
  box.classList.add("anunciosBox");
  const V = window.FarejadinhosVitrine;
  if(!box || !V || !V.anunciosDe) return;
  const lista = V.anunciosDe(o, new Date());
  const melhor = lista.find(a => a.confiavel) || lista[0];
  const fmt = a => a.valor ? "R$ " + a.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "sem preço";
  box.innerHTML = `
    <h4>🏪 Outros anúncios deste produto</h4>
    <div class="ancObs">O site mostra sempre o menor preço confiável entre todos. Preço posto aqui vale por 7 dias; depois a conferência automática assume (preço novo só vale depois de 2 leituras iguais).</div>
    ${lista.length > 1 ? lista.map(a => `
      <div class="ancLinha${a === melhor ? " melhor" : ""}">
        <span>${a.principal ? "⭐" : "🏪"}</span>
        ${a.imagem ? `<img src="${esc(a.imagem)}" alt="" style="width:26px;height:26px;object-fit:contain;border-radius:6px;background:#fff">` : ""}
        <a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.loja)}${a.principal ? " (principal)" : ""}${a.variacao ? ` · <span class="ancCor" style="--c:${esc(V.corDe(a.variacao, a.cor) || "transparent")}"></span>${esc(a.variacao)}` : ""}</a>
        <b>${fmt(a)}</b>
        <small>${a === melhor ? "✅ no site" : a.confiavel ? "" : esc(a.motivo)}</small>
        ${a.principal ? "" : `<button class="ancTirar ancEditarVar" type="button" title="Cor/versão e foto deste anúncio" data-link="${esc(a.link)}">🎨</button><button class="ancTirar" data-tirar="1" type="button" title="Tirar este anúncio" data-link="${esc(a.link)}">🗑️</button>`}
      </div>
      ${a.principal ? "" : `<div class="ancEdVar" data-link="${esc(a.link)}" hidden>
        <input type="text" class="edVar" placeholder="Cor/versão (ex.: Lilás) — vazio = mesma do principal" value="${esc(a.variacao || "")}">
        <input type="color" class="edCor" value="${esc(V.corDe(a.variacao, a.cor) || "#cccccc")}" title="Cor da bolinha">
        <input type="text" class="edFoto" placeholder="Foto desta cor (link da imagem)" value="${esc(a.imagem || "")}">
        <button class="ancBtn edSalvar" type="button">💾 Salvar</button>
      </div>`}`).join("") : ""}
    <div class="ancNovo">
      <input type="text" class="ancVarPrincipal" placeholder="Cor/versão do anúncio principal (ex.: Preto)" value="${esc(o.variacao || "")}">
      <button class="ancBtn ancSalvarVar" type="button">Salvar</button>
    </div>
    <div class="ancNovo">
      <input type="text" class="ancLink" placeholder="Colar link de outro anúncio">
      <input type="text" class="ancPreco" placeholder="Preço">
      <button class="ancBtn ancBuscar" type="button" title="Ler preço e foto do link">🔎</button>
    </div>
    <div class="ancNovo">
      <input type="text" class="ancVar" placeholder="Cor/versão deste anúncio (ex.: Azul) — vazio = mesma do principal">
      <input type="color" class="ancCorHex" title="Cor da bolinha (automática pelo nome)" style="flex:0 0 44px;padding:2px;height:40px">
    </div>
    <div class="ancNovo">
      <input type="text" class="ancFoto" placeholder="Foto desta cor (link da imagem, opcional — o 🔎 preenche)">
      <img class="ancFotoPrev" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid var(--line);display:none">
    </div>
    <button class="ancBtn ancAdd" type="button" style="width:100%;margin-top:6px">➕ Adicionar anúncio</button>
    <div class="ancJuntar">
      <div class="ancSub">…ou escolha uma oferta que <b>já está no site</b>:</div>
      <input type="search" class="ancBuscaOferta" placeholder="🔎 Procurar oferta do site pelo nome">
      <div class="ancResultados"></div>
    </div>
    <div class="ancMsg"></div>`;
  const msg = box.querySelector(".ancMsg");

  // ---------- escolher uma oferta que já está no site ----------
  const jaLigados = new Set(V.anunciosDe(o, new Date()).map(a => a.link));
  let catalogo = null;
  const lerCatalogo = () => catalogo ? Promise.resolve(catalogo) :
    fetch("/ofertas.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.json()).then(d => (catalogo = Array.isArray(d) ? d : []))
      .catch(() => (catalogo = []));
  const semAcento = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const resultados = box.querySelector(".ancResultados");
  function listarParecidas(termo){
    lerCatalogo().then(todas => {
      const palavras = semAcento(termo).split(/\s+/).filter(p => p.length > 1);
      // sem busca: sugere as de nome parecido com este produto
      const base = palavras.length ? palavras : semAcento(o.produto).split(/\s+/).filter(p => p.length > 3).slice(0, 4);
      const pontos = x => base.filter(p => semAcento(x.produto).includes(p)).length;
      const lista = todas
        .filter(x => x && x.slug !== o.slug && x.link && !jaLigados.has(x.link) && x.produto)
        .map(x => [x, pontos(x)])
        .filter(([x, n]) => palavras.length ? n === palavras.length : n >= Math.min(2, base.length))
        .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x);
      resultados.innerHTML = lista.length ? lista.map((x, i) => `
        <div class="ancOpcao">
          <img src="/assets/${encodeURIComponent(x.imagem || "")}" alt="" onerror="this.style.visibility='hidden'">
          <div class="ancOpcaoTxt"><b>${esc(x.produto)}</b><small>${esc(x.preco || "")} · ${esc(V.lojaDe(x.link).nome)}${x.categoria ? " · " + esc(x.categoria) : ""}</small></div>
          <button class="ancBtn ancJuntarBtn" type="button" data-i="${i}">🔗 Juntar</button>
        </div>`).join("")
        : `<div class="ancObs">${palavras.length ? "Nenhuma oferta do site com esse nome." : "Digite o nome pra procurar uma oferta do site."}</div>`;
      resultados.querySelectorAll(".ancJuntarBtn").forEach(b => b.onclick = () => juntar(lista[+b.dataset.i], b));
    });
  }
  async function juntar(outra, botao){
    const variacao = prompt(`Juntar "${outra.produto}" (${outra.preco}) a este produto.\n\nÉ outra cor/versão? Escreva qual (ex.: Azul, 512GB).\nSe for o MESMO produto em outra loja/anúncio, deixe vazio.`, "");
    if(variacao === null) return;
    const tirar = confirm(`Tirar "${outra.produto}" da vitrine do site?\n\nOK = ela some como oferta separada e fica só como anúncio deste produto (recomendado, evita repetido).\nCancelar = continua também como oferta separada.`);
    botao.disabled = true; botao.textContent = "Juntando...";
    try{
      await pedirAnuncio({ op: "juntar", slug: o.slug, de: outra.slug, variacao: variacao.trim(),
        cor: variacao.trim() ? (V.corDe(variacao) || "") : "", tirar });
      jaLigados.add(outra.link);
      botao.textContent = "✅ Juntado";
      aviso(`✅ "${outra.produto}" virou anúncio deste produto${tirar ? " e sai da vitrine" : ""}. Aparece no site em 1-2 minutos.` +
        (variacao.trim() && !o.variacao ? " Dica: salve também a cor do anúncio principal." : ""));
    }catch(e){ aviso("❌ " + e.message, true); botao.disabled = false; botao.textContent = "🔗 Juntar"; }
  }
  const busca = box.querySelector(".ancBuscaOferta");
  busca.addEventListener("input", function(){ clearTimeout(this._t); this._t = setTimeout(() => listarParecidas(this.value), 200); });
  busca.addEventListener("focus", function(){ if(!resultados.innerHTML) listarParecidas(this.value); }, { once: true });
  const aviso = (t, erro) => { msg.style.color = erro ? "var(--red-dark)" : "#1F7A44"; msg.textContent = t; };

  box.querySelector(".ancBuscar").onclick = async function(){
    const link = box.querySelector(".ancLink").value.trim();
    const senha = senhaPainel();
    if(!/^https?:\/\//i.test(link)) return aviso("Cole o link do anúncio primeiro.", true);
    if(!senha) return aviso("Digite a senha do painel primeiro.", true);
    this.disabled = true; aviso("Lendo o preço na loja...");
    try{
      const dados = new FormData(); dados.append("senha", senha); dados.append("link", link);
      const r = await fetch(WORKER_URL + "/produto", { method: "POST", body: dados });
      const j = await r.json().catch(() => ({}));
      if(r.status === 401) throw new Error("Senha incorreta.");
      if(j.imagemUrl && !box.querySelector(".ancFoto").value){ box.querySelector(".ancFoto").value = j.imagemUrl; box.querySelector(".ancFoto").dispatchEvent(new Event("input")); }
      if(j.preco){ box.querySelector(".ancPreco").value = j.preco; aviso("Preço lido: " + j.preco + (j.produto ? " — " + j.produto.slice(0, 60) : "") + ". Confira na loja antes de adicionar."); }
      else aviso("Não consegui ler o preço desse link — digite à mão.", true);
    }catch(e){ aviso("❌ " + e.message, true); }
    this.disabled = false;
  };

  box.querySelector(".ancAdd").onclick = async function(){
    const link = box.querySelector(".ancLink").value.trim();
    const preco = box.querySelector(".ancPreco").value.trim();
    if(!/^https?:\/\//i.test(link)) return aviso("Cole o link do anúncio.", true);
    if(link === o.link) return aviso("Esse já é o link principal da oferta.", true);
    if(!V.numeroPreco(preco)) return aviso("Coloque o preço (ou toque em 🔎 pra ler da loja).", true);
    const principal = V.numeroPreco(o.preco);
    const valor = V.numeroPreco(preco);
    if(principal && (valor < principal / 2 || valor > principal * 2) &&
       !confirm(`O preço ${preco} é muito diferente do principal (${o.preco}). É mesmo o mesmo produto?`)) return;
    this.disabled = true; this.textContent = "Enviando...";
    try{
      const variacao = box.querySelector(".ancVar").value.trim();
      const corHex = box.querySelector(".ancCorHex");
      await pedirAnuncio({ op: "adicionar", slug: o.slug, link, preco, loja: V.lojaDe(link).nome,
        variacao, cor: variacao && corHex.dataset.mexeu ? corHex.value : "",
        imagem: variacao ? box.querySelector(".ancFoto").value.trim() : "" });
      aviso("✅ Anúncio enviado! Aparece no site em 1-2 minutos." + (variacao && !o.variacao ? " Dica: preencha também a cor do anúncio principal." : ""));
      ["ancLink", "ancPreco", "ancVar", "ancFoto"].forEach(c => box.querySelector("." + c).value = "");
      box.querySelector(".ancFotoPrev").style.display = "none"; delete corHex.dataset.mexeu;
    }catch(e){ aviso("❌ " + e.message, true); }
    this.disabled = false; this.textContent = "➕ Adicionar anúncio";
  };

  // cor da bolinha: automática pelo nome, a menos que você escolha
  const corHex = box.querySelector(".ancCorHex");
  box.querySelector(".ancVar").addEventListener("input", function(){
    if(!corHex.dataset.mexeu) corHex.value = V.corDe(this.value) || "#cccccc";
  });
  corHex.addEventListener("input", function(){ this.dataset.mexeu = "1"; });
  box.querySelector(".ancFoto").addEventListener("input", function(){
    const prev = box.querySelector(".ancFotoPrev");
    if(/^https?:\/\//i.test(this.value.trim())){ prev.src = this.value.trim(); prev.style.display = ""; } else prev.style.display = "none";
  });
  box.querySelector(".ancSalvarVar").onclick = async function(){
    this.disabled = true;
    try{
      await pedirAnuncio({ op: "editar", slug: o.slug, link: o.link, variacao: box.querySelector(".ancVarPrincipal").value.trim() });
      aviso("✅ Cor do anúncio principal salva! Aparece no site em 1-2 minutos.");
    }catch(e){ aviso("❌ " + e.message, true); }
    this.disabled = false;
  };

  // 🎨 cor/versão e foto de um anúncio que já está aqui
  box.querySelectorAll(".ancEditarVar").forEach(b => b.onclick = function(){
    const ed = [...box.querySelectorAll(".ancEdVar")].find(x => x.dataset.link === b.dataset.link);
    if(ed) ed.hidden = !ed.hidden;
  });
  box.querySelectorAll(".ancEdVar").forEach(ed => {
    const cor = ed.querySelector(".edCor");
    ed.querySelector(".edVar").addEventListener("input", function(){ if(!cor.dataset.mexeu) cor.value = V.corDe(this.value) || "#cccccc"; });
    cor.addEventListener("input", function(){ this.dataset.mexeu = "1"; });
    ed.querySelector(".edSalvar").onclick = async function(){
      const variacao = ed.querySelector(".edVar").value.trim();
      this.disabled = true;
      try{
        await pedirAnuncio({ op: "editar", slug: o.slug, link: ed.dataset.link, variacao,
          cor: variacao && cor.dataset.mexeu ? cor.value : "", imagem: ed.querySelector(".edFoto").value.trim() });
        aviso("✅ Salvo! Aparece no site em 1-2 minutos." + (variacao && !o.variacao ? " Dica: preencha também a cor do anúncio principal." : ""));
        ed.hidden = true;
      }catch(e){ aviso("❌ " + e.message, true); }
      this.disabled = false;
    };
  });

  box.querySelectorAll(".ancTirar[data-tirar]").forEach(b => b.onclick = async function(){
    if(!confirm("Tirar este anúncio da oferta?")) return;
    this.disabled = true;
    try{
      await pedirAnuncio({ op: "remover", slug: o.slug, link: this.dataset.link });
      this.closest(".ancLinha").style.opacity = ".4";
      aviso("✅ Pedido enviado — some do site em 1-2 minutos.");
    }catch(e){ aviso("❌ " + e.message, true); this.disabled = false; }
  });
}


window.FarejadinhosAnunciosPainel = { montar: montarAnunciosPainel };
})();
