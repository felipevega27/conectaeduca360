import { supabase } from '../config/supabaseClient';

/**
 * Notifica a un usuario específico por su RUT.
 */
export const notificarUsuario = async (rut_destino, tipo, titulo, descripcion, link_destino = null) => {
    if (!rut_destino) return false;
    try {
        const { error } = await supabase
            .from('notificaciones')
            .insert({
                usuario_rut: rut_destino,
                tipo,
                titulo,
                descripcion,
                link_destino,
                leida: false
            });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error al enviar notificacion:', error);
        return false;
    }
};

/**
 * Notifica a todos los usuarios que tengan alguno de los roles especificados.
 * @param {Array<string>} rolesArray - Ej: ['director']
 */
export const notificarPorRol = async (rolesArray, tipo, titulo, descripcion, link_destino = null) => {
    try {
        const { data: perfiles, error: perfilesError } = await supabase
            .from('perfiles')
            .select('rut')
            .in('rol', rolesArray);

        if (perfilesError) throw perfilesError;
        if (!perfiles || perfiles.length === 0) return false;

        const notificaciones = perfiles.map(p => ({
            usuario_rut: p.rut,
            tipo,
            titulo,
            descripcion,
            link_destino,
            leida: false
        }));

        const { error } = await supabase
            .from('notificaciones')
            .insert(notificaciones);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error al notificar por rol:', error);
        return false;
    }
};

/**
 * Notifica a los alumnos y/o apoderados de un curso específico.
 * @param {number} id_curso - ID del curso
 * @param {Array<string>} rolesTarget - Ej: ['alumno', 'apoderado']
 */
export const notificarCurso = async (id_curso, rolesTarget, tipo, titulo, descripcion, link_destino = null) => {
    try {
        const { data: matriculas, error: matriculasError } = await supabase
            .from('matriculas')
            .select('rut_alumno, rut_apoderado')
            .eq('id_curso', id_curso);

        if (matriculasError) throw matriculasError;
        if (!matriculas || matriculas.length === 0) return false;

        const notificaciones = [];
        const notificarAlumnos = rolesTarget.includes('alumno');
        const notificarApoderados = rolesTarget.includes('apoderado');

        matriculas.forEach(mat => {
            if (notificarAlumnos && mat.rut_alumno) {
                notificaciones.push({
                    usuario_rut: mat.rut_alumno,
                    tipo,
                    titulo,
                    descripcion,
                    link_destino,
                    leida: false
                });
            }
            if (notificarApoderados && mat.rut_apoderado) {
                notificaciones.push({
                    usuario_rut: mat.rut_apoderado,
                    tipo,
                    titulo,
                    descripcion,
                    link_destino,
                    leida: false
                });
            }
        });

        if (notificaciones.length === 0) return false;

        const { error } = await supabase
            .from('notificaciones')
            .insert(notificaciones);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error al notificar curso:', error);
        return false;
    }
};
