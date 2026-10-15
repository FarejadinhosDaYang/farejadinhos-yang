/* Encurta os nomes enormes que vêm da Shopee / Mercado Livre
 * (ex.: "Kit 4 Toalhas - Banho Felpudas Ultra Macias 100% Algodão Puro
 * 1,30x65cm Conforto e Qualidade") pra algo que cabe bem no card:
 * "Kit 4 Toalhas de Banho Felpudas Ultra Macias".
 * Usado no envio em lote (painel/lote.html). O nome original continua
 * guardado e o nome encurtado pode ser editado à mão na tabela.
 */
(function(){
  const LIMITE = 50;

  // Termos de "anúncio" que não ajudam a entender o produto
  const RUIDO = [
    "envio imediato", "pronta entrega", "frete gr[aá]tis", "promo[cç][aã]o", "oferta",
    "lan[cç]amento", "original", "top", "barato", "super oferta", "melhor pre[cç]o",
    "alta qualidade", "conforto e qualidade", "qualidade premium", "com nota fiscal",
    "nf", "envio r[aá]pido", "a pronta entrega", "dispon[ií]vel", "novo", "nova"
  ];
  const RE_RUIDO = new RegExp("(^|\\s)(" + RUIDO.join("|") + ")(?=\\s|$|[,.!])", "gi");

  // Medidas e dimensões (34x42x30, 1,30x65cm, 200 cm x 150 cm, 140 cm)
  const RE_DIMENSAO = /\b\d+([.,]\d+)?\s*(cm|mm|m)?\s*[xX×]\s*\d+([.,]\d+)?\s*(cm|mm|m)?(\s*[xX×]\s*\d+([.,]\d+)?\s*(cm|mm|m)?)?\b/g;
  const RE_MEDIDA_SOLTA = /\b(de\s+)?\d+([.,]\d+)?\s*(cm|mm)\b/gi;

  // Lista de tamanhos: "4/5/6/7cm", "150/180/210"
  const RE_LISTA_MEDIDAS = /\b\d+([.,]\d+)?(\s*\/\s*\d+([.,]\d+)?)+\s*\/?\s*(cm|mm|m|ml|l)?(?=\s|$|[,.])/gi;
  // Palavras de anúncio no começo: "Novo estilo ...", "Estoque pronto ..."
  const RE_INICIO = /^(novo|nova|estoque pronto|pronta entrega|envio imediato)\s+(estilo\s+)?/i;

  function chave(p){
    return p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "").replace(/s$/, "");
  }

  // Shopee repete muito ("Enfeite de Natal Enfeite Para Árvore De Natal"):
  // tira palavras (de 4+ letras) que já apareceram, junto com o "de/para"
  // que vinha antes delas.
  function tirarRepetidas(t){
    const vistas = new Set();
    const out = [];
    for(const p of t.split(" ")){
      const k = chave(p);
      if(k.length >= 4 && vistas.has(k)){
        while(out.length && CONECTORES.has(out[out.length - 1].toLowerCase())) out.pop();
        continue;
      }
      if(k.length >= 4) vistas.add(k);
      out.push(p);
    }
    return out.join(" ");
  }

  // Palavras que não podem ficar sobrando no fim do nome
  const CONECTORES = new Set(["de","da","do","das","dos","para","pra","com","e","em","a","o","as","os","no","na","p/","c/","+","-","|","/","ou","tipo","sem","por","ao","à","multiuso","multifuncional","alta","ultra","super","100%","fazer","linha"]);

  function tirarPontaSolta(palavras){
    while(palavras.length > 1){
      const ultima = palavras[palavras.length - 1].toLowerCase().replace(/[,.;:]+$/, "");
      if(CONECTORES.has(ultima) || /^[a-zà-ÿ]$/i.test(ultima) || /^[-–|/+&,.]+$/.test(ultima) || /^\d+[\/,.-]*$/.test(ultima)) palavras.pop();
      else break;
    }
    // vírgula/traço grudado no fim
    if(palavras.length) palavras[palavras.length - 1] = palavras[palavras.length - 1].replace(/[,;:\-–|/+]+$/, "");
    return palavras;
  }

  function capitalizarSeTudoMaiusculo(t){
    const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if(letras.length > 6 && letras === letras.toUpperCase()){
      return t.toLowerCase().replace(/(^|\s)(\S)/g, (m, s, c) => s + c.toUpperCase());
    }
    return t;
  }

  function encurtar(nomeOriginal, limite){
    limite = limite || LIMITE;
    let t = String(nomeOriginal || "").replace(/\s+/g, " ").trim();
    if(!t) return t;

    t = capitalizarSeTudoMaiusculo(t);

    // [Envio Imediato], 【Promoção】, (Original) etc.
    t = t.replace(/[\[【].*?[\]】]/g, " ");
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");

    if(t.length <= limite) return t.replace(/\s+/g, " ").trim();

    t = t.replace(/(^|\s)c\/\s*/gi, "$1com ").replace(/(^|\s)p\/\s*/gi, "$1para ");
    t = t.replace(RE_LISTA_MEDIDAS, " ");
    t = t.replace(RE_DIMENSAO, " ");
    t = t.replace(RE_MEDIDA_SOLTA, " ");
    t = t.replace(RE_INICIO, "");
    t = t.replace(RE_RUIDO, " ");
    t = t.replace(/\([A-Z0-9-]*\d[A-Z0-9-]*\)/g, " ");           // (P10521)
    t = t.replace(/\s\/(?=\S)/g, " ").replace(/(\S)\/\s/g, "$1 "); // " /Colorido", "MDF/ "
    t = t.replace(/\s*,\s*,/g, ",").replace(/(^|\s)[,;]\s*/g, " ");
    t = t.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();
    t = tirarRepetidas(t);

    // "Kit 4 Toalhas - Banho Felpudas ..." → o traço vira "de" quando liga
    // pedaços curtos; quando o primeiro pedaço já é um nome bom, corta ali.
    const partes = t.split(/\s+[-–|]\s+/);
    if(partes.length > 1){
      if(partes[0].length >= 22) t = partes[0];
      else t = partes.join(" ");
    }

    if(t.length > limite){
      const palavras = t.split(" ");
      const out = [];
      for(const p of palavras){
        const tentativa = out.concat(p).join(" ");
        if(tentativa.length > limite) break;
        out.push(p);
      }
      t = tirarPontaSolta(out).join(" ");
    }else{
      t = tirarPontaSolta(t.split(" ")).join(" ");
    }
    const virg = t.lastIndexOf(",");
    if(virg > 15 && t.length - virg < 14 && !/\d/.test(t.charAt(virg - 1))) t = t.slice(0, virg);

    // Se sobrou parêntese aberto no corte
    if((t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length){
      t = t.replace(/\s*\([^)]*$/, "");
    }
    t = t.replace(/[\s\-–,/|]+$/, "").trim();
    if(!t) return String(nomeOriginal).slice(0, limite).trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  if(typeof window !== "undefined") window.FarejadinhosNomes = { encurtar, LIMITE };
  if(typeof module !== "undefined") module.exports = { encurtar, LIMITE };
})();
