export interface PixData {
  txid?: string;
  valor?: number;
  nome_recebedor?: string;
  cidade?: string;
  descricao?: string;
  chave_pix?: string;
}

export function parsePixQRCode(payload: string): PixData | null {
  try {
    const result: PixData = {};
    let i = 0;
    while (i < payload.length - 4) {
      const id = payload.substring(i, i + 2);
      const lenStr = payload.substring(i + 2, i + 4);
      const len = parseInt(lenStr);
      if (isNaN(len)) break;
      const val = payload.substring(i + 4, i + 4 + len);
      if (id === "54") result.valor = parseFloat(val);
      if (id === "59") result.nome_recebedor = val;
      if (id === "60") result.cidade = val;
      if (id === "26") {
        let j = 0;
        while (j < val.length - 4) {
          const sid = val.substring(j, j + 2);
          const slen = parseInt(val.substring(j + 2, j + 4));
          if (isNaN(slen)) break;
          const sval = val.substring(j + 4, j + 4 + slen);
          if (sid === "01") result.chave_pix = sval;
          if (sid === "05") result.txid = sval;
          j += 4 + slen;
        }
      }
      if (id === "62") {
        let j = 0;
        while (j < val.length - 4) {
          const sid = val.substring(j, j + 2);
          const slen = parseInt(val.substring(j + 2, j + 4));
          if (isNaN(slen)) break;
          const sval = val.substring(j + 4, j + 4 + slen);
          if (sid === "05") result.descricao = sval;
          j += 4 + slen;
        }
      }
      i += 4 + len;
    }
    if (!result.valor && !result.chave_pix) return null;
    return result;
  } catch { return null; }
}

export function parseOpenFinanceData(input: string) {
  try {
    const json = JSON.parse(input);
    if (json.transactions) return json.transactions;
    if (Array.isArray(json)) return json;
    if (json.amount || json.value || json.valor) return [json];
  } catch {}
  try {
    const src = input.includes("?") ? input.split("?")[1] : input;
    const params = new URLSearchParams(src);
    const amount = params.get("amount") || params.get("valor");
    if (amount) return [{
      amount: parseFloat(amount),
      date: params.get("date") || params.get("data"),
      description: params.get("desc") || params.get("descricao") || "Open Finance",
    }];
  } catch {}
  return null;
}
