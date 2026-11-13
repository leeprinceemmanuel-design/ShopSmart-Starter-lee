// File: frontend/src/pages/SignInPage.jsx
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignInPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Go back to the page that sent us here (for example /checkout), or to My Orders.
  const goTo = location.state?.from || '/orders';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={goTo} replace />;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(form.email, form.password);
      navigate(goTo, { replace: true });
    } catch (caught) {
      setError(caught.message);
      setForm((current) => ({ ...current, password: '' })); // never keep a wrong password in the box
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="narrow-page">
      <form onSubmit={submit}>
        <p className="eyebrow">TEST CUSTOMER SIGN-IN</p>
        <h1>Sign in</h1>
        <p className="demo-notice">Class demo only: use a fictional test account (for example ana.demo@example.com). Never use a real password here.</p>
        <StatusMessage type="error">{error}</StatusMessage>
        <label>Email address<input name="email" type="email" autoComplete="username" value={form.email} onChange={updateField} required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" value={form.password} onChange={updateField} maxLength="200" required /></label>
        <button disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  );
}
