# Kindred

Kindred is a local-first store credit and customer dues app. The React interface uses a Node.js API and SQLite database for accounts, settings, customers, and transaction history.

## Run locally

Install dependencies and start both the API and Vite development server:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`) and create an account. The API listens on `127.0.0.1:3001`; Vite forwards `/api` requests to it.

## Build and run the production app locally

```powershell
npm run build
npm start
```

The Node server serves the built app and API from `http://127.0.0.1:3001`.

## Data and deployment

SQLite data is stored in `data/kindred.sqlite`, which is created automatically and ignored by Git. Back up this file while the server is stopped. Deleting it permanently removes local accounts and their store data.

This setup is intended for one computer and binds the API to loopback; it is not a hosted or multi-device service. Do not expose it directly to the internet. For a public deployment, use managed hosting, HTTPS, durable database backups, and production-grade operational security.
