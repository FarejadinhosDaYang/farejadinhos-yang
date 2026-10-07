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
 * 4. Depois de 72h (3 dias) ela EXPIRA e não aparece de jeito
 *    nenhum — pra não mostrar preço velho. O limpar-ofertas.ps1
 *    tira essas do ofertas.json de vez.
 *
 * Se mudar os números aqui, mude também no gerador/limpar-ofertas.ps1
 * e no gerador/gerar-lote.ps1.
 * ========================================== */

(function(){

  const MINIMO_VITRINE = 15;
  const HORAS_FRESCA = 24;
  const HORAS_MAXIMA = 72;

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

    const validas = (Array.isArray(todas) ? todas : [todas]).filter(o => o && o.slug);

    const liberadas = validas.filter(o => idadeHoras(o, agora) >= 0);

    const frescas = liberadas.filter(o => idadeHoras(o, agora) <= HORAS_FRESCA);

    let reserva = [];

    if(frescas.length < MINIMO_VITRINE){
      reserva = liberadas
        .filter(o => {
          const h = idadeHoras(o, agora);
          return h > HORAS_FRESCA && h <= HORAS_MAXIMA;
        })
        .sort((a, b) => idadeHoras(a, agora) - idadeHoras(b, agora))
        .slice(0, MINIMO_VITRINE - frescas.length);
    }

    return {
      visiveis: frescas.concat(reserva),
      frescas: new Set(frescas),
      reserva: new Set(reserva)
    };
  }

  // status de uma oferta, pro painel:
  // "agendada" | "fresca" | "reserva" | "fora" (reserva que não coube) | "expirada"
  function status(oferta, selecao, agora){
    agora = agora || new Date();
    const h = idadeHoras(oferta, agora);
    if(h < 0) return "agendada";
    if(selecao.frescas.has(oferta)) return "fresca";
    if(selecao.reserva.has(oferta)) return "reserva";
    if(h > HORAS_MAXIMA) return "expirada";
    return "fora";
  }

  window.FarejadinhosVitrine = {
    MINIMO_VITRINE, HORAS_FRESCA, HORAS_MAXIMA,
    inicio, idadeHoras, selecionar, status
  };

})();
