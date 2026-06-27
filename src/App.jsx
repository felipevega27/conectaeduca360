import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Páginas
import Login from './auth/Login';
import NotFound from './pages/NotFound';
import DirectorDashboard from './pages/director/DirectorDashboard';
import DirectorAlertasAsistencia from './pages/director/DirectorAlertasAsistencia';
import DirectorFichaAlumno from './pages/director/DirectorFichaAlumno';
import DirectorFichaApoderado from './pages/director/DirectorFichaApoderado';
import DirectorDocentes from './pages/director/DirectorDocentes';
import DirectorFichaDocente from './pages/director/DirectorFichaDocente';
import DirectorRendimiento from './pages/director/DirectorRendimiento';
import DirectorConvivencia from './pages/director/DirectorConvivencia';
import DirectorAlumnos from './pages/director/DirectorAlumnos';
import DirectorCursos from './pages/director/DirectorCursos';
import DirectorProgramaPIE from './pages/director/DirectorProgramaPie';
import DirectorSAT from './pages/director/DirectorSAT';
import DirectorCrearAlumno from './pages/director/DirectorCrearAlumno';
import DirectorCrearDocente from './pages/director/DirectorCrearDocente';
import DirectorUTP from './pages/director/DirectorUTP';
import DirectorDocumentos from './pages/director/DirectorDocumentos';
import DirectorConfiguracion from './pages/director/DirectorConfiguracion';
import ProfesorDashboard from './pages/profesor/ProfesorDashboard';
import ProfesorAsistencia from './pages/profesor/ProfesorAsistencia';
import ProfesorAnotaciones from './pages/profesor/ProfesorAnotaciones';
import ProfesorCalificaciones from './pages/profesor/ProfesorCalificaciones';
import ProfesorTareas from './pages/profesor/ProfesorTareas';
import ProfesorTareasNueva from './pages/profesor/ProfesorTareasNueva';
import ProfesorCopiloto from './pages/profesor/ProfesorCopiloto';
import ProfesorPlanificaciones from './pages/profesor/ProfesorPlanificaciones';
import AlumnoDashboard from './pages/alumno/AlumnoDashboard';
import AlumnoCalificaciones from './pages/alumno/AlumnoCalificaciones';
import AlumnoAsistencia from './pages/alumno/AlumnoAsistencia';
import AlumnoAnotaciones from './pages/alumno/AlumnoAnotaciones';
import AlumnoHorario from './pages/alumno/AlumnoHorario';
import AlumnoMateriales from './pages/alumno/AlumnoMateriales';
import ApoderadoDashboard from './pages/apoderado/ApoderadoDashboard';
import ApoderadoRendimiento from './pages/apoderado/ApoderadoRendimiento';
import ApoderadoAsistencia from './pages/apoderado/ApoderadoAsistencia';

// Módulos Compartidos
import MiPerfil from './pages/shared/MiPerfil';

// Componentes de Seguridad
import PrivateRoute from './components/PrivateRoute';

// Componentes Globales
import ScrollToTopButton from './components/ScrollToTopButton';

// Layouts
import DirectorLayout from './layouts/DirectorLayout';
import ProfesorLayout from './layouts/ProfesorLayout';
import AlumnoLayout from './layouts/AlumnoLayout';
import ApoderadoLayout from './layouts/ApoderadoLayout';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTopButton />
      <Routes>
        <Route path="/" element={<Login />} />

        {/* RUTAS DEL DIRECTOR / SOSTENEDOR / ADMINISTRADOR (Envueltas en su Layout) */}
        <Route element={<PrivateRoute allowedRoles={['director', 'sostenedor', 'administrador']} />}>
          <Route element={<DirectorLayout />}>
            <Route path="/panel/director" element={<DirectorDashboard />} />
            <Route path="/panel/director/mi-perfil" element={<MiPerfil />} />
            <Route path="/panel/director/alertas-asistencia" element={<DirectorAlertasAsistencia />} />
            <Route path="/panel/director/ficha-alumno" element={<DirectorFichaAlumno />} />

            {/* NUEVA RUTA DE GESTIÓN DE CURSOS */}
            <Route path="/panel/director/cursos" element={<DirectorCursos />} />

            {/* NUEVA RUTA DE GESTIÓN DOCENTE */}
            <Route path="/panel/director/docentes" element={<DirectorDocentes />} />

            {/* NUEVA RUTA PARA REGISTRAR DOCENTE */}
            <Route path="/panel/director/docentes/nuevo" element={<DirectorCrearDocente />} />

            {/* NUEVA RUTA EXCLUSIVA PARA LA FICHA DEL DOCENTE */}
            <Route path="/panel/director/ficha-docente" element={<DirectorFichaDocente />} />

            {/* NUEVA RUTA DE RENDIMIENTO */}
            <Route path="/panel/director/rendimiento" element={<DirectorRendimiento />} />

            {/* NUEVA RUTA DE CONVIVENCIA ESCOLAR */}
            <Route path="/panel/director/convivencia" element={<DirectorConvivencia />} />

            {/* NUEVA RUTA DE DIRECTORIO ALUMNOS */}
            <Route path="/panel/director/alumnos" element={<DirectorAlumnos />} />

            {/* NUEVA RUTA PARA CREAR ALUMNO */}
            <Route path="/panel/director/alumnos/crear" element={<DirectorCrearAlumno />} />

            {/* RUTA DINÁMICA PARA LA FICHA DEL ALUMNO Y APODERADO */}
            <Route path="/panel/director/alumnos/:rut" element={<DirectorFichaAlumno />} />
            <Route path="/panel/director/apoderado/:rut" element={<DirectorFichaApoderado />} />

            {/* NUEVA RUTA PARA EL PROGRAMA PIE */}
            <Route path="/panel/director/programa-pie" element={<DirectorProgramaPIE />} />

            {/* NUEVA RUTA PARA S.A.T. (SISTEMA DE ALERTA TEMPRANA) */}
            <Route path="/panel/director/sat" element={<DirectorSAT />} />

            {/* NUEVA RUTA PARA UTP */}
            <Route path="/panel/director/utp" element={<DirectorUTP />} />

            {/* NUEVA RUTA PARA EMISIÓN DE DOCUMENTOS */}
            <Route path="/panel/director/documentos" element={<DirectorDocumentos />} />

            {/* NUEVA RUTA DE CONFIGURACIÓN INSTITUCIONAL */}
            <Route path="/panel/director/configuracion" element={<DirectorConfiguracion />} />
          </Route>
        </Route>

        {/* RUTAS DEL PROFESOR (Envueltas en su Layout) */}
        <Route element={<PrivateRoute allowedRoles={['profesor']} />}>
          <Route element={<ProfesorLayout />}>
            <Route path="/panel/profesor" element={<ProfesorDashboard />} />
            <Route path="/panel/profesor/mi-perfil" element={<MiPerfil />} />
            <Route path="/panel/profesor/asistencia" element={<ProfesorAsistencia />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/profesor/anotaciones" element={<ProfesorAnotaciones />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/profesor/calificaciones" element={<ProfesorCalificaciones />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/profesor/tareas" element={<ProfesorTareas />} />
            <Route path="/panel/profesor/tareas/nueva" element={<ProfesorTareasNueva />} />
            {/* NUEVA RUTA DEL COPILOTO IA AQUÍ */}
            <Route path="/panel/profesor/copiloto" element={<ProfesorCopiloto />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/profesor/planificaciones" element={<ProfesorPlanificaciones />} />
            {/* RUTAS PARA VER PERFILES DESDE EL BUSCADOR (Comparten componente con Director) */}
            <Route path="/panel/profesor/perfil-usuario/:rut" element={<DirectorFichaAlumno />} />
            <Route path="/panel/profesor/ficha-docente" element={<DirectorFichaDocente />} />
          </Route>
        </Route>

        {/* RUTAS DEL ALUMNO/APODERADO */}
        <Route element={<PrivateRoute allowedRoles={['alumno', 'apoderado']} />}>
          <Route element={<AlumnoLayout />}>
            <Route path="/panel/alumno" element={<AlumnoDashboard />} />
            <Route path="/panel/alumno/mi-perfil" element={<MiPerfil />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/alumno/calificaciones" element={<AlumnoCalificaciones />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/alumno/asistencia" element={<AlumnoAsistencia />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/alumno/anotaciones" element={<AlumnoAnotaciones />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/alumno/horario" element={<AlumnoHorario />} />
            {/* NUEVA RUTA AQUÍ */}
            <Route path="/panel/alumno/materiales" element={<AlumnoMateriales />} />
          </Route>
        </Route>

        {/* RUTAS DEL APODERADO */}
        <Route element={<PrivateRoute allowedRoles={['apoderado']} />}>
          <Route element={<ApoderadoLayout />}>
            <Route path="/panel/apoderado" element={<ApoderadoDashboard />} />
            <Route path="/panel/apoderado/mi-perfil" element={<MiPerfil />} />
            <Route path="/panel/apoderado/rendimiento" element={<ApoderadoRendimiento />} />
            <Route path="/panel/apoderado/asistencia" element={<ApoderadoAsistencia />} />
          </Route>
        </Route>

        {/* RUTA CATCH-ALL (Error 404) - Siempre debe ir al final */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;