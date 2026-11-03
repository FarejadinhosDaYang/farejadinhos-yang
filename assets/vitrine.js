/* ==========================================
 * REGRA DA VITRINE — quais ofertas aparecem no site
 *
 * Usada pela vitrine (index.html) e pelo painel de ofertas
 * (painel/ofertas.html), pra os dois sempre concordarem.
 *
 * 1. Uma oferta só "começa" quando chega a hora de liberação
 *    (campo "liberacao"; se não tiver, vale a "data" de criação).
 *    Antes disso ela está AGENDADA e não aparece.
 * 2. Nas primeiras 24h depois de começar, ela é FRESCA: sempre aparece.
 * 3. Depois de 24h ela continua NO AR — as ofertas NÃO expiram mais por
 *    tempo (desde 03/11/2026): a conferência de preços passa em todas de
 *    hora em hora e a oferta fica enquanto a loja mostrar o preço.
 * 4. (Antes: reserva / mínimo por categoria.)
 * 5. Se a conferência passar 72h sem conseguir ler o preço (produto saiu
 *    da loja, link morto), a oferta some do site ("semPrecoDesde", gravado
 *    por gerador/marcar_disponibilidade.py) e o limpar-ofertas.ps1 tira do
 *    catálogo. Fixadas (📌) e permanentes não saem.
 *
 * 6. Categoria com MENOS DE 8 no ar não espera a vez na fila: as
 *    próximas ofertas agendadas DELA aparecem na hora até chegar a 8
 *    (como se cada categoria tivesse a sua própria fila). O total do
 *    site não tem teto: são ~10 por categoria, então quanto mais
 *    categorias, mais ofertas no ar.
 * 7. Categorias de ÉPOCA (ex.: Natal) só aparecem dentro do período
 *    delas (TEMPORADAS, abaixo, repete todo ano). Fora dele somem do
 *    site e do menu, e a vitrine fica com as outras categorias.
 *
 * 8. Categorias PERMANENTES (Vídeos e Celulares — produtos que têm vídeo
 *    postado na página) aparecem NA HORA (mesmo agendadas na fila do
 *    lote) e nunca expiram: ficam no site pra sempre, e a limpeza
 *    automática não apaga.
 *
 * Se mudar os números aqui, mude também no gerador/limpar-ofertas.ps1
 * e no gerador/gerar-lote.ps1.
 * ========================================== */

(function(){

  const MINIMO_VITRINE = 15;
  const HORAS_FRESCA = 24;
  const HORAS_MAXIMA = 72;
  const META_CATEGORIA = 10;
  const MINIMO_CATEGORIA = 8;

  // Categorias de época: só aparecem entre "inicio" e "fim" (mês-dia,
  // horário de Brasília, todo ano). Pra adicionar outra, ex.:
  //   "pascoa": { inicio: "03-01", fim: "04-20" }
  // (nome da categoria sem acento e em minúsculas)
  const TEMPORADAS = {
    "natal": { inicio: "09-01", fim: "12-25" }
  };

  // Categorias que nunca expiram (nome sem acento, minúsculo).
  // Mesma lista em gerador/limpar-ofertas.ps1.
  const PERMANENTES = ["videos", "celulares"];

  // "Vídeos" é uma categoria A MAIS: a oferta guarda as duas no campo
  // categoria, separadas por vírgula ("Cozinha, Vídeos"). Ao carregar,
  // normalizar() deixa em o.categoria só a principal ("Cozinha") e marca
  // o.temVideo = true — assim o resto do site continua igual.
  const TAG_VIDEO = "Vídeos";

  function normalizar(o){
    if(!o || o._catNorm) return o;
    const partes = String(o.categoria || "").split(",").map(s => s.trim()).filter(Boolean);
    const video = partes.some(p => chaveCategoria(p) === "videos");
    const outras = partes.filter(p => chaveCategoria(p) !== "videos");
    o.categoriaCompleta = o.categoria || "";
    o.temVideo = video;
    o.categoria = outras[0] || (video ? TAG_VIDEO : "");
    Object.defineProperty(o, "_catNorm", { value: true, enumerable: false });
    return o;
  }

  // ================= CELULARES e suas subcategorias =================
  // Dentro de "Celulares" aparecem: Samsung, Apple e Xiaomi (pela marca no
  // nome do aparelho — não precisa marcar nada) e Acessórios (categoria
  // própria "Acessórios de Celular", que segue as regras normais: expira,
  // recebe cupom, pode ir pro pódio). Filtro: "Celulares" (tudo, aparelhos
  // primeiro) ou "Celulares/Samsung", "Celulares/Acessórios"...
  const ACESSORIOS_CELULAR = "Acessórios de Celular";
  const MARCAS_CELULAR = [
    ["Apple", /\b(iphone|apple)\b/i],
    ["Samsung", /\b(samsung|galaxy)\b/i],
    ["Xiaomi", /\b(xiaomi|redmi|poco)\b/i]
  ];
  const SUBS_CELULAR = ["Samsung", "Apple", "Xiaomi", "Acessórios"];
  function subCelular(o){
    const cats = categoriasDe(o);
    if(cats.includes(ACESSORIOS_CELULAR)) return "Acessórios";
    if(!cats.includes("Celulares")) return "";
    const nome = String(o.produto || "");
    const m = MARCAS_CELULAR.find(([, re]) => re.test(nome));
    return m ? m[0] : "Outras marcas";
  }
  // categoria "de vitrine": acessório de celular conta como Celulares
  function grupoCategoria(c){ return c === ACESSORIOS_CELULAR ? "Celulares" : c; }
  function bateCategoria(o, filtro){
    filtro = String(filtro || "");
    const i = filtro.indexOf("/");
    if(i > 0){
      const mae = filtro.slice(0, i), sub = filtro.slice(i + 1);
      return mae === "Celulares" && subCelular(o) === sub;
    }
    return categoriasDe(o).some(c => c === filtro || grupoCategoria(c) === filtro);
  }
  // dentro de Celulares, aparelhos sempre em cima e acessórios embaixo
  function pesoNaCategoria(o){ return subCelular(o) === "Acessórios" ? 1 : 0; }
  function nomeFiltro(filtro){
    const i = String(filtro || "").indexOf("/");
    return i > 0 ? filtro.slice(0, i) + " · " + filtro.slice(i + 1) : String(filtro || "");
  }

  // Todas as categorias em que a oferta aparece (ex.: ["Cozinha", "Vídeos"])
  function categoriasDe(o){
    normalizar(o);
    const lista = o.categoria ? [o.categoria] : [];
    if(o.temVideo && !lista.includes(TAG_VIDEO)) lista.push(TAG_VIDEO);
    return lista;
  }

  // Monta o valor salvo: ("Cozinha", true) -> "Cozinha, Vídeos"
  function juntarCategoria(principal, video){
    principal = String(principal || "").trim();
    if(chaveCategoria(principal) === "videos") principal = "";
    if(!video) return principal;
    return principal ? principal + ", " + TAG_VIDEO : TAG_VIDEO;
  }

  function ehPermanente(oferta){
    normalizar(oferta);
    // "fixo": anúncio âncora fixado pelo painel (📌 Fixar no site)
    return !!(oferta && (oferta.fixo === true || oferta.temVideo || PERMANENTES.includes(chaveCategoria(oferta.categoria))));
  }

  // Categorias que nunca entram no Top 3 / pódio do dia (nem nos stories)
  const FORA_DO_PODIO = ["piscina", "celulares"];

  // Data usada pra ORDENAR ("mais recente primeiro"). Oferta que aparece
  // antes do horário marcado (Celulares, Vídeos, categoria completando o
  // mínimo) conta pela data em que foi cadastrada — senão ficaria "nova"
  // até o dia agendado e sempre no topo.
  function dataOrdem(oferta, agora){
    agora = agora || new Date();
    const i = inicio(oferta);
    if(!i) return 0;
    if(i <= agora) return i.getTime();
    const criada = new Date(oferta.data);
    return isNaN(criada) ? agora.getTime() : Math.min(criada.getTime(), agora.getTime());
  }

  // ================= VÁRIOS ANÚNCIOS DO MESMO PRODUTO =================
  // A oferta pode ter "anuncios": outros links do mesmo produto (outra
  // loja, outro vendedor) — [{ link, loja, preco, conferido, manual,
  // confirmado }]. O preço mostrado é o MENOR preço CONFIÁVEL na hora:
  //   - o anúncio principal (o link da oferta) sempre vale;
  //   - um extra só vale se tem preço E (foi posto à mão há até 7 dias OU a leitura
  //     automática deu o mesmo valor 2 vezes seguidas — "confirmado") E,
  //     se automático, foi conferido nas últimas 48h;
  //   - nunca vale se for menos da metade do principal (leitura absurda).
  const HORAS_ANUNCIO_VALIDO = 48;

  function numeroPreco(p){
    let s = String(p == null ? "" : p).replace(/[^\d.,]/g, "");
    if(!s) return 0;
    if(s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function lojaDe(link){
    const l = String(link || "");
    if(/shopee|shp\.ee/i.test(l)) return { id: "shopee", nome: "Shopee" };
    if(/mercadoli[vb]re|meli\.la/i.test(l)) return { id: "ml", nome: "Mercado Livre" };
    if(/amazon\.|amzn\./i.test(l)) return { id: "amazon", nome: "Amazon" };
    if(/magazineluiza|magalu/i.test(l)) return { id: "magalu", nome: "Magalu" };
    if(/aliexpress/i.test(l)) return { id: "ali", nome: "AliExpress" };
    return { id: "outra", nome: "Outra loja" };
  }

  // Lista de todos os anúncios da oferta (principal primeiro), com
  // "confiavel" e "motivo" calculados. Ordenada do mais barato pro mais caro.
  function anunciosDe(oferta, agora){
    agora = agora || new Date();
    const pPrincipal = numeroPreco(oferta.preco);
    const lista = [{
      principal: true, link: oferta.link, preco: oferta.preco, valor: pPrincipal,
      loja: lojaDe(oferta.link).nome, lojaId: lojaDe(oferta.link).id,
      conferido: oferta.precoConferido || oferta.precoManual || oferta.data || "",
      confiavel: pPrincipal > 0, motivo: "",
      variacao: String(oferta.variacao || "").trim(), cor: oferta.cor || "", imagem: ""
    }];
    (Array.isArray(oferta.anuncios) ? oferta.anuncios : []).forEach(a => {
      if(!a || !/^https?:\/\//i.test(a.link || "")) return;
      const valor = numeroPreco(a.preco);
      const quando = new Date(a.conferido || 0);
      const horas = isNaN(quando) ? Infinity : (agora - quando) / 3600000;
      // posto à mão vale por 7 dias; depois disso, só a conferência automática
      const m = new Date(a.manual || 0);
      const manual = !!a.manual && !isNaN(m) && (agora - m) <= 7 * 24 * 3600000;
      let motivo = "";
      if(!valor) motivo = "sem preço";
      else if(!manual && !a.confirmado) motivo = "a confirmar";
      else if(!manual && horas > HORAS_ANUNCIO_VALIDO) motivo = "preço antigo";
      else if(pPrincipal && valor < pPrincipal / 2) motivo = "preço estranho";
      const lj = lojaDe(a.link);
      lista.push({
        principal: false, link: a.link, preco: a.preco, valor,
        loja: a.loja || lj.nome, lojaId: lj.id, conferido: a.conferido || "",
        confiavel: !motivo, motivo,
        variacao: String(a.variacao || "").trim(), cor: a.cor || "",
        imagem: /^https?:\/\//i.test(a.imagem || "") ? a.imagem : ""
      });
    });
    return lista.sort((x, y) => (y.confiavel - x.confiavel) || ((x.valor || Infinity) - (y.valor || Infinity)));
  }

  // O anúncio de menor preço confiável (ou o principal, se não tiver extras)
  function melhorAnuncio(oferta, agora){
    const l = anunciosDe(oferta, agora);
    return l.find(a => a.confiavel) || l.find(a => a.principal);
  }

  // ---------- Variações (cor, tamanho...) ----------
  // Cada anúncio pode ter "variacao" (ex.: "Preto", "Azul", "512GB") e,
  // opcional, "cor" (#hex) e "imagem" (foto daquela cor). Anúncios da
  // mesma variação competem entre si pelo menor preço; variações
  // diferentes viram bolinhas na página do produto.
  const CORES = [
    [/laranja.?c[oó]smic/, "#E8742A"], [/tit[aâ]nio.?natural|natural/, "#B9B2A6"], [/tit[aâ]nio.?(preto|negro)|grafite|space|meia.?noite|midnight/, "#2F3133"],
    [/tit[aâ]nio.?branco|estelar|starlight/, "#ECE7DF"], [/tit[aâ]nio.?deserto|deserto/, "#C9A887"], [/tit[aâ]nio/, "#A8A39A"],
    [/azul.?(marinho|escuro|profundo)|navy/, "#1F2F5C"], [/azul.?(claro|beb[eê]|c[eé]u)/, "#9CC8F0"], [/azul|blue/, "#2563EB"],
    [/verde.?(menta|claro|[aá]gua)/, "#9EDBC4"], [/verde|green/, "#1F8A4C"], [/roxo|lil[aá]s|lavanda|purple|violeta/, "#8E6CC9"],
    [/rosa|pink/, "#F2A7C3"], [/vermelh|red|vinho|bord[oô]/, "#D02A2F"], [/laranja|orange/, "#F28C28"], [/amarel|yellow/, "#F7D23E"],
    [/dourad|gold|ouro/, "#D4AF37"], [/prata|silver|prateado/, "#C7CBD1"], [/cinza|gray|grey/, "#8C9096"], [/bege|creme|nude|areia/, "#E3D3B5"],
    [/marrom|caf[eé]|chocolate|brown/, "#7A4E2D"], [/branc|white/, "#F7F7F7"], [/pret|black|negro/, "#151515"], [/inox|a[cç]o/, "#BFC3C7"]
  ];
  function corDe(nome, cor){
    if(/^#[0-9a-f]{3,8}$/i.test(String(cor || "").trim())) return String(cor).trim();
    const n = String(nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for(const [re, hex] of CORES){
      const r = new RegExp(re.source.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      if(r.test(n)) return hex;
    }
    return "";
  }
  const chaveVar = v => String(v || "").trim().toLowerCase();

  // [{ nome, cor, imagem, melhor, lista, confiavel }], mais barata primeiro.
  // Só faz sentido com 2+ variações; com 0/1 devolve [].
  function variacoesDe(oferta, agora){
    const l = anunciosDe(oferta, agora);
    const principal = l.find(a => a.principal);
    // anúncio sem variação herda a do principal (mesmo produto)
    l.forEach(a => { if(!a.variacao) a.variacao = principal.variacao; });
    const grupos = {};
    l.forEach(a => {
      const k = chaveVar(a.variacao);
      (grupos[k] = grupos[k] || { nome: a.variacao, cor: "", imagem: "", lista: [] }).lista.push(a);
    });
    const vs = Object.values(grupos).filter(g => g.nome);
    if(vs.length < 2) return [];
    vs.forEach(g => {
      g.melhor = g.lista.find(a => a.confiavel) || g.lista[0];
      g.confiavel = !!g.lista.find(a => a.confiavel);
      g.cor = corDe(g.nome, (g.lista.find(a => a.cor) || {}).cor);
      const comFoto = g.lista.find(a => a.principal) && !g.lista.some(a => a.imagem) ? null : g.lista.find(a => a.imagem);
      g.imagem = comFoto ? comFoto.imagem : (g.lista.some(a => a.principal) ? "principal" : "");
      g.temPrincipal = g.lista.some(a => a.principal);
    });
    return vs.sort((x, y) => (y.confiavel - x.confiavel) || ((x.melhor.valor || Infinity) - (y.melhor.valor || Infinity)));
  }

  // Cópia da oferta pra MOSTRAR no site (card/página): preço e link do
  // melhor anúncio + quantos anúncios tem. Não altera a oferta original.
  function comMelhorAnuncio(oferta, agora){
    const l = anunciosDe(oferta, agora);
    if(l.length < 2) return oferta;
    const m = l.find(a => a.confiavel) || l[0];
    const copia = Object.assign({}, oferta);
    if(!m.principal){
      copia.preco = m.preco && /^R\$/.test(String(m.preco)) ? m.preco : "R$ " + m.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      copia.link = m.link;
      // o "de R$ X" do principal não vale pro outro anúncio
      copia.precoAntigo = "";
    }
    copia.totalAnuncios = l.filter(a => a.confiavel).length;
    copia.lojaMelhor = m.loja;
    const vs = variacoesDe(oferta, agora);
    if(vs.length > 1){
      copia.variacoes = vs.map(v => ({ nome: v.nome, cor: v.cor }));
      copia.variacaoMelhor = m.variacao || (vs.find(v => v.lista.includes(m)) || {}).nome || "";
      copia.aPartirDe = vs.some(v => v.confiavel && v.melhor.valor > m.valor + 0.009);
      // a foto do card acompanha a variação mais barata, se ela tiver foto própria
      if(m.imagem) copia.imagemUrl = m.imagem;
    }
    return copia;
  }

  // ================= BLACK NOVEMBER =================
  // Oferta "Black": marcada no painel (black: true) OU com desconto de
  // pelo menos BLACK_DESCONTO_MIN% (preço antigo x preço). Só vale enquanto
  // a temporada está ativa (assets/temporada.js); fora dela, nada muda.
  const BLACK_DESCONTO_MIN = 40;
  function descontoPct(o){
    const p = numeroPreco(o && o.preco), a = numeroPreco(o && o.precoAntigo);
    const proprio = a > p && p > 0 ? Math.round((1 - p / a) * 100) : 0;
    // temporada/black.json: desconto mostrado pela loja (Radar) ou queda no histórico
    const lista = (typeof window !== "undefined" && window.FarejadinhosBlackLista) || {};
    return Math.max(proprio, (o && lista[o.slug]) || 0);
  }
  function ehBlack(o){
    const T = typeof window !== "undefined" && window.FarejadinhosTemporada;
    if(!o || !T || !T.ativa()) return false;
    if(o.black === false) return false;          // tirado à mão
    const lista = window.FarejadinhosBlackLista || {};
    // na lista diária já entra quem tem ≥40% na loja ou caiu ≥20% no histórico
    return o.black === true || !!lista[o.slug] || descontoPct(o) >= BLACK_DESCONTO_MIN;
  }

  function podeIrProPodio(oferta){
    // âncora fixa não disputa o pódio (senão ganhava todo dia e o Top 3 não renovava)
    if(oferta && oferta.fixo === true) return false;
    return !FORA_DO_PODIO.includes(chaveCategoria(oferta && oferta.categoria));
  }

  function chaveCategoria(c){
    return String(c || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function foraDeEpoca(oferta, agora){
    const t = TEMPORADAS[chaveCategoria(oferta.categoria)];
    if(!t) return false;
    const br = new Date(agora.getTime() - 3 * 60 * 60 * 1000);   // Brasília (UTC-3)
    const md = String(br.getUTCMonth() + 1).padStart(2, "0") + "-" + String(br.getUTCDate()).padStart(2, "0");
    return t.inicio <= t.fim ? !(md >= t.inicio && md <= t.fim) : !(md >= t.inicio || md <= t.fim);
  }

  function inicio(oferta){
    const d = new Date(oferta.liberacao || oferta.data);
    return isNaN(d) ? null : d;
  }

  // horas desde que a oferta começou (negativo = ainda agendada;
  // sem data válida conta como recém-publicada)
  function idadeHoras(oferta, agora){
    const i = inicio(oferta);
    return i ? (agora - i) / (1000 * 60 * 60) : 0;
  }

  function selecionar(todas, agora){

    agora = agora || new Date();

    const todasValidas = (Array.isArray(todas) ? todas : [todas]).filter(o => o && o.slug).map(normalizar).filter(o => !foraDeEpoca(o, agora));

    // Permanentes (ex.: Vídeos): sempre no ar, na hora, sem esperar a
    // fila e fora das regras de validade
    const permanentes = todasValidas.filter(o => ehPermanente(o));
    const validas = todasValidas.filter(o => !ehPermanente(o));

    // OFERTAS SEM PRAZO (desde 03/11/2026): com a conferência de preços de
    // hora em hora, a oferta liberada fica no ar enquanto a loja mostrar o
    // preço. Só sai quando a conferência passa HORAS_SEM_PRECO sem conseguir
    // ler (campo "semPrecoDesde", gravado por gerador/marcar_disponibilidade.py).
    const liberadas = validas.filter(o => idadeHoras(o, agora) >= 0 && !indisponivel(o, agora));

    const frescas = liberadas.filter(o => idadeHoras(o, agora) <= HORAS_FRESCA);
    // "reserva" agora = no ar há mais de 24h (continua aparecendo)
    let reserva = liberadas.filter(o => idadeHoras(o, agora) > HORAS_FRESCA);
    const categoria = o => (o.categoria || "").trim() || "-";

    // Categoria com menos de MINIMO_CATEGORIA no ar: puxa as próximas
    // agendadas dela (as que sairiam primeiro) pra aparecer já
    const noAr = {};
    frescas.concat(reserva).forEach(o => { noAr[categoria(o)] = 1 + (noAr[categoria(o)] || 0); });
    const adiantadas = [];
    const agendadasPorCat = {};
    validas.filter(o => idadeHoras(o, agora) < 0 && !ehPermanente(o)).forEach(o => {
      (agendadasPorCat[categoria(o)] = agendadasPorCat[categoria(o)] || []).push(o);
    });
    Object.keys(agendadasPorCat).forEach(cat => {
      const faltam = MINIMO_CATEGORIA - (noAr[cat] || 0);
      if(faltam <= 0) return;
      agendadasPorCat[cat]
        .sort((a, b) => idadeHoras(b, agora) - idadeHoras(a, agora))
        .slice(0, faltam)
        .forEach(o => adiantadas.push(o));
    });

    return {
      visiveis: frescas.concat(reserva, adiantadas, permanentes),
      permanentes: new Set(permanentes),
      frescas: new Set(frescas),
      reserva: new Set(reserva),
      adiantadas: new Set(adiantadas)
    };
  }

  // status de uma oferta, pro painel:
  // "agendada" | "adiantada" | "fresca" | "reserva" | "fora" (reserva que não coube) | "expirada" | "foraDeEpoca"
  // sem preço na loja há mais de HORAS_SEM_PRECO: some do site
  const HORAS_SEM_PRECO = 72;
  function indisponivel(oferta, agora){
    if(!oferta || !oferta.semPrecoDesde || oferta.fixo === true) return false;
    const d = new Date(oferta.semPrecoDesde);
    return !isNaN(d) && ((agora || new Date()) - d) / 3600000 > HORAS_SEM_PRECO;
  }

  function status(oferta, selecao, agora){
    agora = agora || new Date();
    const h = idadeHoras(oferta, agora);
    normalizar(oferta);
    if(foraDeEpoca(oferta, agora)) return "foraDeEpoca";
    if(indisponivel(oferta, agora) && !(selecao.permanentes && selecao.permanentes.has(oferta))) return "indisponivel";
    if(selecao.permanentes && selecao.permanentes.has(oferta)) return "permanente";
    if(selecao.adiantadas && selecao.adiantadas.has(oferta)) return "adiantada";
    if(selecao.permanentes && selecao.permanentes.has(oferta)) return "permanente";
    if(h < 0) return "agendada";
    if(selecao.frescas.has(oferta)) return "fresca";
    if(selecao.reserva.has(oferta)) return "noar";
    if(h > HORAS_MAXIMA) return "expirada";
    return "fora";
  }

  window.FarejadinhosVitrine = {
    MINIMO_VITRINE, HORAS_FRESCA, HORAS_MAXIMA, META_CATEGORIA, MINIMO_CATEGORIA, TEMPORADAS,
    inicio, idadeHoras, selecionar, status, indisponivel, HORAS_SEM_PRECO, foraDeEpoca, podeIrProPodio, FORA_DO_PODIO, dataOrdem, anunciosDe, melhorAnuncio, comMelhorAnuncio, lojaDe, numeroPreco, variacoesDe, corDe, ehPermanente, ACESSORIOS_CELULAR, SUBS_CELULAR, subCelular, grupoCategoria, bateCategoria, pesoNaCategoria, nomeFiltro, ehBlack, descontoPct, BLACK_DESCONTO_MIN, PERMANENTES, normalizar, categoriasDe, juntarCategoria, TAG_VIDEO
  };

})();
