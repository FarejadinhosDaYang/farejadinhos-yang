/**
 * Farejadinhos da Yang — cupons do dia
 *
 * Lê o texto colado das mensagens de cupom (WhatsApp, Telegram...) e
 * descobre, pra cada produto, o melhor cupom cujas regras ele cumpre.
 *
 *   FarejadinhosCupons.ler(texto)             -> lista de cupons
 *   FarejadinhosCupons.lojaDoLink(link)       -> "Shopee" | "Mercado Livre" | ""
 *   FarejadinhosCupons.opcoes(cupons, preco, link) -> cupons que servem, melhor primeiro
 *   FarejadinhosCupons.descrever(cupom)       -> "10% até R$ 200 · mín. R$ 149"
 *
 * Cada cupom: { codigo, loja, tipo: "%" | "R$" | "", valor, minimo, teto, link }
 * tipo "" = cupom de um produto específico (anúncio com "CUPOM:" sem regra):
 * só é sugerido quando o link do produto é o mesmo do anúncio.
 *
 * É uma conta pelas regras escritas na mensagem — não testa no carrinho.
 * Regras escondidas (primeira compra, só alguns vendedores...) não aparecem.
 */

(function () {

    function numeroBR(txt) {
        if (txt == null) return 0;
        var s = String(txt).replace(/[^\d.,]/g, "");
        if (!s) return 0;
        if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
        else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
        var n = parseFloat(s);
        return isFinite(n) ? n : 0;
    }

    function lojaDoLink(link) {
        var l = String(link || "").toLowerCase();
        if (/shopee|shp\.ee/.test(l)) return "Shopee";
        if (/mercadoli[bv]re|meli\.la|mlb-?\d|mercadolibre/.test(l)) return "Mercado Livre";
        if (/amazon\.|amzn\.(to|com)|a\.co\//.test(l)) return "Amazon";
        return "";
    }

    function lojaDoTexto(t) {
        var l = String(t || "").toLowerCase();
        if (/shopee/.test(l)) return "Shopee";
        if (/mercado ?livre|\bmeli\b|\bml\b/.test(l)) return "Mercado Livre";
        if (/amazon/.test(l)) return "Amazon";
        return "";
    }

    function lerRegra(texto) {
        var t = String(texto || "").replace(/\s+/g, " ");
        var r = { tipo: "", valor: 0, minimo: 0, teto: 0 };

        var pct = t.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:OFF|desconto)/i) || t.match(/(\d+(?:[.,]\d+)?)\s*%/);
        var fixo = t.match(/R\$\s*([\d.,]+)\s*(?:OFF|de desconto)/i);

        if (pct) { r.tipo = "%"; r.valor = numeroBR(pct[1]); }
        else if (fixo) { r.tipo = "R$"; r.valor = numeroBR(fixo[1]); }

        var min = t.match(/(?:acima de|a partir de|compras? (?:acima )?de|m[ií]nimo(?: de)?|\bem)\s*R\$\s*([\d.,]+)/i);
        if (min) r.minimo = numeroBR(min[1]);

        var teto = t.match(/limitad[oa]\s*(?:a|em|até)?\s*R\$\s*([\d.,]+)/i) || t.match(/(?:até|máx(?:imo)?\.?)\s*R\$\s*([\d.,]+)\s*(?:OFF|de desconto)/i);
        if (teto && r.tipo === "%") r.teto = numeroBR(teto[1]);

        // "R$30 OFF em R$ 149" — o mínimo não pode ser o próprio desconto
        if (r.tipo === "R$" && r.minimo === r.valor) r.minimo = 0;

        return r;
    }

    function limparLinha(l) {
        // tira "[14:15, 13/10/2026] Fulano:" que o WhatsApp põe ao copiar
        return String(l || "")
            .replace(/^\s*\[[^\]]{4,40}\]\s*[^:]{0,60}:\s*/, "")
            .replace(/[*_~]/g, "")
            .trim();
    }

    function ler(texto) {
        var linhas = String(texto || "").split(/\r?\n/).map(limparLinha);
        var cupons = [];
        var bloco = [];          // linhas desde o cupom anterior
        var ultimo = null;       // cupom esperando o link

        for (var i = 0; i < linhas.length; i++) {
            var linha = linhas[i];
            if (!linha) continue;

            var url = linha.match(/https?:\/\/\S+/);
            var m = linha.match(/(?:cupom|c[óo]digo)\s*:\s*([A-Z0-9][A-Z0-9_-]{2,29})\b/i);

            if (m && !/^https?:/i.test(m[1])) {
                var codigo = m[1].toUpperCase();
                var textoBloco = bloco.join(" ");
                // A regra é a última linha do bloco que fala de % ou R$ OFF
                var linhaRegra = "";
                for (var j = bloco.length - 1; j >= 0; j--) {
                    if (/%|R\$\s*[\d.,]+\s*(OFF|de desconto)|OFF/i.test(bloco[j]) && !/\bDE\s+\d/.test(bloco[j])) {
                        linhaRegra = bloco[j];
                        // regra quebrada em 2 linhas ("limitado a" / "R$200 OFF")
                        if (bloco[j + 1] && /^R\$|^OFF/i.test(bloco[j + 1])) linhaRegra += " " + bloco[j + 1];
                        break;
                    }
                }
                var regra = lerRegra(linhaRegra);
                ultimo = {
                    codigo: codigo,
                    loja: lojaDoTexto(textoBloco + " " + linha),
                    tipo: regra.tipo,
                    valor: regra.valor,
                    minimo: regra.minimo,
                    teto: regra.teto,
                    link: "",
                    produto: regra.tipo ? "" : (bloco.filter(function (b) { return !/^https?:|^meli\.la$|^DE |POR /i.test(b); }).slice(-1)[0] || "")
                };
                cupons.push(ultimo);
                bloco = [];
                if (url) { ultimo.link = url[0]; ultimo.loja = ultimo.loja || lojaDoLink(url[0]); ultimo = null; }
                continue;
            }

            if (url && ultimo) {
                ultimo.link = url[0];
                ultimo.loja = lojaDoLink(url[0]) || ultimo.loja;
                ultimo = null;
                continue;
            }

            bloco.push(linha);
        }

        // Mesmo código repetido: fica a versão com regra (e junta loja/link)
        var porCodigo = {};
        var saida = [];
        cupons.forEach(function (c) {
            var ja = porCodigo[c.codigo];
            if (!ja) { porCodigo[c.codigo] = c; saida.push(c); return; }
            if (!ja.tipo && c.tipo) {
                ["tipo", "valor", "minimo", "teto"].forEach(function (k) { ja[k] = c[k]; });
                ja.produto = "";
            }
            ja.loja = ja.loja || c.loja;
            if (!ja.link) ja.link = c.link;
        });
        return saida;
    }

    function desconto(cupom, preco) {
        if (!cupom.tipo || !(preco > 0)) return 0;
        if (cupom.minimo && preco < cupom.minimo) return 0;
        var d = cupom.tipo === "%" ? preco * cupom.valor / 100 : cupom.valor;
        if (cupom.teto) d = Math.min(d, cupom.teto);
        return Math.min(d, preco);
    }

    function mesmoLink(a, b) {
        function norm(x) { return String(x || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/$/, ""); }
        return a && b && norm(a) === norm(b);
    }

    // Cupons que servem pro produto, o de maior desconto primeiro
    function opcoes(cupons, preco, link, linkProduto) {
        var p = typeof preco === "number" ? preco : numeroBR(preco);
        var loja = lojaDoLink(link) || lojaDoLink(linkProduto);
        var lista = [];
        (cupons || []).forEach(function (c) {
            if (c.loja && loja && c.loja !== loja) return;
            if (!c.tipo) {
                if (mesmoLink(c.link, link) || mesmoLink(c.link, linkProduto)) lista.push({ cupom: c, desconto: 0, precoFinal: 0 });
                return;
            }
            if (!c.loja && !loja) return;
            var d = desconto(c, p);
            if (d > 0) lista.push({ cupom: c, desconto: d, precoFinal: Math.max(0, p - d) });
        });
        // cupom do próprio anúncio do produto vem primeiro; depois, o maior desconto
        lista.sort(function (a, b) {
            if (!a.cupom.tipo !== !b.cupom.tipo) return a.cupom.tipo ? 1 : -1;
            return b.desconto - a.desconto;
        });
        return lista;
    }

    function dinheiro(n) {
        return "R$ " + Number(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    function descrever(c) {
        if (!c.tipo) return "cupom do anúncio" + (c.produto ? " (" + c.produto + ")" : "") + " · regra não informada";
        var t = c.tipo === "%" ? c.valor + "% OFF" : dinheiro(c.valor) + " OFF";
        if (c.teto) t += " até " + dinheiro(c.teto);
        if (c.minimo > 1) t += " · mín. " + dinheiro(c.minimo);
        return t;
    }

    window.FarejadinhosCupons = {
        ler: ler,
        lojaDoLink: lojaDoLink,
        opcoes: opcoes,
        descrever: descrever,
        dinheiro: dinheiro,
        numeroBR: numeroBR
    };

})();
