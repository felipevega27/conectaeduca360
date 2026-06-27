import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { supabase } from '../../config/supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import logo from '../../assets/logo.png';
import { initSchoolPdf, addPdfFooter } from '../../utils/pdfUtils';
import { useRendimiento } from '../../hooks/useRendimiento';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../../components/SkeletonLoader';

export default function DirectorRendimiento() {
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // --- ESTADOS Y DATOS (Custom Hook) ---
  const { 
    promedioGeneral, 
    cursosEnRiesgo, 
    chartDataBar, 
    chartDataLine, 
    metricasPaes, 
    isLoading, 
    config 
  } = useRendimiento();

  // --- EFECTO DE GRÁFICOS ---
  useEffect(() => {
    let barChart;
    let lineChart;

    const renderCharts = () => {
      if (barChart) barChart.destroy();
      if (lineChart) lineChart.destroy();
      if (Chart.getChart(barChartRef.current)) Chart.getChart(barChartRef.current).destroy();
      if (Chart.getChart(lineChartRef.current)) Chart.getChart(lineChartRef.current).destroy();

      if (!barChartRef.current || !lineChartRef.current || chartDataBar.labels.length === 0) return;

      const isDark = document.documentElement.classList.contains('dark');
      Chart.defaults.color = isDark ? '#D1D5DB' : '#4B5563';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(148, 163, 184, 0.1)';

      const ctxBar = barChartRef.current.getContext('2d');
      barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: chartDataBar.labels,
          datasets: [{
            label: 'Promedio General',
            data: chartDataBar.data,
            backgroundColor: chartDataBar.colors, // Colores dinámicos
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 1, max: 7, grid: { color: gridColor, borderDash: [5, 5] }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false } }
          }
        }
      });

      const ctxLine = lineChartRef.current.getContext('2d');
      lineChart = new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: chartDataLine.labels,
          datasets: [
            { label: 'Comprensión Lectora', data: chartDataLine.lectura, borderColor: '#010694', borderWidth: 3, tension: 0.4, pointBackgroundColor: '#ffffff', pointBorderColor: '#010694', pointBorderWidth: 2, pointRadius: 4 },
            { label: 'Competencia Matemática', data: chartDataLine.matematica, borderColor: '#6d70fc', borderWidth: 3, tension: 0.4, pointBackgroundColor: '#ffffff', pointBorderColor: '#6d70fc', pointBorderWidth: 2, pointRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
          scales: {
            y: { min: 300, max: 1000, grid: { color: gridColor, borderDash: [5, 5] }, border: { display: false } },
            x: { grid: { display: false }, border: { display: false } }
          }
        }
      });
    };

    renderCharts();
    window.addEventListener('themeChanged', renderCharts);

    return () => {
      if (barChart) barChart.destroy();
      if (lineChart) lineChart.destroy();
      window.removeEventListener('themeChanged', renderCharts);
    };
  }, [chartDataBar, chartDataLine]); // El gráfico se redibuja cuando llegan los datos de notas

  // --- GENERACIÓN DE INFORME UTP (PDF) ---
  const generarInformeUTP = async () => {
    const fechaActual = new Date().toLocaleDateString('es-CL');
    const doc = await initSchoolPdf(
      "INFORME DE GESTIÓN EDUCATIVA", 
      `Unidad Técnico Pedagógica (UTP)  |  Fecha de Emisión: ${fechaActual}`, 
      config
    );

    // 1. Contextualización y Resumen
    let startY = 45;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`1. Resumen de Rendimiento Académico Institucional - ${config?.nombre_colegio || 'Colegio ConectaEduc'}`, 14, startY);

    startY += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const textoContexto = "El presente documento detalla el estado actual del rendimiento académico del establecimiento, evidenciando el progreso de los estudiantes y focalizando las áreas que requieren apoyo pedagógico continuo según las orientaciones emanadas del Decreto 67 de Evaluación y Promoción.";
    const splitContexto = doc.splitTextToSize(textoContexto, 180);
    doc.text(splitContexto, 14, startY);
    
    startY += 15;
    doc.setFont("helvetica", "bold");
    doc.text(`Promedio General del Establecimiento: ${promedioGeneral}`, 14, startY);
    doc.text(`Cantidad de Asignaturas en Riesgo Pedagógico: ${cursosEnRiesgo.length}`, 14, startY + 6);

    // 2. Alertas Mineduc (Decreto 67)
    startY += 20;
    doc.setFontSize(14);
    doc.text("2. Alertas de Riesgo de Repitencia (>30% Reprobación)", 14, startY);

    startY += 8;
    if (cursosEnRiesgo.length > 0) {
      const tableData = cursosEnRiesgo.map(c => [c.curso, c.asignatura, c.profesor, c.reprobacion, c.estado]);
      autoTable(doc, {
        startY: startY,
        head: [['Curso', 'Asignatura', 'Docente', '% Reprob.', 'Nivel de Alerta']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          3: { halign: 'center', fontStyle: 'bold' },
          4: { halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] }
        },
        styles: { fontSize: 10, cellPadding: 4 },
        alternateRowStyles: { fillColor: [254, 242, 242] }
      });
      startY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(34, 197, 94); // success green
      doc.text("Excelentes resultados: No se registran cursos con riesgo de reprobación masiva.", 14, startY);
      doc.setTextColor(30, 41, 59);
      startY += 18;
    }

    // 3. Resultados Promedios por Asignatura
    if (chartDataBar.labels.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. Promedios Generales por Asignatura", 14, startY);
      
      const asigData = chartDataBar.labels.map((label, i) => [label, chartDataBar.data[i]]);
      autoTable(doc, {
        startY: startY + 6,
        head: [['Asignatura', 'Promedio Institucional']],
        body: asigData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'center', fontStyle: 'bold' }
        },
        styles: { fontSize: 10, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      startY = doc.lastAutoTable.finalY + 18;
    }

    // 4. Monitoreo PAES
    if (startY > 230) {
      doc.addPage();
      startY = 25;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("4. Monitoreo de Ensayos PAES (4to Medio)", 14, startY);

    startY += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("El último ensayo estandarizado PAES registrado arrojó los siguientes resultados globales:", 14, startY);
    
    startY += 10;
    
    // Cajas visuales para PAES
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY, 85, 20, 2, 2, 'FD');
    doc.roundedRect(105, startY, 85, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(1, 6, 148);
    doc.setFont("helvetica", "bold");
    doc.text("Comprensión Lectora", 18, startY + 7);
    doc.setFontSize(16);
    doc.text(`${metricasPaes.lectura} pts`, 18, startY + 16);

    doc.setFontSize(10);
    doc.setTextColor(109, 112, 252);
    doc.text("Competencia Matemática", 109, startY + 7);
    doc.setFontSize(16);
    doc.text(`${metricasPaes.matematica} pts`, 109, startY + 16);

    // Footer Oficial
    addPdfFooter(doc, `Documento oficial generado por la Unidad Técnico Pedagógica (UTP) - Sistema ${config?.nombre_colegio || 'Colegio ConectaEduc'}`);

    doc.save(`Informe_UTP_${fechaActual.replace(/\//g, '-')}.pdf`);
    toast.success('Informe UTP descargado correctamente.');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Rendimiento Académico</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Análisis global de calificaciones y ensayos (SIMCE/PAES).</p>
        </div>
        <button onClick={generarInformeUTP} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Descargar Informe UTP
        </button>
      </div>

      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">PROMEDIO COLEGIO</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{isLoading ? '...' : promedioGeneral}</h3>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">/ 7.0</span>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/20 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase mb-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            CURSOS EN RIESGO (&gt;30%)
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-red-700 dark:text-red-400">{isLoading ? '...' : cursosEnRiesgo.length}</h3>
            <span className="text-xs font-medium text-red-500 dark:text-red-400/80">Asignaturas críticas</span>
          </div>
        </div>

        {/* KPIs de PAES Simulados (Módulo futuro) */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">PROMEDIO PAES LECTURA</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{metricasPaes.lectura}</h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+40 pts</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">PROMEDIO PAES MATEMÁTICA</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{metricasPaes.matematica}</h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+50 pts</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Gráfico 1: Promedios por asignatura (CONECTADO) */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm flex flex-col">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-6">Promedio General por Asignatura</h2>
          <div className="relative flex-1 min-h-62.5 w-full flex items-center justify-center">
             {isLoading ? (
               <div className="text-sm text-gray-400">Calculando promedios...</div>
            ) : chartDataBar.labels.length > 0 ? (
               <canvas ref={barChartRef}></canvas>
            ) : (
               <div className="text-sm text-gray-400">Aún no hay notas registradas</div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Evolución PAES (ESTÁTICO) */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-6">Evolución Ensayos PAES (4to Medio)</h2>
          <div className="relative h-62.5 w-full">
            <canvas ref={lineChartRef}></canvas>
          </div>
        </div>

      </div>

      {/* TABLA: Alertas Mineduc CONECTADA A BD */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            Alerta de Reprobación (Normativa Mineduc)
          </h2>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cursos con más del 30% de promedios rojos</span>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-medium">Curso</th>
                  <th className="p-4 font-medium">Asignatura</th>
                  <th className="p-4 font-medium">Docente</th>
                  <th className="p-4 font-medium text-center">% Reprobación</th>
                  <th className="p-4 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {cursosEnRiesgo.length > 0 ? (
                  cursosEnRiesgo.map((curso, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4 font-semibold text-gray-800 dark:text-gray-200">{curso.curso}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">{curso.asignatura}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{curso.profesor}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                          curso.estado === 'Crítico' 
                          ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' 
                          : 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50'
                        }`}>
                          {curso.reprobacion}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors">
                          Ver Plan de Apoyo
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No hay cursos en riesgo de reprobación masiva actualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}