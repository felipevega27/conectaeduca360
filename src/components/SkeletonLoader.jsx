import React from 'react';

/**
 * Componente base de Skeleton
 * @param {string} className Clases adicionales para Tailwind (ancho, alto, bordes, etc.)
 */
export function SkeletonBase({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`}></div>
  );
}

/**
 * Skeleton Card diseñado para imitar las tarjetas de Tareas o Planificaciones.
 */
export function SkeletonCard() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 bg-white dark:bg-gray-800 flex flex-col h-full shadow-sm">
      <div className="flex justify-between items-start mb-4 mt-1">
        <SkeletonBase className="h-5 w-20 rounded-full" />
        <SkeletonBase className="h-4 w-24" />
      </div>
      <SkeletonBase className="h-6 w-3/4 mb-2" />
      <SkeletonBase className="h-3 w-1/2 mb-6" />
      
      <div className="mt-auto space-y-4">
        <SkeletonBase className="h-8 w-full rounded-lg" />
        <SkeletonBase className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Skeleton Row diseñado para imitar una fila de lista de estudiantes o calificaciones.
 */
export function SkeletonRow() {
  return (
    <div className="p-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 w-3/4">
        <SkeletonBase className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-2 w-full">
          <SkeletonBase className="h-4 w-1/2" />
          <SkeletonBase className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonBase className="h-5 w-10 rounded" />
    </div>
  );
}
