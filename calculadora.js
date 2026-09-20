/**
 * Farejadinhos da Yang — Calculadora "Vale a pena parcelar?"
 *
 * Compara pagar à vista vs. parcelar (mesmo sem juros), considerando
 * que o dinheiro do "à vista" fica investido rendendo % do CDI
 * enquanto a pessoa vai pagando as parcelas mês a mês.
 *
 * Desconta Imposto de Renda regressivo (tabela de renda fixa) e
 * IOF regressivo (resgates com menos de 30 dias) de cada saque mensal.
 *
 * Isto é uma ESTIMATIVA educativa, não é consultoria financeira ou
 * fiscal. Alíquotas e regras podem mudar — confirme na Receita Federal
 * e com sua instituição financeira antes de decidir.
 */

(function (global) {

    // ---------------------------------------------
    // TABELAS OFICIAIS (renda fixa)
    // ---------------------------------------------

    function aliquotaIR(dias) {
        if (dias <= 180) return 0.225;
        if (dias <= 360) return 0.20;
        if (dias <= 720) return 0.175;
        return 0.15;
    }

    // IOF regressivo: só incide em resgates com menos de 30 dias
    var TABELA_IOF = [
        96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
        63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
        30, 26, 23, 20, 16, 13, 10, 6, 3, 0
    ];

    function aliquotaIOF(dias) {
        if (dias >= 30) return 0;
        if (dias <= 0) return 0.96;
        return TABELA_IOF[dias - 1] / 100;
    }

    // ---------------------------------------------
    // CDI — Banco Central (série 12, CDI diária)
    // ---------------------------------------------

    var CDI_URL =
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json";

    var cdiCache = null;
    var cdiPromise = null;

    function buscarCDI() {
        if (cdiPromise) return cdiPromise;

        cdiPromise = fetch(CDI_URL)
            .then(function (resp) {
                if (!resp.ok) throw new Error("CDI indisponível");
                return resp.json();
            })
            .then(function (data) {
                var registro = data[0];
                var diaria = parseFloat(String(registro.valor).replace(",", ".")) / 100;
                var anual = Math.pow(1 + diaria, 252) - 1;
                cdiCache = { anual: anual, diaria: diaria, data: registro.data };
                return cdiCache;
            })
            .catch(function (err) {
                cdiCache = null;
                throw err;
            });

        return cdiPromise;
    }

    // ---------------------------------------------
    // SIMULAÇÃO
    // ---------------------------------------------

    function taxaMensal(taxaAnualCDI, percentCDI) {
        var taxaAnualPessoal = taxaAnualCDI * (percentCDI / 100);
        return Math.pow(1 + taxaAnualPessoal, 1 / 12) - 1;
    }

    function simular(opts) {
        var precoAVista = opts.precoAVista;
        var precoAPrazo = opts.precoAPrazo;
        var parcelas = opts.parcelas;
        var percentCDI = opts.percentCDI;
        var taxaAnualCDI = opts.taxaAnualCDI;

        var balance = precoAVista;
        var principal = precoAVista;
        var dias = 0;
        var tMensal = taxaMensal(taxaAnualCDI, percentCDI);
        var parcela = precoAPrazo / parcelas;

        for (var m = 1; m <= parcelas; m++) {
            balance *= (1 + tMensal);
            dias += 30;

            var gainRatio = balance > 0 ? Math.max(0, (balance - principal) / balance) : 0;
            var irRate = aliquotaIR(dias);
            var iofRate = dias < 30 ? aliquotaIOF(dias) : 0;
            var aliquotaEfetiva = gainRatio * (iofRate + irRate * (1 - iofRate));

            var bruto = parcela / (1 - aliquotaEfetiva);
            balance -= bruto;
            principal -= bruto * (1 - gainRatio);
            if (principal < 0) principal = 0;
        }

        return balance;
    }

    // ---------------------------------------------
    // FORMATAÇÃO
    // ---------------------------------------------

    function formatarBRL(valor) {
        return valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    // ---------------------------------------------
    // WIDGET (renderiza formulário + resultado num container)
    // ---------------------------------------------

    function renderCalculadora(container, config) {
        config = config || {};

        var precoAVistaInicial = config.precoAVista || "";
        var precoAPrazoInicial = config.precoAPrazo || "";
        var compact = !!config.compact;

        container.innerHTML =
            '<div class="calc-yang' + (compact ? " calc-yang--compact" : "") + '">' +
            '<div class="calc-yang-grid">' +

            '<label>Preço à vista' +
            '<input type="text" inputmode="decimal" class="calc-av" placeholder="Ex.: 279,90" value="' + precoAVistaInicial + '">' +
            '</label>' +

            '<label>Preço a prazo (total)' +
            '<input type="text" inputmode="decimal" class="calc-ap" placeholder="Ex.: 299,90" value="' + precoAPrazoInicial + '">' +
            '</label>' +

            '<label>Número de parcelas' +
            '<input type="text" inputmode="numeric" class="calc-n" placeholder="Ex.: 10">' +
            '</label>' +

            '<label>Seu dinheiro rende quanto do CDI?' +
            '<input type="text" inputmode="decimal" class="calc-pct" placeholder="Ex.: 100">' +
            '</label>' +

            '</div>' +

            '<div class="calc-yang-cdi">Buscando o CDI atual…</div>' +

            '<button type="button" class="calc-yang-btn">🐾 CALCULAR</button>' +

            '<div class="calc-yang-resultado" style="display:none"></div>' +

            '</div>';

        var elAV = container.querySelector(".calc-av");
        var elAP = container.querySelector(".calc-ap");
        var elN = container.querySelector(".calc-n");
        var elPct = container.querySelector(".calc-pct");
        var elCdiInfo = container.querySelector(".calc-yang-cdi");
        var elBtn = container.querySelector(".calc-yang-btn");
        var elResultado = container.querySelector(".calc-yang-resultado");

        var cdiManualFallback = null;

        buscarCDI()
            .then(function (cdi) {
                elCdiInfo.innerHTML =
                    "CDI atual: <b>" + (cdi.anual * 100).toFixed(2).replace(".", ",") +
                    "% a.a.</b> <span class='calc-yang-cdi-data'>(BCB, " + cdi.data + ")</span>";
            })
            .catch(function () {
                elCdiInfo.innerHTML =
                    "Não consegui buscar o CDI agora. Informe a taxa CDI anual atual (%): " +
                    '<input type="text" inputmode="decimal" class="calc-cdi-manual" placeholder="Ex.: 13,75" style="width:80px;margin-left:6px">';
            });

        function parseNum(str) {
            if (!str) return NaN;
            str = String(str).trim().replace(/\./g, "").replace(",", ".");
            return parseFloat(str);
        }

        elBtn.addEventListener("click", function () {
            var precoAVista = parseNum(elAV.value);
            var precoAPrazo = parseNum(elAP.value);
            var parcelas = parseInt(elN.value, 10);
            var percentCDI = parseNum(elPct.value);

            var taxaAnualCDI;
            if (cdiCache) {
                taxaAnualCDI = cdiCache.anual;
            } else {
                var manual = container.querySelector(".calc-cdi-manual");
                taxaAnualCDI = manual ? parseNum(manual.value) / 100 : NaN;
            }

            if (
                isNaN(precoAVista) || isNaN(precoAPrazo) ||
                isNaN(parcelas) || parcelas <= 0 ||
                isNaN(percentCDI) || isNaN(taxaAnualCDI)
            ) {
                elResultado.style.display = "block";
                elResultado.className = "calc-yang-resultado calc-yang-resultado--erro";
                elResultado.innerHTML = "Preenche todos os campos certinho pra eu calcular 🐾";
                return;
            }

            var saldoFinal = simular({
                precoAVista: precoAVista,
                precoAPrazo: precoAPrazo,
                parcelas: parcelas,
                percentCDI: percentCDI,
                taxaAnualCDI: taxaAnualCDI
            });

            elResultado.style.display = "block";

            if (saldoFinal > 0.5) {
                elResultado.className = "calc-yang-resultado calc-yang-resultado--verde";
                elResultado.innerHTML =
                    "✅ <b>Vale a pena parcelar!</b><br>" +
                    "Você sai na frente em <b>" + formatarBRL(saldoFinal) + "</b> " +
                    "deixando o dinheiro rendendo e pagando aos poucos.";
            } else if (saldoFinal < -0.5) {
                elResultado.className = "calc-yang-resultado calc-yang-resultado--vermelho";
                elResultado.innerHTML =
                    "❌ <b>Melhor pagar à vista.</b><br>" +
                    "Parcelando, você perde <b>" + formatarBRL(Math.abs(saldoFinal)) + "</b> " +
                    "a mais no fim das contas.";
            } else {
                elResultado.className = "calc-yang-resultado calc-yang-resultado--neutro";
                elResultado.innerHTML =
                    "🟰 <b>Empata!</b> Não faz muita diferença parcelar ou pagar à vista aqui.";
            }
        });
    }

    global.FarejadinhosCalculadora = {
        buscarCDI: buscarCDI,
        simular: simular,
        aliquotaIR: aliquotaIR,
        aliquotaIOF: aliquotaIOF,
        formatarBRL: formatarBRL,
        render: renderCalculadora
    };

})(window);
