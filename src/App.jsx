import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Páginas
import Login from './auth/Login';
const NotFound = lazy(() => import('./pages/NotFound'));
const DirectorDashboard = lazy(() => import('./pages/director/DirectorDashboard'));
const DirectorAlertasAsistencia = lazy(() => import('./pages/director/DirectorAlertasAsistencia'));
const DirectorFichaAlumno = lazy(() => import('./pages/director/DirectorFichaAlumno'));
const DirectorFichaApoderado = lazy(() => import('./pages/director/DirectorFichaApoderado'));
const DirectorDocentes = lazy(() => import('./pages/director/DirectorDocentes'));
const DirectorFichaDocente = lazy(() => import('./pages/director/DirectorFichaDocente'));
const DirectorRendimiento = lazy(() => import('./pages/director/DirectorRendimiento'));
const DirectorConvivencia = lazy(() => import('./pages/director/DirectorConvivencia'));
const DirectorAlumnos = lazy(() => import('./pages/director/DirectorAlumnos'));
const DirectorCursos = lazy(() => import('./pages/director/DirectorCursos'));
const DirectorProgramaPIE = lazy(() => import('./pages/director/DirectorProgramaPie'));
const DirectorSAT = lazy(() => import('./pages/director/DirectorSAT'));
const DirectorCrearAlumno = lazy(() => import('./pages/director/DirectorCrearAlumno'));
const DirectorCrearDocente = lazy(() => import('./pages/director/DirectorCrearDocente'));
const DirectorUTP = lazy(() => import('./pages/director/DirectorUTP'));
const DirectorDocumentos = lazy(() => import('./pages/director/DirectorDocumentos'));
const DirectorConfiguracion = lazy(() => import('./pages/director/DirectorConfiguracion'));
const ProfesorDashboard = lazy(() => import('./pages/profesor/ProfesorDashboard'));
const ProfesorAsistencia = lazy(() => import('./pages/profesor/ProfesorAsistencia'));
const ProfesorAnotaciones = lazy(() => import('./pages/profesor/ProfesorAnotaciones'));
const ProfesorCalificaciones = lazy(() => import('./pages/profesor/ProfesorCalificaciones'));
const ProfesorTareas = lazy(() => import('./pages/profesor/ProfesorTareas'));
const ProfesorTareasNueva = lazy(() => import('./pages/profesor/ProfesorTareasNueva'));
const ProfesorCopiloto = lazy(() => import('./pages/profesor/ProfesorCopiloto'));
const ProfesorPlanificaciones = lazy(() => import('./pages/profesor/ProfesorPlanificaciones'));
const ProfesorJefatura = lazy(() => import('./pages/profesor/ProfesorJefatura'));
const ProfesorLeccionario = lazy(() => import('./pages/profesor/ProfesorLeccionario'));
const ProfesorHorario = lazy(() => import('./pages/profesor/ProfesorHorario'));
const AlumnoDashboard = lazy(() => import('./pages/alumno/AlumnoDashboard'));
const AlumnoCalificaciones = lazy(() => import('./pages/alumno/AlumnoCalificaciones'));
const AlumnoAsistencia = lazy(() => import('./pages/alumno/AlumnoAsistencia'));
const AlumnoAnotaciones = lazy(() => import('./pages/alumno/AlumnoAnotaciones'));
const AlumnoHorario = lazy(() => import('./pages/alumno/AlumnoHorario'));
const AlumnoMateriales = lazy(() => import('./pages/alumno/AlumnoMateriales'));
const AlumnoDocumentos = lazy(() => import('./pages/alumno/AlumnoDocumentos'));
const ApoderadoDashboard = lazy(() => import('./pages/apoderado/ApoderadoDashboard'));
const ApoderadoRendimiento = lazy(() => import('./pages/apoderado/ApoderadoRendimiento'));
const ApoderadoAsistencia = lazy(() => import('./pages/apoderado/ApoderadoAsistencia'));

// Módulos Compartidos
const MiPerfil = lazy(() => import('./pages/shared/MiPerfil'));
const NotificacionesPage = lazy(() => import('./pages/shared/NotificacionesPage'));

// Componentes de Seguridad
import PrivateRoute from './components/PrivateRoute';

// Componentes Globales
import BackdropLoader from './components/BackdropLoader';
import ScrollToTopButton from './components/ScrollToTopButton';

// Layouts
import DirectorLayout from './layouts/DirectorLayout';
import ProfesorLayout from './layouts/ProfesorLayout';
import AlumnoLayout from './layouts/AlumnoLayout';
import ApoderadoLayout from './layouts/ApoderadoLayout';
import { AuthProvider } from './context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <AuthProvider>
        <ScrollToTopButton />
        <Suspense fallback={<BackdropLoader isFullScreen={true} />}>
        <Routes>
          <Route path="/" element={<Login />} />

          {/* RUTAS DEL DIRECTOR / SOSTENEDOR / ADMINISTRADOR (Envueltas en su Layout) */}
          <Route element={<PrivateRoute allowedRoles={['director', 'sostenedor', 'administrador']} />}>
            <Route element={<DirectorLayout />}>
              <Route path="/panel/director" element={<DirectorDashboard />} />
              <Route path="/panel/director/mi-perfil" element={<MiPerfil />} />
              <Route path="/panel/director/notificaciones" element={<NotificacionesPage />} />
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
              <Route path="/panel/profesor/notificaciones" element={<NotificacionesPage />} />
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
              <Route path="/panel/profesor/jefatura" element={<ProfesorJefatura />} />
              <Route path="/panel/profesor/leccionario" element={<ProfesorLeccionario />} />
              <Route path="/panel/profesor/horario" element={<ProfesorHorario />} />
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
              <Route path="/panel/alumno/notificaciones" element={<NotificacionesPage />} />
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
              {/* NUEVA RUTA AQUÍ */}
              <Route path="/panel/alumno/documentos" element={<AlumnoDocumentos />} />
            </Route>
          </Route>

          {/* RUTAS DEL APODERADO */}
          <Route element={<PrivateRoute allowedRoles={['apoderado']} />}>
            <Route element={<ApoderadoLayout />}>
              <Route path="/panel/apoderado" element={<ApoderadoDashboard />} />
              <Route path="/panel/apoderado/mi-perfil" element={<MiPerfil />} />
              <Route path="/panel/apoderado/notificaciones" element={<NotificacionesPage />} />
              <Route path="/panel/apoderado/rendimiento" element={<ApoderadoRendimiento />} />
              <Route path="/panel/apoderado/asistencia" element={<ApoderadoAsistencia />} />
            </Route>
          </Route>

          {/* RUTA CATCH-ALL (Error 404) - Siempre debe ir al final */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
    <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;