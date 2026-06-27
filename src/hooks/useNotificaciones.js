import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

export default function useNotificaciones(userRut) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userRut) return;

    // 1. Carga inicial de notificaciones
    const fetchNotificaciones = async () => {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_rut', userRut)
        .order('fecha_creacion', { ascending: false })
        .limit(50); // Traer las últimas 50

      if (error) {
        console.error('Error cargando notificaciones:', error);
      } else if (data) {
        setNotificaciones(data);
        setUnreadCount(data.filter(n => !n.leida).length);
      }
    };

    fetchNotificaciones();

    // 2. Suscripción en Tiempo Real
    const channel = supabase
      .channel(`notificaciones_channel_${userRut}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_rut=eq.${userRut}`
        },
        (payload) => {
          // Cuando llega una nueva, la agregamos al inicio de la lista
          const nuevaNotif = payload.new;
          setNotificaciones(prev => [nuevaNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_rut=eq.${userRut}`
        },
        (payload) => {
          // Si una notificación se actualiza (por ejemplo, se marca como leída por otro medio)
          setNotificaciones(prev => 
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          );
          // Recalcular no leídas (solo necesitamos hacerlo si cambió el estado `leida`)
          if (payload.old && payload.new && payload.old.leida !== payload.new.leida) {
            setUnreadCount(prev => payload.new.leida ? Math.max(0, prev - 1) : prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRut]);

  // 3. Función para marcar como leída
  const marcarComoLeida = async (id) => {
    // Actualización Optimista (UI responde rápido)
    setNotificaciones(prev => 
      prev.map(n => n.id === id ? { ...n, leida: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Actualización en BD
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando notificación:', error);
      // Podríamos revertir el cambio optimista aquí si falla
    }
  };

  return { notificaciones, unreadCount, marcarComoLeida };
}
