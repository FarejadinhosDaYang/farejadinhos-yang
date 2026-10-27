/**
 * Farejadinhos da Yang — GERAR REEL (recebe vídeo + voz do painel e manda pro GitHub montar)
 *
 * Worker separado, usado pela página painel/reels.html:
 *   POST /reel  (formulário) senha, video (arquivo), voz (arquivo MP3), pedido (texto JSON)
 *               -> { ok: true, id }
 *               Guarda os arquivos na release "reels-entrada" do repositório e dispara o
 *               workflow "Gerar reel" (gerar-reel.yml), que monta o Reel, a capa e põe a oferta em Vídeos.
 *   GET  /      -> { ok: true } (teste: o Worker está no ar)
 *
 * Instalação (Cloudflare):
 *   1. Workers & Pages → Create → Worker → nome: farejadinhos-reels → Deploy
 *      → Edit code → apagar tudo, colar ESTE arquivo → Deploy
 *   2. Settings → Variables and Secrets → Add (Type: Secret), duas vezes:
 *        SENHA_PAINEL → a mesma senha do painel do site
 *        GITHUB_TOKEN → token do GitHub (fine-grained) só do repositório farejadinhos-yang,
 *                       com permissão "Contents: Read and write" e "Actions: Read and write"
 *      → Deploy
 *   3. O endereço do Worker (….workers.dev) vai no topo de painel/reels.html (REELS_WORKER).
 * O token fica só na Cloudflare; o navegador nunca vê.
 */

const SITE = "https://farejadinhosdayang.com.br";
const ORIGENS = [SITE, "https://www.farejadinhosdayang.com.br", "https://farejadinhosdayang.github.io"];
const REPO = "FarejadinhosDaYang/farejadinhos-yang";
const TAG_ENTRADA = "reels-entrada";
const MAX_MB = 95;

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
  return new Response(JSON.stringify(d), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origem) } });
}

async function gh(env, caminho, opcoes = {}) {
  const url = caminho.startsWith("http") ? caminho : "https://api.github.com" + caminho;
  const r = await fetch(url, {
    ...opcoes,
    headers: {
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "farejadinhos-reels",
      ...(opcoes.headers || {})
    }
  });
  return r;
}

async function releaseEntrada(env) {
  let r = await gh(env, `/repos/${REPO}/releases/tags/${TAG_ENTRADA}`);
  if (r.status === 404) {
    r = await gh(env, `/repos/${REPO}/releases`, {
      method: "POST",
      body: JSON.stringify({ tag_name: TAG_ENTRADA, target_commitish: "main", name: "Reels (arquivos recebidos)",
        body: "Vídeos e vozes enviados pelo painel pra montar Reels. Apagados sozinhos depois de montar.", prerelease: true })
    });
  }
  if (!r.ok) throw new Error("GitHub (release): " + r.status + " " + (await r.text()).slice(0, 200));
  return (await r.json()).id;
}

async function subir(env, releaseId, nome, arquivo, tipo) {
  const url = `https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(nome)}`;
  const r = await gh(env, url, { method: "POST", body: arquivo, headers: { "Content-Type": tipo || "application/octet-stream" } });
  if (!r.ok) throw new Error("GitHub (upload " + nome + "): " + r.status + " " + (await r.text()).slice(0, 200));
}

function extensao(nome, padrao) {
  const m = /\.([a-z0-9]{2,4})$/i.exec(nome || "");
  return m ? m[1].toLowerCase() : padrao;
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origem) });
    const rota = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && rota === "/") return json({ ok: true }, 200, origem);
    if (request.method !== "POST" || rota !== "/reel") return json({ erro: "rota não encontrada" }, 404, origem);

    try {
      const form = await request.formData();
      if (!env.SENHA_PAINEL || form.get("senha") !== env.SENHA_PAINEL) return json({ erro: "senha incorreta" }, 401, origem);
      if (!env.GITHUB_TOKEN) return json({ erro: "falta o segredo GITHUB_TOKEN no Worker" }, 500, origem);

      const video = form.get("video"), voz = form.get("voz");
      let pedido = {};
      try { pedido = JSON.parse(form.get("pedido") || "{}"); } catch (e) { return json({ erro: "pedido inválido" }, 400, origem); }
      if (!video || typeof video === "string" || !voz || typeof voz === "string") return json({ erro: "mande o vídeo e a voz" }, 400, origem);
      if (!String(pedido.texto || "").trim()) return json({ erro: "falta o texto da narração" }, 400, origem);
      if (video.size > MAX_MB * 1e6 || voz.size > 30e6) return json({ erro: `arquivo grande demais (máx. ${MAX_MB} MB)` }, 413, origem);

      const agora = new Date(Date.now() - 3 * 3600e3).toISOString();      // horário de Brasília
      const id = agora.slice(0, 10).replace(/-/g, "") + "-" + agora.slice(11, 19).replace(/:/g, "") + "-" +
                 Math.random().toString(36).slice(2, 6);
      const ev = extensao(video.name, "mp4"), ea = extensao(voz.name, "mp3");
      pedido = { ...pedido, id, video: `${id}-fonte.${ev}`, voz: `${id}-voz.${ea}` };

      const rel = await releaseEntrada(env);
      await subir(env, rel, pedido.video, video, video.type || "video/mp4");
      await subir(env, rel, pedido.voz, voz, voz.type || "audio/mpeg");
      await subir(env, rel, `${id}-pedido.json`, JSON.stringify(pedido), "application/json");

      const d = await gh(env, `/repos/${REPO}/actions/workflows/gerar-reel.yml/dispatches`, {
        method: "POST", body: JSON.stringify({ ref: "main", inputs: { id } })
      });
      if (!d.ok) throw new Error("GitHub (disparar): " + d.status + " " + (await d.text()).slice(0, 200));
      return json({ ok: true, id }, 200, origem);
    } catch (e) {
      return json({ erro: String(e.message || e) }, 500, origem);
    }
  }
};
