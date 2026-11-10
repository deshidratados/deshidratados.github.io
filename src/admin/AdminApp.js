import { Routes, Route, Navigate, Outlet, NavLink, Link } from 'react-router-dom';
import { configured } from '../data/supabase';
import { AdminProvider, useAdmin } from './AdminContext';
import Login from './Login';
import Dashboard from './Dashboard';
import Products from './Products';
import ProductForm from './ProductForm';
import Categories from './Categories';
import Presentations from './Presentations';
import Reviews from './Reviews';
import Orders from './Orders';
import Subscribers from './Subscribers';
import Settings from './Settings';
import './admin.css';

function AdminLayout() {
  const { session, signOut } = useAdmin();
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <img src={process.env.PUBLIC_URL + '/logo_tienda.png'} alt="" style={{ height: '28px', width: 'auto', borderRadius: '6px' }} />
          {' '}Salud &amp; Vida <small>panel</small>
        </div>
        <nav className="adm-nav">
          <NavLink to="/admin" end>Panel</NavLink>
          <NavLink to="/admin/productos">Productos</NavLink>
          <NavLink to="/admin/categorias">Categorías</NavLink>
          <NavLink to="/admin/presentaciones">Presentaciones</NavLink>
          <NavLink to="/admin/resenas">Reseñas</NavLink>
          <NavLink to="/admin/pedidos">Pedidos</NavLink>
          <NavLink to="/admin/suscriptores">Suscriptores</NavLink>
          <NavLink to="/admin/configuracion">Configuración</NavLink>
        </nav>
      </aside>
      <div className="adm-main">
        <header className="adm-top">
          <span className="adm-user">{session && session.user && session.user.email}</span>
          <div className="adm-top-actions">
            <Link className="adm-link" to="/" target="_blank" rel="noopener noreferrer">Ver tienda ↗</Link>
            <button className="adm-out" onClick={signOut}>Salir</button>
          </div>
        </header>
        <div className="adm-body"><Outlet /></div>
      </div>
    </div>
  );
}

function Guard() {
  const { session, ready } = useAdmin();
  if (!ready) return <div className="adm-loading">Cargando…</div>;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

export default function AdminApp() {
  if (!configured) {
    return (
      <div className="adm-plain">
        <div className="adm-card">
          <h1>Falta configurar Supabase</h1>
          <p>Define <code>REACT_APP_SUPABASE_URL</code> y <code>REACT_APP_SUPABASE_ANON_KEY</code> en tu archivo <code>.env.local</code> para usar el panel.</p>
        </div>
      </div>
    );
  }
  return (
    <AdminProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<Guard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<Products />} />
            <Route path="productos/nuevo" element={<ProductForm />} />
            <Route path="productos/:slug" element={<ProductForm />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="presentaciones" element={<Presentations />} />
            <Route path="resenas" element={<Reviews />} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="suscriptores" element={<Subscribers />} />
            <Route path="configuracion" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </AdminProvider>
  );
}