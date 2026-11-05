import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ShopProvider, useShop } from './data/shop';
import BootLoader from './components/BootLoader';
import Header from './components/Header';
import Hero, { Marquee } from './components/Hero';
import Catalog from './components/Catalog';
import { Process, Testimonials, Faq, Newsletter, Footer } from './components/Sections';
import CartDrawer from './components/CartDrawer';
import LegalPage from './components/LegalPage';
import AdminApp from './admin/AdminApp';
import { CurrencyProvider } from './data/currency';
import PaymentResult from './components/PaymentResult';
import './App.css';

function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Catalog />
      <Process />
      <Testimonials />
      <Faq />
      <Newsletter />
    </>
  );
}

// Sincroniza la posición de la vista con la ruta.
//   · "#proceso" y demás anclas de la portada -> scroll a esa sección.
//   · Página nueva (documento legal) -> principio.
//   · Al volver atrás (POP) no se toca nada: se respeta el scroll guardado.
//
// Sin esto, al entrar a una página legal el navegador conserva la posición
// del pie; como la página legal es más corta que la tienda, el navegador
// "comprime" el scroll hasta el final y se ve el final del documento.
function ScrollManager() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    const id = pathname.replace(/^\/+/, '');
    const el = id ? document.getElementById(id) : null;
    if (el) { el.scrollIntoView(); return; }
    // 'instant' a propósito: html{} tiene scroll-behavior:smooth, y cambiar
    // de página no debe arrastrar una animación de todo el alto de la tienda.
    if (navType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navType]);

  return null;
}

function Store() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <CartProvider>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main>
        <Routes>
          {/* Una sola ruta comodín para toda la portada: así "/" y "#proceso"
              caen en el MISMO route y Home nunca se desmonta. Si se usara
              <Route index> + otro, cambiar de "#" a "#proceso" desmontaría la
              tienda y solo quedaría el pie de página (salto al final). */}
          <Route path="pago/exito" element={<PaymentResult type="exito" />} />
          <Route path="pago/cancelado" element={<PaymentResult type="cancelado" />} />
          <Route path="pago/fallido" element={<PaymentResult type="fallido" />} />
          <Route path="*" element={<Home />} />
          <Route path="doc/:slug" element={<LegalPage />} />
        </Routes>
      </main>
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </CartProvider>
  );
}

// La primera carga de la visita no revela la tienda hasta que estén los
// datos y las imágenes principales del catálogo (o venza el tope de 4 s):
// así nunca se ven placeholders ni parpadeos al entrar. Solo afecta a esa
// primera carga; navegar por la tienda ya no vuelve a pasar por aquí.
function BootGate({ children }) {
  const { ready, progress } = useShop();
  if (!ready) return <BootLoader loaded={progress.loaded} total={progress.total} />;
  return children;
}

function App() {
  return (
    <HashRouter>
      <ScrollManager />
      <ShopProvider>
        <BootGate>
          <CurrencyProvider>
            <Routes>
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="*" element={<Store />} />
            </Routes>
          </CurrencyProvider>
        </BootGate>
      </ShopProvider>
    </HashRouter>
  );
}

export default App;