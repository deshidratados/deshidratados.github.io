export const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

export const money = (n) => `$${Number(n || 0).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;

export const ORDER_STATUS = ['Nuevo', 'Confirmado', 'Enviado', 'Completado', 'Cancelado'];

export const STATUS_HINTS = {
  Nuevo: 'Recién recibido, sin contactar aún.',
  Confirmado: 'Ya hablaste con el cliente y acordaste el pago/envío.',
  Enviado: 'Empacado y entregado a la paquetería o en camino.',
  Completado: 'Entregado y pagado. Pedido cerrado.',
  Cancelado: 'El cliente o la tienda lo anularon.'
};

export const STATUS_CLASS = (s) => {
  const map = {
    Nuevo: 'st-new',
    Confirmado: 'st-conf',
    Enviado: 'st-sent',
    Completado: 'st-done',
    Cancelado: 'st-cancel'
  };
  return map[s] || 'st-new';
};

// Textos de aviso al cliente al cambiar el estado (se usan en el WhatsApp).
export const STATUS_NOTIFY = {
  Nuevo: 'Tu pedido quedó como *nuevo*. Enseguida lo revisamos.',
  Confirmado: '✅ ¡Tu pedido ha sido *confirmado*! Gracias por comprar en Salud & Vida.',
  Enviado: '📦 ¡Tu pedido está *en camino*! Pronto lo tendrás contigo.',
  Completado: '☀ ¡Pedido *entregado*! Gracias por comprar en Salud & Vida.',
  Cancelado: 'Tu pedido quedó *cancelado*. Si tienes dudas, respóndenos por aquí mismo.'
};

// Hora corta (sin fecha) en la zona horaria del navegador.
export const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { timeStyle: 'short' });
  } catch {
    return iso;
  }
};

// Clave de día local "YYYY-MM-DD" para agrupar y filtrar por día COMO LO VE
// EL ADMIN: un pedido de las 23:59 cuenta para ese día, no para el siguiente
// (con la clave UTC se corría al día siguiente en Cuba).
export const dayKey = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// "Hoy" / "Ayer" / '' para una clave de día local.
export const dayPrefix = (key) => {
  if (key === dayKey(new Date())) return 'Hoy';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y)) return 'Ayer';
  return '';
};

// Cabecera larga de día: "viernes, 29 de octubre de 2026".
export const fmtDayLong = (key) => {
  if (!key) return '';
  try {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch {
    return key;
  }
};