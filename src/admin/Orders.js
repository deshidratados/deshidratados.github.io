import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase, configured } from '../data/supabase';
import { fmtDate, fmtTime, dayKey, dayPrefix, fmtDayLong, money, ORDER_STATUS, STATUS_CLASS, STATUS_HINTS, STATUS_NOTIFY } from './helpers';
import Notice from './Notice';

const PAY_STATUS = {
  'pendiente': { label: 'Pendiente de pago', className: 'pay-pending' },
  'pagado': { label: 'Pagado', className: 'pay-paid' },
  'fallido': { label: 'Pago fallido', className: 'pay-failed' },
  'cancelado': { label: 'Cancelado', className: 'pay-cancelled' },
  'expirado': { label: 'Expirado', className: 'pay-expired' }
};

const PAY_METHOD = {
  'whatsapp': { label: 'WhatsApp', icon: '💬' },
  'transfermovil': { label: 'Transfermóvil', icon: '📱' },
  'enzona': { label: 'Enzona', icon: '💳' },
  'qvapay': { label: 'QvaPay', icon: '⚡' }
};

// Fecha en que el pedido adquirió su estado actual; si nunca cambió, la de
// creación. Agrupar y filtrar por AQUÍ: un pedido que entra el lunes y se
// confirma el martes debe salir en «Confirmado · martes», no en «lunes».
const statusDate = (o) => o.status_updated_at || o.created_at;

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openHint, setOpenHint] = useState(null);
  const [stock, setStock] = useState(null); // Mapa de disponibilidad por id de variante
  const [editPhone, setEditPhone] = useState(null); // id del pedido cuyo teléfono se está capturando
  const [phoneVal, setPhoneVal] = useState('');      // borrador del teléfono
  const [datePreset, setDatePreset] = useState('todo'); // todo|hoy|ayer|7d|mes|rango
  const [from, setFrom] = useState('');                 // rango libre: yyyy-mm-dd
  const [to, setTo] = useState('');                     // rango libre: yyyy-mm-dd
  const [collapsed, setCollapsed] = useState(() => new Set()); // días plegados: "Estado|fecha"
  const [notice, setNotice] = useState('');             // aviso info (ej. falta teléfono)

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { setErr(error.message); return; }
    setOrders(data || []);
  };

  const loadStock = async () => {
    if (!configured || !supabase) return;
    const [{ data: prods }, { data: vars }] = await Promise.all([
      supabase.from('products').select('id, name').eq('active', true),
      supabase.from('variants').select('id, product_id')
    ]);
    // Productos activos por nombre (falle) y por id.
    const names = {};
    const activeProd = {};
    (prods || []).forEach(p => {
      names[p.name.toLowerCase()] = true;
      activeProd[p.id] = true;
    });
    // Mapa variante.id (uuid) -> product_id. El label del pedido es compuesto
    // (incluye presentación), por eso emparejamos por id y no por texto.
    const variantById = {};
    (vars || []).forEach(v => { variantById[v.id] = v.product_id; });
    setStock({ names, activeProd, variantById });
  };

  useEffect(() => { load(); loadStock(); }, []);

  // Construye la URL de WhatsApp de un pedido (confirmación o consulta).
  const waUrl = (o, { confirm = false } = {}) => {
    if (!o.phone) return null;
    const digits = o.phone.replace(/\D/g, '');
    if (!digits) return null;
    const lines = confirm
      ? [
          `Hola ${o.customer_name}! ☀`,
          `Tu pedido ha sido *confirmado*. ¡Gracias por comprar en Salud & Vida!`,
          ...(o.items || []).map(it => `• ${it.quantity}× ${it.name}${it.variant ? ` (${it.variant.label})` : ''}`),
          `Total: ${money(o.total)}`,
          `Te avisamos cuando salga para entrega.`
        ]
      : [
          `Hola ${o.customer_name}! ☀ Te confirmamos tu pedido:`,
          ...(o.items || []).map(it => `• ${it.quantity}× ${it.name}${it.variant ? ` (${it.variant.label})` : ''} — ${money(it.quantity * (it.variant ? it.variant.price : 0))}`),
          `Total: ${money(o.total)}`
        ];
    return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  // Texto del aviso de estado para WhatsApp (resumen del pedido + novedad).
  const statusMessage = (o, status) => [
    `Hola ${o.customer_name}! ☀`,
    STATUS_NOTIFY[status] || `Tu pedido cambió de estado a *${status}*.`,
    '',
    ...(o.items || []).map(it => `• ${it.quantity}× ${it.name}${it.variant ? ` (${it.variant.label})` : ''}`),
    `Total: ${money(o.total)}`,
    '— Salud & Vida · deshidratados'
  ].join('\n');

  // Al cambiar el estado, ofrece avisar al cliente por WhatsApp si tiene
  // teléfono capturado; si no, deja un cartel recordándote capturarlo.
  const notifyCustomer = (o, status) => {
    const digits = (o.phone || '').replace(/\D/g, '');
    if (digits) {
      const go = window.confirm(
        `¿Avisar a ${o.customer_name} por WhatsApp de que su pedido está «${status}»?\n\nSe abrirá WhatsApp con el mensaje listo: solo pulsas enviar.`
      );
      if (go) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(statusMessage(o, status))}`, '_blank');
      return;
    }
    setNotice(`Estado «${status}» guardado. Para avisar a ${o.customer_name} por WhatsApp, captura su teléfono con el botón «+ teléfono» del pedido.`);
  };

  const changeStatus = async (o, status) => {
    setBusy(o.id);
    // Marca CUÁNDO adquiere el pedido este estado: es la fecha por la que
    // después se agrupa y se filtra (no la de creación).
    const now = new Date().toISOString();
    let res = await supabase.from('orders').update({ status, status_updated_at: now }).eq('id', o.id).select();
    // Respaldo por si la columna aún no existe en la base (SQL pendiente).
    let noCol = false;
    if (res.error && String(res.error.message).includes('status_updated_at')) {
      noCol = true;
      res = await supabase.from('orders').update({ status }).eq('id', o.id).select();
    }
    const { data, error } = res;
    setBusy(null);

    // .select() devuelve [] si no se actualizó ninguna fila (p. ej. RLS o id inválido).
    if (error || !data || data.length === 0) {
      setErr(error ? error.message : 'No se pudo actualizar el pedido. ¿Sesión expirada?');
      load();
      return;
    }

    setErr('');
    // Actualización optimista: refleja el cambio al instante sin esperar la recarga.
    setOrders(prev => prev.map(x => (x.id === o.id ? { ...x, status, ...(noCol ? {} : { status_updated_at: now }) } : x)));
    notifyCustomer(o, status);

    load();
  };

  const remove = async (o) => {
    if (!window.confirm('¿Eliminar este pedido?')) return;
    setBusy(true);
    const { error } = await supabase.from('orders').delete().eq('id', o.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  // Abre WhatsApp del pedido (true = mensaje de confirmación).
  const openWa = (o, confirm = false) => {
    const url = waUrl(o, { confirm });
    if (url) window.open(url, '_blank');
  };

  // Captura el teléfono del cliente en el pedido (lo toma el admin del chat de WhatsApp).
  const savePhone = async (o) => {
    const phone = phoneVal.trim();
    setBusy(o.id);
    const { data, error } = await supabase.from('orders').update({ phone }).eq('id', o.id).select();
    setBusy(null);
    if (error || !data || data.length === 0) {
      setErr(error ? error.message : 'No se pudo guardar el teléfono. ¿Sesión expirada?');
      return;
    }
    setErr('');
    setOrders(prev => prev.map(x => (x.id === o.id ? { ...x, phone } : x)));
    setEditPhone(null);
    setPhoneVal('');
  };

  const isAvailable = (it) => {
    if (!stock) return true;
    // Lo más fiable: el id (uuid) de la variante que viaja en el pedido.
    const vid = it.variant && it.variant.id;
    if (vid) {
      const pid = stock.variantById[vid];
      // Si la variante pertenece a un producto, checamos que siga activo.
      if (pid) return Boolean(stock.activeProd[pid]);
    }
    // Respaldo: coincide por nombre del producto.
    return Boolean(stock.names[(it.name || '').toLowerCase()]);
  };

  // Filtra por texto de búsqueda (nombre, teléfono o producto del pedido).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o => {
      if ((o.customer_name || '').toLowerCase().includes(q)) return true;
      if ((o.phone || '').toLowerCase().includes(q)) return true;
      return (o.items || []).some(it => (it.name || '').toLowerCase().includes(q));
    });
  }, [orders, search]);

  // Rango activo del filtro de fecha como claves de día local [desde, hasta].
  // null = sin filtro. Se calcula en la zona horaria del navegador para que
  // un pedido de noche cuente para el día en que lo vivió tu cliente.
  const dateRange = useMemo(() => {
    const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };
    const todayKey = dayKey(new Date());
    switch (datePreset) {
      case 'hoy': return [todayKey, todayKey];
      case 'ayer': return [shift(-1), shift(-1)];
      case '7d': return [shift(-6), todayKey];
      case 'mes': { const d = new Date(); d.setDate(1); return [dayKey(d), todayKey]; }
      case 'rango': return [from || '', to || '9999-12-31'];
      default: return null;
    }
  }, [datePreset, from, to]);

  // Pedidos que pasan la búsqueda de texto Y el filtro de fecha
  // (la fecha del filtro es el día en que adquirió su estado actual).
  const inScope = useMemo(() => {
    if (!dateRange) return searched;
    return searched.filter(o => {
      const k = dayKey(statusDate(o));
      return k >= dateRange[0] && k <= dateRange[1];
    });
  }, [searched, dateRange]);

  // Conteos de los chips de estado sobre lo ya filtrado por fecha:
  // «Nuevo (2)» son los nuevos del día elegido.
  const counts = useMemo(() => {
    const c = { all: inScope.length };
    ORDER_STATUS.forEach(s => { c[s] = inScope.filter(o => o.status === s).length; });
    return c;
  }, [inScope]);

  const grouped = useMemo(() => {
    const filtered = inScope.filter(o => filter === 'all' || o.status === filter);
    const groups = {};
    filtered.forEach(o => { (groups[o.status] = groups[o.status] || []).push(o); });
    // ORDER_STATUS ya empieza con 'Nuevo', así que ese grupo queda primero.
    // Dentro de cada grupo, orden por fecha de estado (no de creación): así
    // los tramos por día quedan contiguos y el más reciente, arriba.
    return ORDER_STATUS.filter(s => groups[s]).map(s => ({
      status: s,
      list: groups[s].sort((a, b) => new Date(statusDate(b)) - new Date(statusDate(a)))
    }));
  }, [inScope, filter]);

  const visible = grouped.reduce((n, g) => n + g.list.length, 0);
  const filtersActive = Boolean(search.trim()) || filter !== 'all' || datePreset !== 'todo';

  // Divide la lista (ya ordenada por fecha de estado descendente) en tramos
  // por día local — el día en que el pedido adquirió su estado actual.
  const splitByDay = (list) => {
    const segs = [];
    list.forEach(o => {
      const k = dayKey(statusDate(o)) || 'sin-fecha';
      const last = segs[segs.length - 1];
      if (last && last.key === k) last.list.push(o);
      else segs.push({ key: k, list: [o] });
    });
    return segs;
  };

  const toggleDay = (status, key) => {
    const id = `${status}|${key}`;
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Pedidos</h2>
          <p>
            {filtersActive
              ? `Mostrando ${visible} de ${orders.length} pedido${orders.length !== 1 ? 's' : ''}.`
              : `${orders.length} pedido${orders.length !== 1 ? 's' : ''} registrado${orders.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <button className="adm-btn ghost" onClick={load}>Actualizar</button>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <Notice kind="info" onDismiss={() => setNotice('')}>{notice}</Notice>
      <div className="adm-filters">
        <input
          className="adm-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, teléfono o producto…"
          aria-label="Buscar pedidos"
        />
        <button className={'adm-chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>Todos ({counts.all})</button>
        {ORDER_STATUS.map(s => (
          <button
            key={s}
            className={'adm-chip' + (filter === s ? ' on' : '') + (s === 'Nuevo' && counts.Nuevo > 0 ? ' pulse' : '')}
            onClick={() => setFilter(s)}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>
      <div className="adm-filters adm-date-row">
        <span className="adm-date-label">📅 Fecha</span>
        {[
          ['todo', 'Todo'],
          ['hoy', 'Hoy'],
          ['ayer', 'Ayer'],
          ['7d', 'Últimos 7 días'],
          ['mes', 'Este mes'],
          ['rango', 'Rango libre']
        ].map(([id, label]) => (
          <button
            key={id}
            className={'adm-chip' + (datePreset === id ? ' on' : '')}
            onClick={() => setDatePreset(id)}
          >
            {label}
          </button>
        ))}
        <label className="adm-date-label">
          desde
          <input
            className="adm-date-input"
            type="date"
            value={from}
            max={to || undefined}
            onChange={e => { setFrom(e.target.value); setDatePreset('rango'); }}
            aria-label="Fecha inicial"
          />
        </label>
        <label className="adm-date-label">
          hasta
          <input
            className="adm-date-input"
            type="date"
            value={to}
            min={from || undefined}
            onChange={e => { setTo(e.target.value); setDatePreset('rango'); }}
            aria-label="Fecha final"
          />
        </label>
      </div>
      {orders.length === 0 && !err && <p className="adm-muted">Aún no hay pedidos.</p>}
      {orders.length > 0 && grouped.length === 0 && <p className="adm-muted">No se encontraron pedidos con ese filtro.</p>}
      {grouped.map(group => (
        <div className="adm-order-group" key={group.status}>
          <h3 className="adm-group-title">
            <span className={'adm-badge ' + STATUS_CLASS(group.status)}>{group.status}</span>
            <span className="adm-muted small">{group.list.length} pedido{group.list.length !== 1 ? 's' : ''}</span>
          </h3>
          <div className="adm-orders">
            {splitByDay(group.list).map(seg => {
              const segId = `${group.status}|${seg.key}`;
              const isDown = collapsed.has(segId);
              const prefix = dayPrefix(seg.key);
              const segTotal = seg.list.reduce((s, o) => s + Number(o.total || 0), 0);
              return (
                <Fragment key={segId}>
                  <button
                    type="button"
                    className="adm-day-sep"
                    aria-expanded={!isDown}
                    onClick={() => toggleDay(group.status, seg.key)}
                    title={isDown ? 'Mostrar los pedidos de este día' : 'Plegar los pedidos de este día'}
                  >
                    <span className="adm-day-arrow" aria-hidden="true">{isDown ? '▸' : '▾'}</span>
                    <span>{prefix ? `${prefix} · ` : ''}{seg.key === 'sin-fecha' ? 'Sin fecha' : fmtDayLong(seg.key)}</span>
                    <span className="adm-muted small">{seg.list.length} pedido{seg.list.length !== 1 ? 's' : ''}</span>
                    <span className="adm-day-total">{money(segTotal)}</span>
                  </button>
                  {!isDown && seg.list.map(o => (
                    <div className="adm-card adm-order" key={o.id}>
                      <div className="adm-order-head">
                        <div>
                          <b>{o.customer_name}</b> · <span className="adm-muted">{fmtTime(statusDate(o))}</span>
                          {dayKey(statusDate(o)) !== dayKey(o.created_at) && (
                            <span className="adm-muted small"> · recibido {fmtDate(o.created_at)}</span>
                          )}
                          {editPhone === o.id ? (
                            <span className="adm-phone-edit">
                              {' · '}
                              <input
                                autoFocus
                                value={phoneVal}
                                onChange={e => setPhoneVal(e.target.value)}
                                placeholder="Tel. del cliente"
                                maxLength={30}
                                disabled={busy === o.id}
                              />
                              <button className="adm-linkbtn" onClick={() => savePhone(o)} disabled={busy === o.id}>Guardar</button>
                              <button className="adm-linkbtn" onClick={() => { setEditPhone(null); setPhoneVal(''); }}>Cancelar</button>
                            </span>
                          ) : (
                            <>
                              {o.phone && <a className="adm-link" href={`tel:${o.phone}`}> · {o.phone}</a>}
                              <button
                                className={'adm-linkbtn phone-add' + (o.status === 'Confirmado' && !o.phone ? ' need' : '')}
                                onClick={() => { setEditPhone(o.id); setPhoneVal(o.phone || ''); }}
                                title={o.phone ? 'Editar teléfono' : 'Captura el teléfono del cliente (lo ves en tu WhatsApp) para poder avisarle'}
                              >
                                {o.phone ? ' · editar' : ' · + teléfono'}
                              </button>
                            </>
                          )}
                          {(() => {
                            const pm = PAY_METHOD[o.payment_method] || PAY_METHOD.whatsapp;
                            const ps = PAY_STATUS[o.payment_status] || PAY_STATUS.pendiente;
                            return (
                              <span className={`ord-pay ${ps.className}`} title={o.payment_ref ? `Ref: ${o.payment_ref}` : ''}>
                                {' · '}
                                {o.payment_method === 'enzona' ? (
                                  <img src={process.env.PUBLIC_URL + '/payments/enzona.png'} alt="Enzona" width="16" height="16" style={{ borderRadius: '3px', verticalAlign: 'middle' }} />
                                ) : o.payment_method === 'transfermovil' ? (
                                  <img src={process.env.PUBLIC_URL + '/payments/Transfermovil.png'} alt="Transfermóvil" width="16" height="16" style={{ borderRadius: '3px', verticalAlign: 'middle' }} />
                                ) : o.payment_method === 'qvapay' ? (
                                  <img src={process.env.PUBLIC_URL + '/payments/QvaPay.png'} alt="QvaPay" width="16" height="16" style={{ borderRadius: '3px', verticalAlign: 'middle' }} />
                                ) : (
                                  <img src={process.env.PUBLIC_URL + '/payments/WhatSapp.jpg'} alt="WhatsApp" width="16" height="16" style={{ borderRadius: '50%', verticalAlign: 'middle' }} />
                                )}{' '}{pm.label} · {ps.label}
                              </span>
                            );
                          })()}
                        </div>
                        <button
                          className={'adm-badge click ' + STATUS_CLASS(o.status)}
                          onClick={() => setOpenHint(openHint === o.id ? null : o.id)}
                          title="Clic para ver qué significa"
                        >
                          {o.status} ▾
                        </button>
                      </div>
                      {openHint === o.id && (
                        <p className="adm-status-hint">{STATUS_HINTS[o.status] || ''}</p>
                      )}
                      <ul className="adm-order-items">
                        {(o.items || []).map((it, i) => {
                          const avail = isAvailable(it);
                          return (
                            <li key={i} className="adm-order-item">
                              <span className="adm-item-info">
                                <b>{it.quantity}×</b> {it.name}
                                {it.variant && <span className="adm-muted"> ({it.variant.label})</span>}
                                {!avail && <span className="adm-warn-tag" title="Este producto ya no está en la tienda">⚠ Agotado</span>}
                              </span>
                              <span className="adm-item-price">{money(it.quantity * (it.variant ? it.variant.price : 0))}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="adm-order-foot">
                        <span className="adm-total">Total: <b>{money(o.total)}</b></span>
                        <select value={o.status} disabled={busy === o.id} onChange={e => changeStatus(o, e.target.value)}>
                          {ORDER_STATUS.map(s => <option key={s} value={s} title={STATUS_HINTS[s]}>{s}</option>)}
                        </select>
                        {(o.payment_method === 'enzona' || o.payment_method === 'qvapay' || o.payment_method === 'transfermovil') && (
                          <select
                            value={o.payment_status || 'pendiente'}
                            disabled={busy === o.id}
                            onChange={async (e) => {
                              const val = e.target.value;
                              setBusy(o.id);
                              const upd = val === 'pagado' ? { payment_status: val, paid_at: new Date().toISOString() } : { payment_status: val };
                              const { error } = await supabase.from('orders').update(upd).eq('id', o.id);
                              setBusy(null);
                              if (error) { setErr(error.message); return; }
                              setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...upd } : x));
                            }}
                            title="Estado de pago"
                          >
                            <option value="pendiente">Pago: Pendiente</option>
                            <option value="pagado">Pago: Pagado</option>
                            <option value="fallido">Pago: Fallido</option>
                            <option value="cancelado">Pago: Cancelado</option>
                            <option value="expirado">Pago: Expirado</option>
                          </select>
                        )}
                        {(o.status === 'Confirmado' && o.phone) && (
                          <button className="adm-linkbtn wa-confirm" onClick={() => openWa(o, true)}>
                            ✆ Enviar WhatsApp
                          </button>
                        )}
                        <button className="adm-linkbtn danger" onClick={() => remove(o)} disabled={busy}>Eliminar</button>
                      </div>
                      {o.status === 'Confirmado' && !o.phone && (
                        <p className="adm-phone-hint">Captura el teléfono del cliente (botón «+ teléfono») para poder enviarle el WhatsApp de confirmación.</p>
                      )}
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
