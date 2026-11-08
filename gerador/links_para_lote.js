/*
 * Lote "só links": {"acao": "links", "links": ["https://...", ...]}
 * (ou uma lista de itens com só "link"). Faz o mesmo que o painel faz
 * com uma planilha de links (painel/lote.html): pergunta ao Worker
 * (/produto) o nome, o preço, o preço antigo, a foto e o parcelamento,
 * encurta o nome (assets/nomes.js), sugere a categoria
 * (assets/categorias.js) e reescreve o arquivo como um lote comum,
 * que o gerar-lote.ps1 processa depois.
 *
 * Uso: node gerador/links_para_lote.js entrada/lote-xxx.json
 * Precisa do segredo PAINEL_SENHA (a mesma senha do painel).
 * Link que não der pra ler fica de fora (aparece no log).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const WORKER_URL = "https://holy-pine-e7fc.bernard-shimizu.workers.dev";
const RAIZ = path.resolve(__dirname, "..");

function carregar(arquivos) {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const a of arquivos) vm.runInContext(fs.readFileSync(path.join(RAIZ, a), "utf8"), ctx);
  return ctx.window;
}

async function produto(senha, link) {
  const corpo = new URLSearchParams({ senha, link });
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(WORKER_URL + "/produto", {
        method: "POST", body: corpo,
        headers: { "Origin": "https://farejadinhosdayang.com.br", "Referer": "https://farejadinhosdayang.com.br/painel/lote.html" },
      });
      if (r.status === 401) throw new Error("senha do painel errada (segredo PAINEL_SENHA)");
      const j = await r.json().catch(() => ({}));
      if (j.produto && j.preco) return j;
      if (tentativa === 3) return j;
    } catch (e) {
      if (/senha/.test(e.message) || tentativa === 3) throw e;
    }
    await new Promise(ok => setTimeout(ok, 3000 * tentativa));
  }
}

async function main() {
  const arq = process.argv[2];
  const bruto = JSON.parse(fs.readFileSync(arq, "utf8").replace(/^﻿/, ""));
  const lista = Array.isArray(bruto) ? bruto : [bruto];
  let links = [];
  let extras = {};
  for (const it of lista) {
    if (it && it.acao === "links") {
      links.push(...(it.links || []));
      extras = { categoria: it.categoria || "", soNomes: !!it.soNomes };
    }
  }
  links = [...new Set(links.map(l => String(l || "").trim()).filter(Boolean))];
  // link que já está no site (como oferta ou anúncio juntado) fica de fora
  const noSite = new Set();
  try {
    for (const o of JSON.parse(fs.readFileSync(path.join(RAIZ, "ofertas.json"), "utf8").replace(/^\uFEFF/, ""))) {
      if (!o) continue;
      noSite.add(String(o.link || "").trim());
      for (const a of o.anuncios || []) if (a && a.link) noSite.add(String(a.link).trim());
    }
  } catch (e) { console.log("  (não li o ofertas.json: " + e.message + ")"); }
  const repetidos = links.filter(l => noSite.has(l));
  if (repetidos.length) console.log(`  ⏭️ ${repetidos.length} link(s) já estão no site: ${repetidos.join(" ")}`);
  if (!extras.soNomes) links = links.filter(l => !noSite.has(l));
  if (!links.length) { fs.writeFileSync(arq, "[]", "utf8"); console.log("Links: todos já estavam no site."); return; }

  const senha = process.env.PAINEL_SENHA || "";
  if (!senha) throw new Error("falta o segredo PAINEL_SENHA");
  const w = carregar(["assets/categorias-config.js", "assets/categorias.js", "assets/nomes.js"]);
  const suspeito = require(path.join(RAIZ, "assets", "preco-suspeito.js"));
  let catalogo = [];
  try { catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, "ofertas.json"), "utf8").replace(/^\uFEFF/, "")); } catch (e) {}
  const foraPorPreco = [];

  const itens = [];
  for (const link of links) {
    try {
      const j = await produto(senha, link);
      if (extras.soNomes) {  // só lista o nome completo de cada link (pra organizar), não sobe nada
        console.log(`  NOME\t${link}\t${j && j.produto || "?"}\t${j && j.preco || "?"}\t${j && j.precoAntigo || ""}`);
        await new Promise(ok => setTimeout(ok, 500));
        continue;
      }
      if (!j || !j.produto || !j.preco || !j.imagemUrl) {
        console.log(`  ⚠️ fora do lote (faltou ${!j || !j.produto ? "nome" : !j.preco ? "preço" : "foto"}): ${link}`);
        continue;
      }
      const item = {
        produto: w.FarejadinhosNomes.encurtar(j.produto),
        preco: j.preco, precoAntigo: j.precoAntigo || "",
        categoria: extras.categoria || w.FarejadinhosCategorias.sugerir(j.produto),
        link, imagemUrl: j.imagemUrl,
      };
      if (j.precoAPrazo && j.parcelas) { item.precoAPrazo = j.precoAPrazo; item.parcelas = j.parcelas; }
      // preço suspeito (parcela, preço de outro produto...): conserta ou tenta ler de novo
      let s = suspeito.checar({ ...item, produto: j.produto }, catalogo);
      if (s.motivo && !s.corrigido) {
        await new Promise(ok => setTimeout(ok, 4000));
        const j2 = await produto(senha, link).catch(() => null);
        if (j2 && j2.preco) {
          item.preco = j2.preco; item.precoAntigo = j2.precoAntigo || item.precoAntigo;
          if (j2.precoAPrazo && j2.parcelas) { item.precoAPrazo = j2.precoAPrazo; item.parcelas = j2.parcelas; }
          s = suspeito.checar({ ...item, produto: j.produto }, catalogo);
        }
      }
      if (s.corrigido) {
        console.log(`  🔧 ${item.produto}: ${s.motivo}; usando ${s.corrigido} (era ${item.preco})`);
        item.preco = s.corrigido;
      } else if (s.motivo) {
        console.log(`  🚫 fora do lote (preço suspeito: ${s.motivo}): ${item.produto} | ${item.preco} | ${link}`);
        foraPorPreco.push({ link, produto: item.produto, preco: item.preco, motivo: s.motivo });
        continue;
      }
      itens.push(item);
      console.log(`  ✅ ${item.produto} | ${item.preco} | ${item.categoria}`);
    } catch (e) {
      console.log(`  ⚠️ fora do lote (${e.message}): ${link}`);
      if (/senha/.test(e.message)) throw e;
    }
    await new Promise(ok => setTimeout(ok, 800));
  }
  if (extras.soNomes) { fs.writeFileSync(arq, "[]", "utf8"); console.log("Só nomes: nada foi subido."); process.exit(3); }
  fs.writeFileSync(arq, JSON.stringify(itens, null, 2), "utf8");
  console.log(`Links: ${itens.length} de ${links.length} viraram itens do lote.`);
  if (foraPorPreco.length) {
    // fica registrado pro painel/Claude mostrarem (e no resumo da execução)
    const reg = path.join(RAIZ, "precos", "fora-por-preco.json");
    let antes = [];
    try { antes = JSON.parse(fs.readFileSync(reg, "utf8")); } catch (e) {}
    const quando = new Date().toISOString().slice(0, 19) + "Z";
    fs.mkdirSync(path.dirname(reg), { recursive: true });
    fs.writeFileSync(reg, JSON.stringify(foraPorPreco.map(x => ({ ...x, quando })).concat(antes).slice(0, 200), null, 2), "utf8");
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      "### 🚫 Fora do lote por preço suspeito\n" + foraPorPreco.map(x => `- ${x.produto} — ${x.preco} (${x.motivo}) ${x.link}`).join("\n") + "\n");
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
