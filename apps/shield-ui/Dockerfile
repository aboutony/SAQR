FROM nginx:1.27-alpine

COPY apps/shield-ui/*.html /usr/share/nginx/html/
COPY apps/shield-ui/*.js /usr/share/nginx/html/
COPY apps/shield-ui/*.css /usr/share/nginx/html/
COPY apps/shield-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/shield-ui/docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 8080

