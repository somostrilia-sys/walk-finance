-- Adiciona coluna permitted_modules em user_company_access
-- Usada para restringir quais módulos um usuário Sócio pode acessar numa empresa
ALTER TABLE user_company_access
  ADD COLUMN IF NOT EXISTS permitted_modules text[];

COMMENT ON COLUMN user_company_access.permitted_modules IS
  'Lista de módulos permitidos para usuários do tipo Sócio. NULL = acesso a todos os módulos habilitados da empresa.';
