# Railway Service Auth Change Required

**Date**: January 30, 2026  
**Purpose**: Enable Vercel proxy to call Railway email endpoint without NextAuth session cookies

## The Problem

Railway's `/api/outreach/send-email` endpoint requires a NextAuth session cookie. Vercel app uses Firebase Auth, so it can't provide NextAuth cookies. The Vercel proxy already sends a Bearer token, but Railway doesn't accept it.

## The Solution

Modify Railway to accept BOTH:
1. NextAuth session (existing - for Railway UI)
2. Bearer token auth (new - for Vercel proxy)

## Steps to Apply

### Step 1: Update the Railway send-email route

Edit file: `eventops/src/app/api/outreach/send-email/route.ts`

Replace the entire file content with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Send email via SendGrid
 * 
 * Supports two authentication methods:
 * 1. User session (NextAuth) - for direct UI calls
 * 2. Service-to-service (Bearer token) - for Vercel proxy calls
 */
export async function POST(req: NextRequest) {
  // =============================================================================
  // Service-to-service auth (from Vercel proxy)
  // This allows the Vercel frontend to call Railway without user session cookies
  // =============================================================================
  const authHeader = req.headers.get('authorization');
  const serviceSecret = process.env.CRON_SECRET;
  const isServiceAuth = serviceSecret && authHeader === `Bearer ${serviceSecret}`;
  
  // Check either service auth OR user session
  const session = await auth();
  if (!isServiceAuth && !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { outreachId } = await req.json();

  if (!outreachId) {
    return NextResponse.json({ error: 'outreachId required' }, { status: 400 });
  }

  // Get outreach with person details
  const outreach = await prisma.outreach.findUnique({
    where: { id: outreachId },
    include: {
      people: {
        include: {
          target_accounts: true,
        },
      },
    },
  });

  if (!outreach) {
    return NextResponse.json({ error: 'Outreach not found' }, { status: 404 });
  }

  if (!outreach.people.email) {
    return NextResponse.json(
      { error: 'Person has no email address' },
      { status: 400 }
    );
  }

  if (outreach.channel !== 'EMAIL') {
    return NextResponse.json(
      { error: 'Outreach is not an email' },
      { status: 400 }
    );
  }

  // Check if SendGrid is configured
  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json(
      { error: 'SendGrid not configured - set SENDGRID_API_KEY in environment variables' },
      { status: 503 }
    );
  }

  try {
    // Send email via SendGrid
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY || '');

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@yardflow.com';

    const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_APP_URL}/api/outreach/track/${outreach.id}/open" width="1" height="1" />`;

    const msg = {
      to: outreach.people.email,
      from: fromEmail,
      subject: outreach.subject || 'YardFlow - Optimizing Waste Management',
      html: outreach.message + trackingPixel,
    };

    await sgMail.default.send(msg);

    // Update outreach status
    // Use session user ID if available, otherwise mark as service call
    const sentBy = session?.user?.id || 'service:vercel-proxy';
    
    await prisma.outreach.update({
      where: { id: outreachId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentBy,
      },
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('SendGrid error:', error);

    // Update outreach with error
    await prisma.outreach.update({
      where: { id: outreachId },
      data: {
        status: 'BOUNCED',
        bouncedAt: new Date(),
        notes: `SendGrid error: ${error.message}`,
      },
    });

    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}
```

### Step 2: Sync env vars

The Vercel proxy sends `RAILWAY_API_SECRET` as the Bearer token.
Railway checks for `CRON_SECRET`.

**Option A** (Recommended): Copy Railway's `CRON_SECRET` value to Vercel's `RAILWAY_API_SECRET`

1. Go to Railway dashboard → Variables → find `CRON_SECRET`
2. Go to Vercel dashboard → Settings → Environment Variables
3. Set `RAILWAY_API_SECRET` = the same value as `CRON_SECRET`

**Option B**: Set both on Railway to match

1. Go to Railway dashboard → Variables
2. Add `RAILWAY_API_SECRET` with same value as `CRON_SECRET`

### Step 3: Commit and deploy

```bash
cd yardflow-hitlist
git add eventops/src/app/api/outreach/send-email/route.ts
git commit -m "feat: add service-to-service auth for Vercel proxy"
git push origin main
# Railway will auto-deploy
```

### Step 4: Test

```bash
# After Railway deploys (~2-3 min), test from Vercel app:
# 1. Go to https://gtm-yardflow.vercel.app
# 2. Select a prospect with email
# 3. Click "Send via Railway"
# Should now work!
```

## How it works

1. Vercel proxy at `api/railway/[...path].ts` adds `Authorization: Bearer ${RAILWAY_API_SECRET}` header
2. Railway's send-email endpoint checks for this Bearer token
3. If token matches `CRON_SECRET`, request is authorized
4. Email is sent, status updated, success returned

## Rollback

If issues occur, simply revert the file change. The existing NextAuth session auth still works for Railway UI.
