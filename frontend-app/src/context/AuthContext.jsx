/**
 * AuthContext.jsx — Contexto global de autenticación.
 *
 * Maneja el estado del usuario autenticado (token + datos) y el cierre
 * automático de sesión por inactividad.
 *
 * Funcionamiento del timeout de sesión:
 *   - Al hacer login se inicia un temporizador de SESSION_DURATION_MINUTES
 *   - Cualquier actividad del usuario (click, teclado, scroll, touch) reinicia el timer
 *   - Si el timer llega a cero sin actividad → logout automático
 *   - Además, cada 5 min de actividad se llama /auth/refresh para renovar el JWT
 */

import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';

export const AuthContext = createContext();

// URL base del auth-api
const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001';

// Tiempo de inactividad antes de cerrar sesión (en ms) — debe coincidir con SESSION_DURATION_MINUTES del backend
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

// Mínimo tiempo entre llamadas a /auth/refresh para no saturar el backend
const REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Timer de inactividad — se reinicia con cada actividad del usuario
  const inactivityTimer = useRef(null);

  // Timestamp del último refresh al backend
  const ultimoRefresh = useRef(0);

  /**
   * Cierra la sesión y limpia todo el estado.
   * Llamado manualmente (botón logout) o por el timer de inactividad.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    setToken(null);
    setUser(null);
    ultimoRefresh.current = 0;
    // Limpiar el timer al hacer logout
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  /**
   * Reinicia el temporizador de inactividad.
   * Se llama cada vez que el usuario hace algo en la web.
   * Cuando el timer expira sin que se reinicie, llama a logout.
   */
  const reiniciarTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      console.log('⏱️ Sesión cerrada por inactividad');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  /**
   * Llama a /auth/refresh para renovar el JWT en el backend.
   * Con throttle de 5 min para no hacer demasiadas llamadas.
   */
  const renovarToken = useCallback(async (tokenActual) => {
    try {
      const res = await fetch(`${AUTH_API}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenActual}` },
      });

      if (res.status === 401) {
        // El backend también detectó que el token expiró
        logout();
        return;
      }

      if (res.ok) {
        const { token: nuevoToken } = await res.json();
        localStorage.setItem('jwt_token', nuevoToken);
        setToken(nuevoToken);
      }
    } catch {
      // Error de red — no cerrar sesión, podría ser temporal
      console.warn('⚠️ No se pudo renovar el token (error de red)');
    }
  }, [logout]);

  /**
   * Manejador de actividad del usuario.
   * Reinicia el timer de inactividad y hace refresh del token (con throttle).
   */
  const registrarActividad = useCallback(() => {
    const tokenActual = localStorage.getItem('jwt_token');
    if (!tokenActual) return;

    // Siempre reiniciar el timer de inactividad
    reiniciarTimer();

    // Hacer refresh del JWT con throttle de 5 minutos
    const ahora = Date.now();
    if (ahora - ultimoRefresh.current >= REFRESH_THROTTLE_MS) {
      ultimoRefresh.current = ahora;
      renovarToken(tokenActual);
    }
  }, [reiniciarTimer, renovarToken]);

  // Registrar listeners de actividad cuando hay sesión activa
  useEffect(() => {
    if (!token) return;

    const eventos = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    eventos.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true }));

    // Iniciar el timer al montar (por si el usuario no hace nada al cargar)
    reiniciarTimer();

    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, registrarActividad));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [token, registrarActividad, reiniciarTimer]);

  // Inicializar: leer sesión guardada del localStorage al cargar la app
  useEffect(() => {
    const storedToken = localStorage.getItem('jwt_token');
    const storedUser  = localStorage.getItem('user_data');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  /**
   * Guarda el token y datos del usuario tras el login exitoso.
   */
  const login = (tokenStr, userData) => {
    localStorage.setItem('jwt_token', tokenStr);
    localStorage.setItem('user_data', JSON.stringify(userData));
    setToken(tokenStr);
    setUser(userData);
    ultimoRefresh.current = Date.now();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
