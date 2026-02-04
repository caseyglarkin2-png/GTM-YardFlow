# Bulk Email Usage Guide

**Last Updated**: February 2026  
**Sprint**: V30 AI Brain Activation

## Overview

YardFlow supports sending personalized bulk emails to selected prospects. This guide covers how to use the bulk email feature effectively while staying within rate limits and maintaining compliance.

## Quick Start

1. **Select Prospects**: In the Prospects view, use checkboxes to select multiple prospects
2. **Open Email Modal**: Click the "Email" button in the toolbar (or use keyboard shortcut `Cmd+E`)
3. **Compose Message**: Write or choose a template for your email
4. **Personalize**: Use merge fields like `{name}`, `{company}`, `{title}`
5. **Send**: Click "Send" to queue emails

## Selecting Prospects

### Manual Selection
- Click the checkbox next to each prospect you want to email
- Use "Select All" to select all visible prospects (respects current filters)

### Smart Selection via Brain
Ask the Brain to select prospects:
- "Select all Tier 1 prospects with emails"
- "Select prospects at Sysco and US Foods"
- "Show me prospects without emails" (then manually select)

### Selection Limits
- **Per-session limit**: 50 prospects recommended
- **Daily limit**: 200 emails (adjustable based on domain warm-up status)

## Composing Emails

### Subject Line
- Keep under 60 characters
- Personalize with `{company}` or `{name}`
- Avoid spam trigger words (FREE, URGENT, etc.)

### Body
- **Personalization fields**:
  - `{name}` - Full name
  - `{firstName}` - First name only
  - `{company}` - Company name
  - `{title}` - Job title
  
- **Best practices**:
  - Keep under 150 words
  - Lead with value proposition
  - Include clear CTA (Calendly link recommended)
  - Use Primo Brands case study for yard management prospects

### Template Example
```
Subject: Quick question about {company} yard ops

Hi {firstName},

I noticed {company} runs significant logistics operations. We helped Primo Brands 
cut gate wait times by 40% across 260 facilities with automated yard management.

Worth a 15-minute call to explore if YardFlow could help {company}?

Calendly: [your-calendly-link]

Best,
[Your name]
```

## Email Sending Flow

### How It Works

```
Select Prospects → Compose → Send
        ↓
   Queue Added to Railway
        ↓
   BullMQ Processes Queue
        ↓
   SendGrid Sends Emails
        ↓
   Webhooks Update Status
        ↓
   Track Opens/Clicks
```

### Rate Limits

| Stage | Limit | Notes |
|-------|-------|-------|
| UI Selection | 50/session | Recommended for control |
| Queue Processing | 10/second | Railway rate limit |
| SendGrid Daily | 200 (warming) → 1000+ (warmed) | Domain-dependent |

### Error Handling

- **Suppressed emails**: Bounced/unsubscribed emails are automatically skipped
- **Rate limit hit**: Emails queue and retry automatically
- **Railway unavailable**: Falls back to local queue (Firestore)

## Compliance

### CAN-SPAM Requirements (Automatic)
- ✅ Unsubscribe link in every email
- ✅ Physical address in footer
- ✅ `List-Unsubscribe` header for one-click unsubscribe
- ✅ Suppression list honored (bounces, unsubscribes, spam reports)

### Best Practices
- Don't email prospects in active sequences
- Wait 48+ hours between follow-ups
- Respect timezone (emails send during business hours)
- Monitor bounce rate (stop if > 3%)

## Tracking

### Metrics Available
- **Open rate**: Tracking pixel fires on email open
- **Click rate**: Tracked links (use UTM parameters)
- **Reply rate**: Inbound email webhook detection
- **Meeting rate**: Calendly webhook integration

### Viewing Stats
- Dashboard shows aggregate metrics
- Individual prospect timeline shows email history
- Email Stats card shows queue health

## Troubleshooting

### "No prospects selected"
- Make sure checkboxes are checked
- Verify prospects have email addresses (filter by "Has Email")

### "Email suppressed"
- Prospect may have bounced, unsubscribed, or marked spam previously
- Check suppression list in Firebase Console

### "Railway unavailable"
- System falls back to local queue
- Check Railway status at railway.app
- Emails will send when Railway recovers

### Progress bar stuck
- Railway may be processing slowly
- Check browser console for errors
- Refresh and check prospect records for sent status

## Feature Flags

| Flag | Purpose |
|------|---------|
| `VITE_RAILWAY_EMAIL_ENABLED` | Route email through Railway (default: true) |
| `VITE_BULK_EMAIL_ENABLED` | Enable bulk email UI (default: true) |

## Related Docs

- [RAILWAY_INTEGRATION.md](./RAILWAY_INTEGRATION.md) - Railway backend integration
- [ENROLLMENT_STATE_MACHINE.md](./ENROLLMENT_STATE_MACHINE.md) - Sequence states
- [RUNBOOK.md](./RUNBOOK.md) - Operations and monitoring
