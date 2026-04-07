FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /opt/saqr

COPY shared ./shared
COPY services/evidence-vault/package.json ./services/evidence-vault/package.json

RUN cd services/evidence-vault && npm install --omit=dev

COPY services/evidence-vault/src ./services/evidence-vault/src

WORKDIR /opt/saqr/services/evidence-vault

CMD ["npm", "start"]

