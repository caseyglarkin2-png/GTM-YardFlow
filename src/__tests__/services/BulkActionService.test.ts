import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BulkActionService,
  getBulkActionService,
  resetBulkActionService,
  type BulkActionType,
  type BulkAction,
  type BulkActionResult,
  type BulkActionProgress,
} from '../../services/BulkActionService';

describe('BulkActionService', () => {
  let service: BulkActionService;

  beforeEach(() => {
    resetBulkActionService();
    service = new BulkActionService();
  });

  describe('initialization', () => {
    it('should initialize with default actions', () => {
      const actions = service.getActions();
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should have tag action', () => {
      const action = service.getAction('tag');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Add Tags');
    });

    it('should have delete action with confirmation', () => {
      const action = service.getAction('delete');
      expect(action).toBeDefined();
      expect(action?.requiresConfirmation).toBe(true);
      expect(action?.isDestructive).toBe(true);
    });

    it('should have status action', () => {
      const action = service.getAction('status');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Change Status');
    });

    it('should have tier action', () => {
      const action = service.getAction('tier');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Change Tier');
    });

    it('should have assign action', () => {
      const action = service.getAction('assign');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Assign To');
    });

    it('should have export action', () => {
      const action = service.getAction('export');
      expect(action).toBeDefined();
    });

    it('should have sequence action', () => {
      const action = service.getAction('sequence');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Add to Sequence');
    });
  });

  describe('registerAction', () => {
    it('should register a new action', () => {
      const customAction: BulkAction = {
        type: 'custom',
        label: 'Custom Action',
        description: 'A custom bulk action',
      };

      service.registerAction(customAction);
      const action = service.getAction('custom');
      expect(action).toEqual(customAction);
    });

    it('should override existing action', () => {
      const updatedAction: BulkAction = {
        type: 'tag',
        label: 'New Tag Action',
        description: 'Updated tag action',
      };

      service.registerAction(updatedAction);
      const action = service.getAction('tag');
      expect(action?.label).toBe('New Tag Action');
    });
  });

  describe('registerHandler', () => {
    it('should register a handler', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'tag',
        processed: 2,
        failed: 0,
      });

      service.registerHandler('tag', handler);

      await service.execute({
        type: 'tag',
        prospectIds: ['1', '2'],
        value: ['hot'],
      });

      expect(handler).toHaveBeenCalledWith(['1', '2'], ['hot']);
    });
  });

  describe('getAvailableActions', () => {
    it('should return all actions for valid selection', () => {
      const actions = service.getAvailableActions(5);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should filter by minSelection', () => {
      service.registerAction({
        type: 'custom',
        label: 'Requires 3',
        minSelection: 3,
      });

      const actionsFor2 = service.getAvailableActions(2);
      const actionsFor3 = service.getAvailableActions(3);

      const hasCustomFor2 = actionsFor2.some(a => a.type === 'custom');
      const hasCustomFor3 = actionsFor3.some(a => a.type === 'custom');

      expect(hasCustomFor2).toBe(false);
      expect(hasCustomFor3).toBe(true);
    });

    it('should filter by maxSelection', () => {
      service.registerAction({
        type: 'custom',
        label: 'Max 10',
        maxSelection: 10,
      });

      const actionsFor5 = service.getAvailableActions(5);
      const actionsFor15 = service.getAvailableActions(15);

      const hasCustomFor5 = actionsFor5.some(a => a.type === 'custom');
      const hasCustomFor15 = actionsFor15.some(a => a.type === 'custom');

      expect(hasCustomFor5).toBe(true);
      expect(hasCustomFor15).toBe(false);
    });

    it('should filter disabled actions', () => {
      service.registerAction({
        type: 'custom',
        label: 'Disabled',
        enabled: false,
      });

      const actions = service.getAvailableActions(5);
      const hasCustom = actions.some(a => a.type === 'custom');
      expect(hasCustom).toBe(false);
    });

    it('should return empty for zero selection if minSelection is 1', () => {
      const actions = service.getAvailableActions(0);
      expect(actions).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute action with handler', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'tag',
        processed: 2,
        failed: 0,
      });

      service.registerHandler('tag', handler);

      const result = await service.execute({
        type: 'tag',
        prospectIds: ['1', '2'],
        value: ['hot'],
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('should fail if no prospects selected', async () => {
      const result = await service.execute({
        type: 'tag',
        prospectIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toContain('No prospects selected');
    });

    it('should fail if no handler registered', async () => {
      const result = await service.execute({
        type: 'custom',
        prospectIds: ['1'],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toContain('No handler registered');
    });

    it('should handle handler errors', async () => {
      service.registerHandler('tag', async () => {
        throw new Error('Handler failed');
      });

      const result = await service.execute({
        type: 'tag',
        prospectIds: ['1'],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toBe('Handler failed');
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'tag',
        processed: 2,
        failed: 0,
      });

      service.registerHandler('tag', handler);

      await service.execute(
        {
          type: 'tag',
          prospectIds: ['1', '2'],
        },
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith({
        total: 2,
        completed: 0,
        percentage: 0,
      });

      expect(onProgress).toHaveBeenCalledWith({
        total: 2,
        completed: 2,
        percentage: 100,
      });
    });

    it('should store result in history', async () => {
      service.registerHandler('tag', async () => ({
        success: true,
        type: 'tag',
        processed: 1,
        failed: 0,
      }));

      await service.execute({
        type: 'tag',
        prospectIds: ['1'],
      });

      const history = service.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('tag');
    });
  });

  describe('executeBatched', () => {
    it('should process in batches', async () => {
      const handler = vi.fn().mockImplementation(async (ids: string[]) => ({
        success: true,
        type: 'tag' as BulkActionType,
        processed: ids.length,
        failed: 0,
      }));

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 10 }, (_, i) => String(i));

      await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        3
      );

      // 10 items / 3 batch size = 4 batches
      expect(handler).toHaveBeenCalledTimes(4);
    });

    it('should accumulate results across batches', async () => {
      const handler = vi.fn().mockImplementation(async (ids: string[]) => ({
        success: true,
        type: 'tag' as BulkActionType,
        processed: ids.length,
        failed: 0,
      }));

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 10 }, (_, i) => String(i));

      const result = await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        3
      );

      expect(result.processed).toBe(10);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should report progress per batch', async () => {
      const onProgress = vi.fn();
      const handler = vi.fn().mockImplementation(async (ids: string[]) => ({
        success: true,
        type: 'tag' as BulkActionType,
        processed: ids.length,
        failed: 0,
      }));

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 9 }, (_, i) => String(i));

      await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        3,
        onProgress
      );

      // Should report progress after each batch
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures', async () => {
      let callCount = 0;
      const handler = vi.fn().mockImplementation(async (ids: string[]) => {
        callCount++;
        if (callCount === 2) {
          return {
            success: false,
            type: 'tag' as BulkActionType,
            processed: 0,
            failed: ids.length,
            errors: ids.map(id => ({ id, error: 'Failed' })),
          };
        }
        return {
          success: true,
          type: 'tag' as BulkActionType,
          processed: ids.length,
          failed: 0,
        };
      });

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 9 }, (_, i) => String(i));

      const result = await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        3
      );

      expect(result.processed).toBe(6);
      expect(result.failed).toBe(3);
      expect(result.success).toBe(false);
    });

    it('should handle batch exceptions', async () => {
      let callCount = 0;
      const handler = vi.fn().mockImplementation(async (ids: string[]) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Batch error');
        }
        return {
          success: true,
          type: 'tag' as BulkActionType,
          processed: ids.length,
          failed: 0,
        };
      });

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 9 }, (_, i) => String(i));

      const result = await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        3
      );

      expect(result.failed).toBe(3);
      expect(result.errors?.length).toBe(3);
    });

    it('should fail if no handler registered', async () => {
      const result = await service.executeBatched({
        type: 'custom',
        prospectIds: ['1'],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toContain('No handler registered');
    });
  });

  describe('history', () => {
    it('should track action history', async () => {
      service.registerHandler('tag', async () => ({
        success: true,
        type: 'tag',
        processed: 1,
        failed: 0,
      }));

      service.registerHandler('status', async () => ({
        success: true,
        type: 'status',
        processed: 2,
        failed: 0,
      }));

      await service.execute({ type: 'tag', prospectIds: ['1'] });
      await service.execute({ type: 'status', prospectIds: ['1', '2'] });

      const history = service.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('tag');
      expect(history[1].type).toBe('status');
    });

    it('should clear history', async () => {
      service.registerHandler('tag', async () => ({
        success: true,
        type: 'tag',
        processed: 1,
        failed: 0,
      }));

      await service.execute({ type: 'tag', prospectIds: ['1'] });

      service.clearHistory();
      expect(service.getHistory()).toHaveLength(0);
    });

    it('should return copy of history', () => {
      const history1 = service.getHistory();
      const history2 = service.getHistory();
      expect(history1).not.toBe(history2);
    });
  });

  describe('createDefaultHandlers', () => {
    it('should create tag handler', async () => {
      const updateProspect = vi.fn().mockResolvedValue(undefined);
      const deleteProspect = vi.fn().mockResolvedValue(undefined);

      const handlers = BulkActionService.createDefaultHandlers(
        updateProspect,
        deleteProspect
      );

      const tagHandler = handlers.get('tag');
      expect(tagHandler).toBeDefined();

      const result = await tagHandler!(['1', '2'], ['hot', 'priority']);

      expect(updateProspect).toHaveBeenCalledTimes(2);
      expect(result.processed).toBe(2);
    });

    it('should create status handler', async () => {
      const updateProspect = vi.fn().mockResolvedValue(undefined);
      const deleteProspect = vi.fn().mockResolvedValue(undefined);

      const handlers = BulkActionService.createDefaultHandlers(
        updateProspect,
        deleteProspect
      );

      const statusHandler = handlers.get('status');
      const result = await statusHandler!(['1'], 'contacted');

      expect(updateProspect).toHaveBeenCalledWith('1', { status: 'contacted' });
      expect(result.processed).toBe(1);
    });

    it('should create tier handler', async () => {
      const updateProspect = vi.fn().mockResolvedValue(undefined);
      const deleteProspect = vi.fn().mockResolvedValue(undefined);

      const handlers = BulkActionService.createDefaultHandlers(
        updateProspect,
        deleteProspect
      );

      const tierHandler = handlers.get('tier');
      const result = await tierHandler!(['1'], 'Tier 1');

      expect(updateProspect).toHaveBeenCalledWith('1', { tier: 'Tier 1' });
      expect(result.processed).toBe(1);
    });

    it('should create delete handler', async () => {
      const updateProspect = vi.fn().mockResolvedValue(undefined);
      const deleteProspect = vi.fn().mockResolvedValue(undefined);

      const handlers = BulkActionService.createDefaultHandlers(
        updateProspect,
        deleteProspect
      );

      const deleteHandler = handlers.get('delete');
      const result = await deleteHandler!(['1', '2', '3']);

      expect(deleteProspect).toHaveBeenCalledTimes(3);
      expect(result.processed).toBe(3);
    });

    it('should handle errors in default handlers', async () => {
      const updateProspect = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Update failed'));
      const deleteProspect = vi.fn().mockResolvedValue(undefined);

      const handlers = BulkActionService.createDefaultHandlers(
        updateProspect,
        deleteProspect
      );

      const tagHandler = handlers.get('tag');
      const result = await tagHandler!(['1', '2'], ['hot']);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors?.[0].error).toBe('Update failed');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetBulkActionService();
      const instance1 = getBulkActionService();
      const instance2 = getBulkActionService();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getBulkActionService();
      resetBulkActionService();
      const instance2 = getBulkActionService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('action properties', () => {
    it('should include icons for actions', () => {
      const actions = service.getActions();
      const actionsWithIcons = actions.filter(a => a.icon);
      expect(actionsWithIcons.length).toBeGreaterThan(0);
    });

    it('should have confirmation message for delete', () => {
      const deleteAction = service.getAction('delete');
      expect(deleteAction?.confirmationMessage).toBeDefined();
      expect(deleteAction?.confirmationMessage).toContain('delete');
    });

    it('should identify destructive actions', () => {
      const deleteAction = service.getAction('delete');
      const tagAction = service.getAction('tag');

      expect(deleteAction?.isDestructive).toBe(true);
      expect(tagAction?.isDestructive).toBeFalsy();
    });
  });

  describe('edge cases', () => {
    it('should handle single prospect', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'tag',
        processed: 1,
        failed: 0,
      });

      service.registerHandler('tag', handler);

      const result = await service.execute({
        type: 'tag',
        prospectIds: ['single'],
        value: ['test'],
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });

    it('should handle large selection', async () => {
      const handler = vi.fn().mockImplementation(async (ids: string[]) => ({
        success: true,
        type: 'tag' as BulkActionType,
        processed: ids.length,
        failed: 0,
      }));

      service.registerHandler('tag', handler);

      const ids = Array.from({ length: 1000 }, (_, i) => String(i));

      const result = await service.executeBatched(
        {
          type: 'tag',
          prospectIds: ids,
        },
        100
      );

      expect(result.processed).toBe(1000);
      expect(handler).toHaveBeenCalledTimes(10);
    });

    it('should pass through complex value objects', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'custom',
        processed: 1,
        failed: 0,
      });

      service.registerHandler('custom', handler);

      const complexValue = {
        nested: { deep: 'value' },
        array: [1, 2, 3],
      };

      await service.execute({
        type: 'custom',
        prospectIds: ['1'],
        value: complexValue,
      });

      expect(handler).toHaveBeenCalledWith(['1'], complexValue);
    });

    it('should handle undefined value', async () => {
      const handler = vi.fn().mockResolvedValue({
        success: true,
        type: 'tag',
        processed: 1,
        failed: 0,
      });

      service.registerHandler('tag', handler);

      await service.execute({
        type: 'tag',
        prospectIds: ['1'],
      });

      expect(handler).toHaveBeenCalledWith(['1'], undefined);
    });
  });
});
