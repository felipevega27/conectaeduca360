import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Tiempo de expiración: 8 horas
  const OCHO_HORAS = 8 * 60 * 60 * 1000;

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged') || sessionStorage.getItem('userLogged');
    if (loggedUserJSON) {
      try {
        const parsedUser = JSON.parse(loggedUserJSON);
        
        // Verificamos si expiró (solo para los que no tienen "Recordarme" indefinido, o lo aplicamos a todos)
        if (parsedUser.loginTimestamp && (new Date().getTime() - parsedUser.loginTimestamp > OCHO_HORAS)) {
          logout();
        } else {
          setUser(parsedUser);
        }
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = (usuario, recordar = false) => {
    // 1. Eliminar la clave por seguridad antes de guardar localmente
    const { clave, ...usuarioSeguro } = usuario;
    
    const userToSave = {
      ...usuarioSeguro,
      role: usuarioSeguro.rol || usuarioSeguro.role || 'alumno',
      loginTimestamp: new Date().getTime()
    };
    
    // Si recordar es true, usamos localStorage (persiste tras cerrar el navegador).
    // Si recordar es false, usamos sessionStorage (se borra al cerrar la pestaña).
    if (recordar) {
      localStorage.setItem('userLogged', JSON.stringify(userToSave));
    } else {
      sessionStorage.setItem('userLogged', JSON.stringify(userToSave));
    }
    
    setUser(userToSave);

    // Redirección por rol
    switch (userToSave.role) {
      case 'director': navigate('/panel/director'); break;
      case 'profesor': navigate('/panel/profesor'); break;
      case 'apoderado': navigate('/panel/apoderado'); break;
      case 'alumno': default: navigate('/panel/alumno'); break;
    }
  };

  const logout = () => {
    localStorage.removeItem('userLogged');
    sessionStorage.removeItem('userLogged');
    setUser(null);
    navigate('/', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
