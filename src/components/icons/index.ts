/**
 * Icons Module - Sprint 700
 * 
 * Re-exports for clean imports:
 * import { LazyIcon, preloadCriticalIcons } from '@/components/icons';
 */

export { LazyIcon, preloadIcon, preloadIcons, isIconCached } from './LazyIcon';
export type { LazyIconProps } from './LazyIcon';
export { IconErrorBoundary } from './IconErrorBoundary';
export { 
  preloadCriticalIcons, 
  preloadTabIcons, 
  preloadAllIcons,
  CRITICAL_ICONS,
  TAB_ICONS,
} from './iconPreloader';
