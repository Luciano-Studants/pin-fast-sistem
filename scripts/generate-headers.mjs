// Gera dist/_headers (Cloudflare Pages) com cabeçalhos de segurança e CSP.
// CSP_MODE=enforce aplica a política; o padrão (report) apenas reporta violações no console,
// para validar no navegador (VLibras, fontes, favicons) antes de bloquear.
import { mkdirSync, writeFileSync } from "node:fs"

const apiUrl = process.env.VITE_API_URL || "/api/v1"
const filesOrigin = process.env.VITE_FILES_ORIGIN || ""
const mode = process.env.CSP_MODE === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"

let apiOrigin = ""
try {
  apiOrigin = new URL(apiUrl).origin
} catch {
  // URL relativa: mesma origem
}

const vlibras = "https://vlibras.gov.br https://*.vlibras.gov.br"
const csp = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' blob: ${vlibras}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com " + vlibras,
  "font-src 'self' data: https://fonts.gstatic.com " + vlibras,
  `img-src 'self' data: blob: https://www.google.com https://*.gstatic.com ${filesOrigin} ${vlibras}`.replace(/\s+/g, " "),
  `connect-src 'self' ${apiOrigin} ${filesOrigin} ${vlibras}`.replace(/\s+/g, " "),
  `media-src 'self' blob: data: ${vlibras}`,
  `frame-src ${vlibras}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const security = [
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
  "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
  `  ${mode}: ${csp}`,
].join("\n")

const headers = `/*
${security}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
`

mkdirSync("dist", { recursive: true })
writeFileSync("dist/_headers", headers)
console.log(`dist/_headers gerado (${mode})`)
