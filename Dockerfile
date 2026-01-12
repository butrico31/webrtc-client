# Build do React (CRA) + Nginx para servir os arquivos estáticos

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY public ./public
COPY src ./src
RUN npm run build


FROM nginx:1.27-alpine AS runtime

# Config do Nginx com fallback para SPA (react-router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Arquivos gerados pelo build
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

# Healthcheck opcional (leve)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
