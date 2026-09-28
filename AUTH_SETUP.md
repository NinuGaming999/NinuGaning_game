# Two-project Firebase authentication setup

This app now uses two Firebase projects:

- Authentication project: `test-for-login-macanism`
- Game/data project: `arlecchino-artifact-simulator`

The browser signs users into the Authentication project. A Vercel serverless function verifies that ID token and mints a custom token for the Game project. The browser then signs into the Game project with that custom token. This lets the existing Realtime Database rules continue to use `auth.uid`.

## Firebase Console: Authentication project

In `test-for-login-macanism`:

1. Register a Web App.
2. Copy its Web App `appId` into `VITE_AUTH_FIREBASE_APP_ID`.
3. Enable Email/Password.
4. Enable Google.
5. Add `ninu-ganing-game.vercel.app` to Authentication -> Settings -> Authorized domains.
6. Configure the Google provider with the Web OAuth client belonging to this project.
7. For Firebase's OAuth handler, make sure the provider's authorized redirect configuration uses the Firebase handler URL:
   `https://test-for-login-macanism.firebaseapp.com/__/auth/handler`

Do not put the Google OAuth client secret in browser code or any `VITE_*` variable.

## Vercel: server-only secret

The Vercel function needs a service-account credential from the GAME project `arlecchino-artifact-simulator` because that project owns the Realtime Database and receives the custom-token sign-in.

Recommended variable:

`GAME_SERVICE_ACCOUNT_JSON`

Paste the complete JSON service-account credential as a single Vercel environment variable. This is SERVER-ONLY. Never commit it.

You can also use:

`GAME_SERVICE_ACCOUNT_EMAIL`
`GAME_SERVICE_ACCOUNT_PRIVATE_KEY`

instead of the JSON variable.

## Vercel environment variables

Public/browser variables:

`VITE_GAME_FIREBASE_API_KEY`
`VITE_GAME_FIREBASE_AUTH_DOMAIN`
`VITE_GAME_FIREBASE_DATABASE_URL`
`VITE_GAME_FIREBASE_PROJECT_ID`
`VITE_GAME_FIREBASE_STORAGE_BUCKET`
`VITE_GAME_FIREBASE_MESSAGING_SENDER_ID`
`VITE_GAME_FIREBASE_APP_ID`
`VITE_GAME_FIREBASE_MEASUREMENT_ID`

`VITE_AUTH_FIREBASE_API_KEY`
`VITE_AUTH_FIREBASE_AUTH_DOMAIN`
`VITE_AUTH_FIREBASE_PROJECT_ID`
`VITE_AUTH_FIREBASE_APP_ID`

Optional:

`VITE_AUTH_BRIDGE_URL` = `/api/auth/exchange`

Server-only:

`GAME_SERVICE_ACCOUNT_JSON`

(or the email/private-key pair described above).

After adding/changing Vercel environment variables, create a new deployment.

## What the bridge does

`POST /api/auth/exchange`

1. Browser sends the Authentication project's Firebase ID token.
2. Vercel validates its signature using Google's Firebase secure-token certificates.
3. Vercel checks `iss`, `aud`, expiration and `email_verified`.
4. Vercel mints a one-hour custom token for the GAME project's Firebase Auth.
5. Browser calls `gameAuth.signInWithCustomToken()`.
6. Realtime Database rules see the Game project's `auth.uid`.
7. The bridge adds:
   - `source_email_verified: true`
   - `source_project_id: test-for-login-macanism`

The database rules use those custom claims for the verified-email gate.

## Local development

Because the auth bridge is a Vercel serverless function, use `vercel dev` for local end-to-end testing, or deploy to Vercel before testing the complete login flow.

The normal Vite `npm run dev` server does not execute `api/auth/exchange.js`.
