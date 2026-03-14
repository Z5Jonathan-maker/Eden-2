import React from 'react';

export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-zinc-800/50 rounded ${className}`} />
);

export const CardSkeleton = () => (
  <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-xl p-6 space-y-4">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

export const KpiSkeleton = () => (
  <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-xl p-4 space-y-3">
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-2 w-24" />
  </div>
);

export const TableRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-zinc-800">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-6 w-20 rounded-full" />
  </div>
);

export const PageHeaderSkeleton = () => (
  <div className="space-y-3 mb-8">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <Skeleton className="h-8 w-48" />
    </div>
    <Skeleton className="h-4 w-64" />
  </div>
);

export const KpiGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {Array.from({ length: count }).map((_, i) => (
      <KpiSkeleton key={i} />
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-xl overflow-hidden">
    {Array.from({ length: rows }).map((_, i) => (
      <TableRowSkeleton key={i} />
    ))}
  </div>
);
