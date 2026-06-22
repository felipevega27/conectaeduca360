import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';

// --- DICCIONARIO DE REGIONES Y COMUNAS DE CHILE ---
const regionesChile = {
  "Región de Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
  "Región de Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"],
  "Región de Antofagasta": ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"],
  "Región de Atacama": ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"],
  "Región de Coquimbo": ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña", "Illapel", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Río Hurtado", "Canela"],
  "Región de Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "Concón", "Quintero", "Puchuncaví", "Casablanca", "San Antonio", "Quillota", "Los Andes", "La Calera", "San Felipe", "San Esteban", "Rinconada", "Calle Larga", "Llaillay", "Cartagena", "Algarrobo", "El Quisco", "El Tabo", "Santo Domingo", "Papudo", "Petorca", "La Ligua", "Cabildo", "Zapallar", "Limache", "Nogales", "Hijuelas", "Olmué", "Juan Fernández", "Isla de Pascua"],
  "Región Metropolitana": ["Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Santiago", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"],
  "Región de O'Higgins": ["Rancagua", "Machalí", "Graneros", "Doñihue", "Coinco", "Coltauco", "Requínoa", "Olivar", "San Fernando", "Rengo", "Pichilemu", "San Vicente", "Santa Cruz", "Chimbarongo", "Paredones", "Marchigüe", "Litueche", "La Estrella", "Navidad", "Nancagua", "Chépica", "Placilla", "Palmilla", "Peralillo", "Lolol", "Pumanque", "Malloa", "Quinta de Tilcoco", "Las Cabras", "Peumo", "Pichidegua"],
  "Región del Maule": ["Talca", "Curicó", "Linares", "Cauquenes", "Constitución", "Molina", "San Clemente", "San Javier", "Parral", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Rafael", "Curepto", "Teno", "Romeral", "Sagrada Familia", "Rauco", "Hualañé", "Licantén", "Vichuquén", "Empedrado", "Chanco", "Pelluhue", "Colbún", "Retiro", "Longaví", "Villa Alegre", "Yerbas Buenas"],
  "Región de Ñuble": ["Chillán", "Chillán Viejo", "San Carlos", "Bulnes", "Coihueco", "Quillón", "San Ignacio", "El Carmen", "Pinto", "Yungay", "Pemuco", "Quirihue", "Cobquecura", "Coelemu", "Ránquil", "Portezuelo", "Trehuaco", "San Fabián", "Ñiquén", "San Nicolás"],
  "Región del Biobío": ["Concepción", "Talcahuano", "San Pedro de la Paz", "Chiguayante", "Hualpén", "Coronel", "Penco", "Tomé", "Hualqui", "Florida", "Los Ángeles", "Cabrero", "Yumbel", "Laja", "Tucapel", "Mulchén", "Nacimiento", "Negrete", "Santa Bárbara", "Quilaco", "Alto Biobío", "Antuco", "Arauco", "Lota", "Curanilahue", "Lebu", "Los Álamos", "Cañete", "Contulmo", "Tirúa", "Santa Juana"],
  "Región de La Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Angol", "Victoria", "Lautaro", "Curacautín", "Collipulli", "Traiguén", "Nueva Imperial", "Pucón", "Gorbea", "Pitrufquén", "Loncoche", "Toltén", "Freire", "Vilcún", "Cunco", "Carahue", "Cholchol", "Saavedra", "Teodoro Schmidt", "Galvarino", "Perquenco", "Lumaco", "Purén", "Los Sauces", "Renaico", "Ercilla", "Curarrehue", "Melipeuco", "Lonquimay"],
  "Región de Los Ríos": ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli", "La Unión", "Futrono", "Lago Ranco", "Río Bueno"],
  "Región de Los Lagos": ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas", "Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quellón", "Quemchi", "Quinchao", "Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo", "Chaitén", "Futaleufú", "Hualaihué", "Palena"],
  "Región de Aysén": ["Coyhaique", "Lago Verde", "Aysén", "Cisnes", "Guaitecas", "Cochrane", "O'Higgins", "Tortel", "Chile Chico", "Río Ibáñez"],
  "Región de Magallanes": ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio", "Cabo de Hornos", "Antártica", "Porvenir", "Primavera", "Timaukel", "Natales", "Torres del Paine"]
};

export default function DirectorCrearAlumno() {
  const navigate = useNavigate();
  const [cursosDisponibles, setCursosDisponibles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formError, setFormError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  // --- ESTADOS SEPARADOS PARA LA DIRECCIÓN ---
  const [regionSeleccionada, setRegionSeleccionada] = useState('');
  const [comunasDisponibles, setComunasDisponibles] = useState([]);

  const [form, setForm] = useState({
    rut_alumno: '',
    nombre_alumno: '',
    fecha_nacimiento: '',
    // En lugar de direccion_alumno, usamos calle
    calle_numero: '', 
    comuna: '',
    id_curso: '',
    rut_apoderado: '',
    nombre_apoderado: '',
    parentesco: 'Madre',
    telefono: '',
    email_apoderado: '',
    // --- PIE ---
    es_pie: false,
    tipo_necesidad: 'NEET',
    diagnostico: ''
  });

  useEffect(() => {
    const cargarCursos = async () => {
      const { data } = await supabase.from('cursos').select('*').order('nombre');
      setCursosDisponibles(data || []);
    };
    cargarCursos();
  }, []);

  // Lógica cuando el usuario cambia de Región
  const handleRegionChange = (e) => {
    const region = e.target.value;
    setRegionSeleccionada(region);
    setComunasDisponibles(regionesChile[region] || []);
    // Reseteamos la comuna seleccionada
    setForm({ ...form, comuna: '' });
  };

  const formatRUT = (rut) => {
    let valor = rut.replace(/[^0-9kK]/g, '');
    if (valor.length === 0) return '';
    const cuerpo = valor.slice(0, -1);
    const dv = valor.slice(-1).toUpperCase();
    let cuerpoFormateado = '';
    for (let i = cuerpo.length; i > 0; i -= 3) {
      const inicio = Math.max(0, i - 3);
      const segmento = cuerpo.slice(inicio, i);
      cuerpoFormateado = segmento + (cuerpoFormateado ? '.' + cuerpoFormateado : '');
    }
    if (valor.length > 1) {
      return `${cuerpoFormateado}-${dv}`;
    }
    return valor;
  };

  const generarClaveTemporal = (rutFormateado) => {
    const rutLimpio = rutFormateado.replace(/[^0-9kK]/g, '');
    return rutLimpio.substring(0, 4);
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setIsConfirmModalOpen(true);
  };

  const handleMatricular = async () => {
    setIsSaving(true);
    setFormError(null);

    try {
      const claveInicialAlumno = generarClaveTemporal(form.rut_alumno);
      const claveInicialApoderado = generarClaveTemporal(form.rut_apoderado);

      if (!claveInicialAlumno) throw new Error("El RUT del alumno no es válido.");

      // CONSTRUIR DIRECCIÓN COMPLETA (Ej: "Los Leones 123, Providencia, Región Metropolitana")
      let direccionFinal = null;
      if (form.calle_numero && form.comuna && regionSeleccionada) {
        direccionFinal = `${form.calle_numero}, ${form.comuna}, ${regionSeleccionada}`;
      }

      // SUBIR AVATAR SI EXISTE
      let avatarUrl = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${form.rut_alumno}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) throw new Error("Error subiendo foto de perfil: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        avatarUrl = publicUrl;
      }

      // 1. CREAR ALUMNO
      const { error: errAlumno } = await supabase.from('perfiles').insert([{
        rut: form.rut_alumno,
        nombre: form.nombre_alumno,
        rol: 'alumno',
        fecha_nacimiento: form.fecha_nacimiento || null,
        direccion: direccionFinal, // Se guarda como un solo texto en la BD
        clave: claveInicialAlumno,
        avatar_url: avatarUrl 
      }]);
      
      if (errAlumno) {
        if (errAlumno.code === '23505') throw new Error("El RUT del alumno ya existe en el sistema.");
        throw new Error("Error guardando alumno: " + errAlumno.message);
      }

      // 2. CREAR MATRÍCULA
      if (form.id_curso) {
        const { error: errMatricula } = await supabase.from('matriculas').insert([{
          rut_alumno: form.rut_alumno,
          id_curso: parseInt(form.id_curso),
          anio_escolar: new Date().getFullYear()
        }]);
        
        if (errMatricula) throw new Error("Error al asignar el curso: " + errMatricula.message);
      }

      // 3. CREAR APODERADO
      if (form.rut_apoderado) {
        const { data: apodExistente } = await supabase.from('perfiles').select('rut').eq('rut', form.rut_apoderado).maybeSingle();
        
        if (!apodExistente) {
          if (!claveInicialApoderado) throw new Error("El RUT del apoderado no es válido.");
          
          const { error: errApo } = await supabase.from('perfiles').insert([{
            rut: form.rut_apoderado,
            nombre: form.nombre_apoderado,
            rol: 'apoderado',
            clave: claveInicialApoderado,
            email: form.email_apoderado || null 
          }]);

          if (errApo) throw new Error("Error creando al apoderado: " + errApo.message);
        }

        // 4. CREAR RELACIÓN FAMILIAR
        const { error: errRelacion } = await supabase.from('relacion_apoderados').insert([{
          rut_apoderado: form.rut_apoderado,
          rut_alumno: form.rut_alumno,
          parentesco: form.parentesco,
          telefono: form.telefono ? `+56 9 ${form.telefono}` : null
        }]);

        if (errRelacion) throw new Error("Error vinculando a la familia: " + errRelacion.message);
      }

      // 5. REGISTRAR EN PROGRAMA PIE (SI APLICA)
      if (form.es_pie) {
        const { error: errPie } = await supabase.from('pie_estudiantes').insert([{
          rut_alumno: form.rut_alumno,
          tipo_necesidad: form.tipo_necesidad,
          diagnostico: form.diagnostico,
          fecha_reevaluacion: new Date().toISOString(),
          estado_fudei: 'Pendiente'
        }]);

        if (errPie) throw new Error("Error inscribiendo en programa PIE: " + errPie.message);
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      setIsConfirmModalOpen(false);

      setSuccessData({
        alumno: { rut: form.rut_alumno, clave: claveInicialAlumno },
        apoderado: { rut: form.rut_apoderado, clave: claveInicialApoderado }
      });

    } catch (error) {
      console.error(error);
      setFormError(error.message || 'Hubo un error en el proceso.');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCerrarModalExito = () => {
    setSuccessData(null);
    navigate('/panel/director/alumnos');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8 relative">
      
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white border-l-2 border-gray-300 dark:border-gray-600 pl-4 ml-2">
          Matrícula de Incorporación Escolar
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8 max-w-4xl relative z-10">
        <form onSubmit={handleOpenConfirm} className="space-y-8">
          
          {/* SECCIÓN 1: ESTUDIANTE */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
              Antecedentes del Estudiante
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">RUT Alumno</label>
                <input required type="text" placeholder="Ej: 21.234.567-8" value={form.rut_alumno} onChange={(e) => { setForm({...form, rut_alumno: formatRUT(e.target.value)}); setFormError(null); }} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                <input required type="text" placeholder="Ej: Anahis Guzmán" value={form.nombre_alumno} onChange={(e) => setForm({...form, nombre_alumno: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha de Nacimiento</label>
                <input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({...form, fecha_nacimiento: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none scheme-light-dark" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Asignar Curso de Destino</label>
                <select required value={form.id_curso} onChange={(e) => setForm({...form, id_curso: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none">
                  <option value="" disabled className="dark:bg-gray-800">Seleccione un curso...</option>
                  {cursosDisponibles.map(c => (
                    <option key={c.id} value={c.id} className="dark:bg-gray-800">{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* INPUT DE FOTO DE PERFIL */}
              <div className="md:col-span-2 mt-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Foto de Perfil (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setAvatarFile(e.target.files[0])} 
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400" 
                />
              </div>

              {/* BLOQUE DE DIRECCIÓN DINÁMICO */}
              <div className="md:col-span-2 mt-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dirección de Domicilio</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                  
                  {/* Select Región */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Región</label>
                    <select 
                      value={regionSeleccionada} 
                      onChange={handleRegionChange} 
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none"
                    >
                      <option value="" disabled className="dark:bg-gray-800">Seleccione Región</option>
                      {Object.keys(regionesChile).map(region => (
                        <option key={region} value={region} className="dark:bg-gray-800">{region}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Comuna (Depende de Región) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Comuna</label>
                    <select 
                      value={form.comuna} 
                      onChange={(e) => setForm({...form, comuna: e.target.value})} 
                      disabled={!regionSeleccionada}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none disabled:opacity-50"
                    >
                      <option value="" disabled className="dark:bg-gray-800">Seleccione Comuna</option>
                      {comunasDisponibles.map(comuna => (
                        <option key={comuna} value={comuna} className="dark:bg-gray-800">{comuna}</option>
                      ))}
                    </select>
                  </div>

                  {/* Input Calle y Número */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Calle y Número</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Los Leones 1234" 
                      value={form.calle_numero} 
                      onChange={(e) => setForm({...form, calle_numero: e.target.value})} 
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" 
                    />
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* SECCIÓN 2: APODERADO */}
          <div>
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2 mt-8">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Antecedentes del Apoderado Obligatorio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">RUT Apoderado</label>
                <input required type="text" placeholder="Ej: 15.234.567-8" value={form.rut_apoderado} onChange={(e) => { setForm({...form, rut_apoderado: formatRUT(e.target.value)}); setFormError(null); }} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-indigo-500 outline-none" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo del Apoderado</label>
                <input required type="text" placeholder="Ej: Eduardo Guzmán Vega" value={form.nombre_apoderado} onChange={(e) => setForm({...form, nombre_apoderado: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Parentesco Relacional</label>
                <select value={form.parentesco} onChange={(e) => setForm({...form, parentesco: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-indigo-500 outline-none">
                  <option value="Madre" className="dark:bg-gray-800">Madre</option>
                  <option value="Padre" className="dark:bg-gray-800">Padre</option>
                  <option value="Tutor Legal" className="dark:bg-gray-800">Tutor Legal</option>
                  <option value="Abuelo/a" className="dark:bg-gray-800">Abuelo/a</option>
                  <option value="Otro" className="dark:bg-gray-800">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Correo Electrónico (Email)</label>
                <input type="email" placeholder="correo@ejemplo.com" value={form.email_apoderado} onChange={(e) => setForm({...form, email_apoderado: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teléfono Móvil</label>
                <div className="flex">
                  <span className="inline-flex items-center h-11 px-4 whitespace-nowrap text-sm font-medium text-gray-600 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
                    +56 9
                  </span>
                  <input type="text" maxLength="8" placeholder="12345678" value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value.replace(/\D/g, '')})} className="w-full h-11 px-4 rounded-r-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: PROGRAMA DE INTEGRACIÓN ESCOLAR (PIE) */}
          <div>
            <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2 mt-8">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Programa de Integración Escolar (PIE)
            </h3>
            
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-5">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input 
                  type="checkbox" 
                  checked={form.es_pie} 
                  onChange={(e) => setForm({...form, es_pie: e.target.checked})} 
                  className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" 
                />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Inscribir estudiante en el Programa PIE
                </span>
              </label>

              {form.es_pie && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800/50">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo de Necesidad</label>
                    <select value={form.tipo_necesidad} onChange={(e) => setForm({...form, tipo_necesidad: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white focus:border-emerald-500 outline-none">
                      <option value="NEET">NEET (Transitoria)</option>
                      <option value="NEEP">NEEP (Permanente)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Diagnóstico Principal</label>
                    <input required={form.es_pie} type="text" placeholder="Ej: TDAH, TEA, TEL..." value={form.diagnostico} onChange={(e) => setForm({...form, diagnostico: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white focus:border-emerald-500 outline-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MENSAJE DE ERROR NATIVO */}
          {formError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{formError}</p>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 flex justify-center items-center">
              Procesar e Inscribir Matrícula
            </button>
          </div>

        </form>
      </div>

      {/* MODAL CONFIRMAR MATRÍCULA */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Confirmar Matrícula</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">¿Seguro que desea matricular a este estudiante en el sistema?</p>
            
            {isSaving ? (
              <div className="flex w-full items-center justify-center py-2">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  No, cancelar
                </button>
                <button onClick={handleMatricular} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                  Sí, matricular
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL DE ÉXITO Y CREDENCIALES --- */}
      {successData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">¡Matrícula Exitosa!</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              El estudiante y el apoderado han sido registrados. Entrega estas credenciales; el sistema pedirá cambio de clave inicial.
            </p>

            <div className="space-y-3 mb-6">
              {/* Credencial Alumno */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Acceso Alumno</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Usuario: <span className="font-bold">{successData.alumno.rut}</span></p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Clave: <span className="font-bold">{successData.alumno.clave}</span></p>
                </div>
              </div>

              {/* Credencial Apoderado */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Acceso Apoderado</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Usuario: <span className="font-bold">{successData.apoderado.rut}</span></p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Clave: <span className="font-bold">{successData.apoderado.clave}</span></p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCerrarModalExito}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
            >
              Entendido, volver al directorio
            </button>
          </div>
        </div>
      )}

    </div>
  );
}