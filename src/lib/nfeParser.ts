export interface NFeDados {
  chave_acesso: string;        // infNFe.Id ou protNFe.chNFe
  numero: string;              // nNF
  serie: string;               // serie
  data_emissao: string;        // dhEmi
  emitente_nome: string;       // emit.xNome
  emitente_cnpj: string;       // emit.CNPJ
  destinatario_nome: string;   // dest.xNome
  destinatario_cnpj: string;   // dest.CNPJ
  valor_total: number;         // ICMSTot.vNF
  valor_icms: number;          // ICMSTot.vICMS
  valor_pis: number;           // ICMSTot.vPIS
  valor_cofins: number;        // ICMSTot.vCOFINS
  valor_iss: number;           // 0 (NF-e não tem ISS)
  natureza_operacao: string;   // natOp
  status: string;              // "processada" | "erro"
}

export function parseNFe(xmlString: string): NFeDados | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const get = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || "";
    return {
      chave_acesso: get("chNFe") || doc.querySelector("[Id]")?.getAttribute("Id")?.replace("NFe", "") || "",
      numero: get("nNF"),
      serie: get("serie"),
      data_emissao: get("dhEmi"),
      emitente_nome: get("xNome"), // primeiro xNome = emitente
      emitente_cnpj: get("CNPJ"),  // primeiro CNPJ = emitente
      destinatario_nome: doc.getElementsByTagName("xNome")[1]?.textContent || "",
      destinatario_cnpj: doc.getElementsByTagName("CNPJ")[1]?.textContent || "",
      valor_total: parseFloat(get("vNF") || "0"),
      valor_icms: parseFloat(get("vICMS") || "0"),
      valor_pis: parseFloat(get("vPIS") || "0"),
      valor_cofins: parseFloat(get("vCOFINS") || "0"),
      valor_iss: 0,
      natureza_operacao: get("natOp"),
      status: "processada",
    };
  } catch {
    return null;
  }
}
