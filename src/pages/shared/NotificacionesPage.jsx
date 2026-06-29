import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../../components/SkeletonLoader';

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Pagination and filtering states could be added here later

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      fetchNotificaciones(parsedUser.rut);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchNotificaciones = async (rut) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_rut', rut)
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      setNotificaciones(data || []);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      toast.error('Error al cargar el historial de notificaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarcarTodasComoLeidas = async () => {
    if (!user) return;
    try {
      const unreadIds = notificaciones.filter(n => !n.leida).map(n => n.id);
      if (unreadIds.length === 0) return;

      // Optimistic update
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
      toast.success('Todas las notificaciones marcadas como leídas.');

      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .in('id', unreadIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error marcando notificaciones:', error);
      toast.error('Error al actualizar las notificaciones.');
      fetchNotificaciones(user.rut); // Revert on error
    }
  };

  const handleEliminarLeidas = async () => {
    if (!user) return;
    try {
      const leidasIds = notificaciones.filter(n => n.leida).map(n => n.id);
      if (leidasIds.length === 0) {
        toast.error('No hay notificaciones leídas para eliminar.');
        return;
      }

      setNotificaciones(prev => prev.filter(n => !n.leida));
      toast.success('Notificaciones leídas eliminadas.');

      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .in('id', leidasIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error eliminando notificaciones:', error);
      toast.error('Error al eliminar las notificaciones.');
      fetchNotificaciones(user.rut);
    }
  };

  const handleEliminarNotificacion = async (e, id) => {
    e.stopPropagation(); // Evitar que haga clic en la notificación
    try {
      setNotificaciones(prev => prev.filter(n => n.id !== id));
      toast.success('Notificación eliminada.');

      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error eliminando notificación:', error);
      toast.error('Error al eliminar la notificación.');
      fetchNotificaciones(user?.rut);
    }
  };

  const handleClickNotificacion = async (notif) => {
    // Si no está leída, marcarla
    if (!notif.leida) {
      try {
        setNotificaciones(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
        await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('id', notif.id);
      } catch (error) {
        console.error('Error marcando como leída:', error);
      }
    }
    // Navegar si hay link
    if (notif.link_destino) {
      navigate(notif.link_destino);
    }
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

  const unreadCount = notificaciones.filter(n => !n.leida).length;
  const leidasCount = notificaciones.filter(n => n.leida).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando notificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-6 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
        
        {/* CABECERA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-opacity opacity-50"></div>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              Historial de Notificaciones
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Revisa todas las alertas y mensajes importantes.</p>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            {unreadCount > 0 && (
              <button
                onClick={handleMarcarTodasComoLeidas}
                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-xl text-sm font-semibold transition-colors border border-blue-200 dark:border-blue-800/50 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Marcar todas como leídas
              </button>
            )}
            {leidasCount > 0 && (
              <button
                onClick={handleEliminarLeidas}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-xl text-sm font-semibold transition-colors border border-red-200 dark:border-red-800/50 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Limpiar Leídas
              </button>
            )}
          </div>
        </div>

        {/* LISTA DE NOTIFICACIONES */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative z-10">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tus Notificaciones</h3>
               {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-bold px-2 py-0.5 rounded-full text-xs">
                    {unreadCount} sin leer
                  </span>
               )}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notificaciones.length === 0 ? (
                 <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-gray-600">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Todo al día</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">
                        No tienes ninguna notificación en tu historial. Te avisaremos cuando haya novedades.
                    </p>
                 </div>
              ) : (
                notificaciones.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleClickNotificacion(notif)}
                    className={`p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex gap-4 ${!notif.leida ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="shrink-0 mt-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${!notif.leida ? 'bg-white dark:bg-gray-800 shadow-sm border border-blue-100 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-gray-800 border border-transparent'}`}>
                         {getNotifIcon(notif.tipo)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`text-base truncate ${!notif.leida ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-200'}`}>
                            {notif.titulo}
                          </h4>
                          <span className="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                             {formatTimeAgo(notif.fecha_creacion)}
                          </span>
                       </div>
                       
                       <p className={`text-sm ${!notif.leida ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                         {notif.descripcion}
                       </p>

                       {notif.link_destino && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                             Ver detalles
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          </div>
                       )}
                    </div>

                    {!notif.leida ? (
                      <div className="shrink-0 flex items-center justify-center ml-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm shadow-blue-500/40"></div>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => handleEliminarNotificacion(e, notif.id)}
                        className="shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                        title="Eliminar notificación"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
        </div>

      </div>
    </div>
  );
}
