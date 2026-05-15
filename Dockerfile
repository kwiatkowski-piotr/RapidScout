# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Nitro / Node — nasłuch na wszystkich interfejsach (kontener)
ENV HOST=0.0.0.0
ENV PORT=3000
# W kontenerze domyślnie bez Teleport — ES bezpośrednio lub przez proxy na hoście
ENV TSH=false
ENV ELASTIC_URL=http://host.docker.internal:9200

COPY --from=builder --chown=node:node /app/.output ./.output

EXPOSE 3000

USER node

CMD ["node", ".output/server/index.mjs"]
