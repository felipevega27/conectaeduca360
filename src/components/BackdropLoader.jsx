import React from 'react';

/**
 * BackdropLoader Component
 * Muestra un overlay semi-transparente a pantalla completa (o contenedor relativo)
 * con el spinner estándar de la aplicación para bloquear la UI durante cargas.
 */
export default function BackdropLoader({ mensaje = 'Cargando...', isFullScreen = false }) {
  // Si isFullScreen es true, cubre toda la pantalla.
  // De lo contrario, cubre el contenedor relativo.
  const containerClasses = isFullScreen
    ? 'fixed inset-0 z-[100]'
    : 'absolute inset-0 z-50'; 

  return (
    <div className={`${containerClasses} flex flex-col items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm transition-all duration-200 rounded-[inherit]`}>
      <div className="flex flex-col items-center gap-4">
        {/* Spinner Estándar de la aplicación (multicolor) */}
        <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
        {mensaje && (
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">{mensaje}</p>
        )}
      </div>
    </div>
  );
}
