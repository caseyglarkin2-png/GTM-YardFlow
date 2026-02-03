import { randomUUID } from 'crypto';
import type { VercelRequest } from '@vercel/node';

export function getRequestId(req: VercelRequest): string {
  return (req.headers['x-request-id'] as string) || randomUUID();
}
