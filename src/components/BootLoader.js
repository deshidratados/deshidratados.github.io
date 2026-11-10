// Pantalla de carga inicial de la tienda.
// Se ve hasta que Supabase responda y terminen de descargar las imágenes
// principales del catálogo — o hasta venza el tope de 4 s del ShopProvider.
// Mismo lenguaje visual que la tienda: fondo crema, sol terracota, mono.
export default function BootLoader({ loaded = 0, total = 0 }) {
  return (
    <div className="boot" role="status" aria-live="polite">
      <svg className="boot-sun" viewBox="0 0 120 120" width="110" height="110" aria-hidden="true">
        <g stroke="#1E2410" strokeWidth="5" strokeLinecap="round">
          <line x1="60" y1="8" x2="60" y2="22" />
          <line x1="60" y1="98" x2="60" y2="112" />
          <line x1="8" y1="60" x2="22" y2="60" />
          <line x1="98" y1="60" x2="112" y2="60" />
          <line x1="23" y1="23" x2="33" y2="33" />
          <line x1="87" y1="87" x2="97" y2="97" />
          <line x1="97" y1="23" x2="87" y2="33" />
          <line x1="33" y1="87" x2="23" y2="97" />
        </g>
        <circle cx="60" cy="60" r="28" fill="#7CB121" />
      </svg>
      <p className="boot-name">SALUD & VIDA</p>
      <p className="boot-sub">deshidratados · cargando la tienda</p>
      {total > 0 && (
        <p className="boot-count">{Math.min(loaded, total)} de {total} imágenes</p>
      )}
    </div>
  );
}
