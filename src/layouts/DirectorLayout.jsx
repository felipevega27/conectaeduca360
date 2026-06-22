import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import logoTexto from '../assets/logo_texto.png';
import UserAvatar from '../components/UserAvatar';

export default function DirectorLayout() {
  const [user, setUser] = useState(null);
  const [avatarLayout, setAvatarLayout] = useState(null);
  
  // Estado para el menú móvil
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estado para colapsar en escritorio
  const [isCollapsed, setIsCollapsed] = useState(false);

  // --- AQUI AGREGAMOS "alumnos" AL ESTADO DE SUBMENÚS ---
  const [openSubmenus, setOpenSubmenus] = useState({
    gestion: false,
    alumnos: false,
    docentes: false, // <-- Agregamos docentes
  });

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Estado para el modo oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      
      // Fetch fresh avatar
      const fetchAvatar = async () => {
        try {
          const { data } = await supabase.from('perfiles').select('avatar_url').eq('rut', parsedUser.rut || parsedUser.id).single();
          if (data && data.avatar_url) {
            setAvatarLayout(data.avatar_url);
          } else if (parsedUser.avatar_url) {
            setAvatarLayout(parsedUser.avatar_url);
          }
        } catch (e) {
          console.error("Error fetching avatar for layout", e);
        }
      };
      fetchAvatar();
    }
  }, []);

  // Efecto para aplicar o quitar la clase dark del HTML
  useEffect(() => {
    console.log("[DirectorLayout] Aplicando efecto de tema. Estado isDarkMode:", isDarkMode);
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      console.log("[DirectorLayout] Clases en <html> resultantes:", document.documentElement.className);
      
      // Disparamos un evento para que los gráficos sepan que deben actualizarse
      window.dispatchEvent(new Event('themeChanged'));
    } catch (error) {
      console.error("[DirectorLayout] Error crítico al cambiar tema:", error);
      alert("Error al intentar aplicar el tema: " + error.message);
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    console.log("[DirectorLayout] Botón de tema presionado.");
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

  const isItemActive = (itemPath) => {
    if (itemPath === '/panel/director') {
      return location.pathname === '/panel/director' || 
             location.pathname.includes('/panel/director/alertas-asistencia') || 
             location.pathname.includes('/panel/director/ficha-alumno');
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

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all duration-300 lg:static lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!isCollapsed && (
            <div className="flex items-center space-x-2 overflow-hidden cursor-pointer" onClick={() => { navigate('/panel/director'); setIsMobileMenuOpen(false); }}>
              <img src={logoTexto} alt="Logo ConectaEduc" className="h-8 w-auto object-contain" />
            </div>
          )}
          
          {/* Hamburguesa para Escritorio */}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:block text-gray-500 hover:text-gray-700 focus:outline-none shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Cerrar menú en móvil */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-gray-600 lg:hidden shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="py-4 flex-1 overflow-y-auto">
          {/* Navigation Section */}
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Principal</h2>
            <nav className="space-y-1">
              
              {/* Dashboard */}
              <button 
                onClick={() => { navigate('/panel/director'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Visión General" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  isItemActive('/panel/director') && !isItemActive('/panel/director/docentes') && !isItemActive('/panel/director/alumnos') ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                {!isCollapsed && <span>Visión General</span>}
              </button>

              <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 ${isCollapsed ? 'hidden' : 'block'}`}>Académico</h2>
              {/* Gestión de Cursos */}
              <button 
                onClick={() => { navigate('/panel/director/cursos'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Gestión de Cursos" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  location.pathname.includes('/panel/director/cursos') 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {!isCollapsed && <span>Gestión de Cursos</span>}
              </button>

              {/* Equipo Docente (Collapsible) */}
              <div className="relative">
                <button 
                  onClick={() => toggleSubmenu('docentes')}
                  title={isCollapsed ? "Equipo Docente" : ""}
                  className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                    openSubmenus.docentes || isItemActive('/panel/director/docentes') ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  {!isCollapsed && <span>Equipo Docente</span>}
                  {!isCollapsed && (
                    <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${openSubmenus.docentes ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
                
                {/* Submenu Docentes */}
                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.docentes ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11'}`}>
                    <button 
                      onClick={() => { navigate('/panel/director/docentes'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Equipo Docente" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${location.pathname === '/panel/director/docentes' ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">ED</span> : <span>Equipo Docente</span>}
                    </button>
                    <button 
                      onClick={() => { navigate('/panel/director/docentes/nuevo'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Registrar Docente" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${location.pathname === '/panel/director/docentes/nuevo' ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">RE</span> : <span>Registrar Docente</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Directorio Alumnos (Collapsible) */}
              <div className="relative">
                <button 
                  onClick={() => toggleSubmenu('alumnos')}
                  title={isCollapsed ? "Directorio Alumnos" : ""}
                  className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                    openSubmenus.alumnos || isItemActive('/panel/director/alumnos') ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                  {!isCollapsed && <span>Directorio Alumnos</span>}
                  {!isCollapsed && (
                    <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${openSubmenus.alumnos ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
                
                {/* Submenu Alumnos */}
                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.alumnos ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11'}`}>
                    <button 
                      onClick={() => { navigate('/panel/director/alumnos'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Lista Completa" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${location.pathname === '/panel/director/alumnos' ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">LI</span> : <span>Lista Alumnos</span>}
                    </button>
                    <button 
                      onClick={() => { navigate('/panel/director/alumnos/crear'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Matricular Alumno" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${location.pathname === '/panel/director/alumnos/crear' ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">MA</span> : <span>Matricular Alumno</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Gestión Académica (Collapsible) */}
              <div className="relative">
                <button 
                  onClick={() => toggleSubmenu('gestion')}
                  title={isCollapsed ? "Gestión Académica" : ""}
                  className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                    openSubmenus.gestion ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                  </svg>
                  {!isCollapsed && <span>Gestión Académica</span>}
                  {!isCollapsed && (
                    <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${openSubmenus.gestion ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
                
                {/* Submenu Gestión*/}
                <div className={`overflow-hidden transition-all duration-300 ${openSubmenus.gestion ? 'max-h-40 mt-1' : 'max-h-0'}`}>
                  <div className={`space-y-1 ${isCollapsed ? 'px-0' : 'pl-11'}`}>
                    <button 
                      onClick={() => { navigate('/panel/director/rendimiento'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Rendimiento" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${isItemActive('/panel/director/rendimiento') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">RE</span> : <span>Rendimiento</span>}
                    </button>
                    <button 
                      onClick={() => { navigate('/panel/director/convivencia'); setIsMobileMenuOpen(false); }}
                      title={isCollapsed ? "Convivencia" : ""}
                      className={`w-full flex items-center py-2 text-sm rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4 text-left block'} ${isItemActive('/panel/director/convivencia') ? 'text-blue-600 font-medium bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isCollapsed ? <span className="font-bold text-xs uppercase">CO</span> : <span>Convivencia</span>}
                    </button>
                  </div>
                </div>
              </div>

              <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 ${isCollapsed ? 'hidden' : 'block'}`}>Especialidades</h2>
              {/* --- Menú Gestión UTP --- */}
              <button 
                onClick={() => { navigate('/panel/director/utp'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Gestión UTP" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  location.pathname.includes('/panel/director/utp') 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {!isCollapsed && <span>Gestión UTP</span>}
              </button>

              {/* --- Menú Programa PIE --- */}
              <button 
                onClick={() => { navigate('/panel/director/programa-pie'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Programa PIE" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  location.pathname.includes('/panel/director/programa-pie') 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {!isCollapsed && <span>Programa PIE</span>}
              </button>

              <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 ${isCollapsed ? 'hidden' : 'block'}`}>Administración</h2>
              {/* --- Menú Emisión de Documentos --- */}
              <button 
                onClick={() => { navigate('/panel/director/documentos'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Emisión Documentos" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  location.pathname.includes('/panel/director/documentos') 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {!isCollapsed && <span>Emisión Documentos</span>}
              </button>

              {/* --- Menú Configuración Institucional --- */}
              <button 
                onClick={() => { navigate('/panel/director/configuracion'); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? "Config. Institucional" : ""}
                className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                  location.pathname.includes('/panel/director/configuracion') 
                    ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {!isCollapsed && <span>Config. Institucional</span>}
              </button>

            </nav>
          </div>
          
          {/* Settings Section (Diseño) */}
          <div className={`mb-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
              <h2 className={`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4 ${isCollapsed ? 'hidden' : 'block'}`}>Configuración</h2>
              <nav className="space-y-1">
                  {/* BOTÓN MI PERFIL */}
                  <button 
                    onClick={() => { navigate('/panel/director/mi-perfil'); setIsMobileMenuOpen(false); }}
                    title={isCollapsed ? "Mi Perfil" : ""}
                    className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'} ${
                      location.pathname.includes('/panel/director/mi-perfil') 
                        ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {!isCollapsed && <span>Mi Perfil</span>}
                  </button>
                  
                  {/* BOTÓN ALTERNAR TEMA OSCURO */}
                  <button 
                    onClick={handleToggleTheme}
                    title={isCollapsed ? "Cambiar Tema" : ""} 
                    className={`w-full flex items-center py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
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

        {/* User Profile */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-auto">
          <div className={`p-4 flex ${isCollapsed ? 'flex-col items-center gap-4' : 'items-center'}`}>
              <div 
                onClick={() => navigate('/panel/director/mi-perfil')}
                className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 -ml-1 rounded-lg transition-colors"
                title="Ver mi perfil"
              >
                <div className="shrink-0">
                  <UserAvatar 
                    nombre={user ? (user.name || user.nombre || 'Director') : 'Director'}
                    avatarUrl={avatarLayout}
                    className="h-8 w-8 text-sm"
                  />
                </div>
                {!isCollapsed && (
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user ? (user.name || user.nombre) : 'Director'}</p>
                    <p className="text-xs text-gray-500 capitalize truncate">{user ? user.role : 'Administrador'}</p>
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
        
        {/* Header móvil */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-30 transition-colors duration-300">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { navigate('/panel/director'); setIsMobileMenuOpen(false); }}>
            <img src={logoTexto} alt="Logo ConectaEduc" className="h-8 w-auto object-contain" />
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
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