import { useParams } from "react-router-dom";
import { useCompanyModules, useCompanies } from "@/hooks/useFinancialData";
import HubCard from "@/components/HubCard";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Loader2 } from "lucide-react";

const moduleConfig: Record<string, { icon: string; description: string; label: string }> = {
  categorizacao: { icon: "FolderOpen", description: "Categorização de receitas e despesas", label: "Categorização" },
  "cadastro-pessoas": { icon: "Users", description: "Clientes e prestadores", label: "Cadastro de Pessoas" },
  "contas-pagar": { icon: "ArrowDownCircle", description: "Gestão de contas a pagar", label: "Contas a Pagar" },
  "contas-receber": { icon: "ArrowUpCircle", description: "Gestão de contas a receber", label: "Contas a Receber" },
  conciliacao: { icon: "Landmark", description: "Extratos, conciliação e pagamentos", label: "Conciliação Bancária" },
  "fluxo-caixa": { icon: "Wallet", description: "Controle diário de entradas e saídas", label: "Fluxo de Caixa" },
  folha: { icon: "FileText", description: "Folha de pagamento e comissionamento", label: "Folha e Comissões" },
  impostos: { icon: "Receipt", description: "Impostos, tributos e NF", label: "Imposto e Fiscal" },
  projecao: { icon: "LineChart", description: "Projeção e planejamento financeiro", label: "Projeção e Planejamento" },
  faturamento: { icon: "Send", description: "Boletos, faturas e inadimplência", label: "Faturamento e Cobrança" },
  // Módulos exclusivos Objetivo Auto e Truck
  "area-socio": { icon: "UserCircle", description: "Visão geral financeira e indicadores", label: "Área do Sócio" },
  "calendario-financeiro": { icon: "Calendar", description: "Controle de pagamentos e alertas de vencimento", label: "Calendário Financeiro" },
  "gestao-fiscal": { icon: "Calculator", description: "Alertas de pagamentos sem nota fiscal", label: "Gestão Fiscal Inteligente" },
  dashboard: { icon: "BarChart3", description: "Visão estratégica da empresa", label: "Dashboard do Sócio" },
  "centro-custos": { icon: "Target", description: "Gestão de custos por evento", label: "Centro de Custos por Evento" },
  "folha-adm": { icon: "Users", description: "Gestão de remuneração fixa e variável por setor", label: "Folha de Pagamento ADM" },
  comercial: { icon: "TrendingUp", description: "Comissionamento, performance e ROI por consultor", label: "Módulo Comercial" },
  "fluxo-caixa-diario": { icon: "Wallet", description: "Entradas e saídas por conta bancária", label: "Fluxo de Caixa Diário" },
  "programacao-pagamentos": { icon: "CalendarCheck", description: "Banking integrado e fluxo de aprovação", label: "Programação de Pagamentos" },
  "contratacoes-demissoes": { icon: "UserPlus", description: "Ciclo de vida RH integrado à folha e projeção", label: "Contratações e Demissões" },
};

const CompanyModules = () => {
  const { companyId } = useParams();
  const { data: companies } = useCompanies();
  const { data: modules, isLoading } = useCompanyModules(companyId);
  const company = companies?.find((c) => c.id === companyId);

  if (!company && !isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Empresa não encontrada.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout companyBar={{ primary: company?.primary_color, accent: company?.accent_color }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={company?.name || "Empresa"}
          subtitle="Selecione um módulo para acessar"
          showBack
          companyLogo={company?.logo_url}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {modules.map((mod, i) => {
              const config = moduleConfig[mod.module_name] || {
                icon: "BarChart3",
                description: mod.module_name,
                label: mod.module_name,
              };
              return (
                <HubCard
                  key={mod.id}
                  title={config.label}
                  icon={config.icon}
                  subtitle={config.description}
                  to={`/empresa/${companyId}/${mod.module_name}`}
                  delay={i}
                />
              );
            })}
          </div>
        ) : (
          <div className="hub-card-base p-12 text-center">
            <p className="text-muted-foreground">
              Nenhum módulo ativo para esta empresa.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CompanyModules;
