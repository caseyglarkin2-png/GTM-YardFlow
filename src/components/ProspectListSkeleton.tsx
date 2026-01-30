/**
 * ProspectListSkeleton - Loading skeleton for prospect list
 * 
 * Sprint 93: T93.6 - Add Loading Skeletons for Prospect List
 * 
 * Displays animated placeholder content while prospects are loading.
 * Prevents layout shift and provides better UX during API calls.
 */

interface ProspectListSkeletonProps {
  /** Number of skeleton rows to display */
  count?: number;
  /** Show in compact mode (smaller rows) */
  compact?: boolean;
  /** Optional className for container */
  className?: string;
}

/**
 * Skeleton row component that mimics a prospect list item
 */
function SkeletonRow({ compact }: { compact: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg bg-white border border-slate-200 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {/* Avatar */}
      <div
        className={`rounded-full bg-slate-200 animate-pulse ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
      />

      {/* Name and company */}
      <div className="flex-1 min-w-0">
        <div
          className={`bg-slate-200 rounded animate-pulse ${
            compact ? 'h-4 w-32' : 'h-5 w-40'
          }`}
        />
        <div
          className={`bg-slate-200 rounded animate-pulse mt-1 ${
            compact ? 'h-3 w-24' : 'h-4 w-28'
          }`}
        />
      </div>

      {/* Status badge */}
      <div className="hidden md:block">
        <div
          className={`bg-slate-200 rounded-full animate-pulse ${
            compact ? 'h-5 w-16' : 'h-6 w-20'
          }`}
        />
      </div>

      {/* Score */}
      <div className="hidden lg:block">
        <div className="h-5 w-10 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
        <div className="h-8 w-8 bg-slate-200 rounded animate-pulse hidden sm:block" />
      </div>
    </div>
  );
}

/**
 * Card-style skeleton for grid layout
 */
function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 animate-pulse">
      {/* Header with avatar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-slate-200" />
        <div className="flex-1">
          <div className="h-5 w-32 bg-slate-200 rounded mb-1" />
          <div className="h-4 w-24 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Company info */}
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-slate-200 rounded" />
        <div className="h-4 w-2/3 bg-slate-200 rounded" />
      </div>

      {/* Footer with badges */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="h-6 w-16 bg-slate-200 rounded-full" />
        <div className="h-6 w-12 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

/**
 * Table-style skeleton for data table layout
 */
function SkeletonTableRow() {
  return (
    <tr className="border-b border-slate-100 animate-pulse">
      {/* Checkbox */}
      <td className="p-3">
        <div className="h-4 w-4 bg-slate-200 rounded" />
      </td>
      {/* Name */}
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-200" />
          <div className="h-4 w-28 bg-slate-200 rounded" />
        </div>
      </td>
      {/* Company */}
      <td className="p-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </td>
      {/* Status */}
      <td className="p-3">
        <div className="h-5 w-16 bg-slate-200 rounded-full" />
      </td>
      {/* Score */}
      <td className="p-3">
        <div className="h-4 w-10 bg-slate-200 rounded" />
      </td>
      {/* Actions */}
      <td className="p-3">
        <div className="h-8 w-8 bg-slate-200 rounded" />
      </td>
    </tr>
  );
}

/**
 * Main skeleton component with multiple variants
 */
export function ProspectListSkeleton({
  count = 10,
  compact = false,
  className = '',
}: ProspectListSkeletonProps) {
  return (
    <div
      className={`space-y-2 ${className}`}
      role="status"
      aria-label="Loading prospects"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} compact={compact} />
      ))}
      <span className="sr-only">Loading prospects...</span>
    </div>
  );
}

/**
 * Grid layout skeleton
 */
export function ProspectGridSkeleton({
  count = 9,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      role="status"
      aria-label="Loading prospects"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
      <span className="sr-only">Loading prospects...</span>
    </div>
  );
}

/**
 * Table layout skeleton
 */
export function ProspectTableSkeleton({
  count = 10,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <table
      className={`w-full ${className}`}
      role="status"
      aria-label="Loading prospects"
      aria-busy="true"
    >
      <thead>
        <tr className="border-b border-slate-200">
          <th className="p-3 w-10">
            <div className="h-4 w-4 bg-slate-200 rounded" />
          </th>
          <th className="p-3 text-left">
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </th>
          <th className="p-3 text-left">
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </th>
          <th className="p-3 text-left">
            <div className="h-4 w-14 bg-slate-200 rounded" />
          </th>
          <th className="p-3 text-left">
            <div className="h-4 w-12 bg-slate-200 rounded" />
          </th>
          <th className="p-3 w-16"></th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonTableRow key={index} />
        ))}
      </tbody>
    </table>
  );
}

/**
 * Inline skeleton for single prospect loading (e.g., in detail view)
 */
export function ProspectDetailSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-white border border-slate-200 p-6 animate-pulse ${className}`}
      role="status"
      aria-label="Loading prospect details"
      aria-busy="true"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-16 w-16 rounded-full bg-slate-200" />
        <div className="flex-1">
          <div className="h-6 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-slate-200 rounded-full" />
            <div className="h-5 w-14 bg-slate-200 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div>
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-28 bg-slate-200 rounded" />
        </div>
        <div>
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-40 bg-slate-200 rounded" />
        </div>
        <div>
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-24 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Notes section */}
      <div className="border-t border-slate-100 pt-4">
        <div className="h-3 w-12 bg-slate-200 rounded mb-2" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-2/3 bg-slate-200 rounded" />
        </div>
      </div>

      <span className="sr-only">Loading prospect details...</span>
    </div>
  );
}

export default ProspectListSkeleton;
