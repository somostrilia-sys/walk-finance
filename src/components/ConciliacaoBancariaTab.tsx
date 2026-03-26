import React from "react";
import ConciliacaoBancariaUnificada from "./ConciliacaoBancariaUnificada";

interface Props { companyId: string; branchId?: string; bankAccountId?: string; }

export function ConciliacaoBancariaTab({ companyId, branchId, bankAccountId }: Props) {
  return <ConciliacaoBancariaUnificada companyId={companyId} branchId={branchId} bankAccountId={bankAccountId} />;
}

export default ConciliacaoBancariaTab;
