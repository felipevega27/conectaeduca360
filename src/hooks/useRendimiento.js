import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

export function useRendimiento() {
  const [promedioGeneral, setPromedioGeneral] = useState('0.0');
  const [cursosEnRiesgo, setCursosEnRiesgo] = useState([]);
  const [chartDataBar, setChartDataBar] = useState({ labels: [], data: [], colors: [] });
  const [chartDataLine, setChartDataLine] = useState({ labels: [], lectura: [], matematica: [] });
  const [metricasPaes, setMetricasPaes] = useState({ lectura: 0, matematica: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState(null);

  const cargarRendimiento = async () => {
    try {
      setIsLoading(true);

      // 1. Descargamos toda la red académica
      const { data: notas } = await supabase.from('notas').select('*');
      const { data: asignaturas } = await supabase.from('asignaturas').select('*');
      const { data: cursos } = await supabase.from('cursos').select('*');
      const { data: profes } = await supabase.from('perfiles').select('*').eq('rol', 'profesor');

      if (!notas || notas.length === 0) {
        setIsLoading(false);
        return;
      }

      // 2. Calcular Promedio General Histórico
      const sumaTotal = notas.reduce((acc, curr) => acc + Number(curr.nota), 0);
      const promGlobal = (sumaTotal / notas.length).toFixed(1);
      setPromedioGeneral(promGlobal);

      // 3. Agrupar notas por asignatura para sacar estadísticas y alertas
      const asigStats = {}; 
      notas.forEach(n => {
        if(!asigStats[n.id_asignatura]) asigStats[n.id_asignatura] = { total: 0, rojas: 0, suma: 0 };
        asigStats[n.id_asignatura].total++;
        asigStats[n.id_asignatura].suma += Number(n.nota);
        if(Number(n.nota) < 4.0) asigStats[n.id_asignatura].rojas++;
      });

      const alertasRiesgo = [];
      const labelsGrafico = [];
      const datosGrafico = [];
      const coloresGrafico = [];

      // 4. Cruzar los datos para armar la UI
      Object.keys(asigStats).forEach(idAsig => {
        const stat = asigStats[idAsig];
        const objAsig = asignaturas?.find(a => a.id == idAsig);
        const nombreAsig = objAsig ? objAsig.nombre : `Materia ${idAsig}`;
        const objCurso = cursos?.find(c => c.id == objAsig?.id_curso);
        const objProfe = profes?.find(p => p.rut === objAsig?.rut_profesor);

        const promedioMateria = (stat.suma / stat.total).toFixed(1);
        labelsGrafico.push(nombreAsig);
        datosGrafico.push(promedioMateria);
        coloresGrafico.push(Number(promedioMateria) < 4.0 ? '#ef4444' : '#6d70fc');

        const porcentajeRojas = Math.round((stat.rojas / stat.total) * 100);
        if (porcentajeRojas >= 30) {
          alertasRiesgo.push({
            id: idAsig,
            curso: objCurso ? objCurso.nombre : 'Sin Curso Asignado',
            asignatura: nombreAsig,
            profesor: objProfe ? objProfe.nombre : 'Sin Docente',
            reprobacion: `${porcentajeRojas}%`,
            estado: porcentajeRojas > 50 ? 'Crítico' : 'Alerta Media'
          });
        }
      });

      setChartDataBar({ labels: labelsGrafico, data: datosGrafico, colors: coloresGrafico });
      setCursosEnRiesgo(alertasRiesgo);

      // 5. Cargar Ensayos PAES
      const { data: ensayos, error: errPaes } = await supabase.from('ensayos_paes').select('*');
      
      if (!errPaes && ensayos && ensayos.length > 0) {
        const agrupados = {};
        ensayos.forEach(e => {
          if (!agrupados[e.nombre_ensayo]) {
            agrupados[e.nombre_ensayo] = { sumLec: 0, countLec: 0, sumMat: 0, countMat: 0 };
          }
          const eje = e.eje_evaluacion?.toLowerCase() || '';
          if (eje.includes('lectura') || eje.includes('lenguaje')) {
            agrupados[e.nombre_ensayo].sumLec += e.puntaje;
            agrupados[e.nombre_ensayo].countLec++;
          } else if (eje.includes('matemática') || eje.includes('matematica') || eje.includes('mat')) {
            agrupados[e.nombre_ensayo].sumMat += e.puntaje;
            agrupados[e.nombre_ensayo].countMat++;
          }
        });

        const labelsPaes = Object.keys(agrupados).sort();
        const dataLec = labelsPaes.map(l => agrupados[l].countLec > 0 ? Math.round(agrupados[l].sumLec / agrupados[l].countLec) : 0);
        const dataMat = labelsPaes.map(l => agrupados[l].countMat > 0 ? Math.round(agrupados[l].sumMat / agrupados[l].countMat) : 0);

        setChartDataLine({ labels: labelsPaes, lectura: dataLec, matematica: dataMat });

        if (labelsPaes.length > 0) {
          setMetricasPaes({
            lectura: dataLec[dataLec.length - 1] || 0,
            matematica: dataMat[dataMat.length - 1] || 0
          });
        }
      } else {
        setChartDataLine({
          labels: [],
          lectura: [],
          matematica: []
        });
        setMetricasPaes({ lectura: 0, matematica: 0 });
      }

      // 6. Cargar Configuración Institucional
      const { data: configData } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      if (configData) setConfig(configData);

    } catch (error) {
      console.error("Error al calcular rendimiento:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarRendimiento();
  }, []);

  return {
    promedioGeneral,
    cursosEnRiesgo,
    chartDataBar,
    chartDataLine,
    metricasPaes,
    isLoading,
    config
  };
}
