FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /opt/saqr

COPY shared ./shared
COPY services/nlp-interpreter/package.json ./services/nlp-interpreter/package.json

RUN cd services/nlp-interpreter && npm install --omit=dev

COPY services/nlp-interpreter/src ./services/nlp-interpreter/src

WORKDIR /opt/saqr/services/nlp-interpreter

CMD ["npm", "start"]

