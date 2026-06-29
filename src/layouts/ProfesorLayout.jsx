import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { mockUsers } from '../utils/mockUsers';
import { supabase } from '../config/supabaseClient';
import logoTexto from '../assets/logo_texto.png';
import logoImg from '../assets/logo.png';
import TopHeader from '../components/TopHeader';
export default function ProfesorLayout() {
  const [user, setUser] = useState(null);
  const [avatarLayout, setAvatarLayout] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState({ libro: false, tareas: false });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isJefe, setIsJefe] = useState(false);

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
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);

      // Fetch fresh avatar and jefatura
      const fetchUserData = async () => {
        try {
          const { data } = await supabase.from('perfiles').select('avatar_url').eq('rut', parsedUser.rut || parsedUser.id).single();
          if (data && data.avatar_url) {
            setAvatarLayout(data.avatar_url);
          } else if (parsedUser.avatar_url) {
            setAvatarLayout(parsedUser.avatar_url);
          }

          // Check jefatura
          const { data: cursoJefatura } = await supabase.from('cursos').select('id').eq('rut_profesor_jefe', parsedUser.rut || parsedUser.id).maybeSingle();
          if (cursoJefatura) {
            setIsJefe(true);
          }
        } catch (e) {
          console.error("Error fetching user data for layout", e);
        }
      };
      fetchUserData();
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
      window.location.href = '/';
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
    <div className="h-screen overflow-hidden flex bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">

      {/* Overlay oscuro para móvil */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* SIDEBAR PROFESOR */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300 lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20 w-64' : 'w-64'}`}>

        {/* Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'lg:justify-center justify-between px-4' : 'justify-between px-4'}`}>
          {/* LOGO COMPLETO: Visible en móvil siempre, o en PC si no está colapsado */}
          <div className={`flex items-center space-x-2 overflow-hidden cursor-pointer ${isCollapsed ? 'lg:hidden' : ''}`} onClick={() => { navigate('/panel/profesor'); setIsMobileMenuOpen(false); }}>
            <img src={logoTexto} alt="Logo ConectaEduc" className="h-10 w-auto object-contain" />
          </div>

          {/* LOGO ICONO: Visible SOLO en PC cuando está colapsado */}
          <div className={`items-center justify-center cursor-pointer ${isCollapsed ? 'hidden lg:flex' : 'hidden'}`} onClick={() => { navigate('/panel/profesor'); setIsMobileMenuOpen(false); }}>
            <img src={logoImg} alt="Logo" className="h-12 w-12 object-contain transition-transform hover:scale-105" />
          </div>

          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-gray-600 lg:hidden shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menú de Navegación */}
        <div className="py-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Panel Docente</h2>
            <nav className="space-y-1.5">

              {/* Inicio / Panel Principal */}
              <button
                onClick={() => { navigate('/panel/profesor'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Panel Principal" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/profesor', true)
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {!isCollapsed && <span>Panel Principal</span>}
              </button>

              <button
                onClick={() => { navigate('/panel/profesor/horario'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Horario Semanal" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/profesor/horario', true)
                  ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {!isCollapsed && <span>Horario Semanal</span>}
              </button>

              {/* Mi Jefatura (Solo si es profesor jefe) */}
              {isJefe && (
                <button
                  onClick={() => { navigate('/panel/profesor/jefatura'); setIsMobileMenuOpen(false); }}
                  title={isCollapsed ? "Mi Curso" : ""}
                  className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/profesor/jefatura', true)
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {!isCollapsed && <span>Mi Curso</span>}
                </button>
              )}

              {/* Libro de Clases (Desplegable) */}
              <div className="relative pt-2">
                <button
                  onClick={() => toggleSubmenu('libro')}
                  title={isCollapsed ? "Libro Digital" : ""}
                  className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${openSubmenus.libro || isItemActive('/panel/profesor/asistencia') || isItemActive('/panel/profesor/calificaciones')
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
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.libro ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11 pr-2'}`}>
                    <button
                      onClick={() => { navigate('/panel/profesor/asistencia'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Pasar Lista" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/asistencia') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">AS</span> : <span>Pasar Asistencia</span>}
                    </button>
                    <button
                      onClick={() => { navigate('/panel/profesor/calificaciones'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Calificaciones" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/calificaciones') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">NO</span> : <span>Calificaciones</span>}
                    </button>
                    <button
                      onClick={() => { navigate('/panel/profesor/anotaciones'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Anotaciones" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/anotaciones') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">AN</span> : <span>Hoja de Vida</span>}
                    </button>
                    <button
                      onClick={() => { navigate('/panel/profesor/leccionario'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Leccionario" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/leccionario') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">LE</span> : <span>Leccionario</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* TAREAS Y EVALUACIONES (Desplegable) */}
              <div className="relative pt-2">
                <button
                  onClick={() => toggleSubmenu('tareas')}
                  title={isCollapsed ? "Tareas y Evaluaciones" : ""}
                  className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${openSubmenus.tareas || isItemActive('/panel/profesor/tareas')
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  {!isCollapsed && <span>Tareas y Evaluaciones</span>}
                  {!isCollapsed && (
                    <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${openSubmenus.tareas ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.tareas ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11 pr-2'}`}>
                    <button
                      onClick={() => { navigate('/panel/profesor/tareas'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Revisar Entregas" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/tareas', true) ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">RE</span> : <span>Revisar Entregas</span>}
                    </button>
                    <button
                      onClick={() => { navigate('/panel/profesor/tareas/nueva'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Diseñar Actividad" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3 text-left'} ${isItemActive('/panel/profesor/tareas/nueva', true) ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">DA</span> : <span>Diseñar Actividad</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* PLANIFICACIONES UTP */}
              <button
                onClick={() => { navigate('/panel/profesor/planificaciones'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Planificaciones" : ""}
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/profesor/planificaciones')
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
                className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${isItemActive('/panel/profesor/copiloto')
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

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <TopHeader
          user={user}
          avatarLayout={avatarLayout}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isDarkMode={isDarkMode}
          handleToggleTheme={handleToggleTheme}
          handleLogout={handleLogout}
          profilePath="/panel/profesor/mi-perfil"
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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