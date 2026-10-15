// Falha o build de produção quando a URL da API não está configurada, em vez de publicar
// um site que tenta falar com http://localhost:3000.
const mustCheck = process.env.CF_PAGES === "1" || process.env.REQUIRE_API_URL === "true"
const url = process.env.VITE_API_URL

if (mustCheck) {
  if (!url) {
    console.error("VITE_API_URL não definida. Ex.: https://api.seudominio.com/api/v1")
    process.exit(1)
  }
  if (!/^https:\/\/[^/]+\/api\/v1\/?$/.test(url) && !/^\/api\/v1\/?$/.test(url)) {
    console.error(`VITE_API_URL inválida: "${url}". Use https://<host>/api/v1 (ou /api/v1 atrás de proxy).`)
    process.exit(1)
  }
}
