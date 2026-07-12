import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function ProfesorHorario() {
  const { user } = useAuth();
  const [horario, setHorario] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const bloquesHorarios = [
    { nombre: 'Bloque 1', horario: '08:00 - 09:30' },
    { nombre: 'Recreo', horario: '09:30 - 09:45', isRecreo: true },
    { nombre: 'Bloque 2', horario: '09:45 - 11:15' },
    { nombre: 'Recreo', horario: '11:15 - 11:30', isRecreo: true },
    { nombre: 'Bloque 3', horario: '11:30 - 13:00' },
    { nombre: 'Almuerzo', horario: '13:00 - 14:00', isRecreo: true },
    { nombre: 'Bloque 4', horario: '14:00 - 15:30' }
  ];

  useEffect(() => {
    if (user) {
      cargarHorario(user.rut);
    }
  }, [user]);

  const cargarHorario = async (rutProfesor) => {
    try {
      setIsLoading(true);
      // 1. Obtener asignaturas del profesor
      const { data: asignaturas } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso')
        .eq('rut_profesor', rutProfesor);

      if (!asignaturas || asignaturas.length === 0) {
        setHorario([]);
        setIsLoading(false);
        return;
      }

      const asignaturasIds = asignaturas.map(a => a.id);
      const cursosIds = [...new Set(asignaturas.map(a => a.id_curso))];

      // 2. Obtener horarios de esas asignaturas
      const { data: horariosData } = await supabase
        .from('horarios')
        .select('*')
        .in('id_asignatura', asignaturasIds);

      // 3. Obtener nombres de los cursos
      const { data: cursosData } = await supabase
        .from('cursos')
        .select('id, nombre')
        .in('id', cursosIds);

      // Mapear datos para fácil acceso
      const schedule = [];
      if (horariosData) {
        horariosData.forEach(h => {
          const asig = asignaturas.find(a => a.id === h.id_asignatura);
          const curso = cursosData?.find(c => c.id === asig?.id_curso);
          
          let bloqueNombreMapped = h.bloque;
          if (h.bloque === 'B1') bloqueNombreMapped = 'Bloque 1';
          if (h.bloque === 'B2') bloqueNombreMapped = 'Bloque 2';
          if (h.bloque === 'B3') bloqueNombreMapped = 'Bloque 3';
          if (h.bloque === 'B4') bloqueNombreMapped = 'Bloque 4';

          schedule.push({
            dia: h.dia_semana, // La columna en DB es dia_semana
            bloque: bloqueNombreMapped,
            asignatura: asig ? asig.nombre : 'Desconocida',
            curso: curso ? curso.nombre : 'Curso Desconocido',
            sala: h.sala || 'Sala Estándar'
          });
        });
      }
      
      setHorario(schedule);

    } catch (error) {
      console.error("Error cargando horario:", error);
      toast.error("Error al cargar el horario.");
    } finally {
      setIsLoading(false);
    }
  };

  const getClase = (dia, bloqueNombre) => {
    return horario.find(h => h.dia === dia && h.bloque === bloqueNombre);
  };

  const getRandomColorClass = (asignaturaName) => {
      // Función simple para generar un color consistente basado en el nombre
      const colors = ['bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/30', 
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/30', 
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/30', 
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
                      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'];
      
      let hash = 0;
      for (let i = 0; i < asignaturaName.length; i++) {
          hash = asignaturaName.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
  };

  const exportarHorarioPDF = async () => {
    try {
      const { initSchoolPdf, addPdfFooter } = await import('../../utils/pdfUtils');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = await initSchoolPdf(
        "COLEGIO CONECTAEDUC", 
        "Horario Semanal Profesor"
      );

      let yPos = doc.startY || 80;
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text(`Profesor: ${user?.nombre || user?.rut}`, 14, yPos);
      yPos += 10;

      const tableHeaders = ['Horario', ...dias];
      const tableRows = [];

      bloquesHorarios.forEach(bloque => {
        const row = [`${bloque.nombre}\n${bloque.horario}`];
        if (bloque.isRecreo) {
            row.push({ content: bloque.nombre.toUpperCase(), colSpan: 5, styles: { halign: 'center', fillColor: [240, 240, 240], textColor: [100, 100, 100], fontStyle: 'bold' } });
        } else {
            dias.forEach(dia => {
                const clase = getClase(dia, bloque.nombre);
                if (clase) {
                    row.push(`${clase.asignatura}\n${clase.curso}\n${clase.sala}`);
                } else {
                    row.push('Libre');
                }
            });
        }
        tableRows.push(row);
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: yPos,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 30 }
        },
        margin: { left: 14, right: 14 }
      });

      addPdfFooter(doc);
      doc.save(`Horario_Profesor_${user?.rut}.pdf`);
      toast.success("Horario exportado a PDF correctamente");
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        toast.error("Error al generar el PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando horario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 p-4 sm:p-8">
      <Toaster position="top-right" />
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Mi Horario Semanal
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">
            Distribución de tus clases a lo largo de la semana.
            </p>
        </div>
        <button 
            onClick={exportarHorarioPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Imprimir Horario
        </button>
      </div>

      {/* CALENDARIO GRILLA */}
      {horario.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Aún no tienes un horario asignado</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">Contacta a Dirección o UTP para que registren tu carga horaria en el sistema y puedas ver tu distribución semanal aquí.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-4 font-bold text-gray-600 dark:text-gray-300 w-32 border-b border-r border-gray-200 dark:border-gray-700 text-center">Horario</th>
              {dias.map(dia => (
                <th key={dia} className="px-4 py-4 font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 text-center">
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {bloquesHorarios.map((bloque, index) => (
              <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-700 text-center align-middle whitespace-nowrap">
                  <div className="font-bold text-gray-700 dark:text-gray-300">{bloque.nombre}</div>
                  <div className="text-xs">{bloque.horario}</div>
                </td>
                
                {bloque.isRecreo ? (
                    <td colSpan="5" className="bg-gray-100/50 dark:bg-gray-800/80 px-4 py-2 text-center text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest text-xs border-y border-gray-200 dark:border-gray-700">
                        {bloque.nombre}
                    </td>
                ) : (
                    dias.map(dia => {
                    const clase = getClase(dia, bloque.nombre);
                    return (
                        <td key={`${dia}-${bloque.nombre}`} className="px-2 py-2 border-r border-gray-100 dark:border-gray-700 last:border-0 align-top">
                        {clase ? (
                            <div className={`p-3 rounded-xl border ${getRandomColorClass(clase.asignatura)} h-full flex flex-col justify-between transition-transform hover:scale-[1.02] cursor-pointer shadow-sm`}>
                                <div>
                                    <div className="font-bold text-sm leading-tight mb-1">{clase.asignatura}</div>
                                    <div className="text-xs opacity-90 font-medium">{clase.curso}</div>
                                </div>
                                <div className="text-[10px] mt-2 opacity-75 font-bold uppercase tracking-wider">
                                    {clase.sala}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center p-4">
                                <span className="text-gray-300 dark:text-gray-600 text-xs font-medium">Libre</span>
                            </div>
                        )}
                        </td>
                    );
                    })
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
