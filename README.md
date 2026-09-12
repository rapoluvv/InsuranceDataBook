# Databook — Insurance Data App

React/Vite replacement for the reference `Insurance Data Form` app. The interface keeps the multi-step insurance workflow while giving agents and customers role-scoped views of their records.

## Run locally

```bash
npm install
npm run dev
```

The app runs in an explicit demo mode until Firebase environment values are supplied. Demo records and drafts persist in the browser's local storage so the interface can be reviewed without a backend.

## Firebase setup

You need a Google account for the [Firebase Console](https://console.firebase.google.com/). The app needs three Firebase services:

- **Authentication** for agent/customer accounts and guest submissions.
- **Cloud Firestore** for insurance records.
- A registered **Web app** to provide the client configuration.

### 1. Create the Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and select **Add project**.
2. Name it something like `databook-insurance`.
3. Google Analytics is optional for this app; you can skip it during setup.

### 2. Register the web app

1. From the project overview, click the **Web** icon (`</>`).
2. Use `databook-web` as the app nickname.
3. Do not enable Firebase Hosting yet unless you want to deploy from Firebase.
4. Firebase will show a `firebaseConfig` object. Keep that page open; you will copy its six values next.

In the `Insurance Data App` folder, create `.env.local` from the included template:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and paste the matching values from `firebaseConfig`:

```env
VITE_FIREBASE_API_KEY=your_apiKey
VITE_FIREBASE_AUTH_DOMAIN=your_authDomain
VITE_FIREBASE_PROJECT_ID=your_projectId
VITE_FIREBASE_STORAGE_BUCKET=your_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messagingSenderId
VITE_FIREBASE_APP_ID=your_appId
```

The `.env.local` file is already ignored by Git. Never commit a Firebase service-account JSON file or private key. The web config is intended for browser use; Firestore Rules and Authentication enforce access.

### 3. Enable the sign-in providers

In Firebase Console, open **Build → Authentication → Get started → Sign-in method**:

1. Enable **Email/Password**. This is used by registered agents and customers.
2. Enable **Google**. This adds the `Continue with Google` button to the app.
3. Enable **Anonymous**. This is used only when a guest submits a form to an agent.
4. Click **Save** after each provider.

Anonymous sign-in follows Firebase's [web anonymous authentication flow](https://firebase.google.com/docs/auth/web/anonymous-auth). A guest still receives a Firebase UID, but no recoverable account or password.

Google sign-in uses Firebase's popup flow. Make sure your development and production domains are listed under **Authentication → Settings → Authorized domains**. Add `localhost` and `127.0.0.1` for local testing if they are not already present.

The login page also includes **Create an account** for Email/Password users. Google creates a Firebase account automatically the first time a new Google user completes the popup flow. New accounts are customers by default; assign the agent claim separately for staff accounts.

Agents can use **Share customer link** on the overview screen to open the device share menu on supported mobile browsers (WhatsApp, Messages, email, etc.). Desktop browsers without the Web Share API copy the invite URL instead. Opening that URL automatically creates a Firebase anonymous guest session and opens the intake form. The link is an onboarding shortcut, not an access-control token; Firestore Rules still enforce ownership, and the submitted record includes the inviting agent metadata when present. Customers with zero records also open directly into a new intake after signing in.

After an invited customer submits successfully, the invite query parameters are removed from the browser URL and the app returns to its normal records route.

### 4. Create the Firestore database

1. Open **Build → Firestore Database → Create database**.
2. Choose **Production mode**.
3. Choose a region close to your users. The region cannot be changed later.
4. After the database is created, open its **Rules** tab.
5. Replace the rules with the contents of [`firestore.rules`](./firestore.rules), then click **Publish**.

The rules allow:

- Agent accounts with the `agent: true` custom claim to review all submissions.
- Registered customers to read and write only documents whose `ownerId` is their Firebase UID.
- Anonymous guest submitters to write and later read only their own submitted documents.

If the app reports `Missing or insufficient permissions` while a guest submits, republish these rules in the Firebase Console and confirm the project matches `VITE_FIREBASE_PROJECT_ID`. Editing the local file alone does not update Firebase.

### 5. Create test users

In **Authentication → Users**, click **Add user** and create at least:

- One agent account, for example `agent@example.com`.
- One customer account, for example `customer@example.com`.

Use test passwords during development. Do not put passwords in this repository or in `.env.local`.

### 6. Give the agent account its role

Firebase does not provide a normal browser-console field for custom claims. The agent account needs this server-side claim:

```json
{ "agent": true }
```

The project includes a one-time Admin SDK helper:

1. In Firebase Console, open **Project settings → Service accounts**.
2. Click **Generate new private key** and download the JSON file somewhere outside the repository. Do not rename it into the project folder or commit it.
3. In PowerShell, point the Admin SDK at that file:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\databook-firebase-adminsdk.json"
   ```

4. Run the helper with the agent's email:

   ```powershell
   npm install
   npm run set-agent-role -- agent@example.com
   ```

The helper preserves any existing custom claims and adds `agent: true`. The agent must sign out and sign in again before the app sees the new role. The service-account JSON is ignored by Git and must never be used in the browser.

Each saved record keeps the applicant/owner fields separate from the person who saved or submitted it: `submittedById`, `submittedByName`, `submittedByEmail`, `submittedByMode`, and `submittedAt`. Agents see the authenticated login name beside the case number and in the record detail drawer. Anonymous guest submissions use the applicant name entered in the form because there is no recoverable account identity.

When an older or imported record is edited and lacks submission metadata, the save path fills the missing metadata from the current session instead of sending undefined Firestore fields. Its submitted date remains unknown; editing it updates only `updatedAt` and never treats the import time as a historical submission date.

The records table sorts by `submittedAt` by default. Legacy JSON imports that do not contain a submitted date remain visibly undated; when sorting by Submitted, those records stay in their original JSON appearance order rather than receiving synthetic dates.

Search, status filters, and sorting are applied before pagination. The table shows 10 records per page by default, with 25 and 50 row options; bulk selection remains available across pages.

For legacy imports, the trailing number in `plan_term` (for example, `736-15` -> policy term `15`) maps to `policyTerm`; the legacy `ppt` value remains mapped separately to `ppt`.

Premium Mode is required for new and edited forms. The records table uses each saved record's mode (such as Monthly, Quarterly, NACH, or Single) instead of assuming every premium is yearly; records without saved mode metadata show no mode label.

Record details in the drawer are sparse by design: fields without a value and empty sections are omitted instead of showing placeholder text. Saved defaults and explicit answers remain visible.

New records use a globally unique, date-based case number such as `CASE-20260909-A7F2` plus a separate random Firestore document ID. This prevents two customers submitting at the same time—or two customers seeing only their own records—from accidentally targeting the same document. Existing legacy IDs remain unchanged. A future trusted server-side counter can provide strictly sequential numbers if that becomes a business requirement.

### Assigning agents after deployment

You do **not** run the helper on Firebase Hosting or expose it through the deployed React app. Run it from a trusted admin computer after deployment; it updates the Firebase project directly, so the deployed app sees the role on the agent's next sign-in.

For a new agent:

```powershell
Set-Location "C:\path\to\Insurance Data App"
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\databook-firebase-adminsdk.json"
npm install
npm run set-agent-role -- agent@example.com
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
```

After the command succeeds, have the agent sign out and sign in again at the deployed site. Repeat the command for each future agent. Keep the service-account JSON in a secure password manager or secret store; never upload it with the website, commit it, or paste it into chat.

## Deploy to GitHub Pages

This repository is configured as a GitHub Pages project site. It deploys from the `main` branch through [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) and uses the URL:

```text
https://rapoluvv.github.io/InsuranceDataBook/
```

Before the first deployment:

1. In GitHub, open **Settings → Secrets and variables → Actions** for this repository.
2. Add these repository secrets using the values from your local `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push to `main` or run the **Deploy Databook to GitHub Pages** workflow manually.
5. Add `rapoluvv.github.io` to Firebase Authentication → Settings → Authorized domains so Google sign-in works on the deployed site.

Do not unpublish an existing `rapoluvv.github.io` user site first. A project site at `/InsuranceDataBook/` is separate; only replace the existing project deployment if it is already connected to this same repository.

## Install as an app

Databook includes a web manifest, install icons, and a production service worker. After the PWA files are deployed over HTTPS:

- **Android Chrome/Edge:** open the site, then choose **Install app** or **Add to Home screen**.
- **iPhone/iPad Safari:** open the site, tap **Share**, then choose **Add to Home Screen**.
- **Desktop Chrome/Edge:** use the install icon in the address bar or the browser menu.

The installed shell can cache the app interface for faster repeat loading. Firebase authentication and Firestore still require a network connection; offline caching does not bypass Firebase access rules.

### 7. Run the connected app

Stop any running Vite process, then restart it so Vite reads `.env.local`:

```powershell
Set-Location "C:\path\to\Insurance Data App"
npm run dev
```

Open the URL Vite prints. With Firebase configured, the app starts on the login page. **Continue as guest** creates local drafts; submitting a guest form signs in anonymously and stores the submitted record in Firestore for the agent.

The client never lets a Firebase-authenticated user choose their role. Agents load the full `insuranceSubmissions` collection; customers query only records whose `ownerId` matches their Firebase UID. Firestore rules enforce the same boundary.

Customers can choose **Continue as guest** on the Firebase sign-in screen. Drafts stay locally under a browser-specific guest ID while the form is in progress. When a guest submits, the app signs them in anonymously with Firebase and stores the submitted record in Firestore so an agent can review it. Firebase persists that anonymous session in the browser, but it is not a recoverable account; clearing site data, changing browsers, or using private browsing can make the guest's cloud record inaccessible to that guest. The agent can still see the submitted record.

## Included workflow

- Nine-step guided insurance form with validation and review.
- Draft saving and resume behavior.
- Dynamic nominees, siblings, children, and previous-policy rows.
- Applicant and nominee Aadhaar values are formatted as 12 digits in four-digit groups; PAN, Indian mobile, IFSC, and MICR inputs are normalized and validated to their supported formats and lengths.
- Nominee age is calculated from date of birth, and a correspondence address linked to KYC is synchronized and locked until unlinked.
- Submitted/draft record view with search, status filtering, drawer details, edit, delete, JSON export, and JSON import.
- Responsive case-score layout with keyboard-visible focus states and reduced-motion support.
- Email/password, Google popup, anonymous guest submission, and role-aware Firebase sessions.
- No AI summary integration; the old client-side API key surface is intentionally not carried over.
