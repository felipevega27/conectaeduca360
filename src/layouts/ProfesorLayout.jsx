import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { mockUsers } from '../utils/mockUsers';
import logoTexto from '../assets/logo_texto.png';

export default function ProfesorLayout() {
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState({ libro: false });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Estado para el modo oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Simular carga de usuario (En el futuro vendrá del backend)
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      setUser(JSON.parse(loggedUserJSON));
    } else {
      // Obtenemos el profesor de nuestro archivo de prueba si no hay sesión
      const fallbackUser = mockUsers.find(u => u.role === 'profesor');
      setUser(fallbackUser || { nombre: 'Profesor Invitado', role: 'Profesor' });
    }
  }, []);

  // Efecto para aplicar o quitar la clase dark del HTML
  useEffect(() => {
    console.log("[ProfesorLayout] Aplicando efecto de tema. Estado isDarkMode:", isDarkMode);
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      console.log("[ProfesorLayout] Clases en <html> resultantes:", document.documentElement.className);
      window.dispatchEvent(new Event('themeChanged'));
    } catch (error) {
      console.error("[ProfesorLayout] Error crítico al cambiar tema:", error);
      alert("Error al intentar aplicar el tema: " + error.message);
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    console.log("[ProfesorLayout] Botón de tema presionado.");
    setIsDarkMode(prev => !prev);
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

  const toggleSubmenu = (menuKey) => {
    setOpenSubmenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const isItemActive = (itemPath, exact = false) => {
    if (exact) {
      return location.pathname === itemPath;
    }
    return location.pathname.includes(itemPath);
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
      
      {/* Overlay oscuro para móvil */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* SIDEBAR PROFESOR */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300 lg:static lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!isCollapsed && (
            <div className="flex items-center space-x-2 overflow-hidden">
              <img src={logoTexto} alt="Logo ConectaEduc" className="h-8 w-auto object-contain" />
            </div>
          )}
          
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:block text-gray-500 hover:text-gray-700 focus:outline-none shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-gray-600 lg:hidden shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Menú de Navegación */}
        <div className="py-6 flex-1 overflow-y-auto">
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Panel Docente</h2>
            <nav className="space-y-1.5">
              
              {/* Inicio / Mi Horario */}
              <button 
                onClick={() => { navigate('/panel/profesor'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Mi Horario" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/profesor', true) 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {!isCollapsed && <span>Mi Horario (Hoy)</span>}
              </button>

              {/* Libro de Clases (Desplegable) */}
              <div className="relative pt-2">
                <button 
                  onClick={() => toggleSubmenu('libro')}
                  title={isCollapsed ? "Libro Digital" : ""}
                  className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                    openSubmenus.libro || isItemActive('/panel/profesor/asistencia') || isItemActive('/panel/profesor/calificaciones')
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  {!isCollapsed && <span>Libro Digital</span>}
                  {!isCollapsed && (
                    <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${openSubmenus.libro ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.libro ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11 pr-2'}`}>
                    <button 
                      onClick={() => { navigate('/panel/profesor/asistencia'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Pasar Lista" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left block'} ${isItemActive('/panel/profesor/asistencia') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">AS</span> : <span>Pasar Asistencia</span>}
                    </button>
                    <button 
                      onClick={() => { navigate('/panel/profesor/calificaciones'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Calificaciones" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left block'} ${isItemActive('/panel/profesor/calificaciones') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">NO</span> : <span>Calificaciones</span>}
                    </button>
                    <button 
                      onClick={() => { navigate('/panel/profesor/anotaciones'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Anotaciones" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left block'} ${isItemActive('/panel/profesor/anotaciones') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">AN</span> : <span>Hoja de Vida</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* GESTIÓN DE TAREAS */}
              <button 
                onClick={() => { navigate('/panel/profesor/tareas'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Gestión de Tareas" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/profesor/tareas') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                {!isCollapsed && <span>Gestión de Tareas</span>}
              </button>

              {/* PLANIFICACIONES UTP */}
              <button 
                onClick={() => { navigate('/panel/profesor/planificaciones'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Planificaciones" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/profesor/planificaciones') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
                </svg>
                {!isCollapsed && <span>Mis Planificaciones</span>}
              </button>

              {/* Conectaedu IA */}
              <button 
                onClick={() => { navigate('/panel/profesor/copiloto'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "ConectaEdu IA" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/profesor/copiloto') 
                  ? 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500/30' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isItemActive('/panel/profesor/copiloto') ? 'text-purple-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                {!isCollapsed && <span className="font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-600 to-blue-600">ConectaEdu IA</span>}
              </button>

            </nav>
          </div>
          
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

        {/* Perfil del Profesor & Botones de Sistema */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-auto">
          <div className={`p-4 flex ${isCollapsed ? 'flex-col items-center gap-4' : 'items-center'}`}>
              <div 
                onClick={() => navigate('/panel/profesor/mi-perfil')}
                className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 -ml-1 rounded-lg transition-colors"
                title="Ver mi perfil"
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0 uppercase">
                  {user ? (user.name || user.nombre || 'P').charAt(0) : 'P'}
                </div>
                {!isCollapsed && (
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user ? (user.name || user.nombre) : 'Profesor'}</p>
                    <p className="text-xs text-gray-500 capitalize truncate">{user ? user.role : 'Docente'}</p>
                  </div>
                )}
              </div>
              <button 
                onClick={handleLogout}
                className={`${isCollapsed ? '' : 'ml-auto'} text-gray-400 hover:text-red-600 transition-colors`}
                title="Cerrar sesión"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
              </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center space-x-2">
            <img src={logoTexto} alt="Logo ConectaEduc" className="h-8 w-auto object-contain" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
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