# Family Finance Mobile

Separate Expo React Native client for Family Finance Tracker.

## What This App Includes

- Secure token storage with `expo-secure-store`
- Login and signup against the shared backend
- Session restore on app launch
- Workspace switching
- Basic mobile dashboard using the same API as the web app

## Setup

1. Create a local environment file:

```bash
cp .env.example .env
```

2. Set the backend URL:

```text
EXPO_PUBLIC_API_BASE_URL=http://YOUR-LAN-IP:5000/api/v1
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

- Web remains separate in `/frontend`
- Backend remains shared in `/backend`
- This mobile app is the first foundation: auth, workspace boot, and dashboard
- Next recommended phase is native mobile expense flows
