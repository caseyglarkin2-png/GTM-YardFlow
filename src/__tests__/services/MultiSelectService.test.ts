/**
 * MultiSelectService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MultiSelectService,
  getMultiSelectService,
  resetMultiSelectService,
} from '../../services/MultiSelectService';

describe('MultiSelectService', () => {
  let service: MultiSelectService<string>;
  const testItems = ['a', 'b', 'c', 'd', 'e'];

  beforeEach(() => {
    service = new MultiSelectService();
    service.setItems(testItems);
  });

  describe('initialization', () => {
    it('starts with empty selection', () => {
      expect(service.getSelectedCount()).toBe(0);
      expect(service.getSelectedIds()).toEqual([]);
    });

    it('accepts initial selection', () => {
      const serviceWithInitial = new MultiSelectService({
        initialSelection: ['a', 'b'],
      });
      serviceWithInitial.setItems(testItems);
      
      expect(serviceWithInitial.getSelectedCount()).toBe(2);
      expect(serviceWithInitial.isSelected('a')).toBe(true);
      expect(serviceWithInitial.isSelected('b')).toBe(true);
    });

    it('sets items correctly', () => {
      expect(service.getState().totalCount).toBe(5);
    });
  });

  describe('select', () => {
    it('selects a single item', () => {
      service.select('a');
      
      expect(service.isSelected('a')).toBe(true);
      expect(service.getSelectedCount()).toBe(1);
    });

    it('replaces selection by default', () => {
      service.select('a');
      service.select('b');
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('b')).toBe(true);
      expect(service.getSelectedCount()).toBe(1);
    });

    it('extends selection with extend option', () => {
      service.select('a');
      service.select('b', { extend: true });
      
      expect(service.isSelected('a')).toBe(true);
      expect(service.isSelected('b')).toBe(true);
      expect(service.getSelectedCount()).toBe(2);
    });
  });

  describe('deselect', () => {
    it('deselects an item', () => {
      service.select('a');
      service.deselect('a');
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.getSelectedCount()).toBe(0);
    });

    it('does nothing if item not selected', () => {
      service.deselect('a');
      
      expect(service.getSelectedCount()).toBe(0);
    });

    it('respects allowEmpty=false', () => {
      const strictService = new MultiSelectService({ allowEmpty: false });
      strictService.setItems(testItems);
      strictService.select('a');
      strictService.deselect('a');
      
      // Should still have 'a' selected
      expect(strictService.isSelected('a')).toBe(true);
    });
  });

  describe('toggle', () => {
    it('toggles selection on', () => {
      service.toggle('a');
      
      expect(service.isSelected('a')).toBe(true);
    });

    it('toggles selection off', () => {
      service.select('a');
      service.toggle('a');
      
      expect(service.isSelected('a')).toBe(false);
    });

    it('extends selection with extend option', () => {
      service.select('a');
      service.toggle('b', { extend: true });
      
      expect(service.isSelected('a')).toBe(true);
      expect(service.isSelected('b')).toBe(true);
    });

    it('replaces selection without extend', () => {
      service.select('a');
      service.toggle('b');
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('b')).toBe(true);
    });
  });

  describe('selectRange', () => {
    it('selects range of items', () => {
      service.selectRange('b', 'd');
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('b')).toBe(true);
      expect(service.isSelected('c')).toBe(true);
      expect(service.isSelected('d')).toBe(true);
      expect(service.isSelected('e')).toBe(false);
    });

    it('works in reverse order', () => {
      service.selectRange('d', 'b');
      
      expect(service.isSelected('b')).toBe(true);
      expect(service.isSelected('c')).toBe(true);
      expect(service.isSelected('d')).toBe(true);
    });

    it('clears previous selection', () => {
      service.select('a');
      service.selectRange('c', 'd');
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('c')).toBe(true);
      expect(service.isSelected('d')).toBe(true);
    });
  });

  describe('extendRange', () => {
    it('extends from anchor', () => {
      service.select('b'); // Sets anchor to 'b'
      service.extendRange('d');
      
      expect(service.getSelectedIds()).toContain('b');
      expect(service.getSelectedIds()).toContain('c');
      expect(service.getSelectedIds()).toContain('d');
    });

    it('selects single if no anchor', () => {
      service.extendRange('c');
      
      expect(service.isSelected('c')).toBe(true);
      expect(service.getSelectedCount()).toBe(1);
    });
  });

  describe('selectAll', () => {
    it('selects all items', () => {
      service.selectAll();
      
      expect(service.getSelectedCount()).toBe(5);
      expect(service.getState().isAllSelected).toBe(true);
    });

    it('respects maxSelection', () => {
      const limitedService = new MultiSelectService({ maxSelection: 3 });
      limitedService.setItems(testItems);
      limitedService.selectAll();
      
      expect(limitedService.getSelectedCount()).toBe(3);
    });
  });

  describe('deselectAll', () => {
    it('deselects all items', () => {
      service.selectAll();
      service.deselectAll();
      
      expect(service.getSelectedCount()).toBe(0);
      expect(service.getState().isAllSelected).toBe(false);
    });

    it('respects allowEmpty=false', () => {
      const strictService = new MultiSelectService({ allowEmpty: false });
      strictService.setItems(testItems);
      strictService.selectAll();
      strictService.deselectAll();
      
      // Should still have all selected
      expect(strictService.getSelectedCount()).toBe(5);
    });
  });

  describe('toggleAll', () => {
    it('selects all when none selected', () => {
      service.toggleAll();
      
      expect(service.getState().isAllSelected).toBe(true);
    });

    it('deselects all when all selected', () => {
      service.selectAll();
      service.toggleAll();
      
      expect(service.getSelectedCount()).toBe(0);
    });

    it('selects all when some selected', () => {
      service.select('a');
      service.select('b', { extend: true });
      service.toggleAll();
      
      expect(service.getState().isAllSelected).toBe(true);
    });
  });

  describe('invertSelection', () => {
    it('inverts selection', () => {
      service.select('a');
      service.select('b', { extend: true });
      service.invertSelection();
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('b')).toBe(false);
      expect(service.isSelected('c')).toBe(true);
      expect(service.isSelected('d')).toBe(true);
      expect(service.isSelected('e')).toBe(true);
    });

    it('handles empty selection', () => {
      service.invertSelection();
      
      expect(service.getSelectedCount()).toBe(5);
    });
  });

  describe('setSelection', () => {
    it('sets specific IDs', () => {
      service.setSelection(['b', 'd']);
      
      expect(service.getSelectedIds()).toContain('b');
      expect(service.getSelectedIds()).toContain('d');
      expect(service.getSelectedCount()).toBe(2);
    });
  });

  describe('handleClick', () => {
    it('selects on normal click', () => {
      service.handleClick('a', {});
      
      expect(service.isSelected('a')).toBe(true);
    });

    it('extends on ctrl+click', () => {
      service.handleClick('a', {});
      service.handleClick('c', { ctrlKey: true });
      
      expect(service.isSelected('a')).toBe(true);
      expect(service.isSelected('c')).toBe(true);
    });

    it('extends on meta+click (Mac)', () => {
      service.handleClick('a', {});
      service.handleClick('c', { metaKey: true });
      
      expect(service.isSelected('a')).toBe(true);
      expect(service.isSelected('c')).toBe(true);
    });

    it('range selects on shift+click', () => {
      service.handleClick('b', {});
      service.handleClick('d', { shiftKey: true });
      
      expect(service.isSelected('b')).toBe(true);
      expect(service.isSelected('c')).toBe(true);
      expect(service.isSelected('d')).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('notifies on selection change', () => {
      const callback = vi.fn();
      service.subscribe(callback);
      
      service.select('a');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedIds: expect.any(Set),
        }),
        expect.objectContaining({
          type: 'select',
          ids: ['a'],
        })
      );
    });

    it('can unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe(callback);
      
      unsubscribe();
      service.select('a');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('returns immutable copy', () => {
      service.select('a');
      const state1 = service.getState();
      service.select('b', { extend: true });
      const state2 = service.getState();
      
      expect(state1.selectedIds.size).toBe(1);
      expect(state2.selectedIds.size).toBe(2);
    });
  });

  describe('setItems', () => {
    it('removes invalid selections', () => {
      service.select('a');
      service.select('b', { extend: true });
      
      service.setItems(['b', 'c', 'd']); // 'a' no longer exists
      
      expect(service.isSelected('a')).toBe(false);
      expect(service.isSelected('b')).toBe(true);
    });

    it('updates total count', () => {
      service.setItems(['x', 'y']);
      
      expect(service.getState().totalCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      service.selectAll();
      service.reset();
      
      expect(service.getSelectedCount()).toBe(0);
      expect(service.getState().totalCount).toBe(0);
    });
  });
});

describe('Singleton', () => {
  beforeEach(() => {
    resetMultiSelectService();
  });

  it('returns same instance', () => {
    const service1 = getMultiSelectService();
    const service2 = getMultiSelectService();
    
    expect(service1).toBe(service2);
  });

  it('reset creates new instance', () => {
    const service1 = getMultiSelectService();
    resetMultiSelectService();
    const service2 = getMultiSelectService();
    
    expect(service1).not.toBe(service2);
  });
});
