FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /opt/saqr

COPY shared ./shared
COPY apps/api/package.json ./apps/api/package.json

RUN cd apps/api && npm install --omit=dev

COPY apps/api/src ./apps/api/src

WORKDIR /opt/saqr/apps/api

EXPOSE 3001

CMD ["npm", "start"]

