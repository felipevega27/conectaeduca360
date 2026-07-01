import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useReactToPrint } from 'react-to-print';
import CertificadoAlumnoRegular from '../../components/documentos/CertificadoAlumnoRegular';
import CertificadoNotas from '../../components/documentos/CertificadoNotas';

export default function AlumnoDocumentos() {
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [notasData, setNotasData] = useState(null);
  const [configColegio, setConfigColegio] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const certificadoRegularRef = useRef(null);
  const certificadoNotasRef = useRef(null);

  const handlePrintRegular = useReactToPrint({
    contentRef: certificadoRegularRef,
    documentTitle: 'Certificado_Alumno_Regular',
  });

  const handlePrintNotas = useReactToPrint({
    contentRef: certificadoNotasRef,
    documentTitle: 'Certificado_Notas',
  });

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarDatos(user);
    }
  }, []);

  const cargarDatos = async (user) => {
    setIsLoading(true);
    try {
      // 1. Obtener curso del alumno
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('id_curso, cursos(nombre)')
        .eq('rut_alumno', user.rut)
        .maybeSingle();

      setAlumnoInfo({
        rut: user.rut,
        nombre: user.name || user.nombre,
        curso: matricula?.cursos?.nombre || 'Sin curso asignado'
      });

      const { data: config } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      setConfigColegio(config || {});

      // 2. Obtener Calificaciones
      const { data: calificaciones } = await supabase
        .from('notas')
        .select('*')
        .eq('rut_alumno', user.rut);

      // Agrupar calificaciones por asignatura
      if (calificaciones) {
        const asignaturasIds = [...new Set(calificaciones.map(n => n.id_asignatura).filter(Boolean))];
        let asignaturasMap = {};
        if (asignaturasIds.length > 0) {
          const { data: asigData } = await supabase.from('asignaturas').select('id, nombre').in('id', asignaturasIds);
          if (asigData) asigData.forEach(a => asignaturasMap[a.id] = a.nombre);
        }

        const agrupadas = {};
        calificaciones.forEach(nota => {
          if (!agrupadas[nota.id_asignatura]) agrupadas[nota.id_asignatura] = [];
          agrupadas[nota.id_asignatura].push(nota.nota);
        });

        const arrayAsignaturas = Object.keys(agrupadas).map(asigId => {
          const notas = agrupadas[asigId];
          const promedio = notas.reduce((a, b) => a + b, 0) / notas.length;
          return {
            nombre: asignaturasMap[asigId] || 'Asignatura',
            notas: notas,
            promedio: parseFloat(promedio.toFixed(1))
          };
        });

        const sumaPromedios = arrayAsignaturas.reduce((acc, asig) => acc + asig.promedio, 0);
        const promedioGeneral = arrayAsignaturas.length > 0 ? (sumaPromedios / arrayAsignaturas.length) : 0;

        setNotasData({
          asignaturas: arrayAsignaturas,
          promedioGeneral: promedioGeneral
        });
      }

    } catch (error) {
      console.error('Error cargando datos para certificados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const docs = [
    {
      id: 'regular',
      titulo: 'Certificado de Alumno Regular',
      descripcion: 'Documento oficial que acredita que el estudiante se encuentra actualmente matriculado y asistiendo a clases. Válido para trámites legales y beneficios.',
      icon: <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      action: handlePrintRegular,
      color: 'blue'
    },
    {
      id: 'notas',
      titulo: 'Informe de Calificaciones',
      descripcion: 'Resumen oficial de las notas obtenidas hasta la fecha, promedios por asignatura y promedio general. Ideal para postulaciones o seguimiento académico.',
      icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      action: handlePrintNotas,
      color: 'emerald'
    },
    {
      id: 'asistencia',
      titulo: 'Certificado de Asistencia',
      descripcion: 'Documento que detalla el porcentaje actual de asistencia a clases del estudiante durante el año lectivo en curso.',
      icon: <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      action: () => alert('Certificado de Asistencia en desarrollo...'),
      color: 'amber'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Cargando módulo de documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-8 mt-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Trámites y Certificados</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Descarga e imprime tus documentos oficiales al instante, sin filas ni esperas.</p>
      </div>

      {/* GRID DE DOCUMENTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {docs.map(doc => (
          <div key={doc.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all hover:-translate-y-1">
            <div>
              <div className={`w-14 h-14 rounded-2xl bg-${doc.color}-50 dark:bg-${doc.color}-900/20 flex items-center justify-center mb-4`}>
                {doc.icon}
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{doc.titulo}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{doc.descripcion}</p>
            </div>
            
            <button 
              onClick={doc.action}
              className={`mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-${doc.color}-50 text-${doc.color}-700 hover:bg-${doc.color}-100 dark:bg-${doc.color}-900/30 dark:text-${doc.color}-400 dark:hover:bg-${doc.color}-900/50 transition-colors`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Generar PDF
            </button>
          </div>
        ))}
      </div>

      {/* COMPONENTES OCULTOS PARA IMPRESIÓN */}
      <div className="hidden">
        <CertificadoAlumnoRegular 
          ref={certificadoRegularRef} 
          alumno={alumnoInfo}
          fechaEmision={new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
          correlativo={Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
          config={configColegio}
        />
        <CertificadoNotas 
          ref={certificadoNotasRef} 
          alumno={alumnoInfo} 
          notasData={notasData}
          fechaEmision={new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
          correlativo={Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
          config={configColegio}
        />
      </div>

    </div>
  );
}
