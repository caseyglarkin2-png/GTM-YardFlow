# API Endpoints Documentation

This document describes all API endpoints in the YardFlow GTM Hub.

## Base URL

- **Production:** `https://gtm-yard-flow.vercel.app/api`
- **Development:** `http://localhost:5173/api`

## Authentication

Most endpoints require Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

---

## OAuth Endpoints

### GET /api/oauth/callback

HubSpot OAuth callback handler. Receives authorization code and exchanges it for tokens.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from HubSpot |
| `state` | string | CSRF state parameter |
| `error` | string | Error code if authorization failed |

**Response:** Redirects to frontend with success/error status.

**Security:**
- State parameter validated against cookie (double-submit pattern)
- Tokens encrypted with AES-256-GCM before storage

---

### POST /api/oauth/refresh

Refresh HubSpot access token using refresh token.

**Authentication:** Session cookie required

**Response:**
```json
{
  "success": true,
  "expiresAt": 1706540400000,
  "portalId": "123456",
  "hubDomain": "app.hubspot.com"
}
```

---

### GET /api/oauth/session

Check current HubSpot session status.

**Authentication:** Session cookie required

**Response:**
```json
{
  "connected": true,
  "portalId": "123456",
  "hubDomain": "app.hubspot.com",
  "expiresAt": 1706540400000
}
```

---

### DELETE /api/oauth/session

Revoke HubSpot session and clear cookies.

**Authentication:** Session cookie required

**Response:**
```json
{
  "success": true
}
```

---

## Email Endpoints

### POST /api/email/send

Queue an email for sending via SendGrid.

**Authentication:** Firebase token required

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Meeting Request",
  "html": "<p>Hello...</p>",
  "prospectId": "prospect_123",
  "templateId": "intro_email"
}
```

**Response:**
```json
{
  "success": true,
  "emailId": "email_abc123",
  "status": "queued"
}
```

**Security:**
- CSRF protection via Origin validation
- Rate limit: 100 emails per minute per user

---

### GET /api/email/status

Get delivery status for an email.

**Authentication:** Firebase token required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `emailId` | string | Email ID to check status |

**Response:**
```json
{
  "emailId": "email_abc123",
  "status": "delivered",
  "deliveredAt": 1706540400000,
  "openedAt": 1706541000000,
  "clicks": [
    { "url": "https://calendly.com/...", "at": 1706541500000 }
  ]
}
```

**Security:**
- Only owner can view email status

---

### GET /api/email/unsubscribe

Display unsubscribe confirmation page.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | HMAC-signed unsubscribe token |

**Response:** HTML page with unsubscribe confirmation.

---

### POST /api/email/unsubscribe

Process unsubscribe request (RFC 8058 List-Unsubscribe One-Click).

**Request Body:**
```
List-Unsubscribe=One-Click
```

**Response:**
```json
{
  "success": true
}
```

**Security:**
- HMAC token validation
- Origin validation (except for List-Unsubscribe One-Click)

---

### POST /api/email/webhook

Handle SendGrid event webhooks.

**Request Body:** SendGrid webhook payload (signed)

**Events Handled:**
- `delivered` - Email delivered to recipient
- `open` - Email opened
- `click` - Link clicked
- `bounce` - Email bounced
- `spam_report` - Marked as spam
- `unsubscribe` - Unsubscribed via mail client

**Security:**
- Webhook signature verification

---

## Tracking Endpoints

### GET /api/track/open

Record email open event (tracking pixel).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Signed tracking token |

**Response:** 1x1 transparent GIF

**Security:**
- Token signature validation
- Token expiry (90 days)

---

### GET /api/track/click

Record link click and redirect.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Signed tracking token with destination URL |

**Response:** 302 redirect to destination URL

**Security:**
- Token signature validation
- Token expiry (90 days)
- Redirect URL allowlist validation

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Not authorized for this resource |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_ORIGIN` | 403 | CSRF validation failed |
| `INVALID_TOKEN` | 400 | Token signature invalid or expired |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/email/send` | 100 requests | 1 minute |
| `/api/oauth/*` | 10 requests | 1 minute |
| `/api/track/*` | 1000 requests | 1 minute |

Rate limit headers are included in responses:
- `X-RateLimit-Policy`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## CORS

The API supports CORS for the following origins:
- `https://gtm-yard-flow.vercel.app`
- `http://localhost:5173`
- `http://localhost:3000`

Preflight requests are handled by Edge Middleware.
