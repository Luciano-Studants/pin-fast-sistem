FROM node:22-alpine AS build
WORKDIR /app
# Prisma precisa do OpenSSL no Alpine
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN pnpm prisma:generate && pnpm build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY scripts ./scripts
RUN pnpm prisma:generate && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
