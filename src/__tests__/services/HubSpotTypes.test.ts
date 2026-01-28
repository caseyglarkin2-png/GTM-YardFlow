/**
 * HubSpot Types Tests
 * Sprint 26 - T26.1
 */

import { describe, it, expect } from 'vitest';
import {
  HubSpotContactSchema,
  HubSpotDealSchema,
  HubSpotEngagementSchema,
  HubSpotOwnerSchema,
  HubSpotContactsResponseSchema,
  HubSpotTokensSchema,
  HubSpotApiError,
  RateLimitError,
  AuthenticationError,
  HubSpotErrorSchema,
} from '../../types/hubspot';

describe('HubSpot Types - T26.1', () => {
  describe('HubSpotContactSchema', () => {
    it('should validate a complete contact response', () => {
      const validContact = {
        id: '123456',
        properties: {
          email: 'john@example.com',
          firstname: 'John',
          lastname: 'Doe',
          company: 'Acme Corp',
          jobtitle: 'VP Operations',
          phone: '+1-555-123-4567',
          hs_linkedinid: 'johndoe',
          hs_lead_status: 'OPEN',
          createdate: '2026-01-15T10:00:00.000Z',
          lastmodifieddate: '2026-01-20T15:30:00.000Z',
        },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-20T15:30:00.000Z',
        archived: false,
      };

      const result = HubSpotContactSchema.safeParse(validContact);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('123456');
        expect(result.data.properties.email).toBe('john@example.com');
        expect(result.data.properties.firstname).toBe('John');
      }
    });

    it('should validate contact with minimal properties', () => {
      const minimalContact = {
        id: '789',
        properties: {},
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const result = HubSpotContactSchema.safeParse(minimalContact);
      expect(result.success).toBe(true);
    });

    it('should validate contact with YardFlow custom properties', () => {
      const contactWithCustomProps = {
        id: '456',
        properties: {
          email: 'jane@example.com',
          firstname: 'Jane',
          yardflow_id: 'yf-123',
          yardflow_tier: 'tier_1',
          yardflow_persona: 'ops_director',
          yardflow_last_sync: '2026-01-20T15:30:00.000Z',
        },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-20T15:30:00.000Z',
      };

      const result = HubSpotContactSchema.safeParse(contactWithCustomProps);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.properties.yardflow_id).toBe('yf-123');
        expect(result.data.properties.yardflow_tier).toBe('tier_1');
      }
    });

    it('should handle null property values', () => {
      const contactWithNulls = {
        id: '101',
        properties: {
          email: null,
          firstname: 'Test',
          lastname: null,
          phone: null,
        },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const result = HubSpotContactSchema.safeParse(contactWithNulls);
      expect(result.success).toBe(true);
    });

    it('should reject contact without id', () => {
      const invalidContact = {
        properties: { email: 'test@example.com' },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const result = HubSpotContactSchema.safeParse(invalidContact);
      expect(result.success).toBe(false);
    });

    it('should reject contact with invalid email format', () => {
      const invalidContact = {
        id: '123',
        properties: { email: 'not-an-email' },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const result = HubSpotContactSchema.safeParse(invalidContact);
      expect(result.success).toBe(false);
    });
  });

  describe('HubSpotDealSchema', () => {
    it('should validate a complete deal', () => {
      const validDeal = {
        id: 'deal-123',
        properties: {
          dealname: 'Acme Corp - YardFlow Implementation',
          amount: '50000',
          dealstage: 'presentationscheduled',
          closedate: '2026-03-15',
          pipeline: 'default',
          yardflow_prospect_id: 'prospect-456',
          yardflow_roi_estimate: '125000',
        },
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-25T14:00:00.000Z',
      };

      const result = HubSpotDealSchema.safeParse(validDeal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.properties.dealname).toBe('Acme Corp - YardFlow Implementation');
        expect(result.data.properties.amount).toBe('50000');
      }
    });

    it('should validate deal with minimal properties', () => {
      const minimalDeal = {
        id: 'deal-789',
        properties: {
          dealname: 'Quick Deal',
          dealstage: 'appointmentscheduled',
        },
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
      };

      const result = HubSpotDealSchema.safeParse(minimalDeal);
      expect(result.success).toBe(true);
    });

    it('should reject deal without dealname', () => {
      const invalidDeal = {
        id: 'deal-invalid',
        properties: {
          dealstage: 'appointmentscheduled',
        },
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
      };

      const result = HubSpotDealSchema.safeParse(invalidDeal);
      expect(result.success).toBe(false);
    });
  });

  describe('HubSpotEngagementSchema', () => {
    it('should validate a note engagement', () => {
      const noteEngagement = {
        id: 'eng-123',
        type: 'NOTE',
        properties: {
          hs_timestamp: '2026-01-20T10:00:00.000Z',
          hs_note_body: 'Met with John at Manifest 2026. Very interested in YardFlow.',
        },
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
      };

      const result = HubSpotEngagementSchema.safeParse(noteEngagement);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('NOTE');
      }
    });

    it('should validate an email engagement', () => {
      const emailEngagement = {
        id: 'eng-456',
        type: 'EMAIL',
        properties: {
          hs_timestamp: '2026-01-21T09:00:00.000Z',
          hs_email_subject: 'Follow-up from Manifest',
          hs_email_text: 'Great meeting you yesterday...',
        },
        createdAt: '2026-01-21T09:00:00.000Z',
        updatedAt: '2026-01-21T09:00:00.000Z',
      };

      const result = HubSpotEngagementSchema.safeParse(emailEngagement);
      expect(result.success).toBe(true);
    });

    it('should validate all engagement types', () => {
      const types = ['NOTE', 'EMAIL', 'TASK', 'MEETING', 'CALL'];
      
      for (const type of types) {
        const engagement = {
          id: `eng-${type}`,
          type,
          properties: {
            hs_timestamp: '2026-01-20T10:00:00.000Z',
          },
          createdAt: '2026-01-20T10:00:00.000Z',
          updatedAt: '2026-01-20T10:00:00.000Z',
        };

        const result = HubSpotEngagementSchema.safeParse(engagement);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid engagement type', () => {
      const invalidEngagement = {
        id: 'eng-invalid',
        type: 'INVALID_TYPE',
        properties: {
          hs_timestamp: '2026-01-20T10:00:00.000Z',
        },
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
      };

      const result = HubSpotEngagementSchema.safeParse(invalidEngagement);
      expect(result.success).toBe(false);
    });
  });

  describe('HubSpotOwnerSchema', () => {
    it('should validate an owner', () => {
      const owner = {
        id: 'owner-123',
        email: 'sales@company.com',
        firstName: 'Sales',
        lastName: 'Rep',
        userId: 12345,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
        archived: false,
      };

      const result = HubSpotOwnerSchema.safeParse(owner);
      expect(result.success).toBe(true);
    });
  });

  describe('HubSpotContactsResponseSchema', () => {
    it('should validate paginated contacts response', () => {
      const response = {
        results: [
          {
            id: '1',
            properties: { email: 'a@example.com', firstname: 'A' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: '2',
            properties: { email: 'b@example.com', firstname: 'B' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        paging: {
          next: {
            after: 'cursor-abc123',
            link: 'https://api.hubapi.com/crm/v3/objects/contacts?after=cursor-abc123',
          },
        },
      };

      const result = HubSpotContactsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(2);
        expect(result.data.paging?.next?.after).toBe('cursor-abc123');
      }
    });

    it('should validate response without paging', () => {
      const response = {
        results: [
          {
            id: '1',
            properties: {},
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      const result = HubSpotContactsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('HubSpotTokensSchema', () => {
    it('should validate tokens', () => {
      const tokens = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh_token_abc123',
        expiresIn: 1800,
        expiresAt: 1737991200000,
        tokenType: 'bearer',
      };

      const result = HubSpotTokensSchema.safeParse(tokens);
      expect(result.success).toBe(true);
    });

    it('should reject tokens with wrong tokenType', () => {
      const invalidTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 1800,
        expiresAt: 1737991200000,
        tokenType: 'basic',
      };

      const result = HubSpotTokensSchema.safeParse(invalidTokens);
      expect(result.success).toBe(false);
    });
  });

  describe('HubSpotErrorSchema', () => {
    it('should validate API error response', () => {
      const error = {
        status: 'error',
        message: 'Contact already exists',
        correlationId: 'abc-123-def',
        category: 'CONFLICT',
        errors: [
          {
            message: 'A contact with this email already exists',
            context: { email: 'duplicate@example.com' },
          },
        ],
      };

      const result = HubSpotErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Classes', () => {
    describe('HubSpotApiError', () => {
      it('should create error with all properties', () => {
        const error = new HubSpotApiError(
          'Something went wrong',
          500,
          'correlation-123',
          'INTERNAL_ERROR'
        );

        expect(error.message).toBe('Something went wrong');
        expect(error.statusCode).toBe(500);
        expect(error.correlationId).toBe('correlation-123');
        expect(error.category).toBe('INTERNAL_ERROR');
        expect(error.name).toBe('HubSpotApiError');
      });

      it('should create from API response', () => {
        const apiError = {
          status: 'error' as const,
          message: 'Resource not found',
          correlationId: 'corr-456',
          category: 'NOT_FOUND',
        };

        const error = HubSpotApiError.fromResponse(404, apiError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Resource not found');
      });
    });

    describe('RateLimitError', () => {
      it('should create with retry after', () => {
        const error = new RateLimitError(30, 'rate-limit-123');

        expect(error.message).toContain('30 seconds');
        expect(error.retryAfter).toBe(30);
        expect(error.statusCode).toBe(429);
        expect(error.name).toBe('RateLimitError');
      });
    });

    describe('AuthenticationError', () => {
      it('should create authentication error', () => {
        const error = new AuthenticationError('Invalid token', 'auth-123');

        expect(error.message).toBe('Invalid token');
        expect(error.statusCode).toBe(401);
        expect(error.category).toBe('AUTHENTICATION');
        expect(error.name).toBe('AuthenticationError');
      });
    });
  });

  describe('Sample API Response Validation', () => {
    it('should validate real HubSpot API contact response structure', () => {
      // This simulates what we'd get from the actual HubSpot API
      const realApiResponse = {
        results: [
          {
            id: '51',
            properties: {
              createdate: '2019-10-30T03:30:17.883Z',
              email: 'bh@hubspot.com',
              firstname: 'Brian',
              hs_object_id: '51',
              lastmodifieddate: '2019-12-07T16:50:06.678Z',
              lastname: 'Halligan',
            },
            createdAt: '2019-10-30T03:30:17.883Z',
            updatedAt: '2019-12-07T16:50:06.678Z',
            archived: false,
          },
        ],
        paging: {
          next: {
            after: '5678',
            link: 'https://api.hubapi.com/crm/v3/objects/contacts?after=5678',
          },
        },
      };

      const result = HubSpotContactsResponseSchema.safeParse(realApiResponse);
      expect(result.success).toBe(true);
    });
  });
});
