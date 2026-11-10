import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { useAdmin } from './AdminContext';

export default function Login() {
  const { session } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/admin" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr('Credenciales incorrectas.');
      return;
    }
    navigate('/admin', { replace: true });
  };

  return (
    <div className="adm-plain">
      <form className="adm-card adm-login adm-form" onSubmit={onSubmit}>
        <h1>
          <img src={process.env.PUBLIC_URL + '/logo_tienda.png'} alt="" style={{ height: '38px', width: 'auto', verticalAlign: '-8px', borderRadius: '8px', marginRight: '10px' }} />
          Salud &amp; Vida · Panel
        </h1>
        <p className="adm-sub">Inicia sesión para administrar la tienda.</p>
        <label>Correo
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {err && <p className="adm-err">{err}</p>}
        <button className="adm-btn" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}