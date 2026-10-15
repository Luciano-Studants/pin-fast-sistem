# PINFAST — publicação em produção

Arquitetura (tudo online, sem servidor próprio):

| Peça | Serviço | Função |
|---|---|---|
| Frontend | Cloudflare Pages | Site estático (React/Vite) |
| API | Fly.io | Fastify + Prisma (região `gru`) |
| Banco | Neon | PostgreSQL |
| Anexos | Cloudflare R2 | Arquivos dos post-its |
| CI/CD | GitHub Actions | Testes e deploy automático |

## 0. Decisão que evita o problema nº 1: domínio próprio

O login usa um cookie `httpOnly` de refresh. Se o site e a API ficam em domínios diferentes
(`pinfast.pages.dev` e `*.fly.dev`), o navegador o trata como cookie de terceiros: **Safari e
vários navegadores bloqueiam**, e o usuário perde a sessão ao recarregar a página.

**Recomendado:** um domínio com dois subdomínios no mesmo site:

- `app.seudominio.com` → Cloudflare Pages
- `api.seudominio.com` → Fly.io

Com isso use `COOKIE_SAME_SITE=lax` e `COOKIE_SECURE=true`. Sem domínio próprio, use
`COOKIE_SAME_SITE=none` apenas para testes (funciona no Chrome/Firefox com cookies de terceiros
liberados, não no Safari).

## 1. Contas e ferramentas

Contas: [Neon](https://neon.tech), [Cloudflare](https://dash.cloudflare.com),
[Fly.io](https://fly.io) (pode exigir cartão), [GitHub](https://github.com).
Ferramentas locais: Git, Node 22, pnpm 10 (`npm i -g pnpm@10`), `flyctl`, `wrangler`
(`pnpm dlx wrangler`), OpenSSL.

```bash
git clone <seu-repositório> pinfast && cd pinfast
pnpm install --frozen-lockfile
pnpm --dir pinfast-api install --frozen-lockfile
```

## 2. Banco de dados (Neon)

1. Crie o projeto `pinfast` numa região próxima de São Paulo.
2. Em **Connection Details** copie duas URLs:
   - **Pooled** → `DATABASE_URL`. Acrescente `&pgbouncer=true&connect_timeout=15`.
   - **Direct** → `DIRECT_URL` (usada pelas migrações).
3. Mantenha `sslmode=require`. Nunca publique essas URLs.
4. Ative/confirme o histórico de restauração (PITR) nas configurações do projeto.

## 3. Armazenamento (Cloudflare R2)

1. Crie o bucket `pinfast`.
2. Crie um token de API com leitura/escrita **somente nesse bucket** e anote Account ID,
   Access Key ID e Secret Access Key.
3. Habilite acesso público (domínio `files.seudominio.com` recomendado, ou `r2.dev`) e anote a URL
   pública **sem barra final** (`R2_PUBLIC_URL`).

Os arquivos são enviados pela API (não direto do navegador), então não é preciso configurar CORS
no bucket. As URLs públicas são difíceis de adivinhar (UUID), mas qualquer pessoa com o link
acessa o arquivo.

## 4. API no Fly.io

```bash
cd pinfast-api
fly auth login
fly apps create pinfast-api-SEUUSUARIO        # o nome precisa ser único
# edite a 1ª linha do fly.toml: app = "pinfast-api-SEUUSUARIO"

fly secrets set \
  DATABASE_URL='<pooled>&pgbouncer=true&connect_timeout=15' \
  DIRECT_URL='<direct>' \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  CORS_ORIGINS='https://app.seudominio.com' \
  COOKIE_SECURE='true' \
  COOKIE_SAME_SITE='lax' \
  R2_ACCOUNT_ID='...' R2_ACCESS_KEY_ID='...' R2_SECRET_ACCESS_KEY='...' \
  R2_BUCKET='pinfast' R2_PUBLIC_URL='https://files.seudominio.com' \
  APP_URL='https://app.seudominio.com' \
  RESEND_API_KEY='re_...' MAIL_FROM='PINFAST <nao-responda@seudominio.com>'

fly deploy
```

- As migrações rodam uma vez por deploy (`release_command`), antes de trocar as máquinas.
- A API **recusa iniciar** com segredo JWT de exemplo, CORS com `*`/caminho/`http` (fora de
  localhost) ou `SAME_SITE=none` sem `Secure`.
- `min_machines_running = 1` mantém uma máquina ligada (sem partida a frio). Use `0` para economizar.
- `/docs` (Swagger) fica desligado em produção; ligue com `ENABLE_DOCS=true` se precisar.
- **Recuperação de senha** usa o [Resend](https://resend.com) (plano gratuito basta): verifique o
  domínio de envio lá e defina `RESEND_API_KEY`, `MAIL_FROM` e `APP_URL`. Sem isso, "Esqueci minha
  senha" avisa que o recurso está indisponível.
- **Lançamento fechado:** `fly secrets set REGISTRATION_ENABLED=false` bloqueia novos cadastros
  (usuários existentes continuam entrando).
- Cota de anexos por usuário: `USER_STORAGE_QUOTA_BYTES` (padrão 200 MB).

Domínio da API:

```bash
fly certs add api.seudominio.com        # crie o CNAME indicado no DNS
fly certs check api.seudominio.com
```

## 5. Frontend no Cloudflare Pages

Variáveis de build:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `https://api.seudominio.com/api/v1` |
| `VITE_FILES_ORIGIN` | `https://files.seudominio.com` (mesma origem de `R2_PUBLIC_URL`) |
| `CSP_MODE` | vazio no 1º deploy (apenas reporta); `enforce` depois de validar |

Build: comando `pnpm build`, saída `dist`, Node 22. O build **falha** se `VITE_API_URL` faltar
(`CF_PAGES=1`). O `pnpm build` já gera `_headers` (HSTS, nosniff, CSP etc.) e usa
`public/_redirects` para o fallback de SPA.

```bash
pnpm dlx wrangler pages project create pinfast
VITE_API_URL=https://api.seudominio.com/api/v1 VITE_FILES_ORIGIN=https://files.seudominio.com \
  pnpm build && pnpm dlx wrangler pages deploy dist --project-name pinfast
```

Depois adicione `app.seudominio.com` em **Custom domains** do projeto.

**CSP:** abra o site com o console do navegador aberto e use todas as telas (inclusive o VLibras e
os ícones dos links). Se não houver avisos de CSP, defina `CSP_MODE=enforce` e publique de novo.

**Indexação:** `.figma/make/site.json` mantém `robots.index=false` (o site pede login). Mude para
`true` se quiser aparecer em buscadores.

## 6. Verificar

```bash
scripts/smoke.sh https://api.seudominio.com https://app.seudominio.com
```

Teste manual (5 minutos):

1. Criar conta, sair e entrar de novo.
2. Criar post-it com anexo, recarregar a página (os dados e o anexo permanecem).
3. Desligar a rede, editar uma nota, religar: o aviso "Salvando…" some e a nota está no servidor.
4. Abrir em outro navegador com a mesma conta: os dados aparecem.
5. Clicar em "Esqueci minha senha", abrir o e-mail recebido e definir uma nova senha.
6. Se havia dados antigos no navegador: confirmar o fluxo de migração (baixa um backup .json).

## 7. Deploy automático (GitHub Actions)

`.github/workflows/ci.yml` roda a cada push/PR: typecheck, testes, **testes de integração com
PostgreSQL**, build e build das imagens Docker. `deploy.yml` publica API e frontend quando o CI
da `main` passa. Para ativar:

- Segredos: `FLY_API_TOKEN` (`fly tokens create deploy`), `CLOUDFLARE_API_TOKEN` (permissão
  Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`.
- Variáveis: `DEPLOY_ENABLED=true`, `VITE_API_URL`, `VITE_FILES_ORIGIN`, `CSP_MODE`,
  `CF_PAGES_PROJECT` (padrão `pinfast`).

## 8. Operação

- **Logs:** `fly logs`. Status: `fly status`. Health checks em `/health` (processo) e `/ready` (banco).
- **Monitoramento:** crie um monitor externo (UptimeRobot/Better Stack) em
  `https://api.seudominio.com/ready` e no site.
- **Backup:** Neon mantém o histórico (PITR); faça também `pg_dump "$DIRECT_URL" -Fc -f pinfast.dump`
  periodicamente. Os usuários têm o snapshot em `GET /api/v1/sync/snapshot`.
- **Rollback da API:** `fly releases` e `fly deploy --image <imagem anterior>`. Migrações são
  aditivas; teste-as primeiro numa branch do Neon.
- **Rotacionar o segredo JWT:** `fly secrets set JWT_ACCESS_SECRET=...` (encerra os access tokens
  em uso; os refresh tokens continuam válidos).
- **LGPD:** a exclusão de conta (`DELETE /users/me`) apaga dados e anexos. Publique política de
  privacidade e canal de contato antes de abrir ao público.

## 9. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Desloga ao recarregar | Site e API em domínios diferentes (ver seção 0) ou `COOKIE_SECURE` falso |
| `CORS` no navegador | `CORS_ORIGINS` precisa ser a origem exata (`https://app...`, sem `/` final) |
| API não inicia | Variável inválida: veja `fly logs` (a mensagem diz qual) |
| 413 ao anexar | Arquivo > 10 MB ou cota por usuário excedida |
| Migração falha no deploy | `DIRECT_URL` ausente/errada; veja o log do `release_command` |
| Anexo não abre | `R2_PUBLIC_URL`/acesso público do bucket não configurado |
| "Salvando…" não some | Sem rede ou API fora do ar; as alterações ficam salvas no dispositivo |
