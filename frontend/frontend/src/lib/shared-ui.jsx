/**
 * Eden Shared UI Components
 * 
 * Consistent loading, error, and empty state components
 * used across all features for unified UX.
 */

import React from 'react';
import { Loader2, AlertCircle, FileQuestion, RefreshCcw, Home } from 'lucide-react';
import { Button } from '../components/ui/button';

/**
 * Spinner - Loading indicator
 */
export function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };
  
  return (
    <Loader2 
      className={`animate-spin text-orange-600 ${sizeClasses[size]} ${className}`} 
    />
  );
}

/**
 * LoadingState - Full loading screen
 */
export function LoadingState({ 
  message = 'Loading...', 
  size = 'lg',
  fullScreen = false,
  className = ''
}) {
  const containerClass = fullScreen 
    ? 'fixed inset-0 bg-white/80 backdrop-blur-sm z-50' 
    : 'w-full py-12';
  
  return (
    <div className={`flex flex-col items-center justify-center ${containerClass} ${className}`}>
      <Spinner size={size} />
      {message && (
        <p className="mt-4 text-gray-600 text-sm">{message}</p>
      )}
    </div>
  );
}

/**
 * ErrorState - Error display with retry option
 */
export function ErrorState({ 
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  onGoHome,
  showHomeButton = false,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      
      <p className="text-gray-600 text-sm text-center max-w-md mb-6">
        {message}
      </p>
      
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
        
        {showHomeButton && onGoHome && (
          <Button onClick={onGoHome} size="sm" className="bg-orange-600 hover:bg-orange-700">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * EmptyState - No data display with optional action
 */
export function EmptyState({ 
  icon: Icon = FileQuestion,
  title = 'No data found',
  message = 'There\'s nothing here yet.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      
      <p className="text-gray-600 text-sm text-center max-w-md mb-6">
        {message}
      </p>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-orange-600 hover:bg-orange-700">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * StatusPill - Colored status indicator
 */
export function StatusPill({ 
  status, 
  labels = {}, 
  colors = {},
  className = '' 
}) {
  const label = labels[status] || status;
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  );
}

/**
 * PageHeader - Consistent page header
 */
export function PageHeader({ 
  title, 
  subtitle,
  actions,
  backButton,
  className = '' 
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {backButton}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-600 text-sm md:text-base mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SectionCard - Consistent card wrapper
 */
export function SectionCard({ 
  title, 
  subtitle,
  headerActions,
  children, 
  className = '',
  noPadding = false
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {(title || headerActions) && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerActions}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  );
}

/**
 * ConfirmDialog - Simple confirmation modal
 */
export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger' // 'danger' | 'warning' | 'info'
}) {
  if (!isOpen) return null;
  
  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    info: 'bg-blue-600 hover:bg-blue-700'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button 
            onClick={() => { onConfirm(); onClose(); }}
            className={variantStyles[variant]}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * InfoBanner - Informational banner
 */
export function InfoBanner({ 
  type = 'info', // 'info' | 'warning' | 'error' | 'success'
  title,
  message,
  onDismiss,
  className = ''
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800'
  };
  
  const icons = {
    info: AlertCircle,
    warning: AlertCircle,
    error: AlertCircle,
    success: AlertCircle
  };
  
  const Icon = icons[type];
  
  return (
    <div className={`border rounded-lg p-4 ${styles[type]} ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {title && <p className="font-medium">{title}</p>}
          {message && <p className="text-sm mt-1 opacity-90">{message}</p>}
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-current opacity-60 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default {
  Spinner,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusPill,
  PageHeader,
  SectionCard,
  ConfirmDialog,
  InfoBanner
};
