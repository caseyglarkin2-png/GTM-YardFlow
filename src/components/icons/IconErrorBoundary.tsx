/**
 * IconErrorBoundary - Sprint 700 T700.1
 * 
 * Error boundary specifically for lazy-loaded icons.
 * Catches network failures and renders a fallback placeholder.
 */

import { Component, type ReactNode } from 'react';

interface IconErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface IconErrorBoundaryState {
  hasError: boolean;
}

export class IconErrorBoundary extends Component<IconErrorBoundaryProps, IconErrorBoundaryState> {
  constructor(props: IconErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): IconErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log icon loading failures for monitoring
    console.warn('[IconErrorBoundary] Icon failed to load:', error.message, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default IconErrorBoundary;
