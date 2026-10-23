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
 *   GET  /        -> { ok: true } (teste: o Worker está no ar)
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
