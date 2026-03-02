export interface Company {
  id: string;
  name: string;
  logo?: string;
  initials: string;
  status: "positive" | "warning" | "danger";
  revenue: number;
  expenses: number;
}

export interface Module {
  id: string;
  name: string;
  icon: string;
  path: string;
  description: string;
}

export const companies: Company[] = [
  {
    id: "coop-central",
    name: "Cooperativa Central",
    initials: "CC",
    status: "positive",
    revenue: 485000,
    expenses: 312000,
  },
  {
    id: "coop-norte",
    name: "Cooperativa Norte",
    initials: "CN",
    status: "positive",
    revenue: 230000,
    expenses: 178000,
  },
  {
    id: "coop-sul",
    name: "Cooperativa Sul",
    initials: "CS",
    status: "warning",
    revenue: 195000,
    expenses: 186000,
  },
  {
    id: "assistencia-24h",
    name: "Assistência 24h",
    initials: "A24",
    status: "danger",
    revenue: 88000,
    expenses: 102000,
  },
];

export const modules: Module[] = [
  { id: "dashboard", name: "Dashboard", icon: "BarChart3", path: "dashboard", description: "Visão geral da empresa" },
  { id: "conciliacao", name: "Conciliação Bancária", icon: "Landmark", path: "conciliacao", description: "Extratos, conciliação e pagamentos" },
  { id: "fluxo-caixa", name: "Fluxo de Caixa", icon: "Wallet", path: "fluxo-caixa", description: "Controle diário de entradas e saídas" },
  { id: "categorizacao", name: "Categorização de Despesas", icon: "FolderOpen", path: "categorizacao", description: "Classificação de despesas" },
  { id: "faturamento", name: "Faturamento e Cobrança", icon: "Send", path: "faturamento", description: "Boletos, faturas e inadimplência" },
  { id: "folha", name: "Folha e Comissões", icon: "FileText", path: "folha", description: "Folha de pagamento e comissionamento" },
  { id: "sinistros", name: "Sinistros e Riscos", icon: "ShieldAlert", path: "sinistros", description: "Gestão de sinistralidade e riscos" },
  { id: "gestao-fiscal", name: "Gestão Fiscal", icon: "Calculator", path: "gestao-fiscal", description: "Gestão tributária e obrigações fiscais" },
  { id: "projecao", name: "Projeção e Planejamento Financeiro", icon: "LineChart", path: "projecao", description: "Projeção e planejamento financeiro" },
  { id: "impostos", name: "Impostos e Fiscal", icon: "Receipt", path: "impostos", description: "Impostos, tributos e NF" },
  { id: "integracao-erp", name: "Integração ERP SGA", icon: "RefreshCw", path: "integracao-erp", description: "Sincronização com ERP SGA" },
  { id: "integracao-assistencia", name: "Integração Assistência 24h", icon: "Headphones", path: "integracao-assistencia", description: "Integração com Assistência 24h" },
  { id: "area-socio", name: "Área do Sócio", icon: "UserCircle", path: "area-socio", description: "Portal do sócio e parceiro" },
];

export const dashboardData = {
  totalRevenue: 998000,
  totalExpenses: 778000,
  projectedBalance: 220000,
  projectedStatus: "positive" as const,
  monthlyEvolution: [
    { month: "Out", receita: 820000, despesa: 710000 },
    { month: "Nov", receita: 870000, despesa: 735000 },
    { month: "Dez", receita: 915000, despesa: 760000 },
    { month: "Jan", receita: 945000, despesa: 780000 },
    { month: "Fev", receita: 970000, despesa: 768000 },
    { month: "Mar", receita: 998000, despesa: 778000 },
  ],
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
