/*
 * Busca que perdoa erro de digitação e de português.
 *
 *   "lacheira" -> chaleira · "air frier" -> air fryer · "selular" -> celular
 *   "liquidificadô" -> liquidificador · "pissina" -> piscina · "xinelo" -> chinelo
 *
 * Como funciona: cada palavra é passada pra um "som" parecido com o falado
 * (ç/ss/z/c+e,i -> s, ch/x -> x, qu/k/c -> k, h mudo some, y -> i, letras
 * dobradas viram uma...). Depois compara as palavras da busca com as palavras
 * dos nomes dos produtos aceitando 1 erro (palavras de 4 a 6 letras) ou 2
 * erros (7 letras ou mais), contando troca de letras vizinhas como 1 erro.
 *
 *   const b = FarejadinhosBusca.criar(ofertas);
 *   const r = b.buscar("lacheira");   // { bate(o) -> true/false, corrigido: "chaleira" | "" }
 */
(function (raiz) {
  function semAcento(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function palavras(t) { return semAcento(t).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean); }

  // "som" da palavra em português (bem simples, mas pega os erros comuns)
  function som(w) {
    return w
      .replace(/ç/g, "s")
      .replace(/^h/, "")
      .replace(/ch/g, "x").replace(/sh/g, "x")
      .replace(/lh/g, "li").replace(/nh/g, "ni")
      .replace(/ph/g, "f").replace(/th/g, "t")
      .replace(/qu([ei])/g, "k$1").replace(/gu([ei])/g, "g$1")
      .replace(/c([ei])/g, "s$1").replace(/c/g, "k").replace(/q/g, "k")
      .replace(/sc([ei])/g, "s$1").replace(/xc([ei])/g, "s$1")
      .replace(/([aeiou])z([aeiou])/g, "$1s$2").replace(/z$/, "s")
      .replace(/ss/g, "s").replace(/rr/g, "r")
      .replace(/y/g, "i").replace(/w/g, "v")
      .replace(/h/g, "")
      .replace(/([a-z])\1+/g, "$1")
      .replace(/(ao|am|an)$/, "ao")
      .replace(/[ou]$/, "u").replace(/[ei]$/, "i");     // "fogau", "telefoni"
  }

  // distância de edição com troca de vizinhas (Damerau), com corte cedo
  function distancia(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let menor = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
        if (v < menor) menor = v;
      }
      if (menor > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  function tolerancia(n) { return n >= 7 ? 2 : n >= 4 ? 1 : 0; }

  function criar(ofertas) {
    // vocabulário: palavras dos nomes (sem acento) e o "som" delas
    const vocab = new Map();   // palavra -> som
    const nomes = new WeakMap();
    (ofertas || []).forEach(o => {
      if (!o) return;
      const ws = palavras(o.produto);
      nomes.set(o, { texto: " " + ws.join(" ") + " ", ws: new Set(ws) });
      ws.forEach(w => { if (w.length >= 3 && !vocab.has(w)) vocab.set(w, som(w)); });
      // palavras grudadas: "airfryer" acha "air fryer"
      for (let i = 0; i + 1 < ws.length; i++) {
        const j = ws[i] + ws[i + 1];
        nomes.get(o).ws.add(j);
        if (j.length >= 6 && !vocab.has(j)) vocab.set(j, som(j));
      }
    });
    const cache = new Map();

    // palavras do vocabulário que "são" esta palavra da busca
    function parecidas(q) {
      if (cache.has(q)) return cache.get(q);
      const res = new Map();   // palavra -> quão longe (0 = mesmo som)
      const sq = som(q);
      const tol = tolerancia(q.length);
      if (q.length >= 3) {
        vocab.forEach((sw, w) => {
          if (w === q) return;
          if (sw === sq) { res.set(w, 0); return; }
          if (!tol) return;
          if (Math.abs(w.length - q.length) > tol + 1) return;
          // palavra curta: a 1ª letra (ou o som dela) tem que bater — "dente" não vira "quente"
          if (q.length < 7 && q[0] !== w[0] && sq[0] !== sw[0]) return;
          // mesmas letras fora de ordem ("lacheira" / "chaleira") conta quase como acerto
          const anagrama = q.length >= 5 && q.length === w.length && q.split("").sort().join("") === w.split("").sort().join("");
          const dd = anagrama ? 0.5 : Math.min(distancia(sq, sw, tol), distancia(q, w, tol));
          if (dd <= tol) res.set(w, dd);
          // "liquidifica" -> começo de liquidificador (a pessoa ainda está digitando)
          else if (q.length >= 5 && w.length > q.length && distancia(sq, som(w.slice(0, q.length)), 1) <= 1) res.set(w, 1.5);
        });
      }
      cache.set(q, res);
      return res;
    }

    function buscar(termo) {
      const qs = palavras(termo);
      const textoQ = qs.join(" ");
      if (!qs.length) return { bate: () => true, corrigido: "", exato: true, distancia: () => 0 };
      // 1º: busca normal (pedaço do nome, sem acento)
      const exato = o => { const n = nomes.get(o); return !!n && n.texto.indexOf(textoQ) >= 0 || (!!n && qs.every(q => n.texto.indexOf(q) >= 0)); };
      // 2º: cada palavra bate por pedaço OU por uma parecida
      const alternativas = qs.map(q => parecidas(q));
      // quão longe da busca está o produto (pra pôr os mais parecidos primeiro)
      const distProduto = o => {
        const n = nomes.get(o);
        if (!n) return Infinity;
        let soma = 0;
        for (let i = 0; i < qs.length; i++) {
          if (n.texto.indexOf(qs[i]) >= 0 || n.ws.has(qs[i])) continue;
          let m = Infinity;
          alternativas[i].forEach((dd, w) => { if (dd < m && n.ws.has(w)) m = dd; });
          if (m === Infinity) return Infinity;
          soma += m;
        }
        return soma;
      };
      const tolerante = o => distProduto(o) !== Infinity;
      const temExato = (ofertas || []).some(exato);
      if (temExato) return { bate: exato, corrigido: "", exato: true, distancia: () => 0 };
      // "Mostrando resultados para ..." com a palavra mais comum de cada correção
      const contagem = w => (ofertas || []).reduce((s, o) => s + ((nomes.get(o) || { ws: new Set() }).ws.has(w) ? 1 : 0), 0);
      const corr = qs.map((q, i) => {
        if ((ofertas || []).some(o => (nomes.get(o) || { texto: "" }).texto.indexOf(q) >= 0)) return q;
        const alt = [...alternativas[i].entries()];
        if (!alt.length) return q;
        // a mais parecida; empatou, a que aparece em mais produtos
        return alt.sort((a, b) => a[1] - b[1] || contagem(b[0]) - contagem(a[0]))[0][0];
      }).join(" ");
      return { bate: tolerante, corrigido: corr !== textoQ ? corr : "", exato: false, distancia: distProduto };
    }

    return { buscar };
  }

  const api = { criar, som, distancia };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (raiz) raiz.FarejadinhosBusca = api;
})(typeof window !== "undefined" ? window : null);
