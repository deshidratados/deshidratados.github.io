import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

const pageStyle = {
  maxWidth: '680px',
  margin: '40px auto',
  padding: '40px 20px',
  textAlign: 'center'
};

const titleStyle = { fontSize: '28px', marginBottom: '12px', color: '#1E2410' };
const textStyle = { fontSize: '16px', color: '#5D6850', marginBottom: '24px', lineHeight: '1.6' };
const buttonStyle = {
  display: 'inline-block',
  background: '#7CB121',
  color: '#fff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600'
};

function OrderNumber({ orderId }) {
  if (!orderId) return null;
  return (
    <p style={{ fontSize: '13px', color: '#5D6850', marginBottom: '24px' }}>
      Número de pedido:{' '}
      <code style={{ background: '#ECEEE0', padding: '4px 8px', borderRadius: '4px' }}>{orderId}</code>
    </p>
  );
}

export default function PaymentResult({ type }) {
  const [params] = useSearchParams();
  // Enzona añade ?transaction_uuid=... al volver de la pasarela.
  const transactionUuid =
    params.get('transaction_uuid') || params.get('transactionUuid') || '';
  const orderFromUrl = params.get('order') || '';

  const { clearCart } = useCart();
  const [cleared, setCleared] = useState(false);
  const [orderId, setOrderId] = useState(orderFromUrl);
  // idle | checking | paid | pending
  const [verify, setVerify] = useState(
    type === 'exito' && transactionUuid ? 'checking' : 'idle'
  );

  useEffect(() => {
    if (!cleared) {
      try { clearCart(); } catch {}
      setCleared(true);
    }
  }, [cleared, clearCart]);

  // Al volver de Enzona, cerramos la transacción y marcamos el pedido como pagado.
  useEffect(() => {
    if (type !== 'exito' || !transactionUuid) return;

    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/enzona-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_ANON}`
          },
          body: JSON.stringify({ transaction_uuid: transactionUuid })
        });

        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;

        if (data.orderId) setOrderId(data.orderId);
        setVerify(data.paid ? 'paid' : 'pending');
      } catch {
        // Si falla la verificación, no asustamos al cliente: el pedido queda
        // pendiente y lo confirmamos manualmente.
        if (!cancelled) setVerify('pending');
      }
    })();

    return () => { cancelled = true; };
  }, [type, transactionUuid]);

  if (type === 'exito') {
    const checking = verify === 'checking';
    const paid = verify === 'paid';

    return (
      <section style={pageStyle}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>
          {checking ? '⏳' : paid ? '✅' : '🕒'}
        </div>
        <h1 style={titleStyle}>
          {checking ? 'Verificando tu pago…' : paid ? '¡Pago recibido!' : 'Pago en proceso'}
        </h1>
        <p style={textStyle}>
          {checking ? (
            <>Estamos confirmando el pago con Enzona. Espera un momento…</>
          ) : paid ? (
            <>
              Gracias por tu compra. Hemos recibido tu pago correctamente.<br />
              Te contactaremos por WhatsApp o teléfono para coordinar la entrega.
            </>
          ) : (
            <>
              Estamos confirmando tu pago con Enzona. Si ya pagaste, el pedido se
              marcará como pagado en breve.<br />
              Te contactaremos por WhatsApp o teléfono para coordinar la entrega.
            </>
          )}
        </p>
        <OrderNumber orderId={orderId} />
        <Link to="/" style={buttonStyle}>Volver a la tienda</Link>
      </section>
    );
  }

  if (type === 'cancelado') {
    return (
      <section style={pageStyle}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={titleStyle}>Pago cancelado</h1>
        <p style={textStyle}>
          Has cancelado el proceso de pago. Tu pedido sigue guardado pero <strong>no ha sido pagado</strong>.<br />
          Puedes intentarlo de nuevo o elegir pagar por WhatsApp.
        </p>
        <OrderNumber orderId={orderId} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={buttonStyle}>Volver a la tienda</Link>
        </div>
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
      <h1 style={titleStyle}>Pago no completado</h1>
      <p style={textStyle}>
        No se ha podido completar el pago. Puedes volver a intentarlo o contactar con nosotros por WhatsApp.
      </p>
      <Link to="/" style={buttonStyle}>Volver a la tienda</Link>
    </section>
  );
}
