import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import exportHandler from '../../../api/privacy/export';
import deleteHandler from '../../../api/privacy/delete';
import retentionHandler from '../../../api/cron/retention';

const { mockVerifyIdToken, mockRailwayPost } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockRailwayPost: vi.fn(),
}));

vi.mock('../../../lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
  getAdminDb: () => dbMock,
}));

vi.mock('../../../lib/railway-client', () => ({
  railwayServerClient: { post: mockRailwayPost },
}));

function createRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

let dbMock: any;

function buildExportDbMock() {
  const redactionRef = { set: vi.fn() };
  return {
    collection: vi.fn((name: string) => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => {
          if (name === 'prospects') {
            return {
              empty: false,
              docs: [{ id: 'p1', data: () => ({ userId: 'user-1', railwayUserId: 'ru-1', foo: 'bar' }), ref: redactionRef }],
            };
          }
          return { empty: true, docs: [] };
        }),
      })),
    })),
    batch: vi.fn(() => ({ delete: vi.fn(), commit: vi.fn() })),
  };
}

function buildRetentionDbMock() {
  const deleteFn = vi.fn();
  const commit = vi.fn();
  const batch = { delete: deleteFn, commit };
  return {
    batch: vi.fn(() => batch),
    collection: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            const query: any = {
              get: vi.fn(async () => ({
                empty: false,
                size: 2,
                docs: [
                  { ref: { id: 'a' } },
                  { ref: { id: 'b' } },
                ],
              })),
              startAfter: vi.fn(() => query),
            };
            return query;
          }),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  mockVerifyIdToken.mockResolvedValue({ uid: 'user-1' });
  mockRailwayPost.mockResolvedValue({});
  dbMock = buildExportDbMock();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('privacy export', () => {
  it('exports user data when present', async () => {
    const req: any = { method: 'GET', headers: { authorization: 'Bearer token' } };
    const res = createRes();

    await exportHandler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.prospects?.length).toBe(1);
  });
});

describe('privacy delete', () => {
  it('redacts user data and syncs railway', async () => {
    const req: any = { method: 'POST', headers: { authorization: 'Bearer token' } };
    const res = createRes();

    await deleteHandler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body?.redacted).toBeGreaterThan(0);
    expect(mockRailwayPost).toHaveBeenCalled();
  });
});

describe('retention cron', () => {
  it('purges old documents with cron auth', async () => {
    dbMock = buildRetentionDbMock();
    const req: any = { method: 'POST', headers: { authorization: 'Bearer secret' } };
    const res = createRes();
    process.env.CRON_SECRET = 'secret';

    await retentionHandler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body?.results?.email_logs).toBeGreaterThanOrEqual(0);
  });
});
