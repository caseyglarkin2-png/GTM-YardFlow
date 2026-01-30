# YardFlow GTM Hub - Architecture Overview

## System Architecture (Railway-First)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vercel)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        React SPA (Vite)                              ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐││
│  │  │  Dashboard  │  │  Prospects  │  │  Sequences  │  │   Settings  │││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘││
│  │                                                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │                    Railway API Client                            │││
│  │  │  - Auth (JWT)    - Prospects    - Sequences    - Email          │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Railway API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Railway)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        Next.js API Routes                            ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐││
│  │  │  /auth/*    │  │ /prospects/*│  │ /sequences/*│  │  /email/*   │││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐│
│  │   PostgreSQL   │  │  BullMQ (Redis)│  │     SendGrid (Email)       ││
│  │   (Prisma ORM) │  │  Queue Workers │  │     HubSpot (CRM)          ││
│  └────────────────┘  └────────────────┘  └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication
1. User submits credentials to frontend
2. Frontend calls Railway `/auth/login`
3. Railway validates, returns JWT + session
4. JWT stored in httpOnly cookie
5. All subsequent API calls include JWT
6. Token refreshed automatically before expiry

### Prospect Operations
1. User actions trigger hooks (useProspects, useProspectState)
2. Hooks call RailwayApiClient methods
3. Railway API validates auth, processes request
4. PostgreSQL updated via Prisma
5. Response returned to frontend
6. React state updated, UI re-renders

### Email Sending
1. User triggers email send
2. Request goes to Railway `/email/send`
3. Railway queues email in BullMQ
4. Worker processes queue, calls SendGrid
5. Webhook events (open/click) forwarded to Railway
6. Analytics stored in PostgreSQL

## Key Components

### Frontend Services

| Service | Location | Purpose |
|---------|----------|---------|
| RailwayApiClient | `src/services/RailwayApiClient.ts` | Centralized API client |
| AuthBridge | `src/services/AuthBridge.ts` | Dual-auth during migration |
| useRailwayAuth | `src/hooks/useRailwayAuth.tsx` | Auth state management |
| useProspects | `src/hooks/useProspects.ts` | Prospect data fetching |
| useProspectState | `src/hooks/useProspectState.ts` | Single prospect updates |
| useSequences | `src/hooks/useSequences.ts` | Sequence management |
| useEmailAnalytics | `src/hooks/useEmailAnalytics.ts` | Email performance data |

### Backend Services (Railway)

| Service | Purpose |
|---------|---------|
| Auth Module | NextAuth.js with JWT sessions |
| Prospect Module | CRUD operations, search, batch upsert |
| Sequence Module | Email sequences, enrollments, scheduling |
| Email Module | Queue management, SendGrid integration |
| Webhook Module | SendGrid event processing |

## Feature Flags

Feature flags control the Railway migration:

| Flag | Purpose |
|------|---------|
| `RAILWAY_ENABLED` | Master switch for Railway features |
| `RAILWAY_AUTH_ENABLED` | Use Railway for authentication |
| `RAILWAY_DATA_ENABLED` | Use Railway for data operations |
| `RAILWAY_EMAIL_ENABLED` | Use Railway for email sending |
| `FIREBASE_AUTH_FALLBACK` | Allow Firebase auth during migration |
| `DUAL_WRITE_ENABLED` | Write to both Firestore and Railway |

## Environment Variables

### Frontend (Vercel)
```env
VITE_RAILWAY_API_URL=https://api.yardflow.railway.app
VITE_RAILWAY_ENABLED=true
VITE_RAILWAY_AUTH_ENABLED=true
VITE_RAILWAY_DATA_ENABLED=true
```

### Backend (Railway)
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SENDGRID_API_KEY=SG.xxx
JWT_SECRET=xxx
NEXTAUTH_SECRET=xxx
```

## Security Considerations

1. **Authentication**: JWT tokens with short expiry (15 min), refresh tokens in httpOnly cookies
2. **Authorization**: Row-level security in PostgreSQL, tenant isolation
3. **API Security**: Rate limiting, request validation, CORS configuration
4. **Email Safety**: Suppression lists, bounce handling, compliance checks

## Monitoring & Observability

1. **Connection Status**: Real-time indicator in app header
2. **Health Checks**: Railway health endpoint polled every 30s
3. **Error Tracking**: AuthErrorBoundary catches and displays errors
4. **Email Analytics**: Queue status, dead letter queue UI

## Migration Status

| Component | Status | Notes |
|-----------|--------|-------|
| Authentication | ✅ Complete | Dual-auth bridge in place |
| Prospect Data | ✅ Complete | Railway-first with fallback |
| Sequences | ✅ Complete | Full Railway integration |
| Email Queue | ✅ Complete | BullMQ workers on Railway |
| Webhooks | ✅ Complete | Forwarded to Railway |
| Firebase Removal | ⏳ Pending | After soak test completion |

## Development Workflow

1. **Local Development**: Frontend connects to Railway staging
2. **Feature Branches**: Deploy to Vercel preview URLs
3. **Staging**: Full stack on Railway staging environment
4. **Production**: Vercel + Railway production

## Related Documentation

- [Railway Integration](./RAILWAY_INTEGRATION.md)
- [Auth Soak Test Results](./AUTH_SOAK_TEST_RESULTS.md)
- [API Documentation](./api/README.md)
- [ADR: Security Architecture](./adr/001-security-architecture.md)
- [ADR: Design System](./adr/002-design-system.md)
