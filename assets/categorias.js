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
    "Natal": [
      "natal", "natalino", "natalina", "arvore de natal", "pisca pisca", "papai noel",
      "mamae noel", "guirlanda", "presepio", "bola de natal", "bolas de natal",
      "festao", "rena", "boneco de neve", "meia de natal", "gorro de natal",
      "luzes de natal", "cascata de led", "cortina de led", "enfeite de natal",
      "estrela de natal", "amigo secreto", "panetone", "chocotone", "ceia",
      "laco de natal", "toalha de natal", "noel"
    ],
    "Skincare": [
      "skincare", "skin care", "serum", "serum facial", "protetor solar", "filtro solar",
      "protetor facial", "hidratante facial", "creme facial", "gel facial", "tonico facial",
      "agua micelar", "sabonete facial", "gel de limpeza", "limpeza facial", "esfoliante facial",
      "mascara facial", "argila facial", "vitamina c", "acido hialuronico", "niacinamida",
      "retinol", "acido salicilico", "anti idade", "antirrugas", "anti rugas", "anti acne",
      "antiacne", "cravos", "espinhas", "olheiras", "area dos olhos", "creme para olhos",
      "clareador facial", "manchas no rosto", "manchas na pele", "peeling", "colageno facial", "facial", "rosto",
      "rolo de jade", "gua sha", "dermaroller", "principia", "cerave", "la roche posay",
      "creamy", "sallve", "bioderma", "neutrogena", "episol", "isdin",
      "retinal", "booster facial", "ampola facial", "essencia facial", "celimax", "tightening",
      "skin booster", "kokeshi", "cosrx", "anua"
    ],
    "Piscina": [
      "piscina", "piscina inflavel", "piscina de armacao", "piscina infantil", "boia", "boia de braco",
      "boia inflavel", "colchao inflavel", "colchao de piscina", "flutuador", "tapete flutuante",
      "cloro", "pastilha de cloro", "clorador", "clorador flutuante", "clarificante", "algicida",
      "barrilha", "redutor de ph", "elevador de ph", "teste de ph", "kit teste ph", "aspirador de piscina",
      "peneira de piscina", "escova de piscina", "cabo telescopico", "capa de piscina", "lona de piscina",
      "filtro de piscina", "bomba de piscina", "escada de piscina", "termometro de piscina",
      "oculos de natacao", "touca de natacao", "natacao", "macarrao de piscina", "espaguete de piscina"
    ],
    "Eletrodomésticos": [
      "eletrodomestico", "air fryer", "airfryer", "fritadeira eletrica", "fritadeira sem oleo",
      "micro ondas", "microondas", "forno eletrico", "forno de embutir", "fogao", "cooktop",
      "geladeira", "frost free", "refrigerador", "freezer", "frigobar", "adega climatizada", "lava loucas",
      "lava louca", "maquina de lavar", "lavadora", "lava e seca", "secadora", "tanquinho",
      "liquidificador", "batedeira", "processador de alimentos", "multiprocessador", "mixer",
      "cafeteira eletrica", "cafeteira", "sanduicheira", "torradeira", "panela eletrica",
      "panela de pressao eletrica", "panela de arroz", "chaleira eletrica", "pipoqueira eletrica",
      "pipoqueira", "waffle", "grill eletrico", "centrifuga", "extrator de suco", "espremedor eletrico",
      "aspirador de po", "aspirador", "robo aspirador", "aspirador robo", "vaporizador",
      "ferro de passar", "passadeira", "ventilador", "climatizador", "ar condicionado",
      "aquecedor", "umidificador de ar", "desumidificador", "purificador de agua", "purificador de ar",
      "bebedouro", "filtro de agua", "maquina de gelo", "sorveteira", "iogurteira", "bivolt"
    ],
    "Pet": [
      "pet", "cachorro", "cao", "caes", "gato", "racao", "petisco pet", "petisco para cachorro",
      "petisco para gato", "petisco canino", "coleira",
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
      "secador", "chapinha", "prancha alisadora", "escova secadora",
      "escova de cabelo", "barbeador", "aparador de pelos", "depilador",
      "sabonete", "desodorante", "esmalte", "cilios", "sobrancelha",
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
      "cozinha", "panela", "frigideira", "geladeira", "organizadores de geladeira", "organizador geladeira",
      "forma de silicone", "forma para air fryer", "papel para air fryer", "cesto de silicone", "tapete de silicone", "taca", "jogo de tacas", "ramekin", "molheira",
      "petisqueira", "travessa", "saladeira", "sousplat", "jogo americano",
      "forma", "assadeira", "pote", "marmita", "hermetico", "tigela", "bowl",
      "talher", "faqueiro", "faca", "fatiador", "ralador", "descascador", "batedor", "mixer", "forno",
      "tabua de corte", "escorredor", "garrafa termica", "copo", "caneca", "xicara",
      "prato", "espatula", "concha", "pia", "detergente", "esponja", "porta mantimentos",
      "porta tempero", "forma de gelo", "grill", "chaleira",
      "jarra", "squeeze", "lancheira", "pano de prato", "avental", "utensilio", "organizador de geladeira", "panela de pressao", "espremedor"
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
      "casa", "maquina de lavar", "limpa maquina", "limpador de maquina", "comprimido efervescente",
      "varal", "varal de roupa", "varal de chao", "varal dobravel", "varal de piso", "lavanderia", "tira manchas", "pastilha de limpeza", "limpador", "organizador", "cabide", "tapete", "cortina", "persiana",
      "travesseiro", "lencol", "edredom", "cobertor", "manta", "toalha", "almofada",
      "luminaria", "lampada", "abajur", "vassoura", "rodo", "mop",
      "limpeza", "aromatizador", "difusor", "tomada",
      "extensao", "filtro de linha", "benjamim", "prateleira", "estante",
      "nicho", "decoracao", "quadro", "vaso", "cadeira", "mesa", "colchao", "cama",
      "banheiro", "chuveiro", "ducha", "porta toalha", "lixeira",
      "furadeira", "parafusadeira", "jardim", "mangueira", "cesto", "caixa organizadora", "sapateira",
      "rack", "escrivaninha", "espelho", "fechadura", "campainha",
      "pano de chao", "balde", "dispenser", "cabideiro", "guarda roupa"
    ]
  };

  // Sem categoria clara: vai pra Utilidades (a categoria "Outros" não existe mais)
  const PADRAO = "Utilidades";

  // Categorias de temporada (têm prioridade quando aparecem no nome)
  const TEMPORADA = ["Natal"];

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

  // Devolve a categoria sugerida ("Utilidades" se nada bater)
  function sugerir(nomeProduto){
    const texto = normalizar(nomeProduto);
    let melhor = PADRAO;
    let melhorPontos = 0;

    for(const regra of REGRAS){
      let pontos = 0;
      for(const termo of regra.termos){
        if(termo.regex.test(texto)) pontos += termo.peso;
      }
      // Categorias de temporada ganham de "toalha", "mesa", "pote"...:
      // um item de Natal é de Natal, mesmo sendo de cozinha ou de casa.
      if(TEMPORADA.includes(regra.categoria)) pontos *= 3;
      if(pontos > melhorPontos){
        melhor = regra.categoria;
        melhorPontos = pontos;
      }
    }

    return melhor;
  }

  window.FarejadinhosCategorias = {
    LISTA: Object.keys(CATEGORIAS),
    sugerir
  };

})();
