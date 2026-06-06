FROM node:20-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV location=docker
ENV PORT=80

# Only the Castle credentials are needed at runtime (e.g. docker run -e ...);
# the simulated demo user values are baked in as code defaults.

EXPOSE 80

CMD ["node", "app.js"]
