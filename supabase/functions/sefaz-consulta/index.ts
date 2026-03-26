import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const { cnpj, certificado_base64, senha_certificado, ambiente } =
      await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: "CNPJ obrigatório" }),
        { status: 400, headers }
      );
    }

    if (!certificado_base64 || !senha_certificado) {
      return new Response(
        JSON.stringify({
          error: "certificado_requerido",
          message:
            "Certificado digital A1 (.pfx) e senha são necessários para consultar a SEFAZ",
          notas: [],
        }),
        { status: 200, headers }
      );
    }

    // TODO: implementar autenticação mTLS com certificado A1 e consulta SEFAZ
    // Endpoint produção:   https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
    // Endpoint homologação: https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
    //
    // Fluxo quando certificado real disponível:
    //   1. Decodificar certificado_base64 → Uint8Array
    //   2. Usar node-forge ou Deno TLS para autenticar com mTLS
    //   3. Montar envelope SOAP nfeDistDFeInteresse
    //   4. POST ao endpoint SEFAZ com client certificate
    //   5. Parsear XML de resposta e extrair lista de NF-e

    return new Response(
      JSON.stringify({
        status: "aguardando_certificado",
        message:
          "Infraestrutura pronta. Insira o certificado A1 (.pfx) para consultar a SEFAZ.",
        notas: [],
        cnpj,
        ambiente: ambiente || "producao",
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers }
    );
  }
});
