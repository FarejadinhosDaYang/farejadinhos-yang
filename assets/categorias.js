/* ==========================================
 * SUGESTÃO AUTOMÁTICA DE CATEGORIA
 *
 * Olha o nome do produto e sugere uma das categorias do site,
 * contando palavras-chave. Grátis, instantâneo e sem internet.
 * Não acerta 100% — por isso o painel sempre deixa trocar.
 *
 * Pra melhorar: é só acrescentar palavras nas listas abaixo
 * (sem acento, em minúsculas). Plural é reconhecido sozinho.
 * Frases com mais de uma palavra valem o dobro.
 * ========================================== */

(function(){

  // Ordem = desempate (a primeira ganha quando empatar)
  const CATEGORIAS = {
    "Pet": [
      "pet", "cachorro", "cao", "caes", "gato", "racao", "petisco", "coleira",
      "arranhador", "areia sanitaria", "areia de gato", "comedouro", "bebedouro pet",
      "tapete higienico", "caminha pet", "cama pet", "brinquedo para cachorro",
      "brinquedo para gato", "focinheira", "peitoral pet"
    ],
    "Academia": [
      "academia", "whey", "creatina", "suplemento", "proteina", "pre treino",
      "pasta de amendoim", "halter", "anilha", "kettlebell", "elastico extensor",
      "faixa elastica", "mini band", "corda de pular", "yoga", "pilates",
      "colchonete", "treino", "fitness", "coqueteleira", "shaker", "luva de treino",
      "bicicleta ergometrica", "esteira eletrica", "barra fixa", "hipercalorico",
      "bcaa", "termogenico", "musculacao", "caneleira"
    ],
    "Café": [
      "cafe", "cafeteira", "capsula", "capsulas", "nespresso", "dolce gusto",
      "tres coracoes", "moedor de cafe", "coador", "barista", "espresso",
      "expresso", "cappuccino", "prensa francesa", "graos de cafe", "cafe em graos"
    ],
    "Beleza": [
      "perfume", "maquiagem", "batom", "rimel", "mascara de cilios", "base liquida",
      "corretivo", "shampoo", "condicionador", "creme", "hidratante",
      "protetor solar", "secador", "chapinha", "prancha alisadora", "escova secadora",
      "escova de cabelo", "barbeador", "aparador de pelos", "depilador", "skincare",
      "serum", "sabonete", "desodorante", "esmalte", "cilios", "sobrancelha",
      "maquininha de cortar cabelo", "cortador de cabelo", "body splash", "colonia",
      "creme dental", "escova de dente eletrica", "oleo capilar", "mascara capilar"
    ],
    "Eletrônicos": [
      "fone", "headset", "headphone", "earbuds", "celular", "smartphone", "iphone",
      "galaxy", "xiaomi", "redmi", "carregador", "cabo usb", "usb c", "power bank",
      "notebook", "laptop", "computador", "monitor", "teclado", "mouse", "ssd",
      "hd externo", "pendrive", "pen drive", "cartao de memoria", "smartwatch",
      "relogio inteligente", "smartband", "tablet", "ipad", "kindle", "smart tv",
      "televisao", "caixa de som", "bluetooth", "alexa", "echo dot", "camera",
      "webcam", "roteador", "repetidor wifi", "console", "playstation", "xbox",
      "nintendo", "controle", "joystick", "impressora", "projetor", "microfone",
      "ring light", "suporte para celular", "pelicula", "capinha", "gamer",
      "placa de video", "processador intel", "ryzen", "memoria ram", "chromecast",
      "fire tv", "tv box", "lampada inteligente", "tomada inteligente"
    ],
    "Moda": [
      "camiseta", "camisa", "blusa", "regata", "calca", "short", "bermuda",
      "vestido", "saia", "jaqueta", "moletom", "casaco", "jeans", "tenis",
      "sapato", "sandalia", "chinelo", "bota", "bolsa", "mochila", "carteira",
      "oculos", "relogio", "meia", "cueca", "calcinha", "sutia", "pijama",
      "bone", "cinto", "pulseira", "colar",
      "brinco", "anel", "biquini", "maio", "legging", "cropped", "conjunto feminino",
      "conjunto masculino", "polo", "blazer"
    ],
    "Cozinha": [
      "cozinha", "panela", "frigideira", "air fryer", "airfryer", "fritadeira",
      "forma", "assadeira", "pote", "marmita", "hermetico", "tigela", "bowl",
      "talher", "faqueiro", "faca", "fatiador", "ralador", "descascador",
      "liquidificador", "batedor", "mixer", "processador de alimentos",
      "multiprocessador", "micro ondas", "microondas", "forno", "fogao", "cooktop",
      "tabua de corte", "escorredor", "garrafa termica", "copo", "caneca", "xicara",
      "prato", "espatula", "concha", "pia", "detergente", "esponja", "porta mantimentos",
      "porta tempero", "forma de gelo", "sanduicheira", "grill", "chaleira",
      "jarra", "squeeze", "lancheira", "pano de prato", "avental", "utensilio",
      "geladeira", "organizador de geladeira", "panela de pressao",
      "panela eletrica", "torradeira", "espremedor", "centrifuga", "batedeira",
      "mixer de mao", "pipoqueira", "waffle"
    ],
    "Utilidades": [
      "utilidade", "guarda chuva", "sombrinha", "lanterna", "pilha", "pilhas recarregaveis",
      "bateria recarregavel", "fita adesiva", "fita isolante", "fita dupla face",
      "cadeado", "balanca", "termometro", "mala de viagem", "mala", "necessaire",
      "organizador de mala", "chaveiro", "bomba de ar", "encher pneu", "compressor de ar",
      "calibrador", "kit ferramenta", "ferramenta", "alicate", "trena", "multimetro",
      "chave de fenda", "jogo de chaves", "cola instantanea", "super cola",
      "abracadeira", "enforca gato", "gancho adesivo", "ventosa", "porta documento",
      "porta cartao", "canivete", "estilete", "tesoura", "regua", "kit emergencia",
      "capa de chuva", "saco a vacuo", "etiquetadora", "relogio de parede", "despertador"
    ],
    "Casa": [
      "casa", "varal", "varal de roupa", "organizador", "cabide", "tapete", "cortina", "persiana",
      "travesseiro", "lencol", "edredom", "cobertor", "manta", "toalha", "almofada",
      "luminaria", "lampada", "abajur", "aspirador", "vassoura", "rodo", "mop",
      "limpeza", "ventilador", "umidificador", "aromatizador", "difusor", "tomada",
      "extensao", "filtro de linha", "benjamim", "prateleira", "estante",
      "nicho", "decoracao", "quadro", "vaso", "cadeira", "mesa", "colchao", "cama",
      "banheiro", "chuveiro", "ducha", "porta toalha", "lixeira",
      "furadeira", "parafusadeira", "jardim", "mangueira",
      "ar condicionado", "aquecedor", "cesto", "caixa organizadora", "sapateira",
      "rack", "escrivaninha", "espelho", "fechadura", "campainha",
      "pano de chao", "balde", "dispenser", "cabideiro", "guarda roupa"
    ]
  };

  const OUTROS = "Outros";

  function normalizar(texto){
    return " " + String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() + " ";
  }

  // Pré-monta uma regex por palavra-chave (aceita plural: s / es)
  const REGRAS = Object.entries(CATEGORIAS).map(([categoria, palavras]) => ({
    categoria,
    termos: palavras.map(p => {
      const limpo = normalizar(p).trim();
      return {
        regex: new RegExp(" " + limpo.replace(/ /g, " ") + "(s|es)? "),
        peso: limpo.includes(" ") ? 2 : 1
      };
    })
  }));

  // Devolve a categoria sugerida ("Outros" se nada bater)
  function sugerir(nomeProduto){
    const texto = normalizar(nomeProduto);
    let melhor = OUTROS;
    let melhorPontos = 0;

    for(const regra of REGRAS){
      let pontos = 0;
      for(const termo of regra.termos){
        if(termo.regex.test(texto)) pontos += termo.peso;
      }
      if(pontos > melhorPontos){
        melhor = regra.categoria;
        melhorPontos = pontos;
      }
    }

    return melhor;
  }

  window.FarejadinhosCategorias = {
    LISTA: Object.keys(CATEGORIAS).concat(OUTROS),
    sugerir
  };

})();
