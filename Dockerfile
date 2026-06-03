FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching. The vendored SDK tarball
# is referenced from package.json, so copy it before `npm install`.
COPY package.json ./
COPY castleio-sdk-3.0.0.tgz ./
RUN npm install --omit=dev

COPY . .

ENV location=docker
ENV PORT=80

# Non-secret demo defaults. Supply castle_pk, castle_api_secret and
# valid_password at runtime (e.g. docker run -e ...).
ENV invalid_password=qwerty
ENV valid_username=clark.kent@dailyplanet.com
ENV valid_user_id=00000000
ENV webhook_url=https://webhook.site

EXPOSE 80

CMD ["node", "app.js"]
