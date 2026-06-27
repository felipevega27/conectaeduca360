import { useState, useRef, useEffect } from 'react';
import UserAvatar from './UserAvatar';
import { useNavigate } from 'react-router-dom';
import { menuItems } from '../utils/searchIndex';
import { supabase } from '../config/supabaseClient';
import useNotificaciones from '../hooks/useNotificaciones';

export default function TopHeader({
  user,
  avatarLayout,
  isCollapsed,
  setIsCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isDarkMode,
  handleToggleTheme,
  handleLogout,
  profilePath = '/panel/director/mi-perfil' // Default path
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], menus: [] });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const searchRef = useRef(null);
  const notificationsRef = useRef(null);

  // Roles que pueden ver el buscador
  const userRoleStr = (user?.role || user?.rol || '')?.toLowerCase();
  const canSearch = userRoleStr === 'director' || userRoleStr === 'administrador' || userRoleStr === 'profesor' || userRoleStr === 'docente';

  // Obtener usuarios de la base de datos
  useEffect(() => {
    const fetchUsers = async () => {
      if (!canSearch) return;

      const userRut = user?.rut || user?.id;

      if (userRoleStr === 'director' || userRoleStr === 'administrador') {
        const { data } = await supabase
          .from('perfiles')
          .select('rut, nombre, rol, avatar_url');
        if (data) setDbUsers(data);
      } else if (userRoleStr === 'profesor' || userRoleStr === 'docente') {
        // 1. Cursos donde es jefe
        const { data: cursosJefe } = await supabase.from('cursos').select('id').eq('rut_profesor_jefe', userRut);
        // 2. Cursos donde hace clases
        const { data: asignaturas } = await supabase.from('asignaturas').select('id_curso').eq('rut_profesor', userRut);
        
        const idsCursos = new Set();
        cursosJefe?.forEach(c => idsCursos.add(c.id));
        asignaturas?.forEach(a => idsCursos.add(a.id_curso));

        if (idsCursos.size > 0) {
          // 3. Obtener ruts de alumnos
          const { data: matriculas } = await supabase.from('matriculas').select('rut_alumno').in('id_curso', Array.from(idsCursos));
          
          if (matriculas && matriculas.length > 0) {
            const rutsAlumnos = [...new Set(matriculas.map(m => m.rut_alumno))];
            
            // 4. Obtener perfiles solo de esos alumnos
            const { data: perfilesAlumnos } = await supabase.from('perfiles')
              .select('rut, nombre, rol, avatar_url')
              .in('rut', rutsAlumnos);
            
            if (perfilesAlumnos) setDbUsers(perfilesAlumnos);
          }
        }
      }
    };
    fetchUsers();
  }, [canSearch, user, userRoleStr]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? <strong key={index} className="font-bold text-gray-900 dark:text-white">{part}</strong> : part
    );
  };

  // Usar el hook de notificaciones con el RUT del usuario actual
  const userRut = user?.rut || user?.id;
  const { notificaciones, unreadCount, marcarComoLeida } = useNotificaciones(userRut);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Hace un momento';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours} hr`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  const getNotifIcon = (tipo) => {
    switch (tipo) {
      case 'matricula': return '🧑‍🎓';
      case 'alerta': return '📄';
      case 'urgente': return '🔴';
      case 'mensaje': return '💬';
      default: return 'ℹ️';
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      
      const userRole = (user?.role || user?.rol || '')?.toLowerCase();

      // Filtrar Usuarios desde la BD (dbUsers) 
      // Nota: dbUsers ya está pre-filtrado por rol en el useEffect
      const filteredUsers = dbUsers.filter(u => {
        const userName = (u.nombre || u.name || '').toLowerCase();
        return userName.includes(lowerQuery);
      });

      // Filtrar Menús según el rol de quien busca
      const filteredMenus = menuItems.filter(m => {
        const matchesLabel = m.label.toLowerCase().includes(lowerQuery);
        // Mostrar menús relevantes al rol
        return matchesLabel && (m.role === userRole || userRole === 'director' || userRole === 'administrador');
      });

      setSearchResults({ users: filteredUsers, menus: filteredMenus });
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
      setSearchResults({ users: [], menus: [] });
    }
  };

  const handleSelectResult = (result, type) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    if (type === 'menu') {
      navigate(result.route);
    } else if (type === 'user') {
      const uRol = (result.rol || result.role || '').toLowerCase().trim();
      
      if (userRoleStr === 'director' || userRoleStr === 'administrador') {
         if (uRol.includes('profesor') || uRol.includes('docente')) {
           navigate('/panel/director/ficha-docente', { state: { docenteSeleccionado: { id: result.rut } } });
         } else {
           // Si es alumno, apoderado, o si el rol tiene errores de tipeo en BD:
           // Enviamos por defecto a la ficha del alumno, que consultará todo el expediente.
           navigate(`/panel/director/alumnos/${result.rut}`); 
         }
      } else {
         // Para profesores (y otros) que no tienen una ficha separada aún
         navigate(`/panel/${userRoleStr}/perfil-usuario/${result.rut}`);
      }
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30 transition-colors duration-300">
      
      {/* LEFT: Hamburger & Search */}
      <div className="flex items-center gap-4 flex-1">
        
        {/* Desktop Hamburger */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="hidden lg:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none shrink-0"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile Hamburger */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none shrink-0"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search Bar (Global) - Solo visible para Director y Profesor */}
        {canSearch && (
          <div className="hidden sm:flex max-w-md w-full relative" ref={searchRef}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              onFocus={() => { if(searchQuery.length > 1) setIsDropdownOpen(true); }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-300"
              placeholder="Buscar alumnos, profesores, funciones..."
            />

            {/* Dropdown de Resultados */}
            {isDropdownOpen && (searchResults.users.length > 0 || searchResults.menus.length > 0) && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50 animate-fade-in-up">
                
                {/* Accesos / Menús */}
                {searchResults.menus.length > 0 && (
                  <div className="py-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="px-4 py-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Accesos y Funciones
                    </div>
                    <ul className="flex flex-col">
                      {searchResults.menus.map(menu => (
                        <li 
                          key={menu.id}
                          onClick={() => handleSelectResult(menu, 'menu')}
                          className="px-4 py-2 hover:bg-[#eef2ff] dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="text-[14px] font-medium text-gray-700 dark:text-gray-200 ml-1">
                            {highlightMatch(menu.label, searchQuery)}
                          </span>
                          <div className="bg-[#e8f0fe] dark:bg-blue-900/30 text-[#1967d2] dark:text-blue-400 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide shadow-sm">
                            Ir a Pantalla
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Función auxiliar para renderizar grupos de usuarios */}
                {['alumno', 'profesor', 'apoderado', 'otro'].map(categoria => {
                  let usuariosDeGrupo = [];
                  let tituloGrupo = '';
                  let badgeColor = '';
                  let textColor = '';

                  if (categoria === 'alumno') {
                    usuariosDeGrupo = searchResults.users.filter(u => ['alumno', 'estudiante'].includes((u.rol || u.role || '').toLowerCase().trim()));
                    tituloGrupo = 'Alumnos';
                    badgeColor = 'bg-[#e6f4ea] dark:bg-green-900/30';
                    textColor = 'text-[#1e8e3e] dark:text-green-400';
                  } else if (categoria === 'profesor') {
                    usuariosDeGrupo = searchResults.users.filter(u => ['profesor', 'docente'].includes((u.rol || u.role || '').toLowerCase().trim()));
                    tituloGrupo = 'Profesores';
                    badgeColor = 'bg-amber-50 dark:bg-amber-900/30';
                    textColor = 'text-amber-700 dark:text-amber-400';
                  } else if (categoria === 'apoderado') {
                    usuariosDeGrupo = searchResults.users.filter(u => ['apoderado'].includes((u.rol || u.role || '').toLowerCase().trim()));
                    tituloGrupo = 'Apoderados';
                    badgeColor = 'bg-purple-50 dark:bg-purple-900/30';
                    textColor = 'text-purple-700 dark:text-purple-400';
                  } else {
                    usuariosDeGrupo = searchResults.users.filter(u => !['alumno', 'estudiante', 'profesor', 'docente', 'apoderado'].includes((u.rol || u.role || '').toLowerCase().trim()));
                    tituloGrupo = 'Otros Usuarios';
                    badgeColor = 'bg-gray-100 dark:bg-gray-700';
                    textColor = 'text-gray-600 dark:text-gray-400';
                  }

                  if (usuariosDeGrupo.length === 0) return null;

                  return (
                    <div key={categoria} className="py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div className="px-4 py-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {tituloGrupo}
                      </div>
                      <ul className="flex flex-col">
                        {usuariosDeGrupo.map(u => (
                          <li 
                            key={u.rut}
                            onClick={() => handleSelectResult(u, 'user')}
                            className="px-4 py-2 hover:bg-[#eef2ff] dark:hover:bg-gray-700/80 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              {u.avatar_url || u.avatar ? (
                                <img src={u.avatar_url || u.avatar} alt={u.name || u.nombre} className="h-8 w-8 rounded-full object-cover shadow-sm" />
                              ) : (
                                <div className={`h-8 w-8 rounded-full ${badgeColor} flex items-center justify-center ${textColor} font-bold text-xs shrink-0 shadow-sm uppercase`}>
                                  {(u.name || u.nombre || 'U').charAt(0)}
                                </div>
                              )}
                              <span className="text-[14px] text-gray-700 dark:text-gray-200">
                                {highlightMatch(u.name || u.nombre, searchQuery)}
                              </span>
                            </div>
                            
                            <div className={`${badgeColor} ${textColor} px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase shadow-sm`}>
                              {u.rol || u.role || 'Usuario'}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        
        {/* Theme Toggle */}
        <button
          onClick={handleToggleTheme}
          title="Cambiar Tema"
          className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <div className={`transition-transform duration-500 ${isDarkMode ? 'rotate-180' : 'rotate-0'}`}>
            {isDarkMode ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </div>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            title="Notificaciones"
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition-colors relative focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
                <span className={`absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full ${unreadCount > 0 ? 'bg-red-500 ring-2 ring-white dark:ring-gray-800' : 'hidden'}`}></span>
          </button>

          {/* Notificaciones Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 animate-fade-in-up origin-top-right">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">{unreadCount} Nuevas</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {notificaciones.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p className="text-sm">No tienes notificaciones</p>
                  </div>
                ) : (
                  notificaciones.map((notif) => (
                    <div 
                      key={notif.id} 
                      onClick={() => {
                        if (!notif.leida) marcarComoLeida(notif.id);
                        if (notif.link_destino) navigate(notif.link_destino);
                      }}
                      className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-50 dark:border-gray-700/30 transition-colors flex gap-3 ${!notif.leida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="shrink-0 mt-0.5 text-xl">
                        {getNotifIcon(notif.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.leida ? 'font-bold' : 'font-semibold'} text-gray-800 dark:text-gray-100 truncate`}>{notif.titulo}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.descripcion}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">{formatTimeAgo(notif.fecha_creacion)}</p>
                      </div>
                      {!notif.leida && (
                        <div className="shrink-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-gray-700 text-center">
                <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors w-full p-2">
                  Ver todas las notificaciones
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block"></div>

        {/* User Profile */}
        <div 
          onClick={() => navigate(profilePath)}
          className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"
          title="Ver mi perfil"
        >
          <div className="shrink-0">
            <UserAvatar 
              nombre={user ? (user.name || user.nombre || 'Usuario') : 'Usuario'}
              avatarUrl={avatarLayout}
              className="h-8 w-8 text-sm"
            />
          </div>
          <div className="hidden md:block text-left overflow-hidden max-w-[120px]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user ? (user.name || user.nombre) : 'Usuario'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{user ? user.role : 'Rol'}</p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 ml-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
          title="Cerrar sesión"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>

      </div>
    </header>
  );
}
