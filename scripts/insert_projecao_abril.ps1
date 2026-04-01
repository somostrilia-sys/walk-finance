$token = "sbp_278cf26fc623f36d3547fc9fb4912a6dcd8448d2"
$url   = "https://api.supabase.com/v1/projects/xytnibnqztjaixemlepb/database/query"
$hdr   = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
$cid   = "b1000000-0000-0000-0000-000000000001"

function RQ($q) {
    $b = [System.Text.Encoding]::UTF8.GetBytes("{`"query`":`"$q`"}")
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $hdr -Body $b -ContentType "application/json; charset=utf-8"
    return $r
}

# Limpar projecao anterior de abril/marco 2026 para esta empresa (evitar duplicatas)
RQ "DELETE FROM contas_pagar WHERE company_id = '$cid' AND vencimento BETWEEN '2026-03-01' AND '2026-04-30' AND descricao LIKE '%PROJEC%'"
Write-Host "Iniciando insercao..."

$rows = @(
  @("2026-03-27","EVENTO ISS2170 TIJUCAS",12593.72,"Eventos","pendente"),
  @("2026-03-27","EVENTO TERC EQF6I77/GKA5B41 CAJAMAR",2900.00,"Eventos","pendente"),
  @("2026-03-28","BOLETO CADEIRAS",2295.00,"Moveis","pendente"),
  @("2026-03-29","MUNDIALE",4049.00,"Servicos","pendente"),
  @("2026-03-30","REGULAGEM PXP9E55 JUNDIAI",1004.00,"Tecnicos","pendente"),
  @("2026-03-30","REGULAGEM FEU5G57 CAMPINAS",1148.00,"Tecnicos","pendente"),
  @("2026-03-30","PRESTADOR FATURADO AUTO SOCORRO TIJUCAS",7110.00,"Servicos","pendente"),
  @("2026-03-30","REGULAGEM FAD6C78 JUNDIAI",846.00,"Tecnicos","pendente"),
  @("2026-03-30","PERIFERICO JCR7E77 CAXIAS DO SUL",11444.00,"Perifericos","pendente"),
  @("2026-03-30","EVENTO UEZ5170 CAPAO REDONDO",5500.00,"Eventos","pendente"),
  @("2026-03-30","EVENTO EGT9386 SOROCABA",4350.00,"Eventos","pendente"),
  @("2026-03-31","EVENTO TERC TKB1A26/FVW3A26 OSASCO",1450.00,"Eventos","pendente"),
  @("2026-03-31","PREMIACAO MODO TURBO",4380.00,"Premiacoes e Bonificacoes","pendente"),
  @("2026-03-31","EVENTO TIQ2B25 SANTANA DE PARNAIBA",2800.00,"Eventos","pendente"),
  @("2026-03-31","EVENTO LZE8662 CAMACARI",10500.00,"Eventos","pendente"),
  @("2026-04-01","PRESTADORES MES 03",165742.10,"Servicos","pendente"),
  @("2026-04-01","REEMBOLSO PECA GWE1923 PARA DE MINAS",62.62,"Reembolso Colaborador","pago"),
  @("2026-04-01","INDENIZACAO TLQ9H67 CAPAO REDONDO",11623.18,"Servicos","pendente"),
  @("2026-04-01","REEMBOLSO TECNICO WILLIAM PORTO VELHO",91.30,"Reembolso Colaborador","pendente"),
  @("2026-04-01","EVENTO TERC RMF7F53/CJU5J57 CAJAMAR",2750.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO IQM7B69 JUNDIAI",6000.00,"Eventos","pendente"),
  @("2026-04-01","REEMBOLSO ITALO ESTACIONAMENTO ALPHAVILLE",135.00,"Reembolso Colaborador","pendente"),
  @("2026-04-01","ADIANTAMENTO GABI",200.00,"Reembolso Colaborador","pendente"),
  @("2026-04-01","EVENTO TERC EIF4980/QQC6G18 JUNDIAI",680.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO TERC GEU6D59/GGX8G45 SOROCABA",1300.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO IXW3F67 VARZEA PAULISTA",3600.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO ECY3F42 JUNDIAI",2000.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO BDR3D78 JUNDIAI",6250.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO DQQ8A47 ALPHAVILLE",2250.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO TERC SUJ3E88/FLS0538 JUNDIAI",2400.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO FBP7H48 RIBEIRAO PRETO",4750.00,"Eventos","pendente"),
  @("2026-04-01","EVENTO TERC ERK1B07/FQX0868 CAPAO REDONDO",3167.50,"Eventos","pendente"),
  @("2026-04-01","EVENTO RKR7G84 VARZEA PAULISTA",7304.45,"Eventos","pendente"),
  @("2026-04-01","CONTA DE AGUA CAJAMAR MES 02 E 03",350.25,"Agua, Luz, Telefonia e Internet","pendente"),
  @("2026-04-02","EVENTO EQM2E87/MGK3D77 GUARULHOS",1800.00,"Eventos","pendente"),
  @("2026-04-02","CAMISETA MODO TURBO MES 03",950.00,"Premiacoes e Bonificacoes","pendente"),
  @("2026-04-02","EVENTO EJW3F34 TIJUCAS",7750.00,"Eventos","pendente"),
  @("2026-04-03","EVENTO DWF2E99 JUNDIAI",3400.00,"Eventos","pendente"),
  @("2026-04-03","ACORDO TERC IPK6J01/IEU3409 SANTA CRUZ",15000.00,"Servicos","pendente"),
  @("2026-04-05","ALUGUEL PRAIA GRANDE",6274.30,"Alugueis","pendente"),
  @("2026-04-05","SISTEMA STRATEGIA",280.00,"Sistemas","pendente"),
  @("2026-04-05","COMISSAO RAFA DIRETOR COMERCIAL",2577.50,"Comissao","pendente"),
  @("2026-04-05","COMISSAO CARLOS DIRETOR COMERCIAL",5155.00,"Comissao","pendente"),
  @("2026-04-05","CARRO LALUCHA",2639.97,"Carro Reserva","pendente"),
  @("2026-04-05","ALUGUEL PONTA GROSSA",3245.89,"Alugueis","pendente"),
  @("2026-04-05","EVENTO RDA3I88 FEIRA DE SANTANA",105000.00,"Eventos","pendente"),
  @("2026-04-05","REGULAGEM LZE8662 CAMACARI",2000.00,"Tecnicos","pendente"),
  @("2026-04-05","INDENIZACAO FFA7D34 JUNDIAI",9774.51,"Servicos","pendente"),
  @("2026-04-05","GALPAO SEDE",3500.00,"Alugueis","pendente"),
  @("2026-04-06","ADIANTAMENTO RAFA",5000.00,"Reembolso Colaborador","pendente"),
  @("2026-04-06","NOTEBOOKS 3/3",2630.00,"Materiais (Notebooks e Demais)","pendente"),
  @("2026-04-07","FOLHA 5 DIA UTIL",79000.00,"Folha ADM","pendente"),
  @("2026-04-07","ESSENCIA 1/2",10000.00,"Servicos","pendente"),
  @("2026-04-07","EVENTO TERC OHU4G93/QTJ3G77 PORTO VELHO",4500.00,"Eventos","pendente"),
  @("2026-04-08","EVENTO TERC TKN0D38/GJS5J15 PRAIA GRANDE",2150.00,"Eventos","pendente"),
  @("2026-04-08","INDENIZACAO DDJ6C24 PRAIA GRANDE",11329.00,"Servicos","pendente"),
  @("2026-04-10","ALUGUEL SEDE",17500.00,"Alugueis","pendente"),
  @("2026-04-10","ALUGUEL PORTO VELHO",2700.00,"Alugueis","pendente"),
  @("2026-04-10","SALA PARA DE MINAS",300.00,"Alugueis","pendente"),
  @("2026-04-10","CONDOMINIO SEDE",10528.25,"Alugueis","pendente"),
  @("2026-04-10","ALUGUEL GUARULHOS",2955.00,"Alugueis","pendente"),
  @("2026-04-10","ALUGUEL SOROCABA",7062.67,"Alugueis","pendente"),
  @("2026-04-10","PAGAMENTO SANDRA ELOIS",13000.00,"Folha ADM","pendente"),
  @("2026-04-12","POWER SIGN",2363.00,"Sistemas","pendente"),
  @("2026-04-12","FOLHA DIA 12",135000.00,"Folha ADM","pendente"),
  @("2026-03-14","INDENIZACAO CAPAO REDONDO UFC8A86",18188.00,"Servicos","pendente"),
  @("2026-04-15","REEMBOLSO TERC FVB6200/EWJ7D68 SAO BERNARDO",74000.00,"Reembolso Associado","pendente"),
  @("2026-04-15","APP ASSOCIADO",1130.80,"Plataforma e Linhas","pendente"),
  @("2026-04-15","HINOVA COBRANCA",115.00,"Plataforma e Linhas","pendente"),
  @("2026-04-15","VISTO",1700.00,"Servicos","pendente"),
  @("2026-04-15","SGA",9700.00,"Sistemas","pendente"),
  @("2026-04-15","POWER",3294.00,"Sistemas","pendente"),
  @("2026-04-15","CONTABILIDADE",580.00,"Servicos","pendente"),
  @("2026-04-15","ACORDO IKR1I11 IPS8C44 IPS8C51 IJK0707 TIJUCAS",36000.00,"Servicos","pendente"),
  @("2026-04-15","ALUGUEL SEDE CONJ 71 A",6388.26,"Alugueis","pendente"),
  @("2026-04-15","NOTEBOOKS 2/2",3635.00,"Materiais (Notebooks e Demais)","pendente"),
  @("2026-04-15","ALUGUEL SEDE CONJ 71 B",6388.00,"Alugueis","pendente"),
  @("2026-04-15","INTERNET SEDE KNET",1112.90,"Agua, Luz, Telefonia e Internet","pendente"),
  @("2026-04-16","EVENTO BBY9F00/AVH6B94 TIJUCAS",5000.00,"Eventos","pendente"),
  @("2026-04-16","INDENIZACAO RPG3C47 FEIRA DE SANTANA",56731.00,"Servicos","pendente"),
  @("2026-04-18","ALUGUEL JUNDIAI",6693.72,"Alugueis","pendente"),
  @("2026-04-20","CADEIRAS ESCRITORIO A",1630.00,"Moveis","pendente"),
  @("2026-04-20","CADEIRAS ESCRITORIO B",1530.00,"Moveis","pendente"),
  @("2026-04-20","EVENTO ESS4G71 ALPHAVILLE",41666.66,"Eventos","pendente"),
  @("2026-04-20","REGULAGEM QSW5H09 SOROCABA",1216.00,"Tecnicos","pendente"),
  @("2026-04-20","EVENTO EJW3A86 TIJUCAS",12365.00,"Eventos","pendente"),
  @("2026-04-20","INDENIZACAO RKV3C52 1/2 VARZEA PAULISTA",8206.76,"Servicos","pendente"),
  @("2026-04-20","ALUGUEL CAJAMAR",4000.00,"Alugueis","pendente"),
  @("2026-04-20","ALUGUEL SANTA CRUZ",1500.00,"Alugueis","pendente"),
  @("2026-04-21","GLOBAL INTERNET SEDE",1260.00,"Agua, Luz, Telefonia e Internet","pendente"),
  @("2026-04-21","ALUGUEL RIBEIRAO PRETO",3034.93,"Alugueis","pendente"),
  @("2026-04-23","PERIFERICO AUF2J44 TIJUCAS 3/3",6062.50,"Perifericos","pendente"),
  @("2026-04-23","INDENIZACAO AML1C78 CAPAO REDONDO",24915.00,"Servicos","pendente"),
  @("2026-04-23","MUNDIALE",4000.00,"Servicos","pendente"),
  @("2026-04-24","ALUGUEL SALA SOROCABA",1919.56,"Alugueis","pendente"),
  @("2026-04-25","ZELO A",235.00,"Limpeza","pendente"),
  @("2026-04-25","ZELO B",2250.00,"Limpeza","pendente"),
  @("2026-04-25","ESSENCIA",17000.00,"Servicos","pendente"),
  @("2026-04-25","FOLHA 25",88814.11,"Folha ADM","pendente"),
  @("2026-04-27","INDENIZACAO TLG6A72 ALPHAVILLE",17476.23,"Servicos","pendente"),
  @("2026-04-27","INDENIZACAO EZF5J84 PRAIA GRANDE 2/2",9562.75,"Servicos","pendente"),
  @("2026-04-28","BOLETO CADEIRAS",2295.00,"Moveis","pendente")
)

$total = $rows.Count
$ok = 0
foreach ($row in $rows) {
    $dt   = $row[0]
    $desc = $row[1] -replace "'","''"
    $val  = $row[2]
    $cat  = $row[3]
    $sts  = $row[4]
    $q = "INSERT INTO contas_pagar (id, company_id, fornecedor, descricao, valor, vencimento, categoria, status) VALUES (gen_random_uuid(), '$cid', '$desc', '$desc', $val, '$dt', '$cat', '$sts')"
    $r = RQ $q
    $ok++
    if ($ok % 10 -eq 0) { Write-Host "  $ok/$total inseridos..." }
}

Write-Host "Concluido! $ok registros inseridos."
$count = RQ "SELECT COUNT(*) as total FROM contas_pagar WHERE company_id = '$cid' AND vencimento BETWEEN '2026-03-01' AND '2026-04-30'"
Write-Host "Total no banco (mar-abr 2026):" $count[0].total
