import { useState, useEffect } from "react";
import { useCobrancaConfig, useSaveCobrancaConfig } from "@/hooks/useCobrancas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface Props {
  companyId: string;
}

const DEFAULT_MSG_VENCIMENTO = "Olá, {nome_cliente}! Passando para lembrar que sua fatura de R$ {valor} vence em {data_vencimento}. Em caso de dúvidas, entre em contato conosco.";
const DEFAULT_MSG_ATRASO = "Olá, {nome_cliente}. Identificamos que sua fatura de R$ {valor} com vencimento em {data_vencimento} encontra-se em atraso. Por favor, regularize o quanto antes.";

const ConfiguracaoCobrancaTab = ({ companyId }: Props) => {
  const { data: config, isLoading } = useCobrancaConfig(companyId);
  const saveConfig = useSaveCobrancaConfig();

  const [whatsapp, setWhatsapp] = useState("");
  const [msgVencimento, setMsgVencimento] = useState(DEFAULT_MSG_VENCIMENTO);
  const [msgAtraso, setMsgAtraso] = useState(DEFAULT_MSG_ATRASO);

  useEffect(() => {
    if (config) {
      setWhatsapp(config.whatsapp_financeiro || "");
      setMsgVencimento(config.msg_vencimento || DEFAULT_MSG_VENCIMENTO);
      setMsgAtraso(config.msg_atraso || DEFAULT_MSG_ATRASO);
    }
  }, [config]);

  const handleSave = async () => {
    if (!msgVencimento.trim() || !msgAtraso.trim()) {
      return toast({ title: "Preencha as mensagens", variant: "destructive" });
    }
    await saveConfig.mutateAsync({ companyId, whatsapp_financeiro: whatsapp, msg_vencimento: msgVencimento, msg_atraso: msgAtraso });
    toast({ title: "Configurações salvas" });
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const varHint = (
    <p className="text-xs text-muted-foreground mt-1">
      Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{nome_cliente}"}</code>{" "}
      <code className="bg-muted px-1 rounded">{"{valor}"}</code>{" "}
      <code className="bg-muted px-1 rounded">{"{data_vencimento}"}</code>
    </p>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Configurações de Cobrança Automática</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium">WhatsApp do financeiro</label>
            <Input
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="5511999999999"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Número com código do país, sem espaços ou traços.</p>
          </div>

          <div>
            <label className="text-sm font-medium">Mensagem — vencimento normal</label>
            <Textarea
              rows={4}
              value={msgVencimento}
              onChange={e => setMsgVencimento(e.target.value)}
              className="mt-1"
            />
            {varHint}
          </div>

          <div>
            <label className="text-sm font-medium">Mensagem — em atraso</label>
            <Textarea
              rows={4}
              value={msgAtraso}
              onChange={e => setMsgAtraso(e.target.value)}
              className="mt-1"
            />
            {varHint}
          </div>

          <Button onClick={handleSave} disabled={saveConfig.isPending}>
            {saveConfig.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <Save className="w-4 h-4 mr-1" />Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracaoCobrancaTab;
