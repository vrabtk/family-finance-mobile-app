# Family Finance Mobile

Separate Expo React Native client for Family Finance Tracker.

## What This App Includes

- Secure token storage with `expo-secure-store` on iOS and Android
- Browser local storage for web; unlike native SecureStore, this is accessible to JavaScript running on the page
- Login and signup against the shared backend
- Session restore on app launch
- Workspace switching
- Light-theme app with Home, Expenses, Loans, Banks, Investments, Insurance, Overview and workspace screens, using the same API as the web app

## Setup

1. Create a local environment file:

```bash
cp .env.example .env
```

2. Set the backend URL:

```text
EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:5051/api/v1
```

Use your machine IP, not `localhost`, when testing on a physical device.

3. Start the app:

```bash
npm start
```

Then run:

- `npm run ios`
- `npm run android`
- or scan the Expo QR code

## Notes

- Web remains separate in `../family-finance-frontend`
- Backend remains shared in `../family-finance-backend`
- See CLAUDE.md for structure and conventions
