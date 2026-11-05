import { useState } from 'react';
import { useShop, submitOrder } from '../data/shop';
import { useCurrency } from '../data/currency';

// Países con su código ISO, prefijo telefónico y bandera.
// Cuba va primero: es el mercado principal y el punto de entrega siempre.
const COUNTRIES = [
  { region: 'CU', dial: '53', flag: '🇨🇺', name: 'Cuba' },
  { region: 'MX', dial: '52', flag: '🇲🇽', name: 'México' },
  { region: 'US', dial: '1', flag: '🇺🇸', name: 'Estados Unidos' },
  { region: 'ES', dial: '34', flag: '🇪🇸', name: 'España' },
  { region: 'GT', dial: '502', flag: '🇬🇹', name: 'Guatemala' },
  { region: 'SV', dial: '503', flag: '🇸🇻', name: 'El Salvador' },
  { region: 'HN', dial: '504', flag: '🇭🇳', name: 'Honduras' },
  { region: 'NI', dial: '505', flag: '🇳🇮', name: 'Nicaragua' },
  { region: 'CR', dial: '506', flag: '🇨🇷', name: 'Costa Rica' },
  { region: 'PA', dial: '507', flag: '🇵🇦', name: 'Panamá' },
  { region: 'DO', dial: '1809', flag: '🇩🇴', name: 'R. Dominicana' },
  { region: 'CO', dial: '57', flag: '🇨🇴', name: 'Colombia' },
  { region: 'VE', dial: '58', flag: '🇻🇪', name: 'Venezuela' },
  { region: 'EC', dial: '593', flag: '🇪🇨', name: 'Ecuador' },
  { region: 'PE', dial: '51', flag: '🇵🇪', name: 'Perú' },
  { region: 'BO', dial: '591', flag: '🇧🇴', name: 'Bolivia' },
  { region: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile' },
  { region: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { region: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguay' },
  { region: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguay' },
  { region: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil' },
  { region: 'CA', dial: '1', flag: '🇨🇦', name: 'Canadá' },
  { region: 'PT', dial: '351', flag: '🇵🇹', name: 'Portugal' },
  { region: 'FR', dial: '33', flag: '🇫🇷', name: 'Francia' },
  { region: 'DE', dial: '49', flag: '🇩🇪', name: 'Alemania' },
  { region: 'IT', dial: '39', flag: '🇮🇹', name: 'Italia' },
  { region: 'GB', dial: '44', flag: '🇬🇧', name: 'Reino Unido' },
  { region: 'IE', dial: '353', flag: '🇮🇪', name: 'Irlanda' },
  { region: 'NL', dial: '31', flag: '🇳🇱', name: 'Países Bajos' },
  { region: 'BE', dial: '32', flag: '🇧🇪', name: 'Bélgica' },
  { region: 'CH', dial: '41', flag: '🇨🇭', name: 'Suiza' },
  { region: 'SE', dial: '46', flag: '🇸🇪', name: 'Suecia' },
  { region: 'NO', dial: '47', flag: '🇳🇴', name: 'Noruega' },
  { region: 'PL', dial: '48', flag: '🇵🇱', name: 'Polonia' },
  { region: 'GR', dial: '30', flag: '🇬🇷', name: 'Grecia' },
  { region: 'MA', dial: '212', flag: '🇲🇦', name: 'Marruecos' },
  { region: 'AE', dial: '971', flag: '🇦🇪', name: 'Emiratos Árabes' },
  { region: 'IL', dial: '972', flag: '🇮🇱', name: 'Israel' },
  { region: 'IN', dial: '91', flag: '🇮🇳', name: 'India' },
  { region: 'JP', dial: '81', flag: '🇯🇵', name: 'Japón' },
  { region: 'AU', dial: '61', flag: '🇦🇺', name: 'Australia' },
  { region: 'NZ', dial: '64', flag: '🇳🇿', name: 'Nueva Zelanda' },
  { region: 'ZA', dial: '27', flag: '🇿🇦', name: 'Sudáfrica' }
];

// Detecta el país del navegador (ej. "es-CU" → CU, "es-ES" → ES) y regresa su código.
// Si no reconoce el país, deja Cuba: es el mercado principal de la tienda.
function detectRegion() {
  try {
    const loc = (navigator.language || '').toUpperCase();
    const region = loc.split('-')[1];
    if (region && COUNTRIES.some(c => c.region === region)) return region;
  } catch { /* sin navegador */ }
  return 'CU';
}

// El mensaje va en la moneda en que el comprador ve la tienda, y aclara que
// el envío es siempre a Cuba (aunque el comprador esté en el exterior).
function buildWaUrl(shop, items, total, customer, buyer, fmt) {
  const lines = [
    `¡Hola ${shop.name}! ☀️ Quiero hacer este pedido:`,
    ...items.map(i => `• ${i.quantity}× ${i.name} (${i.variant.label}) — ${fmt(i.quantity * i.variant.price)}`),
    ` Total: ${fmt(total)}`,
    '',
    `Comprador: ${customer.name}${customer.phone ? ' · ' + customer.phone : ''}`,
    'Entrega en Cuba · dirección a confirmar'
  ];
  if (buyer && buyer.region !== 'CU') lines.push(`(Hiciste el pedido desde ${buyer.name})`);
  lines.push('', '¿Me confirman disponibilidad, dirección de entrega y forma de pago? ¡Gracias!');
  return `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

const { createClient } = await import('@supabase/supabase-js');
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseClient = SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;

export default function CheckoutForm({ items, total, onPlaced, onClose }) {
  const { shop } = useShop();
  const { fmt } = useCurrency();
  const [name, setName] = useState('');
  const [region, setRegion] = useState(detectRegion);
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('whatsapp'); // 'whatsapp' | 'enzona'
  const [state, setState] = useState('idle'); // idle | saving | done | error | redirecting
  const [note, setNote] = useState('');
  const [enzonaEnabled] = useState(true); // Se puede controlar desde settings más adelante

  const digits = phone.replace(/\D/g, '');
  const buyer = COUNTRIES.find(c => c.region === region) || COUNTRIES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state === 'saving' || state === 'redirecting') return;
    if (digits.length < 7) {
      setState('error');
      setNote('Escribe un número de teléfono válido (al menos 7 dígitos).');
      return;
    }
    if (paymentMethod === 'enzona' && !enzonaEnabled) {
      setState('error');
      setNote('El pago con Enzona no está disponible en este momento.');
      return;
    }
    setState('saving');
    setNote('');

    const customer = { name: name.trim(), phone: `+${buyer.dial}${digits}` };

    if (paymentMethod === 'whatsapp') {
      const waUrl = buildWaUrl(shop, items, total, customer, buyer, fmt);

      const res = await submitOrder({
        customerName: customer.name || 'Cliente sin nombre',
        phone: customer.phone,
        items: items.map(i => ({ id: i.id, name: i.name, variant: i.variant, quantity: i.quantity })),
        total,
        paymentMethod: 'whatsapp',
        paymentStatus: 'pendiente'
      });

      window.open(waUrl, '_blank', 'noopener,noreferrer');

      if (res.ok) {
        setState('done');
      } else {
        setState('error');
        setNote('No pudimos guardar tu pedido en línea, pero tu mensaje de WhatsApp ya está listo.');
      }
      onPlaced();
      return;
    }

    // Flujo Enzona
    if (paymentMethod === 'enzona') {
      const res = await submitOrder({
        customerName: customer.name || 'Cliente sin nombre',
        phone: customer.phone,
        items: items.map(i => ({ id: i.id, name: i.name, variant: i.variant, quantity: i.quantity })),
        total,
        paymentMethod: 'enzona',
        paymentStatus: 'pendiente'
      });

      if (!res.ok || !res.data?.id) {
        setState('error');
        setNote('No pudimos crear el pedido para Enzona. Inténtalo de nuevo o elige pagar por WhatsApp.');
        return;
      }

      try {
        setState('redirecting');
        const orderId = res.data.id;
        const origin = window.location.origin;
        const basePath = window.location.pathname.replace(/\/$/, '');
        const returnUrl = `${origin}${basePath}/#/pago/exito?order=${orderId}`;
        const cancelUrl = `${origin}${basePath}/#/pago/cancelado?order=${orderId}`;

        const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/create-enzona-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            orderId,
            amount: total,
            customerName: customer.name || 'Cliente',
            phone: customer.phone,
            items: items.map(i => ({ name: i.name, variant: i.variant.label, quantity: i.quantity, price: i.variant.price })),
            returnUrl,
            cancelUrl
          })
        });

        const data = await resp.json();
        if (!resp.ok || !data.paymentUrl) {
          throw new Error(data.error || 'No se pudo generar el enlace de pago');
        }

        // Guardar URL de pago
        if (supabaseClient) {
          await supabaseClient.from('orders').update({ payment_url: data.paymentUrl }).eq('id', orderId);
        }

        onPlaced();
        window.location.href = data.paymentUrl;
        return;
      } catch (err) {
        setState('error');
        setNote(err.message || 'Error al conectar con Enzona. Prueba a pagar por WhatsApp.');
        onPlaced();
        return;
      }
    }
  };

  if (state === 'done') {
    return (
      <div className="co-done">
        <p className="co-ok">☀ ¡Pedido registrado!</p>
        <p>Te redirigimos a WhatsApp para confirmar tu pedido.</p>
      </div>
    );
  }

  if (state === 'redirecting') {
    return (
      <div className="co-done">
        <p className="co-ok">Redirigiendo a Enzona...</p>
        <p>Espera un momento, te estamos llevando a la pasarela de pago.</p>
      </div>
    );
  }

  return (
    <form className="co-form" onSubmit={handleSubmit}>
      <p className="co-hint">
        El pedido se entrega en <b>Cuba</b>. Deja tu contacto y elige cómo quieres pagar.
      </p>
      <div className="co-row">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          required
          maxLength={80}
        />
      </div>
      <div className="co-phone">
        <select value={region} onChange={e => setRegion(e.target.value)} aria-label="País">
          {COUNTRIES.map(c => (
            <option key={c.region} value={c.region}>{c.flag} +{c.dial} {c.name}</option>
          ))}
        </select>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="33 1234 5678"
          aria-label="Tu teléfono"
          inputMode="tel"
          required
          maxLength={20}
        />
      </div>
      {buyer.region !== 'CU' && (
        <p className="co-hint co-from">
          🌍 Comprando desde {buyer.name}. El envío se entrega en Cuba; lo coordinamos por WhatsApp.
        </p>
      )}

      <div style={{ marginTop: '12px', marginBottom: '10px' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#2a1f14' }}>Método de pago</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
          <input
            type="radio"
            name="paymentMethod"
            value="whatsapp"
            checked={paymentMethod === 'whatsapp'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <span>💬 Pagar por WhatsApp (confirmar por mensaje)</span>
        </label>
        {enzonaEnabled && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="paymentMethod"
              value="enzona"
              checked={paymentMethod === 'enzona'}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <span>💳 Pagar con Enzona</span>
          </label>
        )}
      </div>

      {state === 'error' && note && <p className="co-warn">{note}</p>}
      <button className="wa-btn" type="submit" disabled={state === 'saving' || state === 'redirecting'}>
        {state === 'saving' ? 'Procesando…' : state === 'redirecting' ? 'Redirigiendo…' : paymentMethod === 'enzona' ? 'Pagar con Enzona →' : 'Registrar y pedir por WhatsApp →'}
      </button>
    </form>
  );
}
