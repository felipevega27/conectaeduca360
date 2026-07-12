import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import autoTable from 'jspdf-autotable';
import { sortCursos } from '../../utils/sortUtils';
import { initSchoolPdf, addPdfFooter } from '../../utils/pdfUtils';
import { useAuth } from '../../context/AuthContext';
import { useProfesorDashboardQuery } from '../../hooks/queries/useProfesorDashboardQuery';
import { SkeletonBase, SkeletonCard, SkeletonRow } from '../../components/SkeletonLoader';

const getDiaHoy = () => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[new Date().getDay()];
};

export default function ProfesorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: dashboardData, isLoading, isError } = useProfesorDashboardQuery(user?.rut);

  const profesorJefe = dashboardData?.profesorJefe || { idCurso: null, curso: 'Sin Jefatura', alumnosRiesgo: 0, avancePlanificacion: 0, alumnos: [], alumnosRiesgoDetalle: [] };
  const clasesHoy = dashboardData?.clasesHoy || [];
  const feriadoHoy = dashboardData?.feriadoHoy || null;
  const misCursos = dashboardData?.misCursos || [];
  
  const alumnosJefatura = profesorJefe.alumnos;
  const alumnosEnRiesgo = profesorJefe.alumnosRiesgoDetalle;

  // Estados para el Modal de Jefatura
  const [isModalJefaturaOpen, setIsModalJefaturaOpen] = useState(false);

  // Estados para Muro de Anuncios (Blog)
  const [anuncios, setAnuncios] = useState([]);
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', contenido: '', id_curso: '' });
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Estados para paginacion (Scroll Infinito) y Skeletons
  const [anunciosPage, setAnunciosPage] = useState(0);
  const [hasMoreAnuncios, setHasMoreAnuncios] = useState(true);
  const [isLoadingAnunciosInitial, setIsLoadingAnunciosInitial] = useState(true);
  const [isLoadingMoreAnuncios, setIsLoadingMoreAnuncios] = useState(false);
  const observer = useRef();
  const PAGE_SIZE = 5;

  const fetchAnuncios = async (rut, page = 0, isInitial = false) => {
    if (isInitial) {
      setIsLoadingAnunciosInitial(true);
    } else {
      setIsLoadingMoreAnuncios(true);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data: anunciosData, error } = await supabase
        .from('anuncios_curso')
        .select('*, cursos(nombre)')
        .eq('rut_profesor', rut)
        .order('fecha_creacion', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (anunciosData) {
        if (isInitial) {
          setAnuncios(anunciosData);
        } else {
          setAnuncios(prev => {
            const newIds = new Set(anunciosData.map(a => a.id));
            const filteredPrev = prev.filter(a => !newIds.has(a.id));
            return [...filteredPrev, ...anunciosData];
          });
        }
        setHasMoreAnuncios(anunciosData.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error cargando avisos:", error);
    } finally {
      setIsLoadingAnunciosInitial(false);
      setIsLoadingMoreAnuncios(false);
    }
  };

  const lastAnuncioElementRef = useCallback(node => {
    if (isLoadingAnunciosInitial || isLoadingMoreAnuncios) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreAnuncios) {
        setAnunciosPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoadingAnunciosInitial, isLoadingMoreAnuncios, hasMoreAnuncios]);

  useEffect(() => {
    if (anunciosPage > 0 && user?.rut) {
      fetchAnuncios(user.rut, anunciosPage, false);
    }
  }, [anunciosPage, user]);

  const generarReporteAsistenciaPDF = async () => {
    if (!profesorJefe.idCurso) return;
    
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generando reporte de asistencia...');
    try {
      // 1. Traer todos los alumnos matriculados
      const { data: matriculas, error: errMat } = await supabase
        .from('matriculas')
        .select('rut_alumno')
        .eq('id_curso', profesorJefe.idCurso);
        
      if (errMat) throw errMat;

      if (!matriculas || matriculas.length === 0) {
        toast.error('No hay alumnos matriculados.', { id: toastId });
        setIsGeneratingPDF(false);
        return;
      }
      
      const ruts = matriculas.map(m => m.rut_alumno);
      const { data: perfiles, error: errPerf } = await supabase
        .from('perfiles')
        .select('rut, nombre')
        .in('rut', ruts);

      if (errPerf) throw errPerf;

      // 2. Traer TODA la asistencia de este curso
      const { data: asistencias, error: errAsis } = await supabase
        .from('asistencia_alumnos')
        .select('rut_alumno, estado')
        .eq('id_curso', profesorJefe.idCurso);
        
      if (errAsis) throw errAsis;
        
      // 3. Procesar datos (contar Presente, Ausente, Atrasado por alumno)
      const resumenAsistencia = {};
      matriculas.forEach(m => {
        const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
        resumenAsistencia[m.rut_alumno] = {
          nombre: perfil?.nombre || 'Desconocido',
          presente: 0,
          ausente: 0,
          atrasado: 0
        };
      });
      
      asistencias?.forEach(asis => {
        if (resumenAsistencia[asis.rut_alumno]) {
          const est = asis.estado.toLowerCase();
          if (est === 'presente') resumenAsistencia[asis.rut_alumno].presente++;
          else if (est === 'ausente') resumenAsistencia[asis.rut_alumno].ausente++;
          else if (est === 'atrasado') resumenAsistencia[asis.rut_alumno].atrasado++;
        }
      });
      
      // Convertir a array y ordenar alfabéticamente
      const rows = Object.values(resumenAsistencia).sort((a, b) => a.nombre.localeCompare(b.nombre));
      const bodyData = rows.map(r => [
        r.nombre, 
        r.presente.toString(), 
        r.ausente.toString(), 
        r.atrasado.toString(),
        `${r.presente + r.ausente + r.atrasado} clases`
      ]);

      // 4. Generar el PDF
      const doc = await initSchoolPdf('COLEGIO CONECTAEDUC', 'Reporte de Asistencia');
      
      let currentY = doc.startY + 10;
      
      // Títulos
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175);
      doc.text(`Reporte de Asistencia: ${profesorJefe.curso}`, 14, currentY);
      
      currentY += 8;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generado el: ${new Date().toLocaleDateString('es-CL')} por ${user?.nombre || 'Profesor'}`, 14, currentY);
      
      currentY += 10;
      // AVISO INTERNO
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38); // Rojo
      doc.text("DOCUMENTO DE USO INTERNO E INFORMATIVO PARA REUNIONES DE APODERADOS.", 14, currentY);
      currentY += 5;
      doc.text("ESTE DOCUMENTO NO CONSTITUYE UN CERTIFICADO OFICIAL DE INASISTENCIA.", 14, currentY);

      currentY += 8;
      autoTable(doc, {
        startY: currentY,
        head: [['Estudiante', 'Presentes', 'Ausentes', 'Atrasados', 'Total Clases Registradas']],
        body: bodyData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 9 }
      });
      
      addPdfFooter(doc);
      
      doc.save(`Reporte_Asistencia_${profesorJefe.curso.replace(/ /g, '_')}.pdf`);
      toast.success('Reporte generado exitosamente.', { id: toastId });
      
    } catch (error) {
      console.error(error);
      toast.error('Error al generar reporte.', { id: toastId });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const redactarConIA = async () => {
    if (!nuevoAnuncio.titulo || !nuevoAnuncio.id_curso) {
      toast.error('Ingresa un título y selecciona un curso primero.');
      return;
    }

    setIsGeneratingAI(true);
    const toastId = toast.loading('Redactando con IA...');

    try {
      let evaluacionesContexto = '';
      const { data: asignaturas } = await supabase
        .from('asignaturas')
        .select('id, nombre')
        .eq('rut_profesor', user.rut)
        .eq('id_curso', nuevoAnuncio.id_curso);
        
      if (asignaturas && asignaturas.length > 0) {
        const asigIds = asignaturas.map(a => a.id);
        const { data: evals } = await supabase
          .from('evaluaciones')
          .select('nombre, fecha')
          .in('id_asignatura', asigIds)
          .gte('fecha', new Date().toISOString()) // Solo futuras
          .order('fecha', { ascending: true })
          .limit(4);

        if (evals && evals.length > 0) {
          evaluacionesContexto = 'Próximas evaluaciones del curso (usa esto si es útil para el aviso):\n' + 
            evals.map(e => `- ${e.nombre} (Fecha: ${new Date(e.fecha).toLocaleDateString('es-CL')})`).join('\n');
        }
      }

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error("No hay API Key configurada para IA.");

      const promptIA = `Eres un asistente pedagógico para profesores.
      Debes redactar un mensaje o recordatorio breve, claro y amable para un "Muro Virtual" que verán los estudiantes y apoderados.
      
      Título o tema del aviso dado por el profesor: "${nuevoAnuncio.titulo}"
      
      ${evaluacionesContexto}
      
      Instrucciones:
      - Escribe solo el cuerpo del mensaje (no incluyas el título ni saludos genéricos muy formales).
      - Mantén un tono motivador y empático.
      - Evita usar terminología técnica excesiva.
      - Sé directo, no uses más de 2 o 3 párrafos cortos.
      - No respondas con "Aquí tienes el mensaje" ni similar, responde SOLO con el contenido redactado.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", 
          messages: [{ role: "user", content: promptIA }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Error al generar texto");
      
      const textoGenerado = data.choices[0].message.content.trim();
      setNuevoAnuncio(prev => ({ ...prev, contenido: textoGenerado }));
      toast.success('Mensaje generado', { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error('Error al generar con IA: ' + error.message, { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePublicarAnuncio = async (e) => {
    e.preventDefault();
    if (!nuevoAnuncio.titulo || !nuevoAnuncio.contenido || !nuevoAnuncio.id_curso) {
      toast.error('Completa todos los campos del anuncio (título, contenido y curso).');
      return;
    }
    setIsPublishing(true);
    const toastId = toast.loading('Publicando anuncio...');
    try {
      const { data, error } = await supabase
        .from('anuncios_curso')
        .insert([{
          rut_profesor: user.rut,
          id_curso: parseInt(nuevoAnuncio.id_curso),
          titulo: nuevoAnuncio.titulo,
          contenido: nuevoAnuncio.contenido
        }])
        .select('*, cursos(nombre)');

      if (error) throw error;

      if (data && data.length > 0) {
        setAnuncios([data[0], ...anuncios]);
        setNuevoAnuncio({ titulo: '', contenido: '', id_curso: '' });
        toast.success('Anuncio publicado con éxito', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al publicar anuncio', { id: toastId });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEliminarAnuncio = async (id) => {
    if (!window.confirm('¿Eliminar este anuncio permanentemente?')) return;
    try {
      const { error } = await supabase.from('anuncios_curso').delete().eq('id', id);
      if (error) throw error;
      setAnuncios(anuncios.filter(a => a.id !== id));
      toast.success('Anuncio eliminado');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar anuncio');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-8 space-y-8">
        <div className="flex flex-col mb-8">
          <SkeletonBase className="h-8 w-64 mb-2" />
          <SkeletonBase className="h-4 w-96" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonBase className="h-32 w-full rounded-2xl" />
              <SkeletonBase className="h-32 w-full rounded-2xl" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </div>
          <div className="space-y-6">
             <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (isError) return <div className="p-8 text-red-500">Error al cargar datos del dashboard.</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" />
      
      {/* CABECERA DINÁMICA */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
            ¡Hola, {user ? user.nombre?.split(' ')[0] : 'Profesor'}!
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Este es tu bloque de clases y tareas pendientes para hoy.</p>
        </div>
        <div className="flex h-9 items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 shadow-sm">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Hoy: {getDiaHoy()} {new Date().getDate()}
          </span>
        </div>
      </div>

      {/* ALERTAS OBLIGATORIAS MINEDUC */}
      {clasesHoy.some(c => !c.leccionarioFirmado && c.estado !== 'Pendiente') && (
        <div className="mb-3 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white text-sm">Firma de Libro Digital pendiente</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Tienes {clasesHoy.filter(c => !c.leccionarioFirmado && c.estado !== 'Pendiente').length} bloque(s) finalizados que requieren registro de leccionario.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/panel/profesor/asistencia', { state: clasesHoy.find(c => !c.leccionarioFirmado && c.estado !== 'Pendiente') })} 
            className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 hover:bg-orange-200 dark:hover:bg-orange-800 px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            Resolver Ahora
          </button>
        </div>
      )}

      {/* RECUADROS DE RESUMEN OPERATIVO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Tu Jefatura */}
        <div 
          onClick={() => {
            if(profesorJefe.curso !== 'Sin Jefatura') setIsModalJefaturaOpen(true);
          }}
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg ${profesorJefe.curso !== 'Sin Jefatura' ? 'cursor-pointer' : ''}`}
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tu Curso Jefatura</p>
            {profesorJefe.curso !== 'Sin Jefatura' && (
               <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white mt-1">{profesorJefe.curso}</h3>
          <div className="mt-4 flex gap-4 text-xs font-semibold">
            <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
              {profesorJefe.alumnosRiesgo} Alumnos en Riesgo S.A.T
            </span>
          </div>
        </div>



        {/* Cobertura Curricular Personal */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avance de Planificación</p>
            <h3 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white mt-1">{profesorJefe.avancePlanificacion}%</h3>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
            <div className={`h-full rounded-full ${profesorJefe.avancePlanificacion >= 50 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${profesorJefe.avancePlanificacion}%`}}></div>
          </div>
        </div>

      </div>

      {/* ALERTAS TEMPRANAS S.A.T */}
      {alumnosEnRiesgo.length > 0 && (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                <span className="text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </span>
                Sistema de Alerta Temprana (S.A.T.)
                <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">{alumnosEnRiesgo.length}</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {alumnosEnRiesgo.map((alumno, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-900/50 shadow-sm relative overflow-hidden flex items-start gap-4">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 font-bold uppercase">
                            {alumno.nombre.charAt(0)}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1">{alumno.nombre}</h4>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">{alumno.motivo}</p>
                            <button className="text-xs text-gray-500 hover:text-blue-600 mt-2 transition-colors font-medium">Ver Ficha →</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* CRONOGRAMA / HORARIO DE HOY */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Horario de Clases de Hoy
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Clases vigentes</span>
        </div>

        <div className="p-6 space-y-4">
          {feriadoHoy ? (
            <div className="flex flex-col items-center justify-center py-8 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800 animate-fade-in-up">
              <span className="text-4xl mb-3 block">🏖️</span>
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">¡Es Feriado!</h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1 capitalize text-center px-4">{feriadoHoy.nombre}</p>
            </div>
          ) : clasesHoy.length > 0 ? clasesHoy.map((clase) => (
            <div 
              key={clase.id} 
              className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                clase.estado === 'En Curso' 
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20 ring-1 ring-blue-500/20' 
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm dark:hover:bg-gray-700/50'
              }`}
            >
              
              {/* Bloque y Hora */}
              <div className="flex items-center gap-4 min-w-37.5">
                <div className={`text-center px-3 py-1.5 rounded-lg font-bold text-xs ${
                  clase.estado === 'En Curso' ? 'bg-blue-600 text-white' :
                  clase.estado === 'Finalizada' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                  'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {clase.bloque}
                </div>
                <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">{clase.hora}</span>
              </div>

              {/* Asignatura y Sala */}
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 dark:text-white text-base">{clase.asignatura}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{clase.curso} • <span className="font-semibold text-gray-700 dark:text-gray-300">{clase.sala}</span></p>
              </div>

              {/* Estado de Firmas Legales */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                
                {/* Botón Pasar Lista / Ver Lista */}
                <button 
                  onClick={() => navigate('/panel/profesor/asistencia', { state: clase })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    clase.leccionarioFirmado 
                    ? 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' 
                    : 'border-blue-600 text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {clase.leccionarioFirmado ? 'Ver Asistencia' : 'Pasar Lista'}
                </button>

                {/* Estatus Leccionario */}
                {clase.leccionarioFirmado ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    Firmado
                  </span>
                ) : (
                  <button 
                    onClick={() => navigate('/panel/profesor/asistencia', { state: clase })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-800 border border-orange-200 dark:border-orange-800/50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Firma Pendiente
                  </button>
                )}
                
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm font-medium">No tienes clases asignadas para el día de hoy.</p>
            </div>
          )}
        </div>
      </div>

      {/* MURO DE RECORDATORIOS (BLOG) */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Formulario de Nuevo Anuncio */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
              Publicar Aviso
            </h2>
          </div>
          <form onSubmit={handlePublicarAnuncio} className="p-5 flex flex-col gap-4 flex-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Destinatario (Curso)</label>
              <select 
                value={nuevoAnuncio.id_curso}
                onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, id_curso: e.target.value})}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium text-gray-800 dark:text-white"
              >
                <option value="">Selecciona un curso...</option>
                {misCursos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Título del Aviso</label>
              <input 
                type="text" 
                maxLength={100}
                placeholder="Ej. Material para la próxima clase..."
                value={nuevoAnuncio.titulo}
                onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium text-gray-800 dark:text-white"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Mensaje</label>
                <button 
                  type="button"
                  onClick={redactarConIA}
                  disabled={isGeneratingAI}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                  title="Usa IA para escribir un mensaje basado en el título"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {isGeneratingAI ? 'Generando...' : 'Redactar con IA'}
                </button>
              </div>
              <textarea 
                rows="4"
                placeholder="Escribe aquí las instrucciones o recordatorios..."
                value={nuevoAnuncio.contenido}
                onChange={(e) => setNuevoAnuncio({...nuevoAnuncio, contenido: e.target.value})}
                className="w-full flex-1 min-h-[100px] px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-medium text-gray-800 dark:text-white"
              />
            </div>
            <button 
              type="submit" 
              disabled={isPublishing}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-[0_2px_10px_-3px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? 'Publicando...' : 'Publicar Anuncio'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>

        {/* Columna Derecha: Feed de Anuncios */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Tus Avisos y Recordatorios
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg font-bold">{anuncios.length} publicados</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/30 dark:bg-gray-900/20">
            {isLoadingAnunciosInitial ? (
              <>
                <SkeletonAnuncio />
                <SkeletonAnuncio />
                <SkeletonAnuncio />
              </>
            ) : anuncios.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 gap-3">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                <p className="text-sm font-medium max-w-sm">Aún no has publicado ningún aviso.<br/>Usa el formulario para enviar mensajes a tus cursos.</p>
              </div>
            ) : (
              anuncios.map((anuncio, index) => {
                const date = new Date(anuncio.fecha_creacion);
                const fechaFormateada = date.toLocaleString('es-CL', { day: '2-digit', month: 'long', hour: '2-digit', minute:'2-digit' });
                
                const cardContent = (
                  <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                    <button 
                      onClick={() => handleEliminarAnuncio(anuncio.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 w-8 h-8 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar aviso"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="flex items-center gap-3 mb-3 pr-10">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm">
                          {anuncio.cursos?.nombre?.substring(0,2).toUpperCase() || 'CU'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{anuncio.titulo}</h4>
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">Para: {anuncio.cursos?.nombre} <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">• {fechaFormateada}</span></p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                      {anuncio.contenido}
                    </div>
                  </div>
                );

                if (anuncios.length === index + 1) {
                  return (
                    <div ref={lastAnuncioElementRef} key={anuncio.id}>
                      {cardContent}
                    </div>
                  );
                } else {
                  return (
                    <div key={anuncio.id}>
                      {cardContent}
                    </div>
                  );
                }
              })
            )}

            {isLoadingMoreAnuncios && (
              <div className="py-4 flex justify-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {!hasMoreAnuncios && anuncios.length > 0 && (
               <div className="text-center py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                 No hay más avisos
               </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL ALUMNOS DE JEFATURA */}
      {isModalJefaturaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalJefaturaOpen(false)}></div>
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-fade-in-up border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Alumnos de {profesorJefe.curso}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total: {alumnosJefatura.length} estudiantes matriculados</p>
              </div>
              <button onClick={() => setIsModalJefaturaOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {alumnosJefatura.map(alumno => (
                  <div key={alumno.rut} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {alumno.avatar_url ? (
                      <img src={alumno.avatar_url} alt={alumno.nombre} className="w-12 h-12 rounded-full object-cover shadow-sm shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        {alumno.nombre.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{alumno.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{alumno.rut}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                       <p className="text-xs text-gray-500 dark:text-gray-400">{alumno.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <button 
                onClick={generarReporteAsistenciaPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg shadow-sm transition-colors"
              >
                {isGeneratingPDF ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                )}
                {isGeneratingPDF ? 'Generando...' : 'Exportar Reporte (PDF)'}
              </button>
              <button 
                onClick={() => setIsModalJefaturaOpen(false)}
                className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Componente visual para los esqueletos de carga de Anuncios
const SkeletonAnuncio = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>
    <div className="pt-2 space-y-2">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
    </div>
  </div>
);