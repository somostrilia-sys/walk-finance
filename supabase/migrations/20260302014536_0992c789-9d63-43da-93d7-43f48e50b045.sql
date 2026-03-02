
-- Role enum
CREATE TYPE public.app_role AS ENUM ('master', 'franqueado', 'financeiro', 'leitura');

-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User company access (role per company)
CREATE TABLE public.user_company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'leitura',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Company modules
CREATE TABLE public.company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, module_name)
);

-- Expense categories
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fluxo', -- 'projecao' or 'fluxo'
  parent_id UUID REFERENCES public.expense_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial transactions (cash flow)
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank accounts
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  agency TEXT,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank reconciliation entries
CREATE TABLE public.bank_reconciliation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.financial_transactions(id),
  external_description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'nao_identificado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)

CREATE OR REPLACE FUNCTION public.is_master_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = _user_id AND role = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = _user_id AND company_id = _company_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master_user(_user_id) OR public.has_company_role(_user_id, _company_id, ARRAY['master', 'franqueado', 'financeiro']::app_role[]);
$$;

-- Profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_bank_reconciliation_updated_at BEFORE UPDATE ON public.bank_reconciliation_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS POLICIES

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_master_user(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- companies
CREATE POLICY "View companies user has access to" ON public.companies FOR SELECT USING (public.is_master_user(auth.uid()) OR public.is_company_member(auth.uid(), id));
CREATE POLICY "Master can insert companies" ON public.companies FOR INSERT WITH CHECK (public.is_master_user(auth.uid()));
CREATE POLICY "Master can update companies" ON public.companies FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_company_role(auth.uid(), id, ARRAY['franqueado']::app_role[]));
CREATE POLICY "Master can delete companies" ON public.companies FOR DELETE USING (public.is_master_user(auth.uid()));

-- user_company_access
CREATE POLICY "View own access or master" ON public.user_company_access FOR SELECT USING (user_id = auth.uid() OR public.is_master_user(auth.uid()) OR public.has_company_role(auth.uid(), company_id, ARRAY['franqueado']::app_role[]));
CREATE POLICY "Master or franqueado can insert access" ON public.user_company_access FOR INSERT WITH CHECK (public.is_master_user(auth.uid()) OR public.has_company_role(auth.uid(), company_id, ARRAY['franqueado']::app_role[]));
CREATE POLICY "Master or franqueado can update access" ON public.user_company_access FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_company_role(auth.uid(), company_id, ARRAY['franqueado']::app_role[]));
CREATE POLICY "Master or franqueado can delete access" ON public.user_company_access FOR DELETE USING (public.is_master_user(auth.uid()) OR public.has_company_role(auth.uid(), company_id, ARRAY['franqueado']::app_role[]));

-- company_modules
CREATE POLICY "View modules for accessible companies" ON public.company_modules FOR SELECT USING (public.is_master_user(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Master can manage modules" ON public.company_modules FOR INSERT WITH CHECK (public.is_master_user(auth.uid()));
CREATE POLICY "Master can update modules" ON public.company_modules FOR UPDATE USING (public.is_master_user(auth.uid()));
CREATE POLICY "Master can delete modules" ON public.company_modules FOR DELETE USING (public.is_master_user(auth.uid()));

-- expense_categories
CREATE POLICY "View categories for accessible companies" ON public.expense_categories FOR SELECT USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Financial users can manage categories" ON public.expense_categories FOR INSERT WITH CHECK (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Financial users can update categories" ON public.expense_categories FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Financial users can delete categories" ON public.expense_categories FOR DELETE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));

-- financial_transactions
CREATE POLICY "View transactions" ON public.financial_transactions FOR SELECT USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id) OR (public.is_company_member(auth.uid(), company_id)));
CREATE POLICY "Create transactions" ON public.financial_transactions FOR INSERT WITH CHECK (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update transactions" ON public.financial_transactions FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete transactions" ON public.financial_transactions FOR DELETE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));

-- bank_accounts
CREATE POLICY "View bank accounts" ON public.bank_accounts FOR SELECT USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Create bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update bank accounts" ON public.bank_accounts FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete bank accounts" ON public.bank_accounts FOR DELETE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));

-- bank_reconciliation_entries
CREATE POLICY "View reconciliation" ON public.bank_reconciliation_entries FOR SELECT USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Create reconciliation" ON public.bank_reconciliation_entries FOR INSERT WITH CHECK (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Update reconciliation" ON public.bank_reconciliation_entries FOR UPDATE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));
CREATE POLICY "Delete reconciliation" ON public.bank_reconciliation_entries FOR DELETE USING (public.is_master_user(auth.uid()) OR public.has_financial_access(auth.uid(), company_id));

-- Indexes
CREATE INDEX idx_user_company_access_user ON public.user_company_access(user_id);
CREATE INDEX idx_user_company_access_company ON public.user_company_access(company_id);
CREATE INDEX idx_financial_transactions_company ON public.financial_transactions(company_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(date);
CREATE INDEX idx_bank_reconciliation_company ON public.bank_reconciliation_entries(company_id);
CREATE INDEX idx_bank_reconciliation_status ON public.bank_reconciliation_entries(status);
CREATE INDEX idx_expense_categories_company ON public.expense_categories(company_id);
