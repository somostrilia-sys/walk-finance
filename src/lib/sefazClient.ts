import { supabase } from "@/integrations/supabase/client";

export interface NFeSefaz {
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  emitente_nome: string;
  emitente_cnpj: string;
  valor_total: number;
  status: string;
}

export interface SefazConfig {
  cnpj: string;
  certificado_base64?: string;
  senha_certificado?: string;
  ambiente: "producao" | "homologacao";
}

export interface CertificadoAtivo {
  id: string;
  arquivo_url: string;
  ambiente: string;
  data_validade: string | null;
  ativo: boolean;
}

export async function consultarNFsSefaz(config: SefazConfig): Promise<NFeSefaz[]> {
  const { data, error } = await supabase.functions.invoke("sefaz-consulta", {
    body: config,
  });
  if (error) throw error;
  if (data?.error && data.error !== "certificado_requerido") {
    throw new Error(data.message || data.error);
  }
  return (data?.notas as NFeSefaz[]) || [];
}

export async function salvarCertificado(
  companyId: string,
  file: File,
  _senha: string
): Promise<CertificadoAtivo> {
  const path = `${companyId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("certificados")
    .upload(path, file, { contentType: "application/x-pkcs12", upsert: true });

  if (uploadError) throw uploadError;

  // Desativar certificados anteriores
  await supabase
    .from("empresa_certificados" as never)
    .update({ ativo: false } as never)
    .eq("company_id", companyId);

  const { data, error } = await supabase
    .from("empresa_certificados" as never)
    .insert({
      company_id: companyId,
      tipo: "A1",
      arquivo_url: path,
      ativo: true,
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as CertificadoAtivo;
}

export async function buscarCertificadoAtivo(
  companyId: string
): Promise<CertificadoAtivo | null> {
  const { data, error } = await supabase
    .from("empresa_certificados" as never)
    .select("*")
    .eq("company_id", companyId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as CertificadoAtivo | null) || null;
}

export async function carregarCertificadoDoStorage(
  arquivoUrl: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("certificados")
    .download(arquivoUrl);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
  return btoa(binary);
}
