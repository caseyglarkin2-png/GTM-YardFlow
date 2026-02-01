/**
 * DraggableStepList Tests - Sprint 702
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraggableStepList, type DraggableItem } from '../../../components/sequence/DraggableStepList';

// Mock useMediaQuery
vi.mock('../../../hooks/useMediaQuery', () => ({
  usePrefersReducedMotion: () => false,
}));

describe('DraggableStepList', () => {
  interface TestItem extends DraggableItem {
    id: string;
    name: string;
  }
  
  const items: TestItem[] = [
    { id: '1', name: 'Step 1' },
    { id: '2', name: 'Step 2' },
    { id: '3', name: 'Step 3' },
  ];
  
  const renderItem = (item: TestItem, index: number) => (
    <div data-testid={`item-${item.id}`}>{item.name}</div>
  );
  
  const defaultProps = {
    items,
    renderItem,
    onReorder: vi.fn(),
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Rendering', () => {
    it('renders all items', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
    });
    
    it('renders listbox with correct aria-label', () => {
      render(<DraggableStepList {...defaultProps} ariaLabel="Test list" />);
      
      expect(screen.getByRole('listbox', { name: 'Test list' })).toBeInTheDocument();
    });
    
    it('renders move up/down buttons', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      const moveUpButtons = screen.getAllByRole('button', { name: /move step .* up/i });
      const moveDownButtons = screen.getAllByRole('button', { name: /move step .* down/i });
      
      expect(moveUpButtons).toHaveLength(3);
      expect(moveDownButtons).toHaveLength(3);
    });
    
    it('disables move up on first item', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      const firstMoveUp = screen.getByRole('button', { name: /move step 1 up/i });
      expect(firstMoveUp).toBeDisabled();
    });
    
    it('disables move down on last item', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      const lastMoveDown = screen.getByRole('button', { name: /move step 3 down/i });
      expect(lastMoveDown).toBeDisabled();
    });
    
    it('shows keyboard instructions', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      expect(screen.getByText(/alt \+ arrow keys/i)).toBeInTheDocument();
    });
  });
  
  describe('Reordering', () => {
    it('calls onReorder when move down clicked', () => {
      const onReorder = vi.fn();
      render(<DraggableStepList {...defaultProps} onReorder={onReorder} />);
      
      const moveDown = screen.getByRole('button', { name: /move step 1 down/i });
      fireEvent.click(moveDown);
      
      expect(onReorder).toHaveBeenCalledWith([
        { id: '2', name: 'Step 2' },
        { id: '1', name: 'Step 1' },
        { id: '3', name: 'Step 3' },
      ]);
    });
    
    it('calls onReorder when move up clicked', () => {
      const onReorder = vi.fn();
      render(<DraggableStepList {...defaultProps} onReorder={onReorder} />);
      
      const moveUp = screen.getByRole('button', { name: /move step 2 up/i });
      fireEvent.click(moveUp);
      
      expect(onReorder).toHaveBeenCalledWith([
        { id: '2', name: 'Step 2' },
        { id: '1', name: 'Step 1' },
        { id: '3', name: 'Step 3' },
      ]);
    });
    
    it('reorders on Alt+ArrowDown', () => {
      const onReorder = vi.fn();
      render(<DraggableStepList {...defaultProps} onReorder={onReorder} />);
      
      const options = screen.getAllByRole('option');
      fireEvent.keyDown(options[0], { key: 'ArrowDown', altKey: true });
      
      expect(onReorder).toHaveBeenCalled();
    });
    
    it('reorders on Alt+ArrowUp', () => {
      const onReorder = vi.fn();
      render(<DraggableStepList {...defaultProps} onReorder={onReorder} />);
      
      const options = screen.getAllByRole('option');
      fireEvent.keyDown(options[1], { key: 'ArrowUp', altKey: true });
      
      expect(onReorder).toHaveBeenCalled();
    });
    
    it('announces reorder for screen readers', () => {
      render(<DraggableStepList {...defaultProps} />);
      
      const moveDown = screen.getByRole('button', { name: /move step 1 down/i });
      fireEvent.click(moveDown);
      
      // Check for aria-live region
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toHaveTextContent(/moved item/i);
    });
  });
  
  describe('Selection', () => {
    it('calls onSelect when item clicked', () => {
      const onSelect = vi.fn();
      render(<DraggableStepList {...defaultProps} onSelect={onSelect} />);
      
      const options = screen.getAllByRole('option');
      fireEvent.click(options[1]);
      
      expect(onSelect).toHaveBeenCalledWith(items[1]);
    });
    
    it('marks selected item with aria-selected', () => {
      render(<DraggableStepList {...defaultProps} selectedId="2" />);
      
      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });
    
    it('applies selected styles', () => {
      render(<DraggableStepList {...defaultProps} selectedId="2" />);
      
      const options = screen.getAllByRole('option');
      expect(options[1].className).toContain('ring-2');
    });
  });
  
  describe('Draggable Prop', () => {
    it('hides move buttons when draggable is false', () => {
      render(<DraggableStepList {...defaultProps} draggable={false} />);
      
      expect(screen.queryByRole('button', { name: /move step/i })).not.toBeInTheDocument();
    });
    
    it('hides keyboard instructions when draggable is false', () => {
      render(<DraggableStepList {...defaultProps} draggable={false} />);
      
      expect(screen.queryByText(/alt \+ arrow keys/i)).not.toBeInTheDocument();
    });
  });
});
