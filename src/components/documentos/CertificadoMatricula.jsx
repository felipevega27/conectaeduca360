import React, { forwardRef } from 'react';
import logo from '../../assets/logo.png';
import firma from '../../assets/timbre_con_firma.png';

const CertificadoMatricula = forwardRef(({ alumno, fechaEmision, correlativo, config }, ref) => {
  if (!alumno) return null;

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
              <p className="text-xs font-mono text-gray-500">Folio N° {correlativo || '002'}</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold uppercase tracking-[0.25em]">Certificado</h2>
            <h3 className="text-xl font-serif uppercase tracking-widest text-gray-700 mt-2">Matrícula Estudiantil</h3>
          </div>

          {/* Cuerpo */}
          <div className="text-justify leading-loose text-lg font-serif mb-10 space-y-6 px-6">
            <p>
              El establecimiento educacional <strong>{config?.nombre_colegio || 'Colegio ConectaEduc'}</strong> certifica y acredita mediante el presente documento
              que el/la estudiante don/doña <strong>{alumno.nombre.toUpperCase()}</strong>, cédula de identidad N° <strong>{alumno.rut}</strong>,
              ha formalizado exitosamente su proceso de matrícula en nuestra institución.
            </p>

            <p>
              En consecuencia, el/la estudiante se encuentra registrado(a) en el Libro Oficial de Matrículas del establecimiento, y ha sido
              asignado(a) para cursar el <strong>{alumno.curso || 'Curso no asignado'}</strong> durante el período lectivo del año <strong>{anioActual}</strong>.
            </p>

            <p>
              Se emite este certificado a solicitud expresa del apoderado(a) titular de la cuenta, para ser presentado donde estime conveniente, ya sea para fines de acreditación estudiantil, cajas de compensación o beneficios estatales.
            </p>
          </div>
        </div>

        {/* Pie y Firma */}
        <div className="mt-auto px-6 pb-6">
          <p className="text-right text-md font-serif italic mb-16">
            Santiago, a {fechaEmision}.
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

CertificadoMatricula.displayName = 'CertificadoMatricula';

export default CertificadoMatricula;
