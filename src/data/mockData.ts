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
    id: "objetivo",
    name: "Objetivo Proteção Veicular",
    initials: "OBJ",
    status: "positive",
    revenue: 2000000,
    expenses: 1400000,
  },
  {
    id: "trilho",
    name: "Trilho Soluções",
    initials: "TRL",
    status: "positive",
    revenue: 450000,
    expenses: 280000,
  },
  {
    id: "trackit",
    name: "Trackit Rastreamento",
    initials: "TRK",
    status: "positive",
    revenue: 180000,
    expenses: 120000,
  },
  {
    id: "essencia",
    name: "Essência Marketing",
    initials: "ESS",
    status: "positive",
    revenue: 95000,
    expenses: 75000,
  },
  {
    id: "trilia",
    name: "Trilia Educacional",
    initials: "TRI",
    status: "positive",
    revenue: 120000,
    expenses: 85000,
  },
  {
    id: "digitallux",
    name: "Digital Lux",
    initials: "DL",
    status: "positive",
    revenue: 80000,
    expenses: 60000,
  },
  {
    id: "contabil",
    name: "Walk Contábil",
    initials: "WC",
    status: "positive",
    revenue: 45000,
    expenses: 35000,
  },
  {
    id: "oficina",
    name: "Oficina Walk",
    initials: "OFI",
    status: "warning",
    revenue: 55000,
    expenses: 48000,
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
  totalRevenue: 3025000,
  totalExpenses: 2103000,
  projectedBalance: 922000,
  projectedStatus: "positive" as const,
  monthlyEvolution: [
    { month: "Out", receita: 2480000, despesa: 1820000 },
    { month: "Nov", receita: 2620000, despesa: 1890000 },
    { month: "Dez", receita: 2780000, despesa: 1960000 },
    { month: "Jan", receita: 2850000, despesa: 2010000 },
    { month: "Fev", receita: 2940000, despesa: 2065000 },
    { month: "Mar", receita: 3025000, despesa: 2103000 },
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
