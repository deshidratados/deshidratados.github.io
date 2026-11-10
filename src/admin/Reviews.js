import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';
import { fmtDate } from './helpers';

const STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
const STATUS_CLASS = { pending: 'st-conf', approved: 'st-done', rejected: 'st-cancel' };
const FILTERS = ['pending', 'approved', 'rejected', 'all'];

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  // 'all' como arranque: desde que las reseñas se publican solas no hay
  // ninguna "pendiente", y arrancar en ese filtro enseñaba una lista vacía
  // y obligaba a pulsar "Todas" para ver nada.
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('reviews')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setErr(error.message); return; }
    setReviews(data || []);
  };

  useEffect(() => { load(); }, []);

  const remove = async (r) => {
    if (!window.confirm('¿Eliminar esta reseña?')) return;
    setBusy(true);
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  // Filtra por búsqueda (autor, comentario o producto).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(r => {
      if ((r.author || '').toLowerCase().includes(q)) return true;
      if ((r.comment || '').toLowerCase().includes(q)) return true;
      const pname = r.products ? r.products.name : '';
      return pname.toLowerCase().includes(q);
    });
  }, [reviews, search]);

  const counts = useMemo(() => {
    const c = { all: searched.length };
    FILTERS.forEach(f => { if (f !== 'all') c[f] = searched.filter(r => r.status === f).length; });
    return c;
  }, [searched]);

  // Pendientes (nuevas) primero; dentro de cada filtro, las más recientes ya vienen primero.
  const shown = useMemo(() => {
    const list = searched.filter(r => filter === 'all' || r.status === filter);
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [searched, filter]);

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Reseñas</h2>
          <p>{reviews.length} reseña{reviews.length !== 1 ? 's' : ''} en total.</p>
        </div>
        <button className="adm-btn ghost" onClick={load}>Actualizar</button>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <div className="adm-filters">
        <input
          className="adm-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por autor, comentario o producto…"
          aria-label="Buscar reseñas"
        />
        <button
          className={'adm-chip' + (filter === 'all' ? ' on' : '')}
          onClick={() => setFilter('all')}
        >
          Todas ({counts.all})
        </button>
      </div>
      {reviews.length === 0 && !err && <p className="adm-muted">Aún no hay reseñas.</p>}
      {reviews.length > 0 && shown.length === 0 && <p className="adm-muted">No se encontraron reseñas con ese filtro.</p>}
      <div className="adm-orders">
        {shown.map(r => (
          <div className="adm-card adm-order" key={r.id}>
            <div className="adm-order-head">
              <div>
                <b>{r.author}</b> · <span className="adm-muted">{r.products ? r.products.name : 'General'}</span>
                <div className="adm-muted small">{fmtDate(r.created_at)}</div>
              </div>
              <span className={'adm-badge ' + STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="quote-stars" style={{ color: '#7CB121', marginBottom: 6 }}>
              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
            </div>
            <p style={{ margin: '0 0 10px' }}>{r.comment}</p>
            <div className="adm-order-foot">
              <button className="adm-linkbtn danger" onClick={() => remove(r)} disabled={busy}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
