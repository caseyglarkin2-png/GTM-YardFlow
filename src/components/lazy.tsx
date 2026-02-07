/**
 * Lazy-loaded components for bundle optimization
 * Sprint 49: Reduces initial bundle by deferring heavy components
 * 
 * Usage:
 *   import { LazyROITab, LazySequenceBuilder } from './components/lazy';
 *   <Suspense fallback={<LoadingSpinner />}>
 *     <LazyROITab />
 *   </Suspense>
 */
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Loader } from 'lucide-react';

// Loading fallback component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader className="h-6 w-6 animate-spin text-blue-500" />
  </div>
);

// Wrapper to add Suspense boundary
export function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback: ReactNode = <LoadingSpinner />
) {
  return function WithSuspense(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// --- Heavy Tab Components (defer until user navigates) ---

// ROI Calculator - complex charts, not immediately needed
export const LazyROITab = lazy(() => 
  import('./ROITab').then(m => ({ default: m.ROITab }))
);

// Sequence Builder - heavy editor, only when creating sequences
export const LazySequenceBuilder = lazy(() => 
  import('./SequenceBuilder').then(m => ({ default: m.SequenceBuilder }))
);

// Sequence Performance - analytics, not first-load critical
export const LazySequencePerformancePanel = lazy(() => 
  import('./SequencePerformancePanel').then(m => ({ default: m.SequencePerformancePanel }))
);

// Sequence Manager - admin panel
export const LazySequenceManagerPanel = lazy(() => 
  import('./SequenceManagerPanel').then(m => ({ default: m.SequenceManagerPanel }))
);

// --- Import Modals (only when importing) ---

export const LazyImportWizard = lazy(() => 
  import('./ImportWizard').then(m => ({ default: m.ImportWizard }))
);

export const LazyEmailImportModal = lazy(() => 
  import('./EmailImportModal').then(m => ({ default: m.EmailImportModal }))
);

// --- Company View (alternate view mode) ---

export const LazyCompanyListView = lazy(() => 
  import('./CompanyListView').then(m => ({ default: m.CompanyListView }))
);

export const LazyCompanyDetailPanel = lazy(() => 
  import('./CompanyDetailPanel').then(m => ({ default: m.CompanyDetailPanel }))
);

// --- Pre-wrapped components with Suspense ---

export const ROITabWithSuspense = withSuspense(LazyROITab);
export const SequenceBuilderWithSuspense = withSuspense(LazySequenceBuilder);
export const ImportWizardWithSuspense = withSuspense(LazyImportWizard);
