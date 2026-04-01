$token = "sbp_278cf26fc623f36d3547fc9fb4912a6dcd8448d2"
$url = "https://api.supabase.com/v1/projects/jxuoqktmugynvktvtjsc/database/query"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}
$q = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expense_categories' ORDER BY ordinal_position"
$body = '{"query":"' + $q + '"}'
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
$r | ConvertTo-Json -Depth 5
