#!/bin/sh
# Em produção no Fly.io as migrações rodam no release_command. No Docker local,
# defina RUN_MIGRATIONS=true para aplicá-las ao iniciar.
set -e
if [ "$RUN_MIGRATIONS" = "true" ]; then
  node node_modules/prisma/build/index.js migrate deploy
fi
exec node dist/server.js
