
-- Create branches table for Área do Sócio
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Policies: members of the company can view branches
CREATE POLICY "View branches for accessible companies"
ON public.branches FOR SELECT
USING (is_master_user(auth.uid()) OR is_company_member(auth.uid(), company_id));

CREATE POLICY "Master can manage branches"
ON public.branches FOR INSERT
WITH CHECK (is_master_user(auth.uid()));

CREATE POLICY "Master can update branches"
ON public.branches FOR UPDATE
USING (is_master_user(auth.uid()));

CREATE POLICY "Master can delete branches"
ON public.branches FOR DELETE
USING (is_master_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
