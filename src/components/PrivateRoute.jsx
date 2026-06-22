import { Navigate, Outlet } from 'react-router-dom';

export default function PrivateRoute({ allowedRoles }) {
  // 1. Verificamos si hay un usuario logueado en el almacenamiento local
  const userJSON = localStorage.getItem('userLogged');

  // Si no hay sesión activa, lo pateamos a la pantalla de Login
  if (!userJSON) {
    return <Navigate to="/" replace />;
  }

  const user = JSON.parse(userJSON);

  // 2. Verificamos si el rol del usuario está permitido en esta ruta
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    
    // Si es un usuario válido pero intenta espiar otro panel, lo devolvemos a su casa
    if (user.role === 'director') {
      return <Navigate to="/panel/director" replace />;
    } else if (user.role === 'profesor') {
      return <Navigate to="/panel/profesor" replace />;
    } else if (user.role === 'apoderado') {
      return <Navigate to="/panel/apoderado" replace />;
    } else {
      return <Navigate to="/panel/alumno" replace />;
    }
  }

  // Si pasó todas las pruebas de seguridad, renderizamos los componentes hijos (Outlet)
  return <Outlet />;
}