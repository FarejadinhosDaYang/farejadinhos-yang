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
 *   POST /clique   corpo {"slug":"...","categoria":"...","loja":"..."}  (clique pra loja)
 *   GET  /relatorio?dias=7 -> mais vistas, mais clicadas, categorias, "muita visita e pouco clique"
 *
 * Por oferta, conta por dia: visitas na página da oferta ("v") e cliques
 * pra loja ("c"). Guarda 60 dias (o resto é apagado sozinho).
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
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS contagem (chave TEXT PRIMARY KEY, valor INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ofertas_dia (dia TEXT NOT NULL, slug TEXT NOT NULL, tipo TEXT NOT NULL, categoria TEXT DEFAULT '', loja TEXT DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, slug, tipo, loja))"),
  ]);
  tabelaPronta = true;
}

function contarOferta(db, dia, slug, tipo, categoria, loja) {
  return db.prepare("INSERT INTO ofertas_dia (dia, slug, tipo, categoria, loja, n) VALUES (?1, ?2, ?3, ?4, ?5, 1) " +
    "ON CONFLICT(dia, slug, tipo, loja) DO UPDATE SET n = n + 1, categoria = CASE WHEN ?4 <> '' THEN ?4 ELSE categoria END").bind(dia, slug, tipo, categoria, loja);
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
        // visita na página de uma oferta
        const m = String(d.pagina || "").match(/^\/ofertas\/([a-z0-9-]{3,120})\/?$/);
        if (m) ops.push(contarOferta(env.DB, dia, m[1], "v", "", ""));
        await env.DB.batch(ops);
        return json({ ok: true }, origem);
      }

      // ----- clique pra loja (botão "Pegar oferta", card da vitrine...) -----
      if (url.pathname === "/clique" && request.method === "POST") {
        if (origem && !ORIGENS.includes(origem)) return json({ ok: false }, origem, 403);
        let d = {};
        try { d = JSON.parse(await request.text() || "{}"); } catch (e) {}
        const slug = String(d.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
        if (!slug) return json({ ok: false }, origem, 400);
        const dia = hojeBR();
        await env.DB.batch([
          contarOferta(env.DB, dia, slug, "c", String(d.categoria || "").slice(0, 40), String(d.loja || "").slice(0, 30)),
          somar(env.DB, "total:cliques"), somar(env.DB, "dia:" + dia + ":cliques"),
        ]);
        // limpeza de vez em quando (guarda 60 dias)
        if (Math.random() < 0.02) {
          const corte = new Date(Date.now() - 3 * 3600 * 1000 - 60 * 86400000).toISOString().slice(0, 10);
          await env.DB.prepare("DELETE FROM ofertas_dia WHERE dia < ?1").bind(corte).run();
        }
        return json({ ok: true }, origem);
      }

      // ----- relatório de cliques (painel) -----
      if (url.pathname === "/relatorio") {
        const dias = Math.max(1, Math.min(60, Number(url.searchParams.get("dias")) || 7));
        const desde = new Date(Date.now() - 3 * 3600 * 1000 - (dias - 1) * 86400000).toISOString().slice(0, 10);
        const q = (sql) => env.DB.prepare(sql).bind(desde).all().then(r => r.results);
        const [porOferta, porCategoria, porLoja, porDia] = await Promise.all([
          q("SELECT slug, SUM(CASE WHEN tipo='v' THEN n ELSE 0 END) AS visitas, SUM(CASE WHEN tipo='c' THEN n ELSE 0 END) AS cliques FROM ofertas_dia WHERE dia >= ?1 GROUP BY slug"),
          q("SELECT categoria, SUM(n) AS cliques FROM ofertas_dia WHERE dia >= ?1 AND tipo='c' AND categoria <> '' GROUP BY categoria ORDER BY cliques DESC LIMIT 20"),
          q("SELECT loja, SUM(n) AS cliques FROM ofertas_dia WHERE dia >= ?1 AND tipo='c' AND loja <> '' GROUP BY loja ORDER BY cliques DESC"),
          q("SELECT dia, SUM(CASE WHEN tipo='v' THEN n ELSE 0 END) AS visitas, SUM(CASE WHEN tipo='c' THEN n ELSE 0 END) AS cliques FROM ofertas_dia WHERE dia >= ?1 GROUP BY dia ORDER BY dia"),
        ]);
        const maisClicadas = porOferta.filter(x => x.cliques > 0).sort((a, b) => b.cliques - a.cliques).slice(0, 25);
        const maisVistas = porOferta.filter(x => x.visitas > 0).sort((a, b) => b.visitas - a.visitas).slice(0, 25);
        const poucoClique = porOferta.filter(x => x.visitas >= 15 && x.cliques / x.visitas < 0.08)
          .sort((a, b) => b.visitas - a.visitas).slice(0, 15);
        const tot = porOferta.reduce((s, x) => ({ visitas: s.visitas + x.visitas, cliques: s.cliques + x.cliques }), { visitas: 0, cliques: 0 });
        return json({ dias, desde, total: tot, maisClicadas, maisVistas, poucoClique, porCategoria, porLoja, porDia }, origem);
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
