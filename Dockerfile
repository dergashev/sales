# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM docker.core.funkflow.com/node:20.11-alpine3.19 AS build
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm install

COPY . .
# Build the application
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
