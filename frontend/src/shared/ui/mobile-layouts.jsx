/**
 * Eden Mobile-First Layout Components
 * 
 * Responsive layout primitives for critical flows:
 * - Claims list/detail
 * - Inspections & RapidCapture
 * - Harvest map
 */

import React from 'react';
import { cn } from './utils';

/**
 * MobileContainer - Responsive container with mobile-first sizing
 */
export function MobileContainer({ children, className = '' }) {
  return (
    <div className={cn(
      'w-full max-w-7xl mx-auto',
      'px-4 sm:px-6 lg:px-8',
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileGrid - Responsive grid that collapses on mobile
 */
export function MobileGrid({ 
  children, 
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className = '' 
}) {
  const gridCols = `grid-cols-${cols.default} sm:grid-cols-${cols.sm || cols.default} md:grid-cols-${cols.md || cols.sm || cols.default} lg:grid-cols-${cols.lg || cols.md || cols.sm || cols.default}`;
  
  return (
    <div className={cn(
      'grid',
      gridCols,
      `gap-${gap}`,
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileStack - Vertical stack with responsive spacing
 */
export function MobileStack({ 
  children, 
  spacing = { default: 4, md: 6 },
  className = '' 
}) {
  return (
    <div className={cn(
      'flex flex-col',
      `space-y-${spacing.default}`,
      `md:space-y-${spacing.md || spacing.default}`,
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileRow - Horizontal row that stacks on mobile
 */
export function MobileRow({ 
  children, 
  breakpoint = 'md',
  gap = 4,
  align = 'center',
  className = '' 
}) {
  const flexDirection = breakpoint === 'sm' 
    ? 'flex-col sm:flex-row' 
    : breakpoint === 'lg' 
    ? 'flex-col lg:flex-row'
    : 'flex-col md:flex-row';
  
  return (
    <div className={cn(
      'flex',
      flexDirection,
      `gap-${gap}`,
      `items-${align}`,
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileCard - Responsive card with mobile-optimized padding
 */
export function MobileCard({ 
  children, 
  noPadding = false,
  className = '' 
}) {
  return (
    <div className={cn(
      'bg-white rounded-lg border border-gray-200 shadow-sm',
      !noPadding && 'p-4 sm:p-6',
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileHeader - Responsive page header
 */
export function MobileHeader({ 
  title, 
  subtitle,
  actions,
  backButton,
  className = '' 
}) {
  return (
    <div className={cn(
      'mb-4 sm:mb-6',
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {backButton}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm sm:text-base text-gray-600 mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MobileList - Responsive list with mobile-optimized items
 */
export function MobileList({ 
  children, 
  dividers = true,
  className = '' 
}) {
  return (
    <div className={cn(
      'rounded-lg border border-gray-200 overflow-hidden',
      dividers && 'divide-y divide-gray-100',
      className
    )}>
      {children}
    </div>
  );
}

/**
 * MobileListItem - Responsive list item
 */
export function MobileListItem({ 
  children, 
  onClick,
  className = '' 
}) {
  const Component = onClick ? 'button' : 'div';
  
  return (
    <Component 
      onClick={onClick}
      className={cn(
        'w-full bg-white p-3 sm:p-4',
        'text-left',
        onClick && 'hover:bg-gray-50 transition-colors cursor-pointer',
        className
      )}
    >
      {children}
    </Component>
  );
}

/**
 * MobileBottomSheet - Fixed bottom sheet for mobile actions
 */
export function MobileBottomSheet({ 
  children, 
  isOpen = true,
  onClose,
  className = '' 
}) {
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      {onClose && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sheet */}
      <div className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white rounded-t-2xl shadow-lg',
        'p-4 pb-safe',
        'md:hidden',
        className
      )}>
        {/* Handle */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        {children}
      </div>
    </>
  );
}

/**
 * MobileTabs - Responsive tab navigation
 */
export function MobileTabs({ 
  tabs, 
  activeTab, 
  onTabChange,
  className = '' 
}) {
  return (
    <div className={cn(
      'flex overflow-x-auto no-scrollbar',
      'border-b border-gray-200',
      '-mx-4 px-4 sm:mx-0 sm:px-0',
      className
    )}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex-shrink-0 px-4 py-2 text-sm font-medium',
            'border-b-2 transition-colors',
            activeTab === tab.id
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * HideOnMobile - Hide content on mobile
 */
export function HideOnMobile({ children, breakpoint = 'md' }) {
  const hiddenClass = breakpoint === 'sm' 
    ? 'hidden sm:block' 
    : breakpoint === 'lg' 
    ? 'hidden lg:block'
    : 'hidden md:block';
  
  return <div className={hiddenClass}>{children}</div>;
}

/**
 * ShowOnMobile - Show content only on mobile
 */
export function ShowOnMobile({ children, breakpoint = 'md' }) {
  const visibleClass = breakpoint === 'sm' 
    ? 'sm:hidden' 
    : breakpoint === 'lg' 
    ? 'lg:hidden'
    : 'md:hidden';
  
  return <div className={visibleClass}>{children}</div>;
}

/**
 * ResponsiveText - Text with mobile-first sizing
 */
export function ResponsiveText({ 
  children, 
  as: Component = 'p',
  size = 'base',
  className = '' 
}) {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs sm:text-sm',
    base: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg',
    xl: 'text-lg sm:text-xl md:text-2xl',
    '2xl': 'text-xl sm:text-2xl md:text-3xl',
    '3xl': 'text-2xl sm:text-3xl md:text-4xl'
  };
  
  return (
    <Component className={cn(sizeClasses[size], className)}>
      {children}
    </Component>
  );
}

export default {
  MobileContainer,
  MobileGrid,
  MobileStack,
  MobileRow,
  MobileCard,
  MobileHeader,
  MobileList,
  MobileListItem,
  MobileBottomSheet,
  MobileTabs,
  HideOnMobile,
  ShowOnMobile,
  ResponsiveText
};
