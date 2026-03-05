import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CompanyModules from "./pages/CompanyModules";
import CompanyDashboard from "./pages/CompanyDashboard";
import FluxoCaixa from "./pages/FluxoCaixa";
import ConciliacaoBancaria from "./pages/ConciliacaoBancaria";
import AreaSocio from "./pages/AreaSocio";
import BranchDashboard from "./pages/BranchDashboard";
import ModulePage from "./pages/ModulePage";
import ModuloComercial from "./pages/ModuloComercial";
import FluxoCaixaDiario from "./pages/FluxoCaixaDiario";
import ProgramacaoPagamentos from "./pages/ProgramacaoPagamentos";
import FolhaAdm from "./pages/FolhaAdm";
import ContratacoesDemissoes from "./pages/ContratacoesDemissoes";
import CalendarioFinanceiro from "./pages/CalendarioFinanceiro";
import DashboardSocio from "./pages/DashboardSocio";
import GestaoFiscal from "./pages/GestaoFiscal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/empresa/:companyId" element={<ProtectedRoute><CompanyModules /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/dashboard" element={<ProtectedRoute><DashboardSocio /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/fluxo-caixa" element={<ProtectedRoute><FluxoCaixa /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/conciliacao" element={<ProtectedRoute><ConciliacaoBancaria /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/area-socio" element={<ProtectedRoute><AreaSocio /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/area-socio/:branchId" element={<ProtectedRoute><BranchDashboard /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/comercial" element={<ProtectedRoute><ModuloComercial /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/fluxo-caixa-diario" element={<ProtectedRoute><FluxoCaixaDiario /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/programacao-pagamentos" element={<ProtectedRoute><ProgramacaoPagamentos /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/folha-adm" element={<ProtectedRoute><FolhaAdm /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/contratacoes-demissoes" element={<ProtectedRoute><ContratacoesDemissoes /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/calendario-financeiro" element={<ProtectedRoute><CalendarioFinanceiro /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/gestao-fiscal" element={<ProtectedRoute><GestaoFiscal /></ProtectedRoute>} />
            <Route path="/empresa/:companyId/:moduleId" element={<ProtectedRoute><ModulePage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
