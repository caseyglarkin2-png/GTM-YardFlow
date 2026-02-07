import { useCallback, useState } from 'react';
import type { Prospect } from '../types';
import type { SequenceTemplate } from '../types/emailSequence';
import { BulkExporter } from '../services/BulkExporter';
import { BulkDeleteService } from '../services/BulkDeleteService';
import { BulkActionService } from '../services/BulkActionService';

// Services initialized once
const bulkExporter = new BulkExporter();
const bulkDeleteService = new BulkDeleteService();
const bulkActionService = new BulkActionService();

export type BulkActionModalType = 'sequence' | 'tag' | 'status' | 'export' | 'delete' | 'email' | null;

interface UseBulkActionsParams {
  prospects: Prospect[];
  selectedProspectIds: Set<string>;
  selectedProspect: Prospect | null;
  currentUser: string;
  clearSelection: () => void;
  setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>;
  setSelectedProspect: (prospect: Prospect | null) => void;
  enrollProspects: (prospects: Prospect[], sequenceId: string) => Promise<{ success: boolean; error?: string }[]>;
  createSequence: (data: {
    name: string;
    description: string;
    steps: Array<{
      order: number;
      type: 'email';
      subject: string;
      body: string;
      delayDays: number;
    }>;
  }) => Promise<{ id: string; name: string } | null>;
  refreshSequences: () => Promise<void>;
  announce: (message: string) => void;
  showSuccess: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
}

interface UseBulkActionsReturn {
  // State
  bulkActionModal: BulkActionModalType;
  isProcessingBulkAction: boolean;
  isExportingBulk: boolean;
  deletedProspects: Prospect[];
  
  // State setters
  setBulkActionModal: (modal: BulkActionModalType) => void;
  
  // Handlers
  handleBulkAssignSequence: (sequenceId: string) => Promise<void>;
  handleCreateFromTemplate: (template: SequenceTemplate) => Promise<string | null>;
  handleBulkAddTag: (tags: string[]) => Promise<void>;
  handleBulkChangeStatus: (status: Prospect['status']) => Promise<void>;
  handleBulkExport: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleUndoDelete: () => Promise<void>;
}

/**
 * Hook for managing bulk prospect actions
 * Extracted from App.tsx for maintainability (Sprint 48)
 */
export function useBulkActions({
  prospects,
  selectedProspectIds,
  selectedProspect,
  currentUser,
  clearSelection,
  setProspects,
  setSelectedProspect,
  enrollProspects,
  createSequence,
  refreshSequences,
  announce,
  showSuccess,
  showWarning,
  showError,
}: UseBulkActionsParams): UseBulkActionsReturn {
  const [bulkActionModal, setBulkActionModal] = useState<BulkActionModalType>(null);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);
  const [isExportingBulk, setIsExportingBulk] = useState(false);
  const [deletedProspects, setDeletedProspects] = useState<Prospect[]>([]);

  const handleBulkAssignSequence = useCallback(async (sequenceId: string) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      const selectedProspects = prospects.filter(p => prospectIdsArray.includes(p.id));
      const results = await enrollProspects(selectedProspects, sequenceId);
      
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        clearSelection();
        showSuccess(
          'Enrolled in Sequence',
          `${succeeded} prospect${succeeded === 1 ? '' : 's'} enrolled. First email will send at 9:15 AM.`
        );
        announce(`${succeeded} prospect${succeeded === 1 ? '' : 's'} enrolled in sequence`);
      } else if (succeeded > 0) {
        showWarning(
          'Partial Enrollment',
          `${succeeded} enrolled, ${failed} failed (already enrolled or invalid email)`
        );
        announce(`Partial success: ${succeeded} enrolled, ${failed} failed`);
      } else {
        showError('Enrollment Failed', 'Could not enroll any prospects. They may already be in this sequence.');
        announce('Failed to enroll prospects in sequence');
      }
    } catch (error) {
      console.error('Bulk sequence enrollment failed', error);
      showError('Enrollment Failed', 'Unable to enroll prospects. Please try again.');
      announce('Failed to enroll prospects in sequence');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, prospects, enrollProspects, clearSelection, announce, showSuccess, showWarning, showError]);

  const handleCreateFromTemplate = useCallback(async (template: SequenceTemplate): Promise<string | null> => {
    try {
      const newSequence = await createSequence({
        name: `${template.name} - ${new Date().toLocaleDateString()}`,
        description: template.description || '',
        steps: template.steps.map((step: SequenceTemplate['steps'][number], idx: number) => ({
          order: idx + 1,
          type: 'email' as const,
          subject: step.subjectTemplate,
          body: step.bodyTemplate,
          delayDays: step.delayDays,
        })),
      });
      
      if (newSequence) {
        showSuccess('Sequence Created', `Created "${newSequence.name}" from template`);
        await refreshSequences();
        return newSequence.id;
      }
      showError('Creation Failed', 'Could not create sequence from template');
      return null;
    } catch (error) {
      console.error('Failed to create sequence from template', error);
      showError('Creation Failed', 'Could not create sequence from template');
      return null;
    }
  }, [createSequence, refreshSequences, showSuccess, showError]);

  const handleBulkAddTag = useCallback(async (tags: string[]) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      bulkActionService.registerHandler('tag', async (ids, value) => {
        const tagsToAdd = value as string[];
        setProspects(prev => prev.map(p => {
          if (ids.includes(p.id)) {
            const existingTags = p.tags || [];
            const newTags = [...new Set([...existingTags, ...tagsToAdd])];
            return { ...p, tags: newTags };
          }
          return p;
        }));
        return {
          success: true,
          type: 'tag' as const,
          processed: ids.length,
          failed: 0,
          data: { tags: tagsToAdd }
        };
      });

      const result = await bulkActionService.execute({
        type: 'tag',
        prospectIds: prospectIdsArray,
        value: tags
      });

      if (result.success) {
        clearSelection();
        announce(`Added ${tags.length} tag${tags.length === 1 ? '' : 's'} to ${result.processed} prospect${result.processed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Bulk tag failed', error);
      showError('Tag Update Failed', 'Unable to add tags to the selected prospects. Please try again.');
      announce('Failed to add tags');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, clearSelection, announce, showError, setProspects]);

  const handleBulkChangeStatus = useCallback(async (status: Prospect['status']) => {
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);

    try {
      bulkActionService.registerHandler('status', async (ids, value) => {
        const newStatus = value as Prospect['status'];
        setProspects(prev => prev.map(p => {
          if (ids.includes(p.id)) {
            return { ...p, status: newStatus };
          }
          return p;
        }));
        return {
          success: true,
          type: 'status' as const,
          processed: ids.length,
          failed: 0,
          data: { status: newStatus }
        };
      });

      const result = await bulkActionService.execute({
        type: 'status',
        prospectIds: prospectIdsArray,
        value: status
      });

      if (result.success) {
        clearSelection();
        announce(`Updated status to ${status} for ${result.processed} prospect${result.processed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Bulk status change failed', error);
      showError('Status Update Failed', 'Unable to update status for the selected prospects. Please try again.');
      announce('Failed to update status');
    } finally {
      setBulkActionModal(null);
      setIsProcessingBulkAction(false);
    }
  }, [selectedProspectIds, clearSelection, announce, showError, setProspects]);

  const handleBulkExport = useCallback(async () => {
    setIsExportingBulk(true);
    try {
      const prospectsToExport = prospects.filter(p => selectedProspectIds.has(p.id));
      const result = await bulkExporter.exportToCSV(
        prospectsToExport,
        `yardflow-prospects-${new Date().toISOString().split('T')[0]}.csv`
      );

      if (result.success) {
        bulkExporter.download(result);
        clearSelection();
        showSuccess('Export Complete', `Exported ${result.rowCount} prospect${result.rowCount === 1 ? '' : 's'} to CSV`);
        announce(`Exported ${result.rowCount} prospect${result.rowCount === 1 ? '' : 's'}`);
      } else {
        showError('Export Failed', 'Unable to generate the export file. Please try again.');
        announce('Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export Failed', 'An unexpected error occurred during export. Please try again.');
      announce('Export failed');
    } finally {
      setBulkActionModal(null);
      setIsExportingBulk(false);
    }
  }, [prospects, selectedProspectIds, clearSelection, announce, showSuccess, showError]);

  const handleBulkDelete = useCallback(async () => {
    const prospectsToDelete = prospects.filter(p => selectedProspectIds.has(p.id));
    const prospectIdsArray = Array.from(selectedProspectIds);
    setIsProcessingBulkAction(true);
    setDeletedProspects(prospectsToDelete);
    
    try {
      await bulkDeleteService.delete(prospectsToDelete, { soft: true, deletedBy: currentUser });

      setProspects(prev => prev.filter(p => !selectedProspectIds.has(p.id)));
      
      if (selectedProspect && selectedProspectIds.has(selectedProspect.id)) {
        setSelectedProspect(null);
      }
      
      clearSelection();
      setBulkActionModal(null);
      announce(`Deleted ${prospectIdsArray.length} prospect${prospectIdsArray.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Bulk delete failed', error);
      showError('Delete Failed', 'Unable to delete the selected prospects. Please try again.');
      announce('Failed to delete prospects');
    } finally {
      setIsProcessingBulkAction(false);
    }
  }, [prospects, selectedProspectIds, selectedProspect, clearSelection, announce, currentUser, showError, setProspects, setSelectedProspect]);

  const handleUndoDelete = useCallback(async () => {
    if (deletedProspects.length === 0) return;
    
    try {
      await bulkDeleteService.restore(deletedProspects.map(p => p.id));
      setProspects(prev => [...prev, ...deletedProspects]);
      setDeletedProspects([]);
      announce(`Restored ${deletedProspects.length} prospects`);
    } catch (error) {
      console.error('Undo delete failed', error);
      showError('Restore Failed', 'Unable to restore deleted prospects. Please try again.');
      announce('Failed to restore prospects');
    }
  }, [deletedProspects, announce, showError, setProspects]);

  return {
    bulkActionModal,
    isProcessingBulkAction,
    isExportingBulk,
    deletedProspects,
    setBulkActionModal,
    handleBulkAssignSequence,
    handleCreateFromTemplate,
    handleBulkAddTag,
    handleBulkChangeStatus,
    handleBulkExport,
    handleBulkDelete,
    handleUndoDelete,
  };
}
