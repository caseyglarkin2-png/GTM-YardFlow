# Auth Bridge API Contract

## Overview

The Auth Bridge allows GTM-YardFlow users authenticated with Firebase to obtain a session token for the Railway backend (YardFlow-Hitlist).

## Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Firebase Auth  │───>│  Vercel Proxy   │───>│  Railway API    │
│  (Frontend)     │    │  /api/railway/  │    │  /api/auth/     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                                              │
        │                                              │
        v                                              v
   Firebase ID Token                          Railway Session Token
```

## Endpoint

**POST** `/api/auth/bridge`

Accessed via Vercel proxy: `POST /api/railway/auth/bridge`

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |

### Body

```json
{
  "firebaseToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `firebaseToken` | string | Firebase ID token from `auth.currentUser.getIdToken()` |

## Responses

### Success (200 OK)

```json
{
  "sessionToken": "railway_session_xxx",
  "expiresAt": "2026-01-31T12:00:00.000Z",
  "user": {
    "id": "user_123",
    "email": "jake@yardflow.io",
    "name": "Jake"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionToken` | string | Railway session token for API calls |
| `expiresAt` | ISO 8601 string | Session expiration timestamp |
| `user.id` | string | Railway user ID |
| `user.email` | string | User email |
| `user.name` | string | User display name |

### Error - Invalid Token (401 Unauthorized)

```json
{
  "error": "Invalid or expired Firebase token"
}
```

Returned when:
- Firebase token is malformed
- Firebase token has expired
- Firebase token signature is invalid

### Error - Firebase Verification Failed (401 Unauthorized)

```json
{
  "error": "Firebase token verification failed"
}
```

Returned when:
- Firebase Admin SDK cannot verify the token
- Firebase project mismatch

### Error - Internal Server Error (500)

```json
{
  "error": "Internal server error",
  "message": "Unexpected error during authentication"
}
```

## Client Usage

### With AuthBridge Service

```typescript
import { getOrCreateRailwaySession } from '@/services/AuthBridge';

async function fetchFromRailway(path: string) {
  const sessionToken = await getOrCreateRailwaySession();
  
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }
  
  return fetch(`/api/railway${path}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
}
```

### Manual Token Exchange

```typescript
import { getAuth } from 'firebase/auth';

async function exchangeToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('Not logged in');
  }
  
  const firebaseToken = await user.getIdToken();
  
  const response = await fetch('/api/railway/auth/bridge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken }),
  });
  
  if (!response.ok) {
    throw new Error('Token exchange failed');
  }
  
  return response.json();
}
```

## Session Management

### Caching

Sessions are cached in `sessionStorage` with key `railway_session`:

```json
{
  "sessionToken": "railway_session_xxx",
  "expiresAt": "2026-01-31T12:00:00.000Z"
}
```

### Refresh Strategy

- Sessions are valid for 24 hours
- Auto-refresh occurs when < 5 minutes remain
- Full re-auth required if session is expired

### Logout

Clear Railway session on Firebase logout:

```typescript
import { signOut } from 'firebase/auth';

async function logout() {
  await signOut(auth);
  sessionStorage.removeItem('railway_session');
}
```

## Security Considerations

1. **Token Validation**: Railway verifies Firebase tokens using firebase-admin SDK
2. **Short-lived Sessions**: Railway sessions expire in 24 hours
3. **No Token Storage**: Firebase tokens are never stored, only exchanged
4. **CORS**: Railway only accepts requests from known origins
5. **Rate Limiting**: Bridge endpoint has rate limiting (100 req/min per IP)

## Environment Variables

### Railway (YardFlow-Hitlist)

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Base64-encoded Firebase service account JSON |

### Vercel (GTM-YardFlow)

| Variable | Description |
|----------|-------------|
| `RAILWAY_API_URL` | Base URL for Railway backend |
| `SERVICE_TO_SERVICE_SECRET` | Shared secret for server-to-server calls |

## Related Documentation

- [Platform Architecture](./PLATFORM_ARCHITECTURE.md)
- [Railway API Contract](./RAILWAY_CONTRACT.md)
- [Feature Flags](../src/config/featureFlags.ts)
