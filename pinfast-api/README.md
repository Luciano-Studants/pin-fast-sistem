# PINFAST API

Backend REST multiusuário do PINFAST. O serviço fica isolado nesta subpasta para permitir
desenvolvimento junto ao frontend e publicação independente.

## Stack

- Node.js 22, Fastify 5 e TypeScript
- Prisma ORM e PostgreSQL (compatível com Neon)
- JWT de curta duração e refresh tokens rotativos
- Cloudflare R2 para anexos
- Zod para validação
- Swagger/OpenAPI em `/docs`
- Vitest

O backend implementa somente os módulos ativos. A antiga gamificação da Central de Estudos
não possui rotas ou tabelas ativas; no domínio de estudos existem apenas as configurações e
sessões de Pomodoro.

## Módulos

- Autenticação, perfil e troca de senha
- Áreas de trabalho
- Espaços colaborativos e membros
- Post-its e anexos
- Notas rápidas e links
- Documentos ricos e planilhas
- Rotina fixa
- Questionários e tentativas
- Quadro branco
- Sessões/configurações do Pomodoro
- Preferências de interface
- Snapshot completo para backup

Todas as consultas privadas são filtradas pelo usuário autenticado.

## Configuração local

```bash
cd pinfast-api
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Preencha `DATABASE_URL` com a conexão pooled do Neon e `DIRECT_URL` com a conexão direta.
O frontend Vite existente não precisa ser reiniciado e continua usando sua própria porta.

## Comandos

```bash
pnpm dev              # desenvolvimento com reload
pnpm build            # compila para dist/
pnpm start            # executa a compilação
pnpm typecheck        # TypeScript
pnpm test             # testes
pnpm prisma:validate  # valida o schema
pnpm prisma:deploy    # aplica migrações em produção
```

## Autenticação

1. `POST /api/v1/auth/register` ou `POST /api/v1/auth/login`.
2. Envie `Authorization: Bearer <accessToken>` nas rotas privadas.
3. Quando o access token expirar, use `POST /api/v1/auth/refresh`.
4. Guarde o refresh token em cookie `httpOnly` no adaptador do frontend ou em armazenamento
   seguro; nunca em logs.

Exemplo:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"senha-segura"}'
```

## Convenções para o cliente

- As rotas de criação aceitam `id` (8–64 caracteres `[A-Za-z0-9_-]`) e `createdAt` opcionais,
  usados pelo frontend para manter a mesma identidade nos dados locais e no servidor.
- `PUT /api/v1/collaboration-spaces/:id/member-names` substitui os membros "locais" (somente
  nomes) de um espaço, preservando membros reais convidados por e-mail.

## Rotas principais

| Grupo | Endpoints |
| --- | --- |
| Saúde | `GET /health`, `GET /ready` |
| Auth | `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/me` |
| Perfil | `PATCH /api/v1/users/me`, `PUT /users/me/password`, `DELETE /users/me` |
| Workspaces | CRUD em `/api/v1/workspaces` |
| Colaboração | CRUD em `/api/v1/collaboration-spaces` e `/members` |
| Post-its | CRUD em `/api/v1/post-its` |
| Anexos | `POST/DELETE /api/v1/post-its/:id/attachments` |
| Notas | CRUD em `/api/v1/notes` |
| Links | CRUD em `/api/v1/quick-links` |
| Documentos | CRUD em `/api/v1/documents` |
| Planilhas | CRUD em `/api/v1/spreadsheets` |
| Rotina | CRUD em `/api/v1/routine-tasks` |
| Questionários | CRUD em `/api/v1/quizzes` e `POST/GET /:id/attempts` |
| Quadro branco | `GET/PUT /api/v1/whiteboard` |
| Pomodoro | `/api/v1/pomodoro/settings` e `/pomodoro/sessions` |
| Preferências | `GET/PUT /api/v1/preferences` |
| Backup | `GET /api/v1/sync/snapshot` |

Consulte `/docs` para a documentação navegável.

## Cloudflare R2

Crie um bucket e configure as variáveis `R2_*`. O endpoint de upload aceita imagens, PDF,
TXT/CSV, Word e Excel, com o limite definido por `MAX_UPLOAD_BYTES`. Se R2 não estiver
configurado, somente os endpoints de anexos retornam `503`; o restante da API funciona.

## Deploy no Fly.io

1. Ajuste o nome de `app` em `fly.toml` se necessário.
2. Configure os segredos:

```bash
fly secrets set \
  DATABASE_URL='...' \
  DIRECT_URL='...' \
  JWT_ACCESS_SECRET='...' \
  CORS_ORIGINS='https://seu-frontend.example'
```

3. Adicione os segredos R2 e execute `fly deploy`.

O container aplica `prisma migrate deploy` antes de iniciar. A máquina pode dormir quando
ociosa (`min_machines_running = 0`) para reduzir custos.

## Migração do localStorage

O backend expõe CRUD para todos os formatos atualmente persistidos e um snapshot para
backup. A troca do frontend deve ser feita em uma etapa separada, mantendo um adaptador
temporário que:

1. autentica o usuário;
2. envia os dados locais uma única vez pelas rotas de cada módulo;
3. registra localmente a versão migrada;
4. passa a usar a API como fonte de verdade;
5. conserva uma cópia local somente como cache/offline.
