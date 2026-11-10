import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useShop } from '../data/shop';
import { useCurrency } from '../data/currency';
import CheckoutForm from './CheckoutForm';

// La canasta se recorre en dos pasos dentro del mismo drawer:
//   paso 1 → la lista de productos
//   paso 2 → el formulario de contacto
//
// Se alternan con display:none (.off) y NO con renderizado condicional:
// CheckoutForm guarda en su estado interno el nombre, el país y el teléfono,
// y si se desmonta al volver al paso 1 se perdería todo lo que el usuario ya
// había escrito. Al estar oculto y no desmontado, tampoco participa en el
// flex del drawer, así que no roba altura a la lista — que era justo el
// problema original: el pie, con el formulario dentro, aplastaba la lista.
export default function CartDrawer({ isOpen, onClose }) {
  const { cart, updateQuantity, removeFromCart, clearCart, total, itemCount } = useCart();
  const { shop } = useShop();
  const { fmt, currency, isBase } = useCurrency();
  const [step, setStep] = useState(1);
  const pct = shop.freeShip > 0 ? Math.min(100, (total / shop.freeShip) * 100) : 0;

  // Al cerrar el drawer se vuelve al paso 1: reabrirla debe enseñar siempre la
  // lista, no un formulario a medio cumplimentar de la visita anterior.
  useEffect(() => { if (!isOpen) setStep(1); }, [isOpen]);

  return (
    <>
      <div className={'scrim' + (isOpen ? ' show' : '')} onClick={onClose} />
      <aside className={'drawer' + (isOpen ? ' open' : '')} aria-label="Canasta de compras">
        <div className="drawer-head">
          <h3>{step === 2 ? 'Finalizar pedido' : `Tu canasta (${itemCount})`}</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Resumen del paso 2: responde a "qué compro y por cuánto" sin
            tener que volver atrás a mirarlo. */}
        {step === 2 && cart.length > 0 && (
          <div className="co-bar">
            <button className="co-back" onClick={() => setStep(1)}>← Volver</button>
            <span className="count">
              {itemCount} artículo{itemCount !== 1 ? 's' : ''}
            </span>
            <b className="sum">{fmt(total)}</b>
          </div>
        )}

        <div className={'cart-list' + (step === 2 ? ' off' : '')}>
          {cart.length === 0 ? (
            <div className="cart-empty">
              <img src={process.env.PUBLIC_URL + '/logo_tienda.png'} alt="" style={{ width: '56px', height: 'auto', borderRadius: '10px', opacity: .85 }} />
              <p>Tu canasta está vacía.</p>
              {/* Ancla real a la sección del catálogo: antes era un botón
                  que solo cerraba el cajón sin llevar a ninguna parte.
                  El scroll suave viene de `html{scroll-behavior:smooth}`. */}
              <a className="btn btn-primary" href="#catalogo" onClick={onClose}>Ver catálogo</a>
            </div>
          ) : cart.map(item => (
            <div className="c-item" key={item.id + item.variant.id}>
              <img src={item.image} alt="" />
              <div>
                <div className="c-name">{item.name}</div>
                <div className="c-meta">{item.variant.label} · {fmt(item.variant.price)} c/u</div>
                <div className="c-controls">
                  <button onClick={() => updateQuantity(item.id, item.variant.id, item.quantity - 1)} aria-label="Menos">−</button>
                  <span className="qty">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.variant.id, item.quantity + 1)} aria-label="Más">+</button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="c-total">{fmt(item.quantity * item.variant.price)}</div>
                <button className="c-del" onClick={() => removeFromCart(item.id, item.variant.id)}>quitar</button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className={'drawer-foot' + (step === 2 ? ' off' : '')}>
            {shop.freeShip > 0 && (
              <>
                <div className="ship-bar"><div className="ship-fill" style={{ width: pct + '%' }} /></div>
                <p className="ship-msg">
                  {total >= shop.freeShip
                    ? '🎉 ¡Tienes envío gratis!'
                    : `Te faltan ${fmt(shop.freeShip - total)} para envío gratis`}
                </p>
              </>
            )}
            {!isBase && (
              <p className="cur-note">
                Precios convertidos a {currency}. El importe final se fija en {shop.currencyBase} por WhatsApp.
              </p>
            )}
            <div className="subtotal-row"><span>Subtotal</span><b>{fmt(total)}</b></div>
            <button className="wa-btn" onClick={() => setStep(2)}>
              Continuar →
            </button>
            <button className="clear-btn" onClick={clearCart}>Vaciar canasta</button>
          </div>
        )}

        {/* Siempre montado (ver comentario al inicio): tras un pedido
            registrado el carrito queda vacío y el mensaje de éxito vive
            aquí, dentro del paso 2. */}
        <div className={'checkout-pane' + (step === 1 ? ' off' : '')}>
          <CheckoutForm items={cart} total={total} onPlaced={clearCart} onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
