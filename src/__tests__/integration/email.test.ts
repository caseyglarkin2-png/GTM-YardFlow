import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailQueueService } from '../../services/EmailQueueService';
import { EmailComplianceService } from '../../services/EmailComplianceService';
import { EmailTrackingService } from '../../services/EmailTrackingService';
import { EmailWarmupService } from '../../services/EmailWarmupService';
import { SendGridClient } from '../../services/SendGridClient';
import type { EmailMessage } from '../../types/email';

// Simple in-memory Firestore mock for integration-like tests
class MockDoc {
  constructor(private readonly collection: MockCollection, public readonly id: string) {}

  async get() {
    const data = this.collection.store.get(this.id);
    return { exists: Boolean(data), data: () => data, ref: this } as const;
  }

  async set(data: unknown, options?: { merge?: boolean }) {
    if (options?.merge) {
      const existing = this.collection.store.get(this.id) || {};
      this.collection.store.set(this.id, { ...existing, ...data });
    } else {
      this.collection.store.set(this.id, data);
    }
  }

  async update(data: Record<string, unknown>) {
    const existing = this.collection.store.get(this.id) || {};
    this.collection.store.set(this.id, { ...existing, ...data });
  }

  async delete() {
    this.collection.store.delete(this.id);
  }

  collection(name: string) {
    return this.collection.firestore.collection(`${this.collection.name}/${this.id}/${name}`);
  }
}

class MockQuerySnapshot {
  constructor(public readonly docs: Array<{ id: string; data: () => any; ref: MockDoc }>) {}
  get empty() {
    return this.docs.length === 0;
  }
}

class MockQuery {
  constructor(private readonly collection: MockCollection, private readonly filters: Array<(doc: any) => boolean> = [], private readonly order?: { field: string; direction: 'asc' | 'desc' }, private readonly limiter?: number) {}

  where(field: string, op: '==' | 'in', value: any) {
    const filter = (doc: any) => {
      const parts = field.split('.');
      const val = parts.reduce((acc, key) => acc?.[key], doc);
      if (op === '==') return val === value;
      if (op === 'in') return Array.isArray(value) && value.includes(val);
      return false;
    };
    return new MockQuery(this.collection, [...this.filters, filter], this.order, this.limiter);
  }

  orderBy(field: string, direction: 'asc' | 'desc') {
    return new MockQuery(this.collection, this.filters, { field, direction }, this.limiter);
  }

  limit(n: number) {
    return new MockQuery(this.collection, this.filters, this.order, n);
  }

  async get() {
    let docs = Array.from(this.collection.store.entries()).map(([id, data]) => ({ id, data: () => data, ref: new MockDoc(this.collection, id) }));
    for (const f of this.filters) {
      docs = docs.filter(d => f(d.data()));
    }
    if (this.order) {
      docs.sort((a, b) => {
        const av = (a.data() as any)[this.order!.field];
        const bv = (b.data() as any)[this.order!.field];
        return this.order!.direction === 'asc' ? (av ?? 0) - (bv ?? 0) : (bv ?? 0) - (av ?? 0);
      });
    }
    if (typeof this.limiter === 'number') {
      docs = docs.slice(0, this.limiter);
    }
    return new MockQuerySnapshot(docs);
  }
}

class MockCollection {
  readonly store = new Map<string, any>();
  constructor(public readonly firestore: MockFirestore, public readonly name: string) {}

  doc(id?: string) {
    const docId = id || Math.random().toString(36).slice(2);
    return new MockDoc(this, docId);
  }

  async add(data: any) {
    const doc = this.doc();
    await doc.set(data);
    return doc;
  }

  where(field: string, op: '==' | 'in', value: any) {
    return new MockQuery(this, []).where(field, op, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc') {
    return new MockQuery(this, [], { field, direction });
  }

  limit(n: number) {
    return new MockQuery(this, [], undefined, n);
  }

  async get() {
    return new MockQuerySnapshot(Array.from(this.store.entries()).map(([id, data]) => ({ id, data: () => data, ref: new MockDoc(this, id) })));
  }
}

class MockBatch {
  private ops: Array<() => void> = [];
  constructor(private readonly firestore: MockFirestore) {}
  update(ref: MockDoc, data: Record<string, unknown>) {
    this.ops.push(() => ref.update(data));
  }
  commit() {
    this.ops.forEach(op => op());
  }
}

class MockTransaction {
  constructor(private readonly firestore: MockFirestore) {}
  async get(ref: MockDoc) {
    return ref.get();
  }
  set(ref: MockDoc, data: any, options?: { merge?: boolean }) {
    return ref.set(data, options);
  }
  update(ref: MockDoc, data: Record<string, unknown>) {
    return ref.update(data);
  }
  delete(ref: MockDoc) {
    return ref.delete();
  }
}

class MockFirestore {
  private collections = new Map<string, MockCollection>();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(this, name));
    }
    return this.collections.get(name)!;
  }

  runTransaction<T>(fn: (tx: MockTransaction) => Promise<T>) {
    const tx = new MockTransaction(this);
    return fn(tx);
  }

  batch() {
    return new MockBatch(this);
  }
}

class StubWarmup extends EmailWarmupService {
  constructor(private readonly allow = true) { super(new MockFirestore() as any); }
  async canSend(): Promise<{ allowed: boolean }> { return { allowed: this.allow }; }
  async recordSend(): Promise<void> { return; }
}

class StubSendGrid extends SendGridClient {
  public sent: EmailMessage[] = [];
  async sendEmail(message: EmailMessage) {
    this.sent.push(message);
    return { statusCode: 202 } as any;
  }
}

describe('Email infrastructure', () => {
  let db: MockFirestore;
  let sendGrid: StubSendGrid;
  let compliance: EmailComplianceService;
  let tracking: EmailTrackingService;
  let warmup: StubWarmup;
  let queue: EmailQueueService;

  beforeEach(() => {
    db = new MockFirestore();
    sendGrid = new StubSendGrid();
    compliance = new EmailComplianceService(db as any, undefined);
    tracking = new EmailTrackingService(db as any, 'https://example.com', 'secret');
    warmup = new StubWarmup(true);
    queue = new EmailQueueService(db as any, sendGrid, compliance, warmup, tracking, 'test-worker');
  });

  it('enqueues and enforces idempotency', async () => {
    const message: EmailMessage = { id: 'msg1', to: 'a@example.com', from: 'noreply@test.com', subject: 'Hi', html: '<p>hello</p>' };
    const first = await queue.enqueue(message, { idempotencyKey: 'k1' });
    const second = await queue.enqueue(message, { idempotencyKey: 'k1' });
    expect(first.id).toBe(second.id);
    const snap = await db.collection('email_queue').doc(first.id).get();
    expect(snap.exists).toBe(true);
  });

  it('processes queue and marks sent', async () => {
    const message: EmailMessage = { id: 'msg2', to: 'b@example.com', from: 'noreply@test.com', subject: 'Hi', html: '<p>hello</p>', scheduledAt: Date.now() - 1000 };
    await queue.enqueue(message);
    const processed = await queue.processNext();
    expect(processed?.status).toBe('sent');
    expect(sendGrid.sent.length).toBe(1);
  });

  it('classifies hard bounce', () => {
    const result = compliance.classifyBounce({ event: 'bounce', email: 'x', timestamp: Date.now(), reason: 'User unknown', type: 'bounce' });
    expect(result).toBe('hard');
  });

  it('validates unsubscribe tokens', () => {
    const token = compliance.generateUnsubscribeToken('email-123');
    const validated = compliance.validateUnsubscribeToken(token);
    expect(validated.valid).toBe(true);
    expect(validated.emailId).toBe('email-123');
  });

  it('rewrites links and records opens', async () => {
    const message: EmailMessage = { id: 'msg3', to: 'c@example.com', from: 'noreply@test.com', subject: 'Hi', html: '<a href="https://example.com">click</a>' };
    const tracked = tracking.injectTracking(message);
    expect(tracked.html).toContain('/api/track/click');
    const openToken = tracked.html.match(/track\/open\?token=([^"&]+)/)?.[1];
    expect(openToken).toBeTruthy();
    if (openToken) {
      await tracking.recordOpen(openToken, '127.0.0.1', 'agent');
    }
    const eventSnap = await db.collection('email_events').get();
    expect(eventSnap.docs.length).toBeGreaterThan(0);
  });

  it('pauses when warmup disallows sending', async () => {
    warmup = new StubWarmup(false);
    queue = new EmailQueueService(db as any, sendGrid, compliance, warmup, tracking, 'test-worker');
    const message: EmailMessage = { id: 'msg4', to: 'd@example.com', from: 'noreply@test.com', subject: 'Hi', html: '<p>hello</p>', scheduledAt: Date.now() - 1000 };
    await queue.enqueue(message);
    const processed = await queue.processNext();
    expect(processed?.status).toBe('scheduled');
  });
});
