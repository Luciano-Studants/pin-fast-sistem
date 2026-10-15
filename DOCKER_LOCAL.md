# PINFAST completo no Windows com Docker

Este guia começa no ZIP do projeto e termina com frontend, API, PostgreSQL e armazenamento
de anexos executando localmente.

## Importante

O frontend usa a API como fonte dos dados. Ao criar uma conta e usar a interface, tudo é
salvo no PostgreSQL local (com cache no navegador, por usuário) e os anexos vão para o MinIO.
Os containers escutam apenas em `127.0.0.1`, e as migrações do banco rodam sozinhas ao subir
a API (`RUN_MIGRATIONS=true` no `compose.yaml`).

Este ambiente é só para desenvolvimento: as senhas e o segredo JWT do `compose.yaml` são
públicos. Para publicar de verdade, siga o `DEPLOYMENT.md`.

## 1. Requisitos

- Windows 10 22H2 ou Windows 11;
- virtualização habilitada;
- 8 GB de RAM ou mais;
- aproximadamente 8 GB livres;
- internet na primeira execução.

Você instalará somente o Docker Desktop. Node.js, pnpm, Prisma, PostgreSQL, Nginx e MinIO
serão executados nos containers.

## 2. Instalar o Docker Desktop

1. Acesse <https://www.docker.com/products/docker-desktop/>.
2. Baixe **Docker Desktop for Windows**.
3. Execute o instalador.
4. Mantenha habilitado o uso de WSL 2.
5. Reinicie o Windows se solicitado.
6. Abra o Docker Desktop.
7. Aguarde o status indicar que o Docker está executando.

Se o Windows solicitar WSL, abra PowerShell como administrador:

```powershell
wsl --install
```

Reinicie e teste:

```powershell
docker version
docker compose version
```

Os dois comandos precisam exibir versões sem erro de conexão.

## 3. Extrair o ZIP

1. Localize o ZIP do PINFAST.
2. Clique com o botão direito.
3. Escolha **Extrair Tudo**.
4. Use uma pasta curta, por exemplo:

```text
C:\Projetos\pinfast
```

Na pasta correta devem existir:

```text
compose.yaml
Dockerfile
package.json
pinfast-api
src
```

Se esses arquivos estiverem dentro de outra pasta `pinfast`, entre nessa pasta interna.

## 4. Abrir o PowerShell no projeto

1. Abra no Explorador a pasta que contém `compose.yaml`.
2. Clique na barra de endereço.
3. Digite `powershell`.
4. Pressione Enter.

Confirme:

```powershell
Get-ChildItem
```

## 5. Construir e iniciar tudo

```powershell
docker compose up --build -d
```

Na primeira execução o Docker irá:

1. baixar PostgreSQL e MinIO;
2. instalar dependências do frontend e backend;
3. compilar frontend e API;
4. gerar o Prisma Client;
5. criar o banco;
6. aplicar as migrações;
7. criar o bucket de anexos;
8. iniciar Nginx, API, banco e armazenamento.

Isso pode demorar entre 5 e 20 minutos.

## 6. Acompanhar a inicialização

```powershell
docker compose ps
```

Os serviços abaixo devem ficar `Up` ou `healthy`:

- `frontend`;
- `api`;
- `database`;
- `minio`.

`minio-init` deve terminar com código zero.

Ver logs:

```powershell
docker compose logs -f
```

Use `Ctrl+C` para sair dos logs sem parar o sistema.

## 7. Endereços

| Serviço | Endereço |
| --- | --- |
| Frontend | <http://localhost:8080> |
| API | <http://localhost:3000> |
| Saúde | <http://localhost:3000/health> |
| Banco pronto | <http://localhost:3000/ready> |
| Swagger | <http://localhost:3000/docs> |
| Arquivos MinIO | <http://localhost:9000> |
| Console MinIO | <http://localhost:9001> |

Credenciais locais do MinIO:

```text
Usuário: pinfast
Senha: pinfast-local-password
```

Essas credenciais servem apenas para desenvolvimento local.

## 8. Testar a API

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
```

Criar usuário:

```powershell
$body = @{
  name = "Usuário Local"
  email = "usuario@pinfast.local"
  password = "senha-local-segura"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/v1/auth/register `
  -ContentType "application/json" `
  -Body $body

$session
```

Testar rota protegida:

```powershell
$headers = @{
  Authorization = "Bearer $($session.accessToken)"
}

Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/workspaces `
  -Headers $headers
```

Também é possível testar todas as rotas em:

```text
http://localhost:3000/docs
```

## 9. Parar e retomar

Parar sem apagar dados:

```powershell
docker compose stop
```

Retomar:

```powershell
docker compose start
```

Remover containers preservando os dados:

```powershell
docker compose down
```

Criar novamente:

```powershell
docker compose up -d
```

## 10. Apagar banco e anexos locais

Atenção: este comando apaga todos os dados locais:

```powershell
docker compose down -v
```

Recriar do zero:

```powershell
docker compose up --build -d
```

## 11. Atualizar depois de mudanças

```powershell
docker compose down
docker compose up --build -d
```

Somente frontend:

```powershell
docker compose up --build -d frontend
```

Somente API:

```powershell
docker compose up --build -d api
```

## 12. Diagnóstico

Estado:

```powershell
docker compose ps
```

Últimos logs:

```powershell
docker compose logs --tail=200
```

Logs específicos:

```powershell
docker compose logs --tail=200 api
docker compose logs --tail=200 frontend
docker compose logs --tail=200 database
docker compose logs --tail=200 minio
```

Reiniciar API:

```powershell
docker compose restart api
```

Abrir terminal na API:

```powershell
docker compose exec api sh
```

Listar tabelas:

```powershell
docker compose exec database `
  psql -U pinfast -d pinfast -c "\dt"
```

## 13. Erros comuns

### Docker daemon indisponível

```text
Cannot connect to the Docker daemon
```

Abra o Docker Desktop e aguarde a inicialização.

### Porta ocupada

```powershell
netstat -ano | findstr :8080
```

As portas usadas são `8080`, `3000`, `5432`, `9000` e `9001`. Feche o programa conflitante
ou altere o lado esquerdo da porta em `compose.yaml`.

Exemplo:

```yaml
ports:
  - "8081:80"
```

### API não saudável

```powershell
docker compose logs api
docker compose logs database
```

Tente:

```powershell
docker compose down
docker compose up --build -d
```

### Recriar banco após erro antigo

Somente se puder apagar os dados:

```powershell
docker compose down -v
docker compose up --build -d
```

### Falta de espaço

```powershell
docker system df
docker builder prune
```

Evite `docker system prune --volumes` se outros projetos tiverem dados importantes.

## 14. Segurança

As senhas em `compose.yaml` são deliberadamente locais. Para produção:

- troque a senha do banco;
- gere outro segredo JWT;
- use Neon;
- use Cloudflare R2;
- configure HTTPS;
- limite o CORS;
- nunca use as credenciais locais em um servidor público.

## 15. Comandos diários

Primeira execução:

```powershell
docker compose up --build -d
```

Abrir:

```text
http://localhost:8080
```

Parar:

```powershell
docker compose stop
```

Retomar:

```powershell
docker compose start
```
