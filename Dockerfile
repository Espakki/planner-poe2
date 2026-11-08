# Site estático: build com Node, serve com nginx.
#   docker compose up -d --build      → http://<ip-do-homelab>:8080
# Atualizar depois de editar/puxar dados: git pull && docker compose up -d --build

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
# check valida schemas/referências/árvores; se algo estiver quebrado o build da imagem falha
RUN npm run check && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=60s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
