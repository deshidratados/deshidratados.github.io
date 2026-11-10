export const SHOP = {
  name: 'Salud & Vida',
  whatsapp: '5354410057', // ← código país + número, solo dígitos. Cuba: 53…
  freeShip: 100,            // ← monto (en la moneda base) desde el que no se cobra envío
  // Datos que aparecen en el pie de página. Todos se pueden cambiar desde
  // /admin → Configuración (aquí solo están los valores por defecto).
  email: 'hola@solaria.cu',
  instagram: '@solaria.seca',
  hours: 'Lun – Vie · 9:00 – 18:00\nSábado · 9:00 – 14:00\nDomingo · el sol descansa',
  // Promoción que se superpone a las fotos del inicio (Hero).
  // Vacío = cartel automático con el precio más bajo del catálogo.
  heroPromo: '',
  // MULTI-MONEDA. Los precios del catálogo se guardan en `currencyBase`.
  // rateCUP = cuántos pesos cubanos vale 1 USD. rateEUR = cuántos euros vale 1 USD.
  // NO son automáticos: el negocio los ajusta desde /admin → Configuración.
  currencyBase: 'USD',
  rateCUP: '250',
  rateEUR: '0.92'
};