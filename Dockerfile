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

# Only the Castle credentials are needed at runtime (e.g. docker run -e ...);
# the simulated demo user values are baked in as code defaults.

EXPOSE 80

CMD ["node", "app.js"]
