# Progresso da integração frontend ↔ API

Objetivo: o frontend deixa de usar localStorage como fonte da verdade e passa a sincronizar tudo com a API.

## Desenho
- `src/lib/store/`: armazenamento com cache local **por usuário** (`pinfast:<userId>:<chave>`) + motor de sincronização por diff.
- Chaves antigas (`postits-v1` etc.) mapeadas para recursos da API por "codecs" (puros e testáveis).
- IDs gerados no cliente (UUID); a API aceita `id` opcional na criação (regex `^[A-Za-z0-9_-]{8,64}$`).
- `SyncGate` entre `MigrationGate` e `MainApp`: envia pendências, baixa `/sync/snapshot`, hidrata o cache.
- Anexos: enviados ao R2 depois que o post-it existe no servidor.

## Etapas
- [x] 1. API: `id` opcional nas criações + rota `PUT /collaboration-spaces/:id/member-names`
- [x] 2. Cliente: módulo `store` (cache por usuário, subscribe, dirty/synced)
- [x] 3. Cliente: codecs + motor de sync (diff, fila, retry) + testes (vitest)
- [x] 4. Cliente: `SyncGate` + hidratação + limpeza das chaves legadas + logout
- [x] 5. Trocar acessos diretos a localStorage nas telas (MainApp, Routine, Quiz, Whiteboard, StudySession)
- [x] 6. Anexos (upload/remoção via API, `url` em vez de `data`)
- [x] 7. IDs: `newId()` em todos os geradores; remover ids fixos dos seeds
- [x] 8. Verificação final (tsc, build, testes) + atualizar docs

## Produção
- [x] API endurecida (Prisma/Alpine, release_command, health, validação de env, no-store)
- [x] Frontend para Cloudflare Pages (_redirects, _headers/CSP, check de VITE_API_URL, título/idioma/favicon)
- [x] CI (frontend + API com Postgres + integração + Docker) e deploy opcional
- [x] Recuperação de senha por e-mail (Resend), cadastro fechável, limites de taxa por conta
- [x] DEPLOYMENT.md reescrito, scripts/smoke.sh
- [ ] Pendente do usuário: criar contas (Neon/R2/Fly/Cloudflare/Resend), domínio, segredos, 1º deploy, rodar o CI
