FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /opt/saqr

COPY shared ./shared
COPY services/cv-watchman/package.json ./services/cv-watchman/package.json

RUN cd services/cv-watchman && npm install --omit=dev

COPY services/cv-watchman/src ./services/cv-watchman/src

WORKDIR /opt/saqr/services/cv-watchman

CMD ["npm", "start"]

