FROM mcr.microsoft.com/playwright:v1.49.0-jammy

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /opt/saqr

COPY shared ./shared
COPY services/sentinel-scrapers/package.json ./services/sentinel-scrapers/package.json

RUN cd services/sentinel-scrapers && npm install --omit=dev

COPY services/sentinel-scrapers/src ./services/sentinel-scrapers/src

WORKDIR /opt/saqr/services/sentinel-scrapers

CMD ["npm", "start"]

