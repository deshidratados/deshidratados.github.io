import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useShop } from '../data/shop';
import { CURRENCIES, useCurrency } from '../data/currency';
import SunLogo from './SunLogo';

export default function Header({ onCartOpen }) {
  const { itemCount, total } = useCart();
  const { shop, products } = useShop();
  const { currency, setCurrency, fmt } = useCurrency();
  const [msg, setMsg] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const countRef = useRef(null);

  const MSGS = [
    `Envío gratis en pedidos mayores a ${fmt(shop.freeShip)}`,
    products.length
      ? `Nuevo: ${products[0].name} · solo ${products[0].origin}`
      : 'Nueva cosecha disponible',
    'Pedidos por WhatsApp · respuesta el mismo día',
  ];

  useEffect(() => {
    const t = setInterval(() => setMsg(m => (m + 1) % MSGS.length), 4000);
    return () => clearInterval(t);
  }, [MSGS.length]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }, [itemCount]);

  return (
    <>
      <div className="announce" aria-hidden="true"><span key={msg}>{MSGS[msg]}</span></div>
      <header className={'site-header' + (scrolled ? ' scrolled' : '')}>
        <div className="wrap head-in">
          <a href="#top" className="logo">
            <SunLogo size={30} className="logo-sun" />
            <span className="logo-text">Solaria<small>deshidratados · est. 2019</small></span>
          </a>
          <nav className="main">
            <a href="#catalogo">Catálogo</a>
            <a href="#proceso">Proceso</a>
            <a href="#opiniones">Opiniones</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <select
            className="cur-sel"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            aria-label="Moneda de precios"
            title="Ver los precios en…"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <button className="cart-btn" onClick={onCartOpen}>
            🧺 {itemCount > 0 && <span className="cart-total">{fmt(total)}</span>}
            <span className="cart-count" ref={countRef}>{itemCount}</span>
          </button>
          <button className={'burger' + (menu ? ' open' : '')} onClick={() => setMenu(!menu)} aria-label="Menú">
            <span /><span /><span />
          </button>
        </div>
        <nav className={'mnav' + (menu ? ' open' : '')}>
          <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
          <a href="#proceso" onClick={() => setMenu(false)}>Proceso</a>
          <a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
          <a href="#preguntas" onClick={() => setMenu(false)}>Preguntas</a>
        </nav>
      </header>
    </>
  );
}