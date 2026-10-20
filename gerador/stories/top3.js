// Escolhe o pódio do dia exatamente como a página inicial (index.html → montarPodio)
global.window = {};
require(process.argv[2] + "/assets/vitrine.js");
const fs = require("fs");
const todas = JSON.parse(fs.readFileSync(process.argv[2] + "/ofertas.json", "utf8").replace(/^﻿/, ""));
let ofertas = window.FarejadinhosVitrine.selecionar(todas, new Date()).visiveis;
const agora = new Date();
ofertas.sort((a, b) => window.FarejadinhosVitrine.dataOrdem(b, agora) - window.FarejadinhosVitrine.dataOrdem(a, agora));
const num = p => { let s = String(p || "").replace(/[^\d.,]/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); return parseFloat(s) || 0; };
const pct = o => { const a = num(o.precoAntigo), p = num(o.preco); return a > p && p > 0 ? Math.round((1 - p / a) * 100) : 0; };
const top = ofertas.map((o, i) => ({ o, i, d: pct(o) }))
  .filter(x => window.FarejadinhosVitrine.podeIrProPodio(x.o))
  .sort((a, b) => (b.d - a.d) || ((b.o.destaque ? 1 : 0) - (a.o.destaque ? 1 : 0)) || (a.i - b.i))
  .slice(0, 3).map(x => Object.assign({}, x.o, { desconto: x.d }));
console.log(JSON.stringify(top));
