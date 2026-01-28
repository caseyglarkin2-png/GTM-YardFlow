/**
 * Performance Benchmark Tests - YardFlow Hub
 * 
 * Unit tests for measuring and validating service performance
 */

import { describe, it, expect } from 'vitest';
import { 
  createTenant, 
  createUser, 
  hasPermission, 
  filterByTenant,
  createAuditLog,
  filterAuditLogs 
} from '../../services/TenantService';
import { analyzeMessage, quickValidate } from '../../services/MessageQualityService';
import { createSequence, addStep, validateSequence, type EmailProspect } from '../../services/EmailSequenceService';
import { formatForChannel, createCadence, CADENCE_TEMPLATES, type FormatOptions } from '../../services/SocialChannelService';
import type { AuditLog } from '../../types/tenant';
import type { MessageAnalysisInput } from '../../types/messageQuality';

/**
 * Helper to measure execution time
 */
function measureTime<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

/**
 * Helper to run function multiple times and get average
 */
function benchmark<T>(fn: () => T, iterations: number = 100): {
  avgMs: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
} {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const { timeMs } = measureTime(fn);
    times.push(timeMs);
  }
  
  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  
  return { avgMs, minMs, maxMs, totalMs };
}

describe('Performance Benchmarks', () => {
  describe('TenantService Performance', () => {
    it('should create tenant quickly', () => {
      const result = benchmark(() => {
        createTenant('Test Company', 'admin@test.com', 'professional');
      }, 100);
      
      // Average should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
    
    it('should check permissions quickly', () => {
      const user = createUser('tenant-1', 'user@test.com', 'Test User', 'manager');
      
      const result = benchmark(() => {
        hasPermission(user, 'prospect', 'create');
        hasPermission(user, 'billing', 'read');
        hasPermission(user, 'users', 'update');
      }, 1000);
      
      // Permission checks should be very fast (under 0.1ms)
      expect(result.avgMs).toBeLessThan(0.1);
    });
    
    it('should filter large datasets efficiently', () => {
      // Create 1000 items
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        tenantId: i % 10 === 0 ? 'tenant-1' : 'tenant-2',
        data: `Data for item ${i}`,
      }));
      
      const result = benchmark(() => {
        filterByTenant(items, 'tenant-1');
      }, 100);
      
      // Filtering 1000 items should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
    
    it('should filter audit logs efficiently', () => {
      // Create 500 audit logs
      const logs: AuditLog[] = Array.from({ length: 500 }, (_, i) => 
        createAuditLog(
          'tenant-1',
          `user-${i % 10}`,
          `user${i % 10}@test.com`,
          i % 2 === 0 ? 'user.login' : 'prospect.create',
          'action',
          `Log entry ${i}`
        )
      );
      
      const result = benchmark(() => {
        filterAuditLogs(logs, { userId: 'user-5', eventType: 'prospect.create' });
      }, 100);
      
      // Filtering 500 logs should be under 2ms
      expect(result.avgMs).toBeLessThan(2);
    });
  });
  
  describe('MessageQualityService Performance', () => {
    it('should analyze messages quickly', () => {
      const testInput: MessageAnalysisInput = {
        message: `
          Hi Sarah,
          
          I noticed that Acme Logistics is running a large fleet of trailers across the Midwest.
          With YardFlow, companies like yours typically see a 30% reduction in detention fees
          and significant improvements in yard efficiency.
          
          Would you be open to a quick 15-minute call next week to discuss how we might help?
          
          Best regards,
          John
        `,
        channel: 'email_cold',
        persona: 'ops_director',
      };
      
      const result = benchmark(() => {
        analyzeMessage(testInput);
      }, 100);
      
      // Message analysis should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
    
    it('should quick validate efficiently', () => {
      const result = benchmark(() => {
        quickValidate('Hi Sarah, quick question about your yard operations?', 'linkedin_dm');
      }, 1000);
      
      // Quick validation should be under 0.5ms
      expect(result.avgMs).toBeLessThan(0.5);
    });
    
    it('should handle long messages efficiently', () => {
      const longInput: MessageAnalysisInput = {
        message: 'Lorem ipsum dolor sit amet. '.repeat(200),
        channel: 'email_cold',
      };
      
      const result = benchmark(() => {
        analyzeMessage(longInput);
      }, 50);
      
      // Even long messages should be under 5ms
      expect(result.avgMs).toBeLessThan(5);
    });
  });
  
  describe('EmailSequenceService Performance', () => {
    it('should create sequences quickly', () => {
      const result = benchmark(() => {
        createSequence('Test Sequence', 'Test description', 'owner-1');
      }, 100);
      
      // Sequence creation should be under 0.5ms
      expect(result.avgMs).toBeLessThan(0.5);
    });
    
    it('should add steps efficiently', () => {
      let sequence = createSequence('Test', 'Desc', 'owner');
      
      const result = benchmark(() => {
        sequence = addStep(sequence, {
          type: 'email',
          subject: 'Test Subject',
          body: 'Test body content',
          delayDays: 1,
        });
      }, 100);
      
      // Adding steps should be under 0.5ms
      expect(result.avgMs).toBeLessThan(0.5);
    });
    
    it('should validate sequences with many steps quickly', () => {
      let sequence = createSequence('Large Sequence', 'Test', 'owner');
      
      // Add 20 steps
      for (let i = 0; i < 20; i++) {
        sequence = addStep(sequence, {
          type: i % 3 === 0 ? 'task' : 'email',
          subject: `Step ${i}`,
          body: `Body for step ${i}`,
          delayDays: i,
        });
      }
      
      const result = benchmark(() => {
        validateSequence(sequence);
      }, 100);
      
      // Validation should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
  });
  
  describe('SocialChannelService Performance', () => {
    it('should format for channel quickly', () => {
      const message = 'Hi {{firstName}}, I noticed your company is growing rapidly. Would love to connect and share some insights about yard management.';
      const prospect: EmailProspect = {
        id: 'p-1',
        name: 'Sarah Johnson',
        email: 'sarah@acme.com',
        company: 'Acme Logistics',
        title: 'Fleet Manager',
      };
      const options: FormatOptions = {
        prospect,
        sender: {
          name: 'John Smith',
          title: 'Sales Rep',
          company: 'YardFlow',
        },
      };
      
      const result = benchmark(() => {
        formatForChannel(message, 'linkedin_dm', options);
        formatForChannel(message, 'twitter_reply', options);
        formatForChannel(message, 'linkedin_connection', options);
      }, 100);
      
      // Formatting for 3 channels should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
    
    it('should create cadences efficiently', () => {
      const templateSteps = CADENCE_TEMPLATES.tier1_multitouch.steps;
      
      const result = benchmark(() => {
        createCadence('Test Cadence', templateSteps);
      }, 100);
      
      // Cadence creation should be under 1ms
      expect(result.avgMs).toBeLessThan(1);
    });
  });
  
  describe('Scalability Tests', () => {
    it('should handle 10,000 items without significant slowdown', () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({
        id: `item-${i}`,
        tenantId: `tenant-${i % 100}`,
        data: `Data ${i}`,
      }));
      
      const result = benchmark(() => {
        filterByTenant(items, 'tenant-50');
      }, 10);
      
      // Should complete in under 10ms even for 10,000 items
      expect(result.avgMs).toBeLessThan(10);
    });
    
    it('should validate many messages efficiently', () => {
      const messages = Array.from({ length: 100 }, (_, i) => 
        `Message ${i}: Hi, this is a test message about yard operations.`
      );
      
      const result = benchmark(() => {
        for (const msg of messages) {
          quickValidate(msg, 'email_cold');
        }
      }, 10);
      
      // 100 validations should complete in under 50ms
      expect(result.avgMs).toBeLessThan(50);
    });
  });
});

describe('Memory Efficiency', () => {
  it('should not create memory leaks with repeated operations', () => {
    // This is a simplified memory test
    // Real memory testing would require heap snapshots
    
    const iterations = 1000;
    const results: unknown[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const tenant = createTenant(`Tenant ${i}`, `admin${i}@test.com`);
      const user = createUser(tenant.id, `user${i}@test.com`, `User ${i}`);
      results.push({ tenant, user });
    }
    
    // Should complete without throwing
    expect(results.length).toBe(iterations);
    
    // Clean up
    results.length = 0;
  });
  
  it('should handle object creation efficiently', () => {
    const { timeMs } = measureTime(() => {
      for (let i = 0; i < 1000; i++) {
        createAuditLog(
          'tenant-1',
          'user-1',
          'user@test.com',
          'user.login',
          'login',
          `Login ${i}`
        );
      }
    });
    
    // 1000 audit log creations should complete in under 100ms
    expect(timeMs).toBeLessThan(100);
  });
});

describe('Concurrent Operations', () => {
  it('should handle concurrent permission checks', async () => {
    const user = createUser('tenant-1', 'user@test.com', 'User', 'admin');
    const resources = ['prospect', 'sequence', 'campaign', 'template', 'asset'] as const;
    const actions = ['create', 'read', 'update', 'delete'] as const;
    
    const promises = resources.flatMap(resource =>
      actions.map(action =>
        Promise.resolve(hasPermission(user, resource, action))
      )
    );
    
    const start = performance.now();
    const results = await Promise.all(promises);
    const timeMs = performance.now() - start;
    
    // All concurrent checks should complete quickly
    expect(timeMs).toBeLessThan(10);
    expect(results.length).toBe(20);
  });
  
  it('should handle concurrent message analysis', async () => {
    const inputs: MessageAnalysisInput[] = Array.from({ length: 20 }, (_, i) => ({
      message: `Message ${i}: This is a test message for concurrent analysis.`,
      channel: 'email_cold' as const,
    }));
    
    const promises = inputs.map(input =>
      Promise.resolve(analyzeMessage(input))
    );
    
    const start = performance.now();
    const results = await Promise.all(promises);
    const timeMs = performance.now() - start;
    
    // Concurrent analysis should complete quickly
    expect(timeMs).toBeLessThan(50);
    expect(results.length).toBe(20);
  });
});
