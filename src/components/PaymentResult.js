import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function PaymentResult({ type }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { clearCart } = useCart();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (!cleared) {
      try { clearCart(); } catch {}
      setCleared(true);
    }
  }, [cleared, clearCart]);

  if (type === 'exito') {
    return (
      <section style={{ maxWidth: '680px', margin: '40px auto', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h1 style={{ fontSize: '28px', marginBottom: '12px', color: '#1a1613' }}>¡Pago recibido!</h1>
        <p style={{ fontSize: '16px', color: '#6b6259', marginBottom: '24px', lineHeight: '1.6' }}>
          Gracias por tu compra. Hemos recibido tu pago correctamente.<br/>
          Te contactaremos por WhatsApp o teléfono para coordinar la entrega.
        </p>
        {orderId && (
          <p style={{ fontSize: '13px', color: '#8a7a63', marginBottom: '24px' }}>
            Número de pedido: <code style={{ background: '#f7f4ee', padding: '4px 8px', borderRadius: '4px' }}>{orderId}</code>
          </p>
        )}
        <Link to="/" style={{ display: 'inline-block', background: '#b8471c', color: '#fff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
          Volver a la tienda
        </Link>
      </section>
    );
  }

  if (type === 'cancelado') {
    return (
      <section style={{ maxWidth: '680px', margin: '40px auto', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '28px', marginBottom: '12px', color: '#1a1613' }}>Pago cancelado</h1>
        <p style={{ fontSize: '16px', color: '#6b6259', marginBottom: '24px', lineHeight: '1.6' }}>
          Has cancelado el proceso de pago. Tu pedido sigue guardado pero <strong>no ha sido pagado</strong>.<br/>
          Puedes intentarlo de nuevo o elegir pagar por WhatsApp.
        </p>
        {orderId && (
          <p style={{ fontSize: '13px', color: '#8a7a63', marginBottom: '24px' }}>
            Número de pedido: <code style={{ background: '#f7f4ee', padding: '4px 8px', borderRadius: '4px' }}>{orderId}</code>
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'inline-block', background: '#b8471c', color: '#fff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
            Volver a la tienda
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: '680px', margin: '40px auto', padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
      <h1 style={{ fontSize: '28px', marginBottom: '12px', color: '#1a1613' }}>Pago no completado</h1>
      <p style={{ fontSize: '16px', color: '#6b6259', marginBottom: '24px', lineHeight: '1.6' }}>
        No se ha podido completar el pago. Puedes volver a intentarlo o contactar con nosotros por WhatsApp.
      </p>
      <Link to="/" style={{ display: 'inline-block', background: '#b8471c', color: '#fff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
        Volver a la tienda
      </Link>
    </section>
  );
}
