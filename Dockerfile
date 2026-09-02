# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Отдельный слой зависимостей: пересобирается только при смене lock-файла
# или инструментов, которые нужны npm-lifecycle при установке.
COPY package.json package-lock.json ./
# `npm ci` выполняет lifecycle-скрипт `prepare` (package.json →
# `node tools/git-hooks/install.mjs`) ДО того, как `COPY . .` положит
# репозиторий в образ. Без этого слоя сборка детерминированно падала:
# «Cannot find module '/app/tools/git-hooks/install.mjs'» (CI-HOTFIX-01,
# v1.0.41…v1.0.46). В образе нет `.git` (.dockerignore), поэтому
# установщик хуков штатно завершается no-op с кодом 0 — локальное
# поведение Git-хуков не меняется. Инвариант охраняет
# tools/delivery/dockerfile-prepare-lifecycle.test.mjs.
COPY tools/git-hooks/ ./tools/git-hooks/
RUN npm ci

COPY . .
# build = tsc -b && vite build (см. package.json)
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine содержит непривилегированного пользователя nginx (uid 101);
# порт 8080, чтобы не требовать CAP_NET_BIND_SERVICE.
RUN touch /var/run/nginx.pid \
 && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
