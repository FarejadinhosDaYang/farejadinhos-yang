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
 * 3. Depois de 24h ela vira RESERVA: só aparece se faltar oferta
 *    fresca pra completar o mínimo de 15 no site (as reservas mais
 *    novas entram primeiro).
 * 4. Cada CATEGORIA tenta ter pelo menos 10 no ar: se tiver menos
 *    de 10 frescas, as mais novas da reserva daquela categoria
 *    completam.
 * 5. Depois de 72h (3 dias) ela EXPIRA — a não ser que a categoria
 *    dela não tenha nada na fila (nenhuma agendada): aí ela continua
 *    segurando a categoria até chegar oferta nova. O limpar-ofertas.ps1
 *    só tira do ofertas.json as que não aparecem mais.
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

  // Categorias que nunca entram no Top 3 / pódio do dia (nem nos stories)
  const FORA_DO_PODIO = ["piscina"];

  function podeIrProPodio(oferta){
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

    const validas = (Array.isArray(todas) ? todas : [todas]).filter(o => o && o.slug && !foraDeEpoca(o, agora));

    const liberadas = validas.filter(o => idadeHoras(o, agora) >= 0);

    const frescas = liberadas.filter(o => idadeHoras(o, agora) <= HORAS_FRESCA);

    const categoria = o => (o.categoria || "").trim() || "-";

    // categorias que têm oferta esperando na fila
    const comFila = new Set(validas.filter(o => idadeHoras(o, agora) < 0).map(categoria));

    // cada categoria completa até META_CATEGORIA com as mais novas da reserva
    const escolhidas = new Set();
    const porCategoria = {};
    liberadas.forEach(o => { (porCategoria[categoria(o)] = porCategoria[categoria(o)] || []).push(o); });
    Object.keys(porCategoria).forEach(cat => {
      const lista = porCategoria[cat];
      const nFrescas = lista.filter(o => frescas.includes(o)).length;
      if(nFrescas >= META_CATEGORIA) return;
      lista
        .filter(o => {
          const h = idadeHoras(o, agora);
          return h > HORAS_FRESCA && (h <= HORAS_MAXIMA || !comFila.has(cat));
        })
        .sort((a, b) => idadeHoras(a, agora) - idadeHoras(b, agora))
        .slice(0, META_CATEGORIA - nFrescas)
        .forEach(o => escolhidas.add(o));
    });

    let reserva = Array.from(escolhidas);

    if(frescas.length + reserva.length < MINIMO_VITRINE){
      reserva = liberadas
        .filter(o => {
          const h = idadeHoras(o, agora);
          return h > HORAS_FRESCA && h <= HORAS_MAXIMA && !escolhidas.has(o);
        })
        .sort((a, b) => idadeHoras(a, agora) - idadeHoras(b, agora))
        .slice(0, MINIMO_VITRINE - frescas.length - reserva.length)
        .forEach(o => reserva.push(o));
    }

    // Categoria com menos de MINIMO_CATEGORIA no ar: puxa as próximas
    // agendadas dela (as que sairiam primeiro) pra aparecer já
    const noAr = {};
    frescas.concat(reserva).forEach(o => { noAr[categoria(o)] = 1 + (noAr[categoria(o)] || 0); });
    const adiantadas = [];
    const agendadasPorCat = {};
    validas.filter(o => idadeHoras(o, agora) < 0).forEach(o => {
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
      visiveis: frescas.concat(reserva, adiantadas),
      frescas: new Set(frescas),
      reserva: new Set(reserva),
      adiantadas: new Set(adiantadas)
    };
  }

  // status de uma oferta, pro painel:
  // "agendada" | "adiantada" | "fresca" | "reserva" | "fora" (reserva que não coube) | "expirada" | "foraDeEpoca"
  function status(oferta, selecao, agora){
    agora = agora || new Date();
    const h = idadeHoras(oferta, agora);
    if(foraDeEpoca(oferta, agora)) return "foraDeEpoca";
    if(selecao.adiantadas && selecao.adiantadas.has(oferta)) return "adiantada";
    if(h < 0) return "agendada";
    if(selecao.frescas.has(oferta)) return "fresca";
    if(selecao.reserva.has(oferta)) return "reserva";
    if(h > HORAS_MAXIMA) return "expirada";
    return "fora";
  }

  window.FarejadinhosVitrine = {
    MINIMO_VITRINE, HORAS_FRESCA, HORAS_MAXIMA, META_CATEGORIA, MINIMO_CATEGORIA, TEMPORADAS,
    inicio, idadeHoras, selecionar, status, foraDeEpoca, podeIrProPodio, FORA_DO_PODIO
  };

})();
