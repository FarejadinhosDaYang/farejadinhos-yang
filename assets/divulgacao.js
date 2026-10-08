/* ==========================================
 * DIVULGAÇÃO — arte do story + legenda
 *
 * Usado pelo cadastro (painel/index.html) logo depois de enviar uma
 * oferta, e pelo painel de ofertas ativas (painel/ofertas.html), pra
 * gerar a arte e a legenda de qualquer oferta que já está no site.
 *
 * Tudo acontece no navegador, sem depender do Worker nem do GitHub.
 *
 *   FarejadinhosDivulgacao.gerarArte(dados)  -> Promise<Blob> (PNG 1080x1920)
 *   FarejadinhosDivulgacao.legenda(dados)    -> texto pronto pra colar
 *
 * dados = { produto, preco, precoAntigo, cupom, categoria, link,
 *           chamada (opcional, só legenda),
 *           imagem: <img> já carregada OU endereço da foto,
 *           assets: caminho da pasta assets (ex.: "../assets/") }
 * ========================================== */

(function(){

  const COR = {
    red: "#E5232E",
    redDark: "#C21A24",
    orange: "#F7941D",
    cream2: "#FFFAF1",
    ink: "#2B1B12",
    muted: "#8A7563",
    line: "#F0DFC4"
  };

  const EMOJI_CATEGORIA = {
    "Casa": "🏠",
    "Café": "☕",
    "Academia": "🏋️",
    "Eletrônicos": "🔌",
    "Beleza": "💄",
    "Moda": "👕",
    "Pet": "🐾",
    "Cozinha": "🍳",
    "Utilidades": "🧰"
  };

  // "R$ 1.299,90" / "1299,90" / "129.9" -> número
  function numero(valor){
    if(valor === undefined || valor === null || valor === "") return null;
    let s = String(valor).replace(/[^\d.,]/g, "");
    if(s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function comReais(valor){
    valor = String(valor || "").trim();
    if(!valor) return "";
    return /^R\$/i.test(valor) ? valor : "R$ " + valor;
  }

  function formatarBR(n){
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function descontoPct(preco, precoAntigo){
    const p = numero(preco), a = numero(precoAntigo);
    if(p === null || a === null || a <= p) return 0;
    return Math.round((1 - p / a) * 100);
  }

  function carregarImagem(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function quebrarTexto(ctx, texto, larguraMax){
    const palavras = String(texto || "").split(/\s+/);
    const linhas = [];
    let atual = "";
    palavras.forEach(p => {
      const teste = atual ? atual + " " + p : p;
      if(ctx.measureText(teste).width > larguraMax && atual){
        linhas.push(atual);
        atual = p;
      } else {
        atual = teste;
      }
    });
    if(atual) linhas.push(atual);
    return linhas;
  }

  function retanguloArredondado(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- ARTE DO STORY ---------- */

  async function gerarArte(dados){

    if(document.fonts && document.fonts.ready){
      try{ await document.fonts.ready; }catch(e){}
    }

    const assets = dados.assets || "../assets/";

    let foto = null;
    if(dados.imagem instanceof HTMLImageElement){
      foto = dados.imagem;
    } else if(dados.imagem){
      try{ foto = await carregarImagem(dados.imagem); }catch(e){ foto = null; }
    }

    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    /* Fundo com o gradiente da marca */
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, COR.red);
    grad.addColorStop(0.55, "#f0462f");
    grad.addColorStop(1, COR.orange);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* Textura leve de patinhas */
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.font = "340px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("🐾", -40, 300);
    ctx.fillText("🐾", 760, 1900);
    ctx.restore();

    /* Badge + nome no topo */
    try{
      const badge = await carregarImagem(assets + "yang-badge.png");
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 150, 65, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(badge, 85, 85, 130, 130);
      ctx.restore();
    }catch(e){}

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 46px 'Baloo 2', Arial, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Farejadinhos da Yang", 240, 162);

    /* Cartão central */
    const cardX = 60, cardY = 320, cardW = W - 120, cardH = 1290;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = COR.cream2;
    retanguloArredondado(ctx, cardX, cardY, cardW, cardH, 48);
    ctx.fill();
    ctx.restore();

    /* Foto do produto: INTEIRA dentro do quadrado branco (sem cortar),
       com um respiro em volta — vale pra print ou foto da loja */
    const fotoX = cardX + 50, fotoY = cardY + 50, fotoTam = cardW - 100;
    ctx.save();
    retanguloArredondado(ctx, fotoX, fotoY, fotoTam, fotoTam, 32);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fotoX, fotoY, fotoTam, fotoTam);

    if(foto){
      const iw = foto.naturalWidth || foto.width;
      const ih = foto.naturalHeight || foto.height;
      const area = fotoTam * 0.92;
      const escala = Math.min(area / iw, area / ih);
      const dw = iw * escala, dh = ih * escala;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(foto, fotoX + (fotoTam - dw) / 2, fotoY + (fotoTam - dh) / 2, dw, dh);
    }
    ctx.restore();

    /* Selo de desconto */
    const pct = descontoPct(dados.preco, dados.precoAntigo);
    if(pct > 0){
      const selo = `-${pct}%`;
      ctx.font = "800 44px 'Baloo 2', Arial, sans-serif";
      const largura = ctx.measureText(selo).width + 54;
      ctx.fillStyle = COR.red;
      retanguloArredondado(ctx, fotoX + fotoTam - largura - 24, fotoY + 24, largura, 72, 22);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(selo, fotoX + fotoTam - largura / 2 - 24, fotoY + 24 + 50);
      ctx.textAlign = "left";
    }

    /* Textos abaixo da foto */
    let y = fotoY + fotoTam + 66;

    if(dados.categoria){
      ctx.font = "700 28px 'Work Sans', Arial, sans-serif";
      ctx.fillStyle = COR.muted;
      ctx.fillText(String(dados.categoria).toUpperCase(), fotoX, y);
      y += 50;
    }

    ctx.font = "700 50px 'Baloo 2', Arial, sans-serif";
    ctx.fillStyle = COR.ink;
    let linhas = quebrarTexto(ctx, dados.produto, fotoTam);
    if(linhas.length > 3){
      linhas = linhas.slice(0, 3);
      linhas[2] = linhas[2].replace(/\s*\S*$/, "") + "…";
    }
    linhas.forEach(l => { ctx.fillText(l, fotoX, y); y += 58; });

    y += 16;

    const precoAntigo = comReais(dados.precoAntigo);
    if(precoAntigo && pct > 0){
      ctx.font = "500 34px 'Work Sans', Arial, sans-serif";
      ctx.fillStyle = COR.muted;
      const larg = ctx.measureText(precoAntigo).width;
      ctx.fillText(precoAntigo, fotoX, y);
      ctx.strokeStyle = COR.muted;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fotoX, y - 12);
      ctx.lineTo(fotoX + larg, y - 12);
      ctx.stroke();
      y += 58;
    }

    ctx.font = "800 68px 'Baloo 2', Arial, sans-serif";
    ctx.fillStyle = COR.redDark;
    ctx.fillText(comReais(dados.preco), fotoX, y);
    y += 70;

    if(dados.cupom){
      const textoCupom = `🏷️ CUPOM: ${dados.cupom}`;
      ctx.font = "700 32px 'Work Sans', Arial, sans-serif";
      const largCupom = ctx.measureText(textoCupom).width + 40;
      ctx.strokeStyle = COR.orange;
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3;
      retanguloArredondado(ctx, fotoX, y - 42, largCupom, 60, 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COR.redDark;
      ctx.fillText(textoCupom, fotoX + 20, y - 4);
    }

    /* Rodapé */
    ctx.textAlign = "center";
    ctx.font = "700 38px 'Baloo 2', Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("🐾 @farejadinhosdayang", W / 2, H - 90);
    ctx.textAlign = "left";

    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Não deu pra gerar a imagem.")), "image/png");
    });
  }

  /* ---------- LEGENDA ---------- */

  // "Kit 6 ..." -> preço por unidade
  function precoCada(produto, preco){
    const m = String(produto || "").match(/\bkit\s+(\d+)\b/i);
    if(!m) return null;
    const qtd = parseInt(m[1], 10);
    const n = numero(preco);
    if(!qtd || qtd < 2 || n === null) return null;
    return formatarBR(n / qtd);
  }

  function legenda(dados){

    const emoji = EMOJI_CATEGORIA[dados.categoria] || "🔥";
    const preco = comReais(dados.preco);
    const precoAntigo = comReais(dados.precoAntigo);
    const linhas = [];

    if(dados.chamada){
      linhas.push(String(dados.chamada).toUpperCase());
      linhas.push("");
    }

    linhas.push(`${emoji} *${dados.produto}*`);
    linhas.push("");

    const cada = precoCada(dados.produto, dados.preco);
    const sufixo = cada ? ` (${cada} cada)` : "";

    if(precoAntigo && descontoPct(dados.preco, dados.precoAntigo) > 0){
      linhas.push(`🔥 ~DE ${precoAntigo}~ | POR ${preco} no Pix${sufixo}`);
    } else {
      linhas.push(`🔥 POR ${preco} no Pix${sufixo}`);
    }

    if(dados.cupom){
      linhas.push("");
      linhas.push(`🏷️ CUPOM: *${dados.cupom}*`);
    }

    if(dados.link){
      linhas.push("");
      linhas.push(`🔗 ${dados.link}`);
    }

    return linhas.join("\n");
  }

  window.FarejadinhosDivulgacao = { gerarArte, legenda, descontoPct, carregarImagem };

})();
