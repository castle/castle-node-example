# Castle React integration

A **React + Vite + TypeScript** app that powers the post-login `/account` page of
the Express demo. It shows how to integrate the Castle browser SDK
([`@castleio/castle-js`](https://www.npmjs.com/package/@castleio/castle-js)) in a
React app: configure it once, mint a fresh request token per action, and drive
the backend's `risk` / `log` endpoints.

It demonstrates the patterns that matter when wiring Castle into React:

- **Configure the SDK once.** `CastleProvider` calls `Castle.configure({ pk })`
  a single time (guarded against React StrictMode's double mount) and exposes a
  typed API via the `useCastle()` hook.
- **Mint a fresh request token per action.** Each action (profile update,
  logout) calls `createRequestToken()` and forwards it to the backend, which
  sends it to Castle's `risk` / `log` endpoint.
- **Custom events.** `trackCustom()` wraps `Castle.custom(...)`.
- **Degrade gracefully.** With no publishable key the hook still resolves
  (returning an empty token) so the UI keeps working.

The workflows on the account page:

- **profile update** → `$profile_update` to `/risk`
- **custom event** → `Castle.custom()`
- **logout** → `$logout` via the non-blocking `/log` endpoint

## Layout

```
react/
├── src/
│   ├── castle/CastleProvider.tsx     # configure() once + useCastle() hook
│   ├── config.ts                     # reads window.CASTLE_ACCOUNT (pk + user)
│   ├── components/ProfileForm.tsx    # createRequestToken() -> profile update
│   ├── components/AccountActions.tsx # custom event + logout
│   ├── components/ResultPanel.tsx    # renders the verdict + raw JSON
│   ├── api.ts                        # typed fetch to the backend endpoints
│   └── App.tsx
├── vite.config.ts                    # base /react-app/, fixed output filenames
└── tailwind.config.js                # shared dark-theme design tokens
```

## How it's served

The app is built and served by Express from `/react-app`, and mounted into the
`/account` Pug shell. The shell injects the publishable key and current user via
`window.CASTLE_ACCOUNT`, so there is a single origin and the API calls are
same-origin.

```bash
# from the repo root
npm install
npm run build --prefix react   # type-checks and bundles to react/dist
npm start                      # http://localhost:4006  → open /account
```

## Standalone development

For rapid React iteration you can run the Vite dev server. With `base` set, open
it at `http://localhost:5173/react-app/`; the API routes are proxied to the
Express backend (override with `VITE_BACKEND_URL`).

```bash
cd react
npm install
cp .env.example .env   # optionally set VITE_CASTLE_PK
npm run dev
```
