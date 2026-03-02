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
  { id: "folha", name: "Folha e Comissões", icon: "ClipboardList", path: "folha", description: "Pagamentos e comissionamento" },
  { id: "categorizacao", name: "Categorização", icon: "FolderOpen", path: "categorizacao", description: "Classificação de despesas" },
  { id: "sinistros", name: "Sinistros e Riscos", icon: "AlertTriangle", path: "sinistros", description: "Gestão de sinistralidade" },
  { id: "projecao", name: "Projeção Financeira", icon: "TrendingUp", path: "projecao", description: "Planejamento e cenários" },
  { id: "impostos", name: "Impostos e Fiscal", icon: "Receipt", path: "impostos", description: "Gestão tributária e NF" },
  { id: "faturamento", name: "Faturamento e Cobrança", icon: "Send", path: "faturamento", description: "Boletos, faturas e inadimplência" },
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
