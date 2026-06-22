import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

export default function ApoderadoLayout() {
  const [user, setUser] = useState({ nombre: 'Claudia Pérez', rol: 'Apoderado Titular', pupilo: 'Martina Fernández' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Estado para el modo oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Efecto para aplicar o quitar la clase dark del HTML
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      window.dispatchEvent(new Event('themeChanged'));
    } catch (error) {
      console.error("Error crítico al cambiar tema:", error);
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const isItemActive = (itemPath, exact = false) => {
    if (exact) return location.pathname === itemPath;
    return location.pathname.includes(itemPath);
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('userLogged');
      navigate('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-gray-900 font-sans transition-colors duration-300">
      
      {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* SIDEBAR APODERADO */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300 lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'w-20' : 'w-64'}`}>
        
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">CE</div>
              <span className="text-lg font-bold text-gray-800 dark:text-white truncate">Portal Apoderado</span>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:block text-gray-500 hover:text-gray-700 shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>

        <div className="py-6 flex-1 overflow-y-auto">
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <nav className="space-y-1.5">
              {/* Botón Centro de Alertas */}
              <button onClick={() => { navigate('/panel/apoderado'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/apoderado', true) ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {!isCollapsed && <span>Centro de Alertas</span>}
              </button>
              
              {/* Botón Rendimiento Académico */}
              <button onClick={() => { navigate('/panel/apoderado/rendimiento'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/apoderado/rendimiento') ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                {!isCollapsed && <span>Rendimiento Académico</span>}
              </button>
              
              {/* Botón Asistencia y Justificativos */}
              <button onClick={() => { navigate('/panel/apoderado/asistencia'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/apoderado/asistencia') ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {!isCollapsed && <span>Asistencia y Justificativos</span>}
              </button>
          </nav>
        </div>

         {/* Configuración - Alternar Modo Oscuro */}
         <div className={`mt-8 mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Configuración</h2>
            <nav className="space-y-1">
                <button 
                  onClick={handleToggleTheme}
                  title={isCollapsed ? "Cambiar Tema" : ""} 
                  className={`w-full flex items-center py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                >
                  <div className={`shrink-0 transition-transform duration-500 ${isDarkMode ? 'rotate-180' : 'rotate-0'} ${isCollapsed ? '' : 'mr-3'}`}>
                    {isDarkMode ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    )}
                  </div>
                    {!isCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                </button>
            </nav>
         </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 mt-auto p-4 flex items-center">
          <div 
            onClick={() => navigate('/panel/apoderado/mi-perfil')}
            className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 -ml-1 rounded-lg transition-colors flex-1"
            title="Ver mi perfil"
          >
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">C</div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{user.nombre}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Apoderado Titular</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={`${isCollapsed ? '' : 'ml-auto'} text-gray-400 hover:text-red-600 transition-colors`} title="Cerrar sesión">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">CE</div>
            <span className="text-lg font-semibold text-gray-800 dark:text-white">Portal Apoderado</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500 hover:text-gray-700 dark:text-gray-300"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* MODAL CERRAR SESIÓN */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cerrar Sesión</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">¿Seguro que desea cerrar sesión y salir del sistema?</p>
            
            {isLoggingOut ? (
              <div className="flex w-full items-center justify-center py-2">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsLogoutModalOpen(false)} 
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  No, cancelar
                </button>
                <button 
                  onClick={confirmLogout} 
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Sí, cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}