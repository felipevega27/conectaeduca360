import React, { forwardRef } from 'react';
import logo from '../../assets/logo.png';
import firma from '../../assets/timbre_con_firma.png';

const CertificadoNotas = forwardRef(({ alumno, notasData, fechaEmision, correlativo, config }, ref) => {
  if (!alumno || !notasData) return null;

  const anioActual = new Date().getFullYear();

  return (
    <div ref={ref} className="bg-white text-black p-4 mx-auto" style={{ width: '21.59cm', height: '27.94cm', boxSizing: 'border-box' }}>
      {/* Contenedor principal con borde doble formal */}
      <div className="border-4 border-double border-gray-800 p-6 h-full flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>

        <div>
          {/* Cabecera Oficial Centrada */}
          <div className="flex flex-col items-center mb-6 text-center border-b border-gray-300 pb-4">
            <img src={logo} alt="Logo Colegio" className="w-20 h-20 object-contain mb-2" />
            <h1 className="text-xl font-serif font-bold uppercase tracking-[0.2em] text-gray-900">{config?.nombre_colegio || 'Colegio ConectaEduc'}</h1>
            <p className="text-xs uppercase tracking-widest text-gray-600 mt-1">{config?.resolucion_exenta || 'Resolución Exenta'} — RBD: {config?.rbd || '12345-6'}</p>
            <p className="text-xs uppercase tracking-wider text-gray-500">Documento Oficial</p>

            <div className="w-full flex justify-end mt-2">
              <p className="text-xs font-mono text-gray-500">Folio N° {correlativo || '001'}</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif font-bold uppercase tracking-[0.2em]">Informe de Calificaciones Parciales</h2>
            <h3 className="text-lg font-serif uppercase tracking-widest text-gray-700 mt-1">Año Escolar {anioActual}</h3>
          </div>

          {/* Datos del Alumno */}
          <div className="mb-6 border border-gray-300 p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 text-sm font-serif">
              <div><span className="font-bold">Nombre del Alumno:</span> {alumno.nombre.toUpperCase()}</div>
              <div><span className="font-bold">R.U.T.:</span> {alumno.rut}</div>
              <div><span className="font-bold">Curso:</span> {alumno.curso}</div>
              <div><span className="font-bold">Fecha de Emisión:</span> {fechaEmision}</div>
            </div>
          </div>

          {/* Tabla de Notas */}
          <div className="mb-6">
            <table className="w-full text-sm font-serif border-collapse border border-gray-400 text-center">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-400">
                  <th className="border border-gray-400 p-2 text-left">Asignatura</th>
                  <th className="border border-gray-400 p-2">N1</th>
                  <th className="border border-gray-400 p-2">N2</th>
                  <th className="border border-gray-400 p-2">N3</th>
                  <th className="border border-gray-400 p-2">N4</th>
                  <th className="border border-gray-400 p-2">N5</th>
                  <th className="border border-gray-400 p-2 bg-gray-200">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {notasData.asignaturas.map((asig, index) => (
                  <tr key={index} className="border-b border-gray-400">
                    <td className="border border-gray-400 p-2 text-left font-bold">{asig.nombre}</td>
                    {[0, 1, 2, 3, 4].map(i => (
                      <td key={i} className="border border-gray-400 p-2 text-gray-700">
                        {asig.notas[i] ? asig.notas[i].toFixed(1) : '-'}
                      </td>
                    ))}
                    <td className="border border-gray-400 p-2 font-bold bg-gray-100">
                      {asig.promedio > 0 ? asig.promedio.toFixed(1) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Promedio General */}
          <div className="flex justify-end text-lg font-serif">
            <div className="bg-gray-100 border border-gray-400 px-6 py-2">
              <span className="font-bold mr-4">Promedio General:</span>
              <span className="font-black">{notasData.promedioGeneral > 0 ? notasData.promedioGeneral.toFixed(1) : '-'}</span>
            </div>
          </div>

        </div>

        {/* Pie y Firma */}
        <div className="mt-auto px-6 pb-6">
          <p className="text-xs text-justify text-gray-500 font-serif mb-8">
            El presente documento certifica las calificaciones parciales obtenidas por el estudiante a la fecha de emisión. Este documento tiene validez exclusivamente para fines informativos y de seguimiento académico interno o externo.
          </p>

          <div className="flex justify-center mt-8">
            <div className="text-center w-72 relative pt-16">
              {/* Espacio para la firma en imagen */}
              <img src={config?.firma_director_url || firma} alt="Firma y Timbre" className="absolute -top-8 left-1/2 -translate-x-1/2 w-48 h-48 object-contain opacity-30 z-0 pointer-events-none" onError={(e) => e.target.style.display = 'none'} />

              <div className="border-b-2 border-gray-800 mb-2 relative z-10"></div>
              <p className="font-bold text-lg uppercase tracking-wider relative z-20">{config?.nombre_director || 'Felipe Guzmán Vega'}</p>
              <p className="text-sm font-serif text-gray-600 italic relative z-20">Director(a)</p>
              <p className="text-xs font-serif text-gray-500 mt-1 uppercase relative z-20">{config?.nombre_colegio || 'Colegio ConectaEduc'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

CertificadoNotas.displayName = 'CertificadoNotas';

export default CertificadoNotas;
