/**
 * Firebase Admin Mock for API Tests
 * 
 * Provides mock Firestore implementation for testing webhook handlers.
 * Sprint 900: Webhook Integration Tests
 */

import { vi, type Mock } from 'vitest';

export interface MockDocument {
  id: string;
  data: Record<string, unknown>;
  exists: boolean;
}

interface MockFirestoreState {
  collections: Map<string, Map<string, MockDocument>>;
}

const state: MockFirestoreState = {
  collections: new Map(),
};

// Create a chainable mock for Firestore operations
const createDocRef = (collectionName: string, docId: string) => {
  const getDoc = (): MockDocument | undefined => {
    const collection = state.collections.get(collectionName);
    return collection?.get(docId);
  };

  return {
    id: docId,
    get: vi.fn(async () => {
      const doc = getDoc();
      return {
        exists: doc?.exists ?? false,
        id: docId,
        data: () => doc?.data,
      };
    }),
    set: vi.fn(async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      if (!state.collections.has(collectionName)) {
        state.collections.set(collectionName, new Map());
      }
      const collection = state.collections.get(collectionName)!;
      const existing = collection.get(docId);
      
      if (options?.merge && existing) {
        collection.set(docId, {
          id: docId,
          data: { ...existing.data, ...data },
          exists: true,
        });
      } else {
        collection.set(docId, { id: docId, data, exists: true });
      }
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      if (!state.collections.has(collectionName)) {
        throw new Error(`Document ${docId} does not exist`);
      }
      const collection = state.collections.get(collectionName)!;
      const existing = collection.get(docId);
      if (!existing) {
        throw new Error(`Document ${docId} does not exist`);
      }
      collection.set(docId, {
        id: docId,
        data: { ...existing.data, ...data },
        exists: true,
      });
    }),
    delete: vi.fn(async () => {
      const collection = state.collections.get(collectionName);
      if (collection) {
        collection.delete(docId);
      }
    }),
  };
};

const createCollectionRef = (collectionName: string) => ({
  doc: vi.fn((docId: string) => createDocRef(collectionName, docId)),
  where: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(async () => {
      const collection = state.collections.get(collectionName);
      const docs = collection ? Array.from(collection.values()).filter(d => d.exists) : [];
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map(d => ({
          id: d.id,
          exists: true,
          data: () => d.data,
          ref: createDocRef(collectionName, d.id),
        })),
        forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          docs.forEach(d => cb({ id: d.id, data: () => d.data }));
        },
      };
    }),
  })),
  get: vi.fn(async () => {
    const collection = state.collections.get(collectionName);
    const docs = collection ? Array.from(collection.values()).filter(d => d.exists) : [];
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map(d => ({
        id: d.id,
        exists: true,
        data: () => d.data,
        ref: createDocRef(collectionName, d.id),
      })),
    };
  }),
});

export const mockAdminDb = {
  collection: vi.fn((name: string) => createCollectionRef(name)),
};

/**
 * Seed a document into mock Firestore
 */
export function seedDocument(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): void {
  if (!state.collections.has(collectionName)) {
    state.collections.set(collectionName, new Map());
  }
  state.collections.get(collectionName)!.set(docId, {
    id: docId,
    data,
    exists: true,
  });
}

/**
 * Get a document from mock Firestore
 */
export function getDocument(
  collectionName: string,
  docId: string
): Record<string, unknown> | undefined {
  return state.collections.get(collectionName)?.get(docId)?.data;
}

/**
 * Get all documents in a collection
 */
export function getCollection(collectionName: string): MockDocument[] {
  const collection = state.collections.get(collectionName);
  return collection ? Array.from(collection.values()) : [];
}

/**
 * Clear all mock Firestore data
 */
export function clearFirestoreData(): void {
  state.collections.clear();
}

/**
 * Reset all mocks and clear data
 */
export function resetFirestoreMocks(): void {
  clearFirestoreData();
  mockAdminDb.collection.mockClear();
}
