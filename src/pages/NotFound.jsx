import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="text-center max-w-md animate-fade-in-up">
        
        {/* Ícono de Error */}
        <div className="mx-auto h-24 w-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6 shadow-inner">
          <svg className="h-12 w-12 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-7xl font-black text-gray-800 dark:text-white tracking-tight mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">Página no encontrada</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          Lo sentimos, la ruta a la que intentas acceder no existe, fue movida o no tienes permisos para verla.
        </p>
        
        <button 
          onClick={() => navigate('/')}
          className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}