import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";

interface ConfiguracaoCNPJModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  currentCnpj: string | null;
  currentSecundarios: string[];
  onSaved: () => void;
}

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function ConfiguracaoCNPJModal({
  open,
  onOpenChange,
  companyId,
  currentCnpj,
  currentSecundarios,
  onSaved,
}: ConfiguracaoCNPJModalProps) {
  const [cnpj, setCnpj] = useState(currentCnpj || "");
  const [secundarios, setSecundarios] = useState<string[]>(currentSecundarios || []);
  const [novoSecundario, setNovoSecundario] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Aplica máscara ao carregar — suporta tanto dígitos puros quanto já mascarados
      setCnpj(currentCnpj ? maskCnpj(currentCnpj) : "");
      setSecundarios((currentSecundarios || []).map((c) => maskCnpj(c)));
      setNovoSecundario("");
    }
  }, [open, currentCnpj, currentSecundarios]);

  function adicionarSecundario() {
    const masked = maskCnpj(novoSecundario);
    if (masked.length >= 18 && !secundarios.includes(masked)) {
      setSecundarios((prev) => [...prev, masked]);
      setNovoSecundario("");
    }
  }

  async function handleSave() {
    // Remove máscara antes de salvar — o banco espera apenas dígitos
    const cnpjDigitos = cnpj.replace(/\D/g, "") || null;
    const secundariosDigitos = secundarios.length > 0
      ? secundarios.map((c) => c.replace(/\D/g, ""))
      : null;

    // Validação básica: CNPJ deve ter 14 dígitos ou estar vazio
    if (cnpjDigitos && cnpjDigitos.length !== 14) {
      toast({ title: "CNPJ inválido", description: "O CNPJ deve ter 14 dígitos.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        cnpj: cnpjDigitos,
        cnpj_secundarios: secundariosDigitos,
      } as never)
      .eq("id", companyId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar CNPJ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ CNPJ atualizado com sucesso!" });
    logAudit({ companyId, acao: "editar", modulo: "Configurações", descricao: `CNPJ atualizado: ${cnpjDigitos || "removido"}` });
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⚙️ Configurar CNPJ da Empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>CNPJ Principal</Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpj(e.target.value))}
              placeholder="00.000.000/0001-00"
              maxLength={18}
            />
          </div>
          <div>
            <Label>CNPJs Secundários (filiais)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={novoSecundario}
                onChange={(e) => setNovoSecundario(maskCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                onKeyDown={(e) => e.key === "Enter" && adicionarSecundario()}
              />
              <Button type="button" size="icon" variant="outline" onClick={adicionarSecundario}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {secundarios.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {secundarios.map((c) => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1 pr-1">
                    {c}
                    <button
                      onClick={() => setSecundarios((prev) => prev.filter((x) => x !== c))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
