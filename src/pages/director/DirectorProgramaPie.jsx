import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import UserAvatar from '../../components/UserAvatar';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorProgramaPie() {
  const navigate = useNavigate();

  // --- ESTADOS DE PESTAÑAS Y CARGA ---
  const [activeTab, setActiveTab] = useState('pilarA'); 
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingNomina, setIsExportingNomina] = useState(false); // ESTADO PARA EL BOTÓN EXPORTAR

  // --- ESTADOS DE LA BASE DE DATOS ---
  const [estudiantesPie, setEstudiantesPie] = useState([]);
  const [coberturaHoras, setCoberturaHoras] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [kpis, setKpis] = useState({ total: 0, neep: 0, neet: 0, horasPendientes: 0, fudeiPendientes: 0 });

  // --- ESTADOS DEL MODAL ---
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);

  const cargarDatosPie = async () => {
    try {
      setIsLoading(true);

      const { data: pieData } = await supabase.from('pie_estudiantes').select('*');
      const { data: perfilesData } = await supabase.from('perfiles').select('rut, nombre, avatar_url');
      const { data: matriculasData } = await supabase.from('matriculas').select('rut_alumno, id_curso');
      const { data: cursosData } = await supabase.from('cursos').select('id, nombre');
      const { data: horasData } = await supabase.from('pie_horas_curso').select('*');
      const { data: espData } = await supabase.from('perfiles').select('*').eq('rol', 'especialista');
      setEspecialistas(espData || []);
      const { data: sesData } = await supabase.from('pie_sesiones').select('*').order('fecha_sesion', { ascending: false });

      let conteoNeep = 0, conteoNeet = 0, conteoFudei = 0;

      const estudiantesArmados = (pieData || []).map(registro => {
        const perfil = perfilesData?.find(p => p.rut === registro.rut_alumno);
        const matricula = matriculasData?.find(m => m.rut_alumno === registro.rut_alumno);
        const curso = matricula ? cursosData?.find(c => c.id === matricula.id_curso)?.nombre : 'Sin Curso';

        if (registro.tipo_necesidad === 'NEEP') conteoNeep++;
        if (registro.tipo_necesidad === 'NEET') conteoNeet++;
        if (registro.estado_fudei === 'Pendiente' || registro.estado_fudei === 'Vencido') conteoFudei++;

        return {
          id: registro.id,
          rut: registro.rut_alumno,
          nombre: perfil ? perfil.nombre : 'Desconocido',
          curso: curso,
          tipo: registro.tipo_necesidad,
          diagnostico: registro.diagnostico,
          fechaReevaluacion: new Date(registro.fecha_reevaluacion).toLocaleDateString('es-CL'),
          estado: registro.estado_fudei
        };
      });
      setEstudiantesPie(estudiantesArmados);

      // CÁLCULO DE COBERTURA DE HORAS
      let totalPendientes = 0;
      const resumenHoras = {};

      (horasData || []).forEach(h => {
        if (!resumenHoras[h.especialista_tipo]) resumenHoras[h.especialista_tipo] = { requeridas: 0, asignadas: 0 };
        resumenHoras[h.especialista_tipo].requeridas += h.horas_requeridas;
        resumenHoras[h.especialista_tipo].asignadas += h.horas_asignadas;

        const faltan = h.horas_requeridas - h.horas_asignadas;
        if (faltan > 0) totalPendientes += faltan;
      });

      const coberturaArmada = Object.keys(resumenHoras).map(tipo => {
        const req = resumenHoras[tipo].requeridas;
        const asig = resumenHoras[tipo].asignadas;
        return {
          especialista: tipo,
          requeridas: req,
          asignadas: asig,
          pendientes: req - asig,
          porcentaje: req > 0 ? Math.round((asig / req) * 100) : 100
        };
      });
      setCoberturaHoras(coberturaArmada);

      const sesionesArmadas = (sesData || []).map(sesion => {
        const esp = perfilesData?.find(p => p.rut === sesion.rut_especialista);
        const alum = perfilesData?.find(p => p.rut === sesion.rut_alumno);
        return {
          ...sesion,
          nombre_especialista: esp ? esp.nombre : 'Desconocido',
          nombre_alumno: alum ? alum.nombre : 'Desconocido',
          avatar_url_alumno: alum ? alum.avatar_url : null
        };
      });
      setSesiones(sesionesArmadas);

      setKpis({
        total: estudiantesArmados.length,
        neep: conteoNeep,
        neet: conteoNeet,
        horasPendientes: totalPendientes,
        fudeiPendientes: conteoFudei
      });

    } catch (error) {
      console.error('Error al cargar módulo PIE:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosPie();
  }, []);

  const handleVerDetalleAlumno = (rut) => {
    const estudianteEncontrado = estudiantesPie.find(e => e.rut === rut);
    if (estudianteEncontrado) {
      setEstudianteSeleccionado(estudianteEncontrado);
      setIsDetalleModalOpen(true);
    } else {
      toast.error("No se encontró la ficha PIE de este alumno.");
    }
  };

  // --- NUEVA FUNCIÓN: EXPORTAR NÓMINA PIE (ESTÁNDAR MINEDUC) ---
  const handleExportarNomina = async () => {
    setIsExportingNomina(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Nómina PIE');

      // 1. Configurar anchos de columna según el estándar
      worksheet.columns = [
        { key: 'nro', width: 6 },
        { key: 'rut', width: 16 },
        { key: 'nombre', width: 35 },
        { key: 'curso', width: 15 },
        { key: 'tipo_nee', width: 18 },
        { key: 'diagnostico', width: 50 },
        { key: 'fudei', width: 22 }
      ];

      // 2. Crear el Banner de Cabecera Corporativa (Filas 2 a 4)
      worksheet.mergeCells('A2:G4');
      const titleCell = worksheet.getCell('A2');
      titleCell.value = 'NÓMINA DE ESTUDIANTES PROGRAMA DE INTEGRACIÓN ESCOLAR (PIE)\nRegistro Oficial - Consolidado de Necesidades Educativas Especiales';
      titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; // Verde Mineduc/Esmeralda

      // 3. Crear Fila de Encabezados de Tabla (Fila 6)
      const headerRow = worksheet.getRow(6);
      headerRow.height = 25;
      headerRow.values = [
        'N°', 'RUT Estudiante', 'Nombre Completo', 'Curso', 
        'Categoría NEE', 'Diagnóstico Específico', 'Estado Reevaluación (FUDEI)'
      ];

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '374151' } }; // Gris Oscuro
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'medium', color: { argb: 'FF1F2937' } }
        };
      });

      // 4. Llenar los datos de los estudiantes
      estudiantesPie.forEach((estudiante, index) => {
        const row = worksheet.addRow([
          index + 1,
          estudiante.rut,
          estudiante.nombre,
          estudiante.curso,
          estudiante.tipo,
          estudiante.diagnostico,
          estudiante.estado === 'Al Día' ? 'AL DÍA' : `VENCE: ${estudiante.fechaReevaluacion}`
        ]);

        row.height = 20;
        const esFilaPar = index % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          // Alinear a la izquierda solo el nombre y diagnóstico, el resto centrado
          cell.alignment = { vertical: 'middle', horizontal: (colNumber === 3 || colNumber === 6) ? 'left' : 'center' };

          // Zebra striping
          if (esFilaPar) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };

          // Bordes suaves
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };

          // Formato condicional para NEEP y NEET
          if (colNumber === 5) {
            cell.font = { 
              name: 'Segoe UI', size: 10, bold: true, 
              color: { argb: estudiante.tipo === 'NEEP' ? 'FF2563EB' : 'FF9333EA' } // Azul para NEEP, Morado para NEET
            };
          }

          // Formato condicional para el estado FUDEI
          if (colNumber === 7) {
            if (estudiante.estado === 'Al Día') {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } }; // Verde
            } else {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } }; // Rojo
            }
          }
        });
      });

      // Simular un tiempo de carga para la UI
      await new Promise(resolve => setTimeout(resolve, 800));

      // 5. Generar Archivo y Descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fechaHoy = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
      saveAs(blob, `Nomina_Estudiantes_PIE_${fechaHoy}.xlsx`);
      toast.success('Nómina PIE exportada correctamente.');

    } catch (error) {
      console.error('Error al exportar Nómina PIE:', error);
      toast.error('Ocurrió un problema al generar el archivo Excel.');
    } finally {
      setIsExportingNomina(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700'
        }}
      />

      {/* CABECERA */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Programa de Integración Escolar (PIE)</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Control de nómina NEEP/NEET, FUDEI y cobertura de especialistas.</p>
          </div>
        </div>
        
        {/* BOTÓN EXPORTAR NÓMINA CON ESTADO DE CARGA */}
        <button 
          onClick={handleExportarNomina}
          disabled={isExportingNomina || estudiantesPie.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors sm:w-auto w-full disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isExportingNomina ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          )}
          {isExportingNomina ? 'Generando Nómina...' : 'Exportar Nómina Mineduc'}
        </button>
      </div>

      {/* TARJETAS DE KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm relative z-10 hover:z-50">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estudiantes PIE Activos</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{isLoading ? '...' : kpis.total}</h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Matriculados</span>
          </div>
          <div className="mt-3 flex gap-4 text-xs font-medium text-gray-500 relative">
            <span className="group relative flex items-center gap-1 cursor-help hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> {kpis.neep} NEEP
              <div className="absolute top-full left-0 ml-2 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                <strong className="block text-blue-600 dark:text-blue-400 mb-1.5 text-[11px] uppercase tracking-wider">Necesidad Permanente</strong>
                <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">Condiciones para toda la vida (Ej: TEA, Discapacidad Intelectual). Requieren apoyo continuo de especialistas.</p>
              </div>
            </span>
            <span className="group relative flex items-center gap-1 cursor-help hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> {kpis.neet} NEET
              <div className="absolute top-full left-0 ml-2 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                <strong className="block text-purple-600 dark:text-purple-400 mb-1.5 text-[11px] uppercase tracking-wider">Necesidad Transitoria</strong>
                <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">Dificultades superables (Ej: Trastorno del Lenguaje, TDAH). Exigen reevaluación médica anual.</p>
              </div>
            </span>
          </div>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm relative z-10 hover:z-50 ${kpis.horasPendientes > 0 ? 'border-amber-200 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium uppercase ${kpis.horasPendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Déficit Horas Especialistas
            </p>
            <span className="group relative cursor-help">
              <svg className={`w-4 h-4 ${kpis.horasPendientes > 0 ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="absolute top-full right-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                <strong className="block text-amber-600 dark:text-amber-400 mb-1.5 text-[11px] uppercase tracking-wider">Cálculo de Déficit</strong>
                <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">Compara las horas que el Mineduc <strong>exige</strong> según los alumnos matriculados, restando las horas que el colegio realmente <strong>contrató</strong>. Faltan {kpis.horasPendientes} horas para cumplir la ley.</p>
              </div>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className={`text-2xl font-bold ${kpis.horasPendientes > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-800 dark:text-white'}`}>
              {isLoading ? '...' : kpis.horasPendientes} hrs
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Sin cobertura en aulas PIE</p>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm relative z-10 hover:z-50 ${kpis.fudeiPendientes > 0 ? 'border-red-200 bg-red-50/30 dark:border-red-800/50 dark:bg-red-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium uppercase ${kpis.fudeiPendientes > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Alertas FUDEI (Mineduc)
            </p>
            <span className="group relative cursor-help">
              <svg className={`w-4 h-4 ${kpis.fudeiPendientes > 0 ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="absolute top-full right-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                <strong className="block text-red-600 dark:text-red-400 mb-1.5 text-[11px] uppercase tracking-wider">Formulario Único</strong>
                <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">Alumnos cuyas evaluaciones médicas o psicológicas están vencidas o pendientes de subir a la plataforma del Ministerio para justificar su subvención.</p>
              </div>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className={`text-2xl font-bold ${kpis.fudeiPendientes > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
              {isLoading ? '...' : kpis.fudeiPendientes}
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Reevaluaciones pendientes</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm relative z-10 hover:z-50">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">SESIONES REGISTRADAS</p>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{sesiones.length} <span className="text-sm font-medium text-gray-500">históricas</span></h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Libro de atención PIE</p>
        </div>
      </div>

      {/* CONTENEDOR DE LAS PESTAÑAS (3 PILARES) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">

        <div className="border-b border-gray-200 dark:border-gray-700 flex overflow-x-auto hide-scrollbar bg-gray-50/50 dark:bg-gray-800/80">
          <button onClick={() => setActiveTab('pilarA')} className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors border-b-2 relative ${activeTab === 'pilarA' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Alumnos y FUDEI
          </button>
          <button onClick={() => setActiveTab('pilarB')} className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors border-b-2 relative ${activeTab === 'pilarB' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Cobertura de Especialistas
          </button>
          <button onClick={() => setActiveTab('pilarC')} className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors border-b-2 relative ${activeTab === 'pilarC' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Libro de Registro
          </button>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="p-16 flex justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <>
              {/* --- PILAR A: ALUMNOS --- */}
              {activeTab === 'pilarA' && (
                <div className="overflow-x-auto sm:overflow-visible min-h-[350px] pb-10">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="p-5 font-semibold">Alumno / Curso</th>
                        <th className="p-5 font-semibold">Diagnóstico</th>
                        <th className="p-5 font-semibold text-center">Tipo N.E.E.</th>
                        <th className="p-5 font-semibold text-center">Estado FUDEI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {estudiantesPie.length > 0 ? (
                        estudiantesPie.map((est) => (
                          <tr key={est.id} onClick={() => { setEstudianteSeleccionado(est); setIsDetalleModalOpen(true); }} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                            <td className="p-5">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{est.nombre}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{est.curso}</p>
                            </td>
                            <td className="p-5 text-gray-700 dark:text-gray-300">{est.diagnostico}</td>
                            <td className="p-5 text-center">
                              <div className="group relative inline-flex justify-center cursor-help">
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${est.tipo === 'NEEP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'}`}>
                                  {est.tipo}
                                </span>
                                
                                {est.tipo === 'NEEP' ? (
                                  <div className="absolute bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                                    <strong className="block text-blue-600 dark:text-blue-400 mb-1.5 text-[11px] uppercase tracking-wider">Necesidad Permanente</strong>
                                    <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">
                                      Condiciones para toda la vida (Ej: TEA, Discapacidad Intelectual). Requieren apoyo continuo de especialistas.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="absolute bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-64 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                                    <strong className="block text-purple-600 dark:text-purple-400 mb-1.5 text-[11px] uppercase tracking-wider">Necesidad Transitoria</strong>
                                    <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">
                                      Dificultades superables (Ej: Trastorno del Lenguaje, TDAH). Exigen reevaluación médica anual.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-5 text-center">
                              <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase ${est.estado === 'Al Día' ? 'text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-800' : 'text-red-700 bg-red-100 border border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-800 animate-pulse'}`}>
                                {est.estado === 'Al Día' ? 'Al Día' : `Vence: ${est.fechaReevaluacion}`}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" className="p-10 text-center text-gray-500 dark:text-gray-400">No hay estudiantes PIE registrados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* --- PILAR B: ESPECIALISTAS --- */}
              {activeTab === 'pilarB' && (
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="border-r border-gray-200 dark:border-gray-700">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                      <h3 className="font-semibold text-gray-800 dark:text-white">Equipo Especializado (Contratados)</h3>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                      {especialistas.map(esp => (
                        <li key={esp.rut} className="p-5 flex items-center gap-4">
                          <UserAvatar 
                            nombre={esp.nombre} 
                            avatarUrl={esp.avatar_url}
                            className="w-10 h-10 text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-100 dark:bg-emerald-900/30"
                          />
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{esp.nombre}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{esp.titulo_profesional}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 bg-gray-50/50 dark:bg-gray-800/40">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Análisis de Cobertura (Decreto 170)</h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-3 rounded-lg mb-6 flex gap-3">
                       <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">El sistema cruza la nómina de alumnos matriculados (que exigen horas según su diagnóstico) versus la carga horaria que el colegio ha contratado.</p>
                    </div>

                    <div className="space-y-6">
                      {coberturaHoras.length > 0 ? (
                        coberturaHoras.map((cob, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between items-end mb-2">
                              <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{cob.especialista}</h4>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex gap-2">
                                  <span><strong className="text-gray-700 dark:text-gray-300">{cob.requeridas}h</strong> Exigidas</span> |
                                  <span><strong className="text-gray-700 dark:text-gray-300">{cob.asignadas}h</strong> Contratadas</span>
                                </div>
                              </div>
                              <span className={`text-sm font-bold ${cob.porcentaje >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {cob.porcentaje}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden flex">
                              <div className={`h-full transition-all duration-1000 ${cob.porcentaje >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${cob.porcentaje}%` }}></div>
                            </div>
                            {cob.pendientes > 0 && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-bold text-right">Déficit crítico: faltan {cob.pendientes} hrs</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-4">No hay datos de horas registrados en la malla.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- PILAR C: LIBRO DE REGISTRO MEJORADO --- */}
              {activeTab === 'pilarC' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="p-5 font-semibold w-32">Fecha</th>
                        <th className="p-5 font-semibold w-48">Especialista</th>
                        <th className="p-5 font-semibold w-56">Alumno Atendido</th>
                        <th className="p-5 font-semibold text-center w-24">Ver ficha</th>
                        <th className="p-5 font-semibold text-center w-36">Contexto</th>
                        <th className="p-5 font-semibold">Observación y Evolución</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sesiones.map(sesion => (
                        <tr key={sesion.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-5 text-gray-700 dark:text-gray-300 font-medium">{new Date(sesion.fecha_sesion).toLocaleDateString('es-CL')}</td>
                          <td className="p-5 text-gray-800 dark:text-gray-200">{sesion.nombre_especialista}</td>
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <UserAvatar 
                                nombre={sesion.nombre_alumno} 
                                avatarUrl={sesion.avatar_url_alumno}
                                className="w-8 h-8 text-blue-700 dark:text-blue-400 font-bold text-xs bg-blue-100 dark:bg-blue-900/40"
                              />
                              <p className="font-semibold text-gray-800 dark:text-gray-200 leading-tight max-w-[120px] whitespace-normal break-words">{sesion.nombre_alumno}</p>
                            </div>
                          </td>
                          <td className="p-5 text-center">
                            <div className="flex justify-center">
                              <button 
                                onClick={() => handleVerDetalleAlumno(sesion.rut_alumno)}
                                title="Ver ficha clínica"
                                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-[#1e293b]/80 dark:text-blue-400 dark:hover:bg-[#1e293b] transition-colors border border-transparent dark:hover:border-blue-800/50"
                              >
                                <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="p-5 align-middle text-center">
                            <span className="inline-flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 rounded text-[11px] font-semibold tracking-wide leading-none">{sesion.lugar_atencion}</span>
                          </td>
                          <td className="p-5">
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 leading-relaxed shadow-inner whitespace-pre-wrap">{sesion.observacion}</div>
                          </td>

                        </tr>
                      ))}
                      {sesiones.length === 0 && (
                        <tr><td colSpan="6" className="p-10 text-center text-gray-500 dark:text-gray-400">No hay registros de sesiones ingresadas en el libro aún.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- VENTANA MODAL (POP-UP) DETALLE DE ESTUDIANTE --- */}
      {isDetalleModalOpen && estudianteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${estudianteSeleccionado.tipo === 'NEEP' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-purple-500 shadow-purple-500/50'}`}></div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Ficha Clínica Estudiante PIE</h2>
              </div>
              <button onClick={() => setIsDetalleModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Alumno / Curso</p>
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{estudianteSeleccionado.nombre} <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({estudianteSeleccionado.curso})</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">RUT: {estudianteSeleccionado.rut}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tipo de Necesidad</p>
                  <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold ${estudianteSeleccionado.tipo === 'NEEP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'}`}>
                    {estudianteSeleccionado.tipo}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Estado FUDEI</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold uppercase ${estudianteSeleccionado.estado === 'Al Día' ? 'text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-800' : 'text-red-700 bg-red-100 border border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-800 animate-pulse'}`}>
                    {estudianteSeleccionado.estado === 'Al Día' ? 'Al Día' : `Vence: ${estudianteSeleccionado.fechaReevaluacion}`}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Diagnóstico Detallado Médico</p>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {estudianteSeleccionado.diagnostico}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setIsDetalleModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium text-sm transition-colors">
                Cerrar Ficha
              </button>
              <button onClick={() => navigate('/panel/director/alumnos/' + estudianteSeleccionado.rut, { state: { alumnoSeleccionado: estudianteSeleccionado } })} className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-md shadow-blue-600/20">
                Ver Ficha Completa
              </button>
            </div>
          </div>
        </div>
      )}
    </div> 
  );
}