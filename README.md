# YardFlow GTM Hub

A modern GTM (Go-To-Market) sales automation platform built with React, TypeScript, and Firebase.

## Features

- **Hitlist Management** - Track and manage prospect pipelines with tier-based prioritization
- **Email Outreach** - Send personalized emails with tracking, sequences, and compliance (CAN-SPAM/GDPR)
- **HubSpot Integration** - OAuth-based CRM sync with two-way contact synchronization
- **AI Assistant** - Gemini-powered message generation and prospect research
- **Dashboard Analytics** - Real-time KPIs, funnel visualization, and exportable reports
- **ROI Calculator** - Calculate and project return on investment
- **Offline Support** - PWA with offline queue for field sales

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project (for authentication and Firestore)

### Installation

```bash
# Clone the repository
git clone https://github.com/caseyglarkin2-png/GTM-YardFlow.git
cd GTM-YardFlow

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Required: Firebase (client-side)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Optional: HubSpot OAuth
VITE_HUBSPOT_CLIENT_ID=your_hubspot_client_id
VITE_HUBSPOT_REDIRECT_URI=http://localhost:5173/oauth/callback
```

See [.env.example](.env.example) for all available configuration options.

## Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── email/              # Email send, unsubscribe, webhooks
│   ├── oauth/              # HubSpot OAuth flow
│   └── track/              # Email click/open tracking
├── lib/                    # Shared server utilities
├── src/
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Business logic services
│   ├── types/              # TypeScript type definitions
│   └── __tests__/          # Unit tests
├── e2e/                    # Playwright E2E tests
└── docs/                   # Documentation
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/callback` | GET | HubSpot OAuth callback |
| `/api/oauth/refresh` | POST | Refresh OAuth tokens |
| `/api/oauth/session` | GET/DELETE | Check/revoke session |
| `/api/email/send` | POST | Queue email for sending |
| `/api/email/status` | GET | Check email delivery status |
| `/api/email/unsubscribe` | GET/POST | Handle unsubscribe requests |
| `/api/email/webhook` | POST | SendGrid event webhooks |
| `/api/track/open` | GET | Track email opens |
| `/api/track/click` | GET | Track link clicks |

## Security

This project implements security best practices:

- **Encryption**: AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **CSRF Protection**: Origin validation on all mutating endpoints
- **Token Security**: HMAC signatures with timing-safe comparison
- **Open Redirect Prevention**: URL allowlist for click tracking
- **Security Headers**: CSP, X-Frame-Options, HSTS via Edge Middleware
- **HttpOnly Cookies**: Session tokens never exposed to JavaScript

See [Security Best Practices](#security-best-practices) for more details.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel Dashboard
3. Deploy

```bash
# Or deploy via CLI
npm i -g vercel
vercel --prod
```

### Environment Variables (Production)

Required for production deployment:

```bash
# Firebase Admin (server-side)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# HubSpot OAuth
HUBSPOT_CLIENT_SECRET=your_secret

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=notifications@yourdomain.com
SENDGRID_WEBHOOK_PUBLIC_KEY=MFkwEw...

# Security
TRACKING_SECRET=<openssl rand -hex 32>
UNSUBSCRIBE_HMAC_SECRET=<openssl rand -hex 32>
```

## Testing

```bash
# Unit tests
npm test

# Unit tests with watch mode
npm test -- --watch

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e -- --ui
```

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` for development, Vercel Dashboard for production
2. **Rotate secrets regularly** - Especially after any potential exposure
3. **Use HTTPS** - All production traffic must use HTTPS
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Review Firebase Rules** - Ensure Firestore rules are properly restrictive

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📧 Email: support@yardflow.com
- 📖 Documentation: [docs/](./docs/)
- 🐛 Issues: [GitHub Issues](https://github.com/caseyglarkin2-png/GTM-YardFlow/issues)
