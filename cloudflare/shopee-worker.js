/**
 * Farejadinhos da Yang — SHOPEE (API oficial de afiliados)
 *
 * Worker separado, usado pelo painel:
 *   POST /link    { senha, links: ["https://shopee.com.br/...", ...] }
 *                 -> { resultados: [{ link, afiliado } | { link, erro }] }
 *                 Transforma links comuns da Shopee em links de afiliado.
 *   POST /produto { senha, link }
 *                 -> { produto, preco, imagemUrl, afiliado, loja, comissao }
 *                 Dados do produto pela API (nome, preço, foto) — na hora.
 *   POST /buscar  { termo }   (PÚBLICO — "Pede pra Yang farejar", sem senha)
 *                 -> { produtos: [{ produto, preco, precoAntigo, imagemUrl, afiliado,
 *                      vendas, nota, loja }], bloqueado?, motivo? }
 *                 Busca na API pelos mais vendidos, só com nota boa e vendas,
 *                 e passa pela LISTA DO QUE NÃO PODE (adulto, armas, remédio,
 *                 bebida, comida, réplicas...). Limite por pessoa e cache.
 *   POST /pedidos { senha }   -> últimos pedidos dos visitantes (painel)
 *   GET  /        -> { ok: true } (teste: o Worker está no ar)
 *
 * Pra guardar os pedidos (painel "Pedidos dos visitantes"): Settings →
 * Bindings → Add → D1 database → Variable name: DB → farejadinhos-contador.
 *
 * Instalação (Cloudflare):
 *   1. Workers & Pages → Create → Worker → nome: farejadinhos-shopee → Deploy
 *      → Edit code → apagar tudo, colar ESTE arquivo → Deploy
 *   2. Settings → Variables and Secrets → Add (Type: Secret), três vezes:
 *        SHOPEE_APP_ID  → o AppID do portal de afiliados
 *        SHOPEE_SECRET  → a senha da API (a do portal)
 *        SENHA_PAINEL   → a mesma senha do painel do site
 *      → Deploy
 * As chaves ficam só na Cloudflare; o navegador nunca vê.
 */

const SITE = "https://farejadinhosdayang.com.br";
const ORIGENS = [SITE, "https://www.farejadinhosdayang.com.br", "https://farejadinhosdayang.github.io"];
const API = "https://open-api.affiliate.shopee.com.br/graphql";
const SUB_ID = "farejadinhos"; // aparece nos relatórios da Shopee
const MAX_LINKS = 30;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function cors(origem) {
  const ok = ORIGENS.includes(origem) || /^http:\/\/localhost(:\d+)?$/.test(origem || "");
  return {
    "Access-Control-Allow-Origin": ok ? origem : SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
function json(d, status, origem) {
  return new Response(JSON.stringify(d), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origem) } });
}

async function sha256hex(texto) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Chamada assinada: SHA256(AppId + Timestamp + Payload + Secret)
async function api(env, query) {
  const corpo = JSON.stringify({ query });
  const ts = String(Math.floor(Date.now() / 1000));
  const assinatura = await sha256hex(env.SHOPEE_APP_ID + ts + corpo + env.SHOPEE_SECRET);
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `SHA256 Credential=${env.SHOPEE_APP_ID}, Timestamp=${ts}, Signature=${assinatura}` },
    body: corpo
  });
  const j = await r.json().catch(() => ({}));
  if (j.errors && j.errors.length) {
    const e = j.errors[0], x = e.extensions || {};
    const dicas = { 10020: "chave da API errada (confira SHOPEE_APP_ID/SHOPEE_SECRET)", 10030: "muitos pedidos seguidos, tente daqui a pouco", 10035: "a conta não tem acesso à API" };
    throw new Error(dicas[x.code] || x.message || e.message || "erro da API Shopee");
  }
  return j.data || {};
}

const aspas = s => JSON.stringify(String(s)); // string GraphQL segura

function ehShopee(link) { return /^https?:\/\/([a-z0-9-]+\.)*(shopee\.com\.br|shp\.ee)\//i.test(String(link || "").trim()); }

function idsNoTexto(t, url = true) {
  t = String(t || "");
  const padroes = [/-i\.(\d+)\.(\d+)/, /\/product\/(\d+)\/(\d+)/];
  if (url) padroes.push(/shopee\.com\.br\/[^/?#]+\/(\d{3,})\/(\d{5,})(?:[/?#]|$)/);
  for (let k = 0; k < 4; k++) {
    for (const p of padroes) { const m = t.match(p); if (m) return [m[1], m[2]]; }
    const s = t.match(/shop_?id[=:"]+(\d+)/i), i = t.match(/item_?id[=:"]+(\d+)/i);
    if (s && i) return [s[1], i[1]];
    let t2; try { t2 = decodeURIComponent(t); } catch (e) { break; }
    if (t2 === t) break; t = t2;
  }
  return null;
}

// Link curto (s.shopee.com.br/...) -> [shopId, itemId]
async function resolverIds(link) {
  let ids = idsNoTexto(link);
  if (ids) return ids;
  let url = link;
  for (let k = 0; k < 8; k++) {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } });
    const loc = r.headers.get("Location");
    if (r.status >= 300 && r.status < 400 && loc) {
      url = new URL(loc, url).toString();
      ids = idsNoTexto(url);
      if (ids) return ids;
      continue;
    }
    const corpo = (await r.text()).slice(0, 400000);
    return idsNoTexto(r.url) || idsNoTexto(corpo, false);
  }
  return null;
}

async function gerarLink(env, link) {
  const q = `mutation{generateShortLink(input:{originUrl:${aspas(link)},subIds:[${aspas(SUB_ID)}]}){shortLink}}`;
  const d = await api(env, q);
  const curto = d.generateShortLink && d.generateShortLink.shortLink;
  if (!curto) throw new Error("a Shopee não devolveu o link");
  return curto;
}

// ================= "PEDE PRA YANG FAREJAR" =================
// O que NUNCA aparece (nome do produto ou o que a pessoa digitou).
// Palavras sem acento, minúsculas; casam como palavra inteira (com plural).
const BLOQUEIO = {
  "adulto": ["sexual", "sexy", "sex shop", "sexshop", "erotico", "erotica", "vibrador", "consolo", "lubrificante intimo", "lingerie sensual", "fantasia sensual", "plug anal", "anal", "masturbador", "preservativo", "camisinha", "gel intimo", "excitante", "retardante", "pompoarismo", "bdsm", "algema", "fetiche", "strap", "penis", "vagina", "dildo", "porn"],
  "armas e perigosos": ["arma", "armas", "pistola", "revolver", "espingarda", "rifle", "airsoft", "simulacro", "replica de arma", "municao", "chumbinho", "soco ingles", "canivete", "faca tatica", "faca de combate", "punhal", "spray de pimenta", "gas de pimenta", "taser", "arma de choque", "besta", "estilingue", "fogos", "rojao", "bombinha", "explosivo", "polvora"],
  "drogas, tabaco e bebida": ["vape", "pod descartavel", "cigarro", "cigarro eletronico", "narguile", "essencia de narguile", "tabaco", "bong", "dichavador", "maconha", "cannabis", "cbd", "thc", "kratom", "cerveja", "vinho", "vodka", "whisky", "gin", "cachaca", "licor", "bebida alcoolica"],
  "remédios e promessas": ["remedio", "medicamento", "antibiotico", "emagrecedor", "emagrecimento rapido", "seca barriga", "inibidor de apetite", "termogenico", "anabolizante", "hormonio", "esteroide", "ozempic", "sibutramina", "viagra", "estimulante sexual", "milagroso", "cura"],
  "comida e bebida": ["alimento", "alimentos", "comida", "chocolate", "bombom", "biscoito", "bolacha", "chiclete", "salgadinho", "cafe em graos", "cafe em po", "capsula de cafe", "capsulas de cafe", "refrigerante", "azeite", "racao", "petisco", "nutella", "granola", "farinha", "arroz tipo", "feijao", "miojo", "macarrao instantaneo", "suplemento alimentar"],
  "réplicas e pirataria": ["replica", "primeira linha", "inspirado", "inspirada", "similar ao", "copia", "pirata", "desbloqueado iptv", "iptv", "tv box desbloqueada", "receptor desbloqueado", "conta premium"],
  "outros": ["aposta", "cassino", "rifa", "dinheiro falso", "documento falso", "cnh", "diploma", "spy", "espia", "escuta", "grampo", "rastreador escondido", "camera escondida", "microcamera"]
};
const NORM = t => " " + String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
const REGRAS_BLOQUEIO = Object.entries(BLOQUEIO).map(([motivo, lista]) => ({
  motivo,
  re: new RegExp(" (" + lista.map(p => NORM(p).trim().replace(/ /g, " ")).join("|") + ")(s|es)? ")
}));
function bloqueado(texto) {
  const n = NORM(texto);
  const r = REGRAS_BLOQUEIO.find(x => x.re.test(n));
  return r ? r.motivo : "";
}
const NOTA_MIN = 4.5, VENDAS_MIN = 100, MAX_RESULTADOS = 6;
const LIMITE_HORA = 20; // buscas por pessoa por hora

async function limitePorPessoa(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "?";
  const hora = Math.floor(Date.now() / 3600e3);
  const chave = new Request("https://limite.farejadinhos/" + encodeURIComponent(ip) + "/" + hora);
  const cache = caches.default;
  const atual = await cache.match(chave);
  const n = atual ? Number(await atual.text()) || 0 : 0;
  if (n >= LIMITE_HORA) return false;
  await cache.put(chave, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=3700" } }));
  return true;
}

async function buscarProdutos(env, termo) {
  const q = `{productOfferV2(keyword:${aspas(termo)},sortType:2,page:1,limit:40){nodes{itemId shopId productName priceMin priceMax priceDiscountRate imageUrl offerLink shopName ratingStar sales commissionRate}}}`;
  const d = await api(env, q);
  const nodes = ((d.productOfferV2 || {}).nodes || []);
  const vistos = {};
  return nodes.filter(n => {
    const nome = n.productName || "";
    if (!nome || bloqueado(nome)) return false;
    if ((parseFloat(n.ratingStar) || 0) < NOTA_MIN) return false;
    if ((parseInt(n.sales, 10) || 0) < VENDAS_MIN) return false;
    if (!(parseFloat(n.priceMin) > 0)) return false;
    const k = NORM(nome).slice(0, 40);
    if (vistos[k]) return false;
    vistos[k] = 1;
    return true;
  }).slice(0, MAX_RESULTADOS).map(n => {
    const preco = parseFloat(n.priceMin), desc = parseFloat(n.priceDiscountRate) || 0;
    return {
      produto: n.productName, preco: precoBR(preco),
      precoAntigo: desc > 0 && desc < 95 ? precoBR(Math.round(preco / (1 - desc / 100) * 100) / 100) : "",
      desconto: desc > 0 && desc < 95 ? Math.round(desc) : 0,
      variacoes: parseFloat(n.priceMax) > preco * 1.01,
      imagemUrl: n.imageUrl || "", afiliado: n.offerLink || "",
      vendas: parseInt(n.sales, 10) || 0, nota: Math.round((parseFloat(n.ratingStar) || 0) * 10) / 10,
      loja: n.shopName || "", ids: n.shopId + "." + n.itemId
    };
  });
}

async function guardarPedido(env, termo, produtos) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, termo TEXT, quando TEXT, achados INTEGER, produtos TEXT)").run();
    await env.DB.prepare("INSERT INTO pedidos (termo, quando, achados, produtos) VALUES (?1, ?2, ?3, ?4)")
      .bind(termo, new Date().toISOString(), produtos.length, JSON.stringify(produtos.slice(0, MAX_RESULTADOS))).run();
  } catch (e) {}
}

function precoBR(n) {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function dadosProduto(env, link) {
  const ids = await resolverIds(link);
  if (!ids) throw new Error("não achei o código do produto nesse link");
  const q = `{productOfferV2(shopId:${Number(ids[0])},itemId:${Number(ids[1])},limit:1){nodes{itemId shopId productName priceMin priceMax priceDiscountRate imageUrl offerLink productLink shopName commissionRate}}}`;
  const d = await api(env, q);
  const n = ((d.productOfferV2 || {}).nodes || [])[0];
  if (!n) throw new Error("a API não achou esse produto (pode ter saído do programa de afiliados)");
  const preco = parseFloat(n.priceMin || 0);
  const desconto = parseFloat(n.priceDiscountRate || 0);
  const r = {
    produto: n.productName || "",
    preco: preco > 0 ? precoBR(preco) : "",
    imagemUrl: n.imageUrl || "",
    afiliado: n.offerLink || "",
    linkProduto: n.productLink || "",
    loja: n.shopName || "",
    comissao: n.commissionRate ? (parseFloat(n.commissionRate) * 100).toFixed(1).replace(".", ",") + "%" : "",
    ids: ids.join(".")
  };
  if (preco > 0 && desconto > 0 && desconto < 95) r.precoAntigo = precoBR(Math.round(preco / (1 - desconto / 100) * 100) / 100);
  const max = parseFloat(n.priceMax || 0);
  if (max > preco * 1.01) r.variacoes = precoBR(preco) + " a " + precoBR(max);
  return r;
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origem) });
    const rota = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && rota === "/") {
      return json({ ok: true, chaves: !!(env.SHOPEE_APP_ID && env.SHOPEE_SECRET), senha: !!env.SENHA_PAINEL }, 200, origem);
    }
    if (request.method !== "POST") return json({ erro: "use POST" }, 405, origem);

    // ---------- rota PÚBLICA: "Pede pra Yang farejar" ----------
    if (rota === "/buscar" && request.method === "POST") {
      if (origem && !cors(origem)["Access-Control-Allow-Origin"].startsWith(origem)) return json({ erro: "origem não permitida" }, 403, origem);
      let b = {};
      try { b = JSON.parse(await request.text() || "{}"); } catch (e) {}
      const termo = String(b.termo || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (termo.length < 3) return json({ erro: "Escreva o que você procura (ex.: pipoqueira elétrica)." }, 400, origem);
      const motivo = bloqueado(termo);
      if (motivo) return json({ produtos: [], bloqueado: true, motivo: "Esse tipo de produto a Yang não fareja por aqui." }, 200, origem);
      if (!env.SHOPEE_APP_ID || !env.SHOPEE_SECRET) return json({ erro: "Busca indisponível agora." }, 503, origem);
      // mesmo termo em 1h: resposta guardada (economiza a cota da API)
      const chaveCache = new Request("https://busca.farejadinhos/" + encodeURIComponent(NORM(termo).trim()));
      const guardada = await caches.default.match(chaveCache);
      if (guardada) {
        const r = await guardada.json();
        await guardarPedido(env, termo, r.produtos || []);
        return json(r, 200, origem);
      }
      if (!(await limitePorPessoa(request))) return json({ erro: "Muitas buscas seguidas — tenta de novo daqui a pouco 🐾" }, 429, origem);
      try {
        const produtos = await buscarProdutos(env, termo);
        const r = { produtos };
        await caches.default.put(chaveCache, new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" } }));
        await guardarPedido(env, termo, produtos);
        return json(r, 200, origem);
      } catch (e) {
        return json({ erro: "A Shopee não respondeu agora — tenta de novo daqui a pouco." }, 502, origem);
      }
    }

    let d = {};
    try {
      const tipo = request.headers.get("Content-Type") || "";
      if (/form/.test(tipo)) { const f = await request.formData(); d = Object.fromEntries(f.entries()); if (d.links) d.links = String(d.links).split(/\s+/); }
      else d = JSON.parse(await request.text() || "{}");
    } catch (e) { return json({ erro: "pedido inválido" }, 400, origem); }

    if (!env.SENHA_PAINEL || d.senha !== env.SENHA_PAINEL) return json({ erro: "Senha do painel recusada." }, 401, origem);
    if (!env.SHOPEE_APP_ID || !env.SHOPEE_SECRET) return json({ erro: "Faltam as chaves SHOPEE_APP_ID / SHOPEE_SECRET no Worker." }, 500, origem);

    try {
      if (rota === "/link") {
        const links = [...new Set((Array.isArray(d.links) ? d.links : [d.link]).map(l => String(l || "").trim()).filter(Boolean))].slice(0, MAX_LINKS);
        if (!links.length) return json({ erro: "Cole pelo menos um link." }, 400, origem);
        const resultados = [];
        for (const link of links) {
          if (!ehShopee(link)) { resultados.push({ link, erro: "não é link da Shopee" }); continue; }
          try { resultados.push({ link, afiliado: await gerarLink(env, link) }); }
          catch (e) {
            resultados.push({ link, erro: e.message });
            if (/chave|acesso/.test(e.message)) break; // não adianta seguir
          }
        }
        return json({ resultados }, 200, origem);
      }
      if (rota === "/pedidos") {
        if (!env.DB) return json({ pedidos: [], semBanco: true }, 200, origem);
        try {
          const r = await env.DB.prepare("SELECT termo, quando, achados, produtos FROM pedidos ORDER BY id DESC LIMIT 300").all();
          return json({ pedidos: (r.results || []).map(p => Object.assign(p, { produtos: JSON.parse(p.produtos || "[]") })) }, 200, origem);
        } catch (e) { return json({ pedidos: [] }, 200, origem); }
      }
      if (rota === "/produto") {
        if (!ehShopee(d.link)) return json({ erro: "não é link da Shopee" }, 400, origem);
        return json(await dadosProduto(env, String(d.link).trim()), 200, origem);
      }
      return json({ erro: "rota desconhecida" }, 404, origem);
    } catch (e) {
      return json({ erro: e.message }, 502, origem);
    }
  }
};
