import React, { forwardRef } from 'react';
import logo from '../../assets/logo.png';
import firma from '../../assets/timbre_con_firma.png';

const InformeNotas = forwardRef(({ alumno, notas, fechaEmision, correlativo, config }, ref) => {
  if (!alumno) return null;

  const anioActual = new Date().getFullYear();

  // Calcular promedio general si hay notas
  const promedioGeneral = notas && notas.length > 0
    ? (notas.reduce((acc, curr) => acc + (curr.promedio || 0), 0) / notas.length).toFixed(1)
    : 'N/A';

  return (
    <div ref={ref} className="bg-white text-black p-4 mx-auto" style={{ width: '21.59cm', height: '27.94cm', boxSizing: 'border-box' }}>

      {/* Contenedor principal con borde doble formal */}
      <div className="border-4 border-double border-gray-800 p-6 h-full flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>

        <div>
          {/* Cabecera Oficial Centrada */}
          <div className="flex flex-col items-center mb-6 text-center border-b border-gray-300 pb-4">
            <img src={logo} alt="Logo Colegio" className="w-16 h-16 object-contain mb-2" />
            <h1 className="text-xl font-serif font-bold uppercase tracking-[0.2em] text-gray-900">{config?.nombre_colegio || 'Colegio ConectaEduc'}</h1>
            <p className="text-xs uppercase tracking-widest text-gray-600 mt-1">{config?.resolucion_exenta || 'Resolución Exenta'} — RBD: {config?.rbd || '12345-6'}</p>
            <p className="text-xs uppercase tracking-wider text-gray-500 mt-1">Documento Oficial</p>

            <div className="w-full flex justify-between mt-4">
              <p className="text-xs font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">AÑO LECTIVO {anioActual}</p>
              <p className="text-xs font-mono text-gray-500">Folio N° {correlativo || '003'}</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif font-bold uppercase tracking-[0.2em]">Concentración de Notas</h2>
            <h3 className="text-md font-serif uppercase tracking-widest text-gray-600 mt-2">Informe Parcial de Rendimiento Académico</h3>
          </div>

          {/* Datos del Alumno */}
          <div className="mb-10 border border-gray-800 p-6 rounded-none bg-gray-50 font-serif">
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div><span className="font-bold tracking-wider">ESTUDIANTE:</span> {alumno.nombre.toUpperCase()}</div>
              <div><span className="font-bold tracking-wider">R.U.T:</span> {alumno.rut}</div>
              <div><span className="font-bold tracking-wider">CURSO:</span> {alumno.curso || 'No asignado'}</div>
              <div><span className="font-bold tracking-wider">FECHA EMISIÓN:</span> {fechaEmision}</div>
            </div>
          </div>

          {/* Tabla de Notas */}
          <div className="mb-8">
            <table className="w-full border-collapse border border-gray-800 text-sm text-center font-serif">
              <thead>
                <tr className="bg-gray-200 text-gray-900 border-b-2 border-gray-800">
                  <th className="border border-gray-800 p-3 text-left font-bold tracking-wider uppercase">Asignatura</th>
                  <th className="border border-gray-800 p-3 w-16">N1</th>
                  <th className="border border-gray-800 p-3 w-16">N2</th>
                  <th className="border border-gray-800 p-3 w-16">N3</th>
                  <th className="border border-gray-800 p-3 w-16">N4</th>
                  <th className="border border-gray-800 p-3 w-24 font-bold">PROM</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {notas && notas.length > 0 ? (
                  notas.map((n, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="border border-gray-800 p-3 text-left font-medium uppercase text-xs tracking-wider">{n.asignatura}</td>
                      <td className="border border-gray-800 p-3">{n.n1 || '-'}</td>
                      <td className="border border-gray-800 p-3">{n.n2 || '-'}</td>
                      <td className="border border-gray-800 p-3">{n.n3 || '-'}</td>
                      <td className="border border-gray-800 p-3">{n.n4 || '-'}</td>
                      <td className="border border-gray-800 p-3 font-bold bg-gray-50">{n.promedio || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="border border-gray-800 p-8 text-gray-500 italic text-center">
                      Sin registros de calificaciones para el estudiante en el período actual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Promedio General */}
          {notas && notas.length > 0 && (
            <div className="flex justify-end mb-12">
              <div className="border-2 border-gray-800 p-4 bg-gray-100 text-right min-w-[250px] flex justify-between items-center font-serif">
                <span className="font-bold tracking-wider mr-6 uppercase">Promedio General:</span>
                <span className="text-2xl font-black">{promedioGeneral}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pie y Firma */}
        <div className="mt-auto pt-4">
          <div className="flex justify-around items-end">
            <div className="text-center w-56 relative">
              <div className="h-16 mb-2"></div>
              <div className="border-b-2 border-gray-800 mb-2"></div>
              <p className="font-bold text-sm font-serif uppercase tracking-wider">Profesor(a) Jefe</p>
            </div>
            <div className="text-center w-64 relative pt-16 mt-4">
              {/* Espacio para la firma en imagen */}
              <img src={config?.firma_director_url || firma} alt="Firma y Timbre Director" className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 object-contain opacity-30 z-0 pointer-events-none" onError={(e) => e.target.style.display = 'none'} />

              <div className="border-b-2 border-gray-800 mb-2 relative z-10"></div>
              <p className="font-bold text-sm uppercase tracking-wider relative z-20">{config?.nombre_director || 'Felipe Guzmán Vega'}</p>
              <p className="text-xs font-serif text-gray-600 italic relative z-20">Director(a)</p>
              <p className="text-[10px] font-serif text-gray-500 mt-1 uppercase relative z-20">{config?.nombre_colegio || 'Colegio ConectaEduc'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

InformeNotas.displayName = 'InformeNotas';

export default InformeNotas;
