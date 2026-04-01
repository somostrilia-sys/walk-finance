$token = "sbp_278cf26fc623f36d3547fc9fb4912a6dcd8448d2"
$url = "https://api.supabase.com/v1/projects/xytnibnqztjaixemlepb/database/query"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function Run-Query($q) {
    $body = "{""query"":""$q""}"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    return $r
}

# Limpar tudo das empresas Objetivo
Run-Query "DELETE FROM expense_categories WHERE company_id IN ('b1000000-0000-0000-0000-000000000001','11111111-0001-0001-0001-000000000001')"
Write-Host "Limpeza feita"

# Montar o SQL gigante com todos os INSERTs usando chr() para acentos
# ç=chr(231) ã=chr(227) é=chr(233) ê=chr(234) ó=chr(243) á=chr(225) Á=chr(193) õ=chr(245)
$c1 = "b1000000-0000-0000-0000-000000000001"
$c2 = "11111111-0001-0001-0001-000000000001"

$sql = @"
INSERT INTO expense_categories (id, company_id, name, type, grupo) VALUES
(gen_random_uuid(),'$c1','Folha ADM','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Comiss'||chr(227)||'o','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Sistemas','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Servi'||chr(231)||'os','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','T'||chr(233)||'cnicos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','M'||chr(243)||'veis','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Materiais (Notebooks e Demais)','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Alugu'||chr(233)||'is','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1',chr(193)||'gua, Luz, Telefonia e Internet','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Lucros S'||chr(243)||'cios','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Empr'||chr(233)||'stimo','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Equipamentos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Plataforma e Linhas','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Folha Comercial','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Premia'||chr(231)||chr(245)||'es e Bonifica'||chr(231)||chr(245)||'es','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Limpeza','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Reembolso Associado','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Reembolso Colaborador','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Envios Correios','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Repasse de Ades'||chr(227)||'o','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Insumos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c1','Eventos','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c1','Pe'||chr(231)||'as','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c1','Perif'||chr(233)||'ricos','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c1','Carro Reserva','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c1','Pronta Resposta','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c1','Assist'||chr(234)||'ncia 24H','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Folha ADM','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Comiss'||chr(227)||'o','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Sistemas','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Servi'||chr(231)||'os','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','T'||chr(233)||'cnicos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','M'||chr(243)||'veis','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Materiais (Notebooks e Demais)','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Alugu'||chr(233)||'is','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2',chr(193)||'gua, Luz, Telefonia e Internet','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Lucros S'||chr(243)||'cios','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Empr'||chr(233)||'stimo','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Equipamentos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Plataforma e Linhas','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Folha Comercial','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Premia'||chr(231)||chr(245)||'es e Bonifica'||chr(231)||chr(245)||'es','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Limpeza','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Reembolso Associado','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Reembolso Colaborador','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Envios Correios','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Repasse de Ades'||chr(227)||'o','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Insumos','despesa','Despesas Fixas'),
(gen_random_uuid(),'$c2','Eventos','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Pe'||chr(231)||'as','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Perif'||chr(233)||'ricos','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Carro Reserva','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Pronta Resposta','despesa','Despesas Vari'||chr(225)||'veis'),
(gen_random_uuid(),'$c2','Assist'||chr(234)||'ncia 24H','despesa','Despesas Vari'||chr(225)||'veis')
"@

# Remover quebras de linha para o JSON
$sqlFlat = $sql -replace "`r`n", " " -replace "`n", " " -replace "`r", " "
$sqlFlat = $sqlFlat.Trim()

Run-Query $sqlFlat
Write-Host "Insercao concluida"

# Verificar
$result = Run-Query "SELECT name, grupo FROM expense_categories WHERE company_id = 'b1000000-0000-0000-0000-000000000001' ORDER BY grupo, name"
Write-Host "`n=== RESULTADO ==="
$result | ForEach-Object { Write-Host "  [$($_.grupo)] $($_.name)" }
