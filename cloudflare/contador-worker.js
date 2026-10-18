/**
 * Farejadinhos da Yang — CONTADOR DE VISITAS
 *
 * Worker separado (não mexe no Worker do painel). Guarda só números,
 * nada de dado pessoal: cada navegador ganha uma marquinha anônima no
 * próprio aparelho, que só serve pra saber se é a primeira visita.
 *
 * Como instalar (Cloudflare):
 *   1. Storage & Databases → D1 → Create → nome: farejadinhos-contador
 *   2. Workers & Pages → Create → Worker → nome: farejadinhos-contador
 *      → Deploy → Edit code → apagar tudo, colar ESTE arquivo → Deploy
 *   3. No Worker: Settings → Bindings → Add → D1 database
 *      → Variable name: DB → Database: farejadinhos-contador → Save
 *
 * Rotas:
 *   POST /visita   corpo {"novaVisita":1,"novaPessoa":0,"novaHoje":1,"pagina":"/..."}
 *   GET  /numeros  -> { total:{visitas,pessoas,paginas}, hoje:{...}, dias:[...] }
 */

const ORIGENS = [
  "https://farejadinhosdayang.com.br",
  "https://www.farejadinhosdayang.com.br",
  "https://farejadinhosdayang.github.io",
];

function cors(origem) {
  const ok = ORIGENS.includes(origem) || /^http:\/\/localhost(:\d+)?$/.test(origem || "");
  return {
    "Access-Control-Allow-Origin": ok ? origem : ORIGENS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(dados, origem, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origem) },
  });
}

// dia no horário de Brasília (UTC-3)
function hojeBR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

let tabelaPronta = false;
async function preparar(db) {
  if (tabelaPronta) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS contagem (chave TEXT PRIMARY KEY, valor INTEGER NOT NULL DEFAULT 0)").run();
  tabelaPronta = true;
}

function somar(db, chave) {
  return db.prepare("INSERT INTO contagem (chave, valor) VALUES (?1, 1) ON CONFLICT(chave) DO UPDATE SET valor = valor + 1").bind(chave);
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origem) });

    try {
      if (!env.DB) return json({ erro: "Banco D1 não ligado (binding DB)." }, origem, 500);
      await preparar(env.DB);

      // ----- registrar uma visita -----
      if (url.pathname === "/visita" && request.method === "POST") {
        // só conta o que vem do próprio site
        if (origem && !ORIGENS.includes(origem)) return json({ ok: false }, origem, 403);
        let d = {};
        try { d = JSON.parse(await request.text() || "{}"); } catch (e) {}
        const dia = hojeBR();
        const ops = [
          somar(env.DB, "total:paginas"), somar(env.DB, "dia:" + dia + ":paginas"),
          env.DB.prepare("INSERT OR IGNORE INTO contagem (chave, valor) VALUES ('desde', ?1)").bind(Number(dia.replace(/-/g, ""))),
        ];
        if (d.novaVisita) ops.push(somar(env.DB, "total:visitas"), somar(env.DB, "dia:" + dia + ":visitas"));
        if (d.novaPessoa) ops.push(somar(env.DB, "total:pessoas"));
        if (d.novaHoje) ops.push(somar(env.DB, "dia:" + dia + ":pessoas"));
        await env.DB.batch(ops);
        return json({ ok: true }, origem);
      }

      // ----- ler os números (painel) -----
      if (url.pathname === "/numeros") {
        const { results } = await env.DB.prepare("SELECT chave, valor FROM contagem").all();
        const v = {};
        for (const r of results) v[r.chave] = r.valor;
        const pega = (p) => ({ visitas: v[p + ":visitas"] || 0, pessoas: v[p + ":pessoas"] || 0, paginas: v[p + ":paginas"] || 0 });
        const dias = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(Date.now() - 3 * 3600 * 1000 - i * 86400000).toISOString().slice(0, 10);
          dias.push({ dia: d, ...pega("dia:" + d) });
        }
        return json({ total: pega("total"), hoje: pega("dia:" + hojeBR()), dias, desde: v["desde"] ? String(v["desde"]).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : null }, origem);
      }

      return json({ ok: true, servico: "contador Farejadinhos" }, origem);
    } catch (e) {
      return json({ erro: String(e && e.message || e) }, origem, 500);
    }
  },
};
