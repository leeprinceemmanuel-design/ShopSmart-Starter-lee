// File: frontend/src/context/AuthContext.jsx
// Knows who is signed in. The cookie itself is HttpOnly, so React never sees it:
// on page load we simply ask the API "who am I?" (GET /api/auth/me).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true); // true until the first "who am I?" answer

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
    } catch {
      setUser(null); // 401 (guest) or server unreachable: treat as signed out
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const signIn = useCallback(async (email, password) => {
    const data = await api.signIn(email, password); // throws with a readable message on failure
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.signOut(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, checking, signIn, signOut, refreshUser }), [user, checking, signIn, signOut, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
