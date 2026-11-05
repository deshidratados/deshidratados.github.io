import { createContext, useContext, useEffect, useState } from 'react';
import { configured, supabase, publicImageUrl, moneySettings, SETTINGS_KEYS } from './supabase';
import { products as seedProducts, categories as seedCategories } from './products';
import { SHOP } from './config';

const ShopContext = createContext({
  loading: true,
  ready: false,
  progress: { loaded: 0, total: 0 },
  products: seedProducts,
  categories: seedCategories,
  shop: SHOP
});

export function useShop() {
  return useContext(ShopContext);
}

const DEFAULT_CATS = [{ id: 'todos', label: 'Todos' }];

function mapProduct(row, catBySlug, variantsByProduct, presById) {
  const vs = (variantsByProduct[row.id] || [])
    .sort((a, b) => Number(a.weight || '0') - Number(b.weight || '0'))
    .map(v => {
      const pres = v.presentation_id && presById[v.presentation_id] ? presById[v.presentation_id] : '';
      return {
        id: v.id,
        label: pres ? `${pres} · ${v.label}` : v.label,
        price: Number(v.price),
        presentation: pres || null,
        images: Array.isArray(v.images) ? v.images.map(publicImageUrl) : []
      };
    });
  return {
    dbId: row.id,
    id: row.slug,
    name: row.name,
    category: catBySlug[row.category_id] ? catBySlug[row.category_id].slug : '',
    description: row.description || '',
    origin: row.origin || '',
    rating: Number(row.rating) || 0,
    reviews: Number(row.reviews) || 0,
    badge: row.badge || null,
    image: publicImageUrl(row.image),
    images: (Array.isArray(row.images) && row.images.length ? row.images : []).map(publicImageUrl),
    variants: vs
  };
}

async function loadFromSupabase() {
  const [{ data: cats }, { data: prods }, { data: vars }, { data: settings }, { data: presents }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('variants').select('*').order('weight'),
    supabase.from('settings').select('key, value').in('key', SETTINGS_KEYS),
    supabase.from('presentations').select('*')
  ]);

  const catBySlug = {};
  (cats || []).forEach(c => { catBySlug[c.id] = c; });

  const presById = {};
  (presents || []).forEach(p => { presById[p.id] = p.name; });

  const variantsByProduct = {};
  (vars || []).forEach(v => {
    (variantsByProduct[v.product_id] = variantsByProduct[v.product_id] || []).push(v);
  });

  const list = (prods || []).map(p => mapProduct(p, catBySlug, variantsByProduct, presById));
  return {
    products: list,
    categories: [...DEFAULT_CATS, ...(cats || []).map(c => ({ id: c.slug, label: c.label }))],
    shop: { ...SHOP, ...moneySettings(settings || []) }
  };
}

// Tope (ms) de la pantalla de carga: aunque falte algo por descargar, a los
// 4 s se revela la tienda y lo que falte entra después tras el placeholder
// de marca. Evita dejar al visitante esperando sin límite en conexiones lentas.
const BOOT_TIMEOUT_MS = 4000;

export function ShopProvider({ children }) {
  const [state, setState] = useState({ loading: true, products: seedProducts, categories: seedCategories, shop: SHOP });
  // "ready" = revelar la tienda: datos resueltos + imágenes principales
  // descargadas (o tope vencido). "progress" alimenta el contador del BootLoader.
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  useEffect(() => {
    let alive = true;

    // Precarga la imagen principal de cada producto. Se da por "listo"
    // cuando todas terminan de descargar — onload y onerror cuentan igual,
    // porque una imagen rota nunca va a llegar y esperarla eternamente
    // solo bloquearía la página.
    const warm = prods => {
      const urls = [...new Set((prods || []).map(p => p.image).filter(Boolean))];
      if (!urls.length) { setReady(true); return; }
      let loaded = 0;
      urls.forEach(url => {
        const img = new Image();
        img.onload = img.onerror = () => {
          if (!alive) return;
          loaded += 1;
          setProgress({ loaded, total: urls.length });
          if (loaded >= urls.length) setReady(true);
        };
        img.src = url;
      });
    };

    // Red de seguridad del tope: revela aunque algo se atasque
    // (una espera infinita dejaría al visitante en pantalla en blanco).
    const revealTimer = setTimeout(() => { if (alive) setReady(true); }, BOOT_TIMEOUT_MS);

    if (!configured || !supabase) {
      setState({ loading: false, products: seedProducts, categories: seedCategories, shop: SHOP });
      warm(seedProducts);
      return () => { alive = false; clearTimeout(revealTimer); };
    }
    loadFromSupabase()
      .then(data => {
        if (!alive) return;
        const okProducts = data.products && data.products.length > 0;
        setState({
          loading: false,
          products: okProducts ? data.products : seedProducts,
          categories: okProducts ? data.categories : seedCategories,
          shop: data.shop && data.shop.whatsapp ? data.shop : SHOP
        });
        warm(okProducts ? data.products : seedProducts);
      })
      .catch(() => {
        if (!alive) return;
        setState({ loading: false, products: seedProducts, categories: seedCategories, shop: SHOP });
        warm(seedProducts);
      });
    return () => { alive = false; clearTimeout(revealTimer); };
  }, []);

  return <ShopContext.Provider value={{ ...state, ready, progress }}>{children}</ShopContext.Provider>;
}

// Registra un pedido en la base. Devuelve { ok, error, data }.
// Si Supabase no está configurado responde ok:false sin romper el checkout (sigue el flujo de WhatsApp).
export async function submitOrder({ customerName, phone, items, total, shopName, paymentMethod = 'whatsapp', paymentStatus = 'pendiente' }) {
  if (!configured || !supabase) return { ok: false };
  try {
    const { data, error } = await supabase.from('orders').insert({
      customer_name: customerName,
      phone,
      items,
      total,
      status: 'Nuevo',
      payment_method: paymentMethod,
      payment_status: paymentStatus
    }).select().single();
    return { ok: !error, error: error ? error.message : null, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}