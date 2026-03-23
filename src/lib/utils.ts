import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calcularCompetenciaComissao(dataVenda: string, colaborador: any) {
  const diaInicio = colaborador.dia_inicio_fechamento;
  const diaFim = colaborador.dia_fim_fechamento;
  const diaPag = colaborador.dia_pagamento_comissao;

  if (!diaInicio || !diaFim || !diaPag) return null;

  const data = new Date(dataVenda + "T12:00:00");
  const dia = data.getDate();
  const mes = data.getMonth();
  const ano = data.getFullYear();

  let mesCompetencia: number;
  let anoCompetencia: number;

  if (diaInicio > diaFim) {
    if (dia >= diaInicio) {
      const prox = new Date(ano, mes + 1, 1);
      mesCompetencia = prox.getMonth();
      anoCompetencia = prox.getFullYear();
    } else {
      mesCompetencia = mes;
      anoCompetencia = ano;
    }
  } else {
    if (dia <= diaFim) {
      mesCompetencia = mes;
      anoCompetencia = ano;
    } else {
      const prox = new Date(ano, mes + 1, 1);
      mesCompetencia = prox.getMonth();
      anoCompetencia = prox.getFullYear();
    }
  }

  const mesStr = anoCompetencia + "-" + String(mesCompetencia + 1).padStart(2, "0");
  const dataPagamento = new Date(anoCompetencia, mesCompetencia, diaPag);

  return {
    mes_competencia: mesStr,
    vencimento: dataPagamento.toISOString().slice(0, 10),
  };
}

export function periodoFechamentoLabel(colaborador: any, mesCompetencia?: string) {
  const diaInicio = colaborador.dia_inicio_fechamento;
  const diaFim = colaborador.dia_fim_fechamento;
  if (!diaInicio || !diaFim) return "—";

  if (!mesCompetencia) {
    return `Dia ${diaInicio} ao ${diaFim}`;
  }

  const [ano, m] = mesCompetencia.split("-").map(Number);
  const pad = (d: number, mes: number, a: number) =>
    `${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${a}`;

  if (diaInicio > diaFim) {
    const mesAnterior = m === 1 ? 12 : m - 1;
    const anoAnterior = m === 1 ? ano - 1 : ano;
    return `${pad(diaInicio, mesAnterior, anoAnterior)} a ${pad(diaFim, m, ano)}`;
  }
  return `${pad(diaInicio, m, ano)} a ${pad(diaFim, m, ano)}`;
}

export function gerarParcelas(dadosBase: any, valorParcelas: number[], primeiroVencimento: string, totalParcelas: number) {
  const grupoParcela = crypto.randomUUID();
  const [ano, mes, dia] = primeiroVencimento.split("-").map(Number);

  return Array.from({ length: totalParcelas }, (_, i) => {
    const dataVenc = new Date(ano, mes - 1 + i, dia);
    if (dataVenc.getDate() !== dia) {
      dataVenc.setDate(0);
    }

    return {
      ...dadosBase,
      valor: valorParcelas[i],
      vencimento: dataVenc.toISOString().slice(0, 10),
      parcela_atual: i + 1,
      total_parcelas: totalParcelas,
      grupo_parcela: grupoParcela,
      status: "pendente",
    };
  });
}

export function labelParcela(atual: number, total: number) {
  if (!total || total <= 1) return "";
  return `${atual}x${total}`;
}
