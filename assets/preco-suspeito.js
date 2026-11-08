/*
 * Preço suspeito na ENTRADA de um produto (lote de links, planilha do painel).
 * A leitura da loja às vezes pega o valor da PARCELA ou um preço de outro
 * produto (ex.: Galaxy S26 Ultra por R$ 989,10). Aqui o site desconfia antes
 * de publicar.
 *
 *   FarejadinhosPrecoSuspeito.checar({produto, preco, precoAntigo, precoAPrazo, parcelas}, catalogo)
 *   -> { motivo: "" | "texto", corrigido: "R$ ..." | "" }
 *
 * "corrigido" vem quando dá pra consertar sozinho (era a parcela e o total a
 * prazo sem juros é conhecido). Sem conserto, o produto fica de fora do lote.
 */
(function (raiz) {
  function numero(p) {
    const s = String(p == null ? "" : p).replace(/[^\d,.]/g, "");
    if (!s) return 0;
    if (/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) return parseFloat(s) || 0;
    return parseFloat(s.replace(/[.,]/g, "")) || 0;
  }
  function reais(v) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function norm(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // produto caro: abaixo desse valor, com certeza é parcela ou erro
  const PISOS = [
    [/\b(iphone|ipad|macbook|galaxy (s|z|tab s)\d|playstation|ps5|xbox series|notebook|smart ?tv|geladeira|refrigerador|lava e seca|maquina de lavar|ar condicionado)\b/, 500],
    [/\b(celular|smartphone|galaxy a\d|redmi|tablet|monitor|airfryer|air fryer|robo aspirador)\b/, 150],
  ];

  function checar(item, catalogo) {
    const preco = numero(item.preco);
    const antigo = numero(item.precoAntigo);
    const aPrazo = numero(item.precoAPrazo);
    const parcelas = parseInt(item.parcelas, 10) || 0;
    const nome = " " + norm(item.produto) + " ";
    if (!preco) return { motivo: "sem preço", corrigido: "" };

    // 1) é a parcela? (preço ≈ total a prazo ÷ nº de parcelas)
    if (parcelas > 1 && aPrazo > 0 && Math.abs(preco - aPrazo / parcelas) <= Math.max(1, aPrazo / parcelas * 0.03)) {
      return { motivo: "parece o valor da parcela (" + parcelas + "x)", corrigido: reais(aPrazo) };
    }
    // 2) desconto impossível
    if (antigo > 0 && preco < antigo * 0.3) return { motivo: "mais de 70% abaixo do preço antigo", corrigido: "" };
    // 3) produto caro com preço de bala
    for (const [re, piso] of PISOS) {
      if (re.test(nome) && preco < piso) return { motivo: "preço baixo demais pra esse tipo de produto", corrigido: "" };
    }
    // 4) muito abaixo do mesmo produto já no site (3 primeiras palavras + mesmo GB)
    if (Array.isArray(catalogo) && catalogo.length) {
      const chave = nome.split(" ").filter(Boolean).slice(0, 4).join(" ");
      const gb = (nome.match(/ (\d+) ?(gb|tb) /) || [])[0] || "";
      const iguais = catalogo.filter(o => {
        if (!o || !o.produto) return false;
        const n = " " + norm(o.produto) + " ";
        return n.indexOf(" " + chave + " ") === 0 && (!gb || n.includes(gb));
      }).map(o => numero(o.preco)).filter(v => v > 0).sort((a, b) => a - b);
      if (iguais.length >= 1) {
        const meio = iguais[Math.floor(iguais.length / 2)];
        if (preco < meio * 0.4) return { motivo: "menos da metade do mesmo produto no site (" + reais(meio) + ")", corrigido: "" };
      }
    }
    return { motivo: "", corrigido: "" };
  }

  const api = { checar, numero };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (raiz) raiz.FarejadinhosPrecoSuspeito = api;
})(typeof window !== "undefined" ? window : null);
