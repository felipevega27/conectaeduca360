import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import logoTexto from '../assets/logo_texto.png';
import logoImg from '../assets/logo.png';
import TopHeader from '../components/TopHeader';

export default function AlumnoLayout() {
  const [user, setUser] = useState(null);
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

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUser(profile);
      }
    };
    fetchUser();
  }, []);

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
      console.error("[AlumnoLayout] Error crítico al cambiar tema:", error);
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('userLogged');
      window.location.href = '/';
    }, 1500);
  };

  const isItemActive = (itemPath, exact = false) => {
    if (exact) return location.pathname === itemPath;
    return location.pathname.includes(itemPath);
  };

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
      
      {/* Overlay oscuro para móvil */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* SIDEBAR FAMILIA */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300 lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20 w-64' : 'w-64'}`}>
        
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'lg:justify-center justify-between px-4' : 'justify-between px-4'}`}>
          {/* LOGO COMPLETO: Visible en móvil siempre, o en PC si no está colapsado */}
          <div className={`flex items-center space-x-2 overflow-hidden cursor-pointer ${isCollapsed ? 'lg:hidden' : ''}`} onClick={() => { navigate('/panel/alumno'); setIsMobileMenuOpen(false); }}>
            <img src={logoTexto} alt="Logo ConectaEduc" className="h-8 w-auto object-contain" />
          </div>

          {/* LOGO ICONO: Visible SOLO en PC cuando está colapsado */}
          <div className={`items-center justify-center cursor-pointer ${isCollapsed ? 'hidden lg:flex' : 'hidden'}`} onClick={() => { navigate('/panel/alumno'); setIsMobileMenuOpen(false); }}>
            <img src={logoImg} alt="Logo" className="h-8 w-8 object-contain transition-transform hover:scale-105" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-gray-600 lg:hidden shrink-0 transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Menú de Navegación Simple */}
        <div className="py-6 flex-1 overflow-y-auto">
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <nav className="space-y-1.5">
              
              <button 
                onClick={() => { navigate('/panel/alumno'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Resumen Escolar" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno', true) 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                {!isCollapsed && <span>Resumen Escolar</span>}
              </button>

              {/* MI HORARIO Y AGENDA */}
              <button 
                onClick={() => { navigate('/panel/alumno/horario'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Mi Horario" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno/horario') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9 3.75h.008v.008H12v-.008zm3 0h.008v.008H15v-.008zm-6 3h.008v.008H9v-.008zm3 0h.008v.008H12v-.008zm3 0h.008v.008H15v-.008z" />
                </svg>
                {!isCollapsed && <span>Mi Horario y Pruebas</span>}
              </button>

              <button 
                onClick={() => { navigate('/panel/alumno/calificaciones'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Calificaciones" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno/calificaciones') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                {!isCollapsed && <span>Calificaciones</span>}
              </button>

              <button 
                onClick={() => { navigate('/panel/alumno/asistencia'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Asistencia Diaria" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno/asistencia') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                {!isCollapsed && <span>Asistencia Diaria</span>}
              </button>

              <button 
                onClick={() => { navigate('/panel/alumno/anotaciones'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Anotaciones" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno/anotaciones') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {!isCollapsed && <span>Anotaciones</span>}
              </button>

              {/* AULA VIRTUAL / MATERIALES */}
              <button 
                onClick={() => { navigate('/panel/alumno/materiales'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Aula Virtual" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/alumno/materiales') 
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {!isCollapsed && <span>Aula Virtual</span>}
              </button>
            </nav>
          </div>
          
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <TopHeader
          user={user}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isDarkMode={isDarkMode}
          handleToggleTheme={handleToggleTheme}
          handleLogout={handleLogout}
          profilePath="/panel/alumno/mi-perfil"
        />

        <main className="flex-1 overflow-y-auto p-4 pt-2 md:px-6 md:pb-6 md:pt-3 lg:px-8 lg:pb-8 lg:pt-4">
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
              <div className="flex flex-col w-full items-center justify-center py-4">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
                <p className="mt-4 text-sm font-bold text-gray-600 dark:text-gray-300">Cerrando sesión...</p>
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