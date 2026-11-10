import { useShop } from '../data/shop';
import { useCurrency } from '../data/currency';

export default function Hero() {
  const { products, loading, shop } = useShop();
  const { fmt } = useCurrency();
  const prices = products.flatMap(p => p.variants.map(v => v.price));
  const desde = prices.length ? Math.min(...prices) : 0;
  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">Tienda de deshidratados · sin azúcar añadida</p>
          <h1 className="hero-title">
            <span className="line"><span className="line-inner" style={{ animationDelay: '.1s' }}>El agua se va,</span></span>
            <span className="line"><span className="line-inner" style={{ animationDelay: '.26s' }}>El sabor</span></span>
            <span className="line"><span className="line-inner em" style={{ animationDelay: '.42s' }}>se queda.</span></span>
          </h1>
          <p className="hero-sub">
            Deshidratamos a baja temperatura lo mejor de cada cosecha: frutas, verduras y
            hierbas sin conservadores. Listas para tu alacena, tu mochila o tu taza.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#catalogo">Ver catálogo ↓</a>
            <a className="btn" href="#proceso">Nuestro proceso</a>
          </div>
          <div className="hero-mini">
            <span>Est. 2019</span><span>Sin conservadores</span><span>Envíos a todo el país</span>
          </div>
        </div>
        <div className="collage">
          {/* Mientras carga Supabase no pintamos ningún <img>: si no,
              se veían las fotos de relleno (aleatorias) hasta que
              llegaban las reales, y el collage "parpadeaba". */}
          {(loading ? [null, null, null] : products.slice(0, 3)).map((p, i) => (
            <figure className={`polaroid p${i + 1}`} key={i}>
              {loading ? (
                <div className="polaroid-sk" aria-hidden="true" />
              ) : (
                <>
                  <img src={p.image} alt={p.name} />
                  <figcaption>{p.name.toLowerCase()} · {p.category}</figcaption>
                </>
              )}
            </figure>
          ))}
          <div className="sun-badge" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs><path id="circ" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
              <text style={{ fontFamily: "'Space Mono', monospace", fontSize: '8.6px', letterSpacing: '2px', fill: '#261B10' }}>
                <textPath href="#circ">SECADO LENTO · SIN CONSERVADORES · </textPath>
              </text>
              <circle cx="60" cy="60" r="13" fill="#B85C38" />
              <g stroke="#261B10" strokeWidth="2" strokeLinecap="round">
                <line x1="60" y1="38" x2="60" y2="43" /><line x1="60" y1="77" x2="60" y2="82" />
                <line x1="38" y1="60" x2="43" y2="60" /><line x1="77" y1="60" x2="82" y2="60" />
                <line x1="44.4" y1="44.4" x2="48" y2="48" /><line x1="72" y1="72" x2="75.6" y2="75.6" />
                <line x1="75.6" y1="44.4" x2="72" y2="48" /><line x1="48" y1="72" x2="44.4" y2="75.6" />
              </g>
            </svg>
          </div>
          {/* Texto editable desde Configuración («Promoción del inicio»);
              si está vacío, se calcula solo con el precio más bajo. */}
          <span className="sticker">
            {(shop && String(shop.heroPromo || '').trim()) || `desde ${fmt(desde)}`}
          </span>
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const { products } = useShop();
  const names = products.length ? products.map(p => p.name) : ['Solaria · deshidratados'];
  const group = (
    <div className="mgroup">
      {names.map(i => <span key={i}>{i} <i>✳</i></span>)}
    </div>
  );
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">{group}{group}</div>
    </div>
  );
}