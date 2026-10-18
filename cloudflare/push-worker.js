/**
 * Farejadinhos da Yang — AVISOS NO NAVEGADOR (notificações push)
 *
 * Worker separado. Guarda as inscrições de quem ACEITOU receber avisos
 * (só o "endereço" anônimo que o navegador gera + o que a pessoa quer:
 * melhores do dia, categorias e palavras) e envia:
 *   - na mão, pelo painel (rota /enviar, com a senha);
 *   - sozinho, quando os cupons do dia entram no site (quem marcou
 *     "Cupons do dia" recebe 1 aviso por dia com os códigos novos);
 *   - sozinho, a cada 15 min (Cron Trigger): ofertas que acabaram de
 *     entrar no ar no site e batem com as categorias/palavras de cada um.
 *     Máximo de 3 avisos por pessoa por dia, só das 8h às 22h.
 *
 * Usa o MESMO banco D1 do contador (binding DB). As chaves de segurança
 * do push (VAPID) são criadas sozinhas na primeira vez e ficam no banco.
 *
 * Instalação (Cloudflare):
 *   1. Workers & Pages → Create → Worker → nome: farejadinhos-push → Deploy
 *      → Edit code → apagar tudo, colar ESTE arquivo → Deploy
 *   2. Settings → Bindings → Add → D1 database → Variable name: DB
 *      → Database: farejadinhos-contador → Add Binding
 *   3. Settings → Variables and Secrets → Add → Type: Secret
 *      → Name: SENHA_PAINEL → Value: (a mesma senha do painel) → Save
 *   4. Settings → Triggers → Cron Triggers → Add → "a cada 15 minutos"
 *      (o texto da expressão está no passo a passo do chat) → Add
 */

const SITE = "https://farejadinhosdayang.com.br";
const ORIGENS = [SITE, "https://www.farejadinhosdayang.com.br", "https://farejadinhosdayang.github.io"];
const CONTATO = "mailto:alexandregiorgette2@hotmail.com";
const MAX_POR_DIA = 3;
const HORA_INICIO = 8, HORA_FIM = 22; // horário de Brasília

// ---------------------------------------------------------------- utilidades
const enc = new TextEncoder();
function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64u(str) {
  str = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
function juntar(...partes) {
  const n = partes.reduce((t, p) => t + p.length, 0), out = new Uint8Array(n);
  let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(chave, dados) {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}
async function hkdf(salt, ikm, info, tamanho) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, juntar(info, new Uint8Array([1])))).slice(0, tamanho);
}
function semAcento(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
function agoraBR() { return new Date(Date.now() - 3 * 3600 * 1000); }
function hojeBR() { return agoraBR().toISOString().slice(0, 10); }
async function idDe(endpoint) {
  return b64u(await crypto.subtle.digest("SHA-256", enc.encode(endpoint))).slice(0, 32);
}

// ------------------------------------------------------------------- banco
let pronto = false;
async function preparar(db) {
  if (pronto) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS push_config (chave TEXT PRIMARY KEY, valor TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS push_inscritos (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, melhores INTEGER DEFAULT 1, cupons INTEGER DEFAULT 0, categorias TEXT DEFAULT '[]', palavras TEXT DEFAULT '[]', criado TEXT, dia TEXT, qtd_dia INTEGER DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS push_avisadas (slug TEXT PRIMARY KEY, quando TEXT)"),
  ]);
  pronto = true;
}

// Chaves VAPID: criadas na primeira vez, guardadas no banco
async function chaves(db) {
  const row = await db.prepare("SELECT valor FROM push_config WHERE chave = 'vapid'").first();
  if (row) return JSON.parse(row.valor);
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const privada = await crypto.subtle.exportKey("jwk", par.privateKey);
  const publica = b64u(await crypto.subtle.exportKey("raw", par.publicKey));
  const v = { privada, publica };
  await db.prepare("INSERT OR IGNORE INTO push_config (chave, valor) VALUES ('vapid', ?1)").bind(JSON.stringify(v)).run();
  const de_novo = await db.prepare("SELECT valor FROM push_config WHERE chave = 'vapid'").first();
  return JSON.parse(de_novo.valor);
}

// --------------------------------------------------------- envio Web Push
async function jwtVapid(endpoint, v) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATO })));
  const k = await crypto.subtle.importKey("jwk", v.privada, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, enc.encode(cab + "." + corpo));
  return cab + "." + corpo + "." + b64u(ass);
}

// Criptografia do conteúdo (RFC 8291, aes128gcm)
async function cifrar(texto, p256dh, authSecret) {
  const uaPublic = deB64u(p256dh), auth = deB64u(authSecret);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, segredo, juntar(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const chave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const claro = juntar(enc.encode(texto), new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chave, claro));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(salt, rs, new Uint8Array([asPublic.length]), asPublic, cifrado);
}

async function enviarPush(insc, dados, v) {
  const corpo = await cifrar(JSON.stringify(dados), insc.p256dh, insc.auth);
  const jwt = await jwtVapid(insc.endpoint, v);
  const r = await fetch(insc.endpoint, {
    method: "POST",
    headers: {
      "Authorization": "vapid t=" + jwt + ", k=" + v.publica,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body: corpo,
  });
  return r.status;
}

// envia e limpa inscrições que o navegador já cancelou (404/410)
async function enviarEContar(db, lista, montar, v, contarNoDia) {
  let ok = 0, falhas = 0, removidos = 0;
  const dia = hojeBR();
  for (const insc of lista) {
    const dados = montar(insc);
    if (!dados) continue;
    try {
      const st = await enviarPush(insc, dados, v);
      if (st === 404 || st === 410) {
        await db.prepare("DELETE FROM push_inscritos WHERE id = ?1").bind(insc.id).run();
        removidos++;
      } else if (st >= 200 && st < 300) {
        ok++;
        if (contarNoDia) {
          await db.prepare("UPDATE push_inscritos SET dia = ?2, qtd_dia = CASE WHEN dia = ?2 THEN qtd_dia + 1 ELSE 1 END WHERE id = ?1").bind(insc.id, dia).run();
        }
      } else falhas++;
    } catch (e) { falhas++; }
  }
  return { ok, falhas, removidos };
}

// ------------------------------------------------- ofertas novas (cron)
function categoriasDe(o) {
  return String(o.categoria || "").split(",").map(c => c.trim()).filter(Boolean);
}
function inicioDe(o) {
  const d = new Date(o.liberacao || o.data);
  return isNaN(d) ? null : d;
}
function precoTxt(o) {
  const p = String(o.preco || "").trim();
  return p ? (/^R\$/.test(p) ? p : "R$ " + p) : "";
}

// Cupons do dia: quando aparecem códigos novos nas ofertas do site,
// quem marcou "Cupons do dia" recebe UM aviso com os códigos (1 por dia;
// se entrarem mais cupons no mesmo dia, avisa de novo só dos novos).
async function avisarCupons(db, todas) {
  const dia = hojeBR();
  const codigos = [...new Set(todas.map(o => String(o.cupom || "").trim().toUpperCase()).filter(Boolean))];
  const row = await db.prepare("SELECT valor FROM push_config WHERE chave = 'cupons_dia'").first();
  let estado = row ? JSON.parse(row.valor) : { dia: "", enviados: [] };
  if (estado.dia !== dia) estado = { dia, enviados: [] };
  const novos = codigos.filter(c => !estado.enviados.includes(c));
  if (!novos.length) return { novos: 0 };
  estado.enviados = estado.enviados.concat(novos);
  await db.prepare("INSERT INTO push_config (chave, valor) VALUES ('cupons_dia', ?1) ON CONFLICT(chave) DO UPDATE SET valor = ?1").bind(JSON.stringify(estado)).run();
  const lista = (await db.prepare("SELECT * FROM push_inscritos WHERE cupons = 1").all()).results;
  if (!lista.length) return { novos: novos.length, ok: 0 };
  const v = await chaves(db);
  const dados = {
    titulo: "🏷️ Cupons de hoje: " + novos.slice(0, 3).join(" · "),
    mensagem: (novos.length > 3 ? "+" + (novos.length - 3) + " cupons · " : "") + "Use antes de virar o dia! Toque pra ver as ofertas com cupom.",
    url: SITE + "/#tituloGrid",
  };
  return { novos: novos.length, ...(await enviarEContar(db, lista, () => dados, v, false)) };
}

async function avisarOfertasNovas(env) {
  const db = env.DB;
  await preparar(db);
  const hora = agoraBR().getUTCHours();
  if (hora < HORA_INICIO || hora >= HORA_FIM) return { pulou: "fora do horário" };

  const r = await fetch(SITE + "/ofertas.json?t=" + Date.now(), { cf: { cacheTtl: 0 } });
  if (!r.ok) return { erro: "ofertas.json " + r.status };
  const todas = await r.json();
  const agora = Date.now();
  const recentes = todas.filter(o => {
    const i = inicioDe(o);
    return o && o.slug && i && i.getTime() <= agora && agora - i.getTime() < 24 * 3600 * 1000;
  });

  const resCupons = await avisarCupons(db, todas);

  // primeira vez: marca tudo como já avisado (não manda uma enxurrada)
  const primeira = !(await db.prepare("SELECT valor FROM push_config WHERE chave = 'iniciado'").first());
  const jaAvisadas = new Set((await db.prepare("SELECT slug FROM push_avisadas").all()).results.map(x => x.slug));
  const novas = recentes.filter(o => !jaAvisadas.has(o.slug));
  const marcar = novas.map(o => db.prepare("INSERT OR IGNORE INTO push_avisadas (slug, quando) VALUES (?1, ?2)").bind(o.slug, new Date().toISOString()));
  if (primeira) {
    marcar.push(db.prepare("INSERT OR IGNORE INTO push_config (chave, valor) VALUES ('iniciado', ?1)").bind(new Date().toISOString()));
    if (marcar.length) await db.batch(marcar);
    return { iniciado: true, marcadas: novas.length };
  }
  if (!novas.length) return { novas: 0, cupons: resCupons };

  const v = await chaves(db);
  const dia = hojeBR();
  const inscritos = (await db.prepare("SELECT * FROM push_inscritos").all()).results;

  const res = await enviarEContar(db, inscritos, insc => {
    if ((insc.dia === dia ? insc.qtd_dia : 0) >= MAX_POR_DIA) return null;
    const cats = JSON.parse(insc.categorias || "[]").map(semAcento);
    const pals = JSON.parse(insc.palavras || "[]").map(semAcento).filter(p => p.length >= 2);
    if (!cats.length && !pals.length) return null;
    const bate = novas.filter(o => {
      const oc = categoriasDe(o).map(semAcento);
      const nome = semAcento(o.produto);
      return oc.some(c => cats.includes(c)) || pals.some(p => nome.includes(p));
    });
    if (!bate.length) return null;
    if (bate.length === 1) {
      const o = bate[0];
      return {
        titulo: "🐶 A Yang farejou: " + String(o.produto || "oferta nova").slice(0, 70),
        mensagem: [precoTxt(o), o.cupom ? "cupom " + o.cupom : ""].filter(Boolean).join(" · ") || "Toque pra ver a oferta",
        url: SITE + "/ofertas/" + encodeURIComponent(o.slug) + "/",
        imagem: o.imagem ? SITE + "/assets/" + encodeURIComponent(o.imagem) : "",
      };
    }
    const catsComuns = [...new Set(bate.flatMap(categoriasDe))];
    const unica = catsComuns.length === 1 ? catsComuns[0] : "";
    return {
      titulo: "🐶 A Yang farejou " + bate.length + " ofertas pra você" + (unica ? " em " + unica : ""),
      mensagem: bate.slice(0, 3).map(o => String(o.produto || "").slice(0, 40)).join(" · "),
      url: SITE + "/" + (unica ? "?categoria=" + encodeURIComponent(unica) + "#tituloGrid" : "#tituloGrid"),
      imagem: bate[0].imagem ? SITE + "/assets/" + encodeURIComponent(bate[0].imagem) : "",
    };
  }, v, true);

  if (marcar.length) await db.batch(marcar);
  return { novas: novas.length, ...res, cupons: resCupons };
}

// ------------------------------------------------------------------ HTTP
function cors(origem) {
  const ok = ORIGENS.includes(origem) || /^http:\/\/localhost(:\d+)?$/.test(origem || "");
  return {
    "Access-Control-Allow-Origin": ok ? origem : SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
function json(d, origem, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origem) } });
}
function limparLista(l, max, tam) {
  return [...new Set((Array.isArray(l) ? l : []).map(x => String(x || "").trim().slice(0, tam)).filter(Boolean))].slice(0, max);
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origem) });
    const url = new URL(request.url);
    try {
      if (!env.DB) return json({ erro: "Banco D1 não ligado (binding DB)." }, origem, 500);
      const db = env.DB;
      await preparar(db);
      let d = {};
      if (request.method === "POST") { try { d = JSON.parse(await request.text() || "{}"); } catch (e) {} }
      const senhaOk = () => env.SENHA_PAINEL && d.senha === env.SENHA_PAINEL;

      if (url.pathname === "/chave") {
        return json({ publica: (await chaves(db)).publica }, origem);
      }

      // inscrever ou trocar preferências
      if (url.pathname === "/inscrever" && request.method === "POST") {
        const s = d.inscricao || {};
        if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ erro: "inscrição inválida" }, origem, 400);
        const id = await idDe(s.endpoint);
        const categorias = JSON.stringify(limparLista(d.categorias, 30, 40));
        const palavras = JSON.stringify(limparLista(d.palavras, 8, 30));
        await db.prepare(
          "INSERT INTO push_inscritos (id, endpoint, p256dh, auth, melhores, categorias, palavras, criado, cupons) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) " +
          "ON CONFLICT(id) DO UPDATE SET endpoint = ?2, p256dh = ?3, auth = ?4, melhores = ?5, categorias = ?6, palavras = ?7, cupons = ?9"
        ).bind(id, s.endpoint, s.keys.p256dh, s.keys.auth, d.melhores ? 1 : 0, categorias, palavras, new Date().toISOString(), d.cupons ? 1 : 0).run();
        return json({ ok: true }, origem);
      }

      if (url.pathname === "/minhas" && request.method === "POST") {
        const row = d.endpoint ? await db.prepare("SELECT melhores, cupons, categorias, palavras FROM push_inscritos WHERE id = ?1").bind(await idDe(d.endpoint)).first() : null;
        if (!row) return json({ inscrito: false }, origem);
        return json({ inscrito: true, melhores: !!row.melhores, cupons: !!row.cupons, categorias: JSON.parse(row.categorias), palavras: JSON.parse(row.palavras) }, origem);
      }

      if (url.pathname === "/cancelar" && request.method === "POST") {
        if (d.endpoint) await db.prepare("DELETE FROM push_inscritos WHERE id = ?1").bind(await idDe(d.endpoint)).run();
        return json({ ok: true }, origem);
      }

      // ---- painel (com senha) ----
      if (url.pathname === "/resumo" && request.method === "POST") {
        if (!senhaOk()) return json({ erro: "senha" }, origem, 401);
        const rows = (await db.prepare("SELECT melhores, cupons, categorias, palavras FROM push_inscritos").all()).results;
        const cat = {}, pal = {};
        let melhores = 0, cupons = 0;
        for (const r of rows) {
          if (r.melhores) melhores++;
          if (r.cupons) cupons++;
          for (const c of JSON.parse(r.categorias || "[]")) cat[c] = (cat[c] || 0) + 1;
          for (const p of JSON.parse(r.palavras || "[]")) { const k = semAcento(p); pal[k] = (pal[k] || 0) + 1; }
        }
        const ordenar = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([nome, n]) => ({ nome, n }));
        return json({ total: rows.length, melhores, cupons, categorias: ordenar(cat), palavras: ordenar(pal) }, origem);
      }

      if (url.pathname === "/enviar" && request.method === "POST") {
        if (!senhaOk()) return json({ erro: "senha" }, origem, 401);
        const titulo = String(d.titulo || "").trim().slice(0, 90);
        if (!titulo) return json({ erro: "Escreva um título." }, origem, 400);
        const dados = {
          titulo,
          mensagem: String(d.mensagem || "").trim().slice(0, 180),
          url: /^https:\/\//.test(d.url || "") ? d.url : SITE + "/",
          imagem: /^https:\/\//.test(d.imagem || "") ? d.imagem : "",
        };
        const sql = d.para === "todos" ? "SELECT * FROM push_inscritos"
          : d.para === "cupons" ? "SELECT * FROM push_inscritos WHERE cupons = 1"
          : "SELECT * FROM push_inscritos WHERE melhores = 1";
        const lista = (await db.prepare(sql).all()).results;
        const v = await chaves(db);
        const res = await enviarEContar(db, lista, () => dados, v, false);
        return json({ alvo: lista.length, ...res }, origem);
      }

      if (url.pathname === "/rodar-agora" && request.method === "POST") {
        if (!senhaOk()) return json({ erro: "senha" }, origem, 401);
        return json(await avisarOfertasNovas(env), origem);
      }

      return json({ ok: true, servico: "avisos Farejadinhos" }, origem);
    } catch (e) {
      return json({ erro: String(e && e.message || e) }, origem, 500);
    }
  },

  async scheduled(evento, env, ctx) {
    ctx.waitUntil(avisarOfertasNovas(env).catch(() => {}));
  },
};
