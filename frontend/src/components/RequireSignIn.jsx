// File: frontend/src/components/RequireSignIn.jsx
// Wraps a private page. A guest is sent to /sign-in and comes back here afterwards.
// This only improves the experience: the REAL protection is the API's 401/404 check.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import StatusMessage from './StatusMessage.jsx';

export default function RequireSignIn({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <StatusMessage>Checking sign-in…</StatusMessage>;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
}
