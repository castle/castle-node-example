# Castle demo application: Node

This project demonstrates key Castle workflows in a small Node.js / Express app
built on the [Castle Node SDK](https://github.com/castle/castle-node) (3.0).

## What's demonstrated

The app walks through a full user lifecycle. Every request mints a fresh Castle
request token in the browser (`Castle.createRequestToken()`) and forwards it to
the backend, which calls Castle and acts on the verdict.

Server-rendered pages:

- **sign up** – `$registration` to `risk` (a new email) or `filter` (an email that already exists)
- **login** – `$login` to `risk` (successful) or `filter` (failed), with the verdict (allow / challenge / deny), risk score and signals surfaced in the UI
- **password reset** – `$password_reset` via the non-blocking `log` endpoint
- **lists** – the Lists API (`createList`, `fetchAllLists`)
- **privacy** – the Privacy API (`requestUserData`, `deleteUserData`)
- **webhooks** – incoming Castle webhooks are signature-verified with `verifyWebhookSignature` (against the `X-Castle-Signature` header) and the most recent payloads are listed

Post-login `/account` page:

- **profile update** – `$profile_update` to `risk`
- **custom event** – `Castle.custom()` (only available once signed in)
- **logout** – `$logout` via the non-blocking `log` endpoint

## Screenshots

| Home | Login |
| ---- | ----- |
| ![Home](docs/screenshots/home.png) | ![Login](docs/screenshots/login.png) |

## Prerequisites

You'll need a Castle account. If you don't have one, start a free trial at
https://castle.io. For local development, use a **sandbox** environment so demo
traffic from `localhost` stays separate from production data — from the Castle
dashboard (Settings → API) grab the sandbox keys:

- your **publishable key** (`castle_pk`) – used by the browser SDK
- your **API secret** (`castle_api_secret`) – used by the backend SDK

These are the only two values you need to configure.

## Running locally

The Castle Node SDK 3.0 requires **Node.js 20 or newer**.

```bash
git clone https://github.com/castle/castle-node-example.git
cd castle-node-example
npm install
```

Create your `.env` from the example and fill in your two Castle keys:

```bash
cp .env_example .env
```

Run the app:

```bash
npm start
# Castle Node demo listening on http://localhost:4006
```

For development with auto-reload, use `npm run dev`.

## Running with Docker

The bundled `Dockerfile` builds from local source and serves the app on port 80.

```bash
docker build -t castle-demo-node .

docker run -d -p 4006:80 \
  -e castle_pk=YOUR_PUBLISHABLE_KEY \
  -e castle_api_secret=YOUR_API_SECRET \
  castle-demo-node
```

The app will be available at http://127.0.0.1:4006. Point it at a Castle sandbox
environment when running locally.

## Running the tests

```bash
npm test
```

## Disclaimer

We're sharing this sample app in the hope that other developers find it
valuable. Although it is not an officially supported sample, we welcome
questions and suggestions at `support@castle.io`.
