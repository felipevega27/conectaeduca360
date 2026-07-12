import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Si no hay usuario logueado, lo pateamos a la pantalla de Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

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