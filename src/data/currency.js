import { createContext, useContext, useMemo, useState } from 'react';
import { useShop } from './shop';

// ============================================================
// MULTI-MONEDA · CUP / USD / EUR
//
// Los precios se guardan en la base de datos en una sola moneda
// (la "moneda base", configurable en /admin → Configuración).
// Al mostrarlos se convierten a la moneda que el visitante eligió
// o a la que se detectó por su idioma.
//
// IMPORTANTE: los tipos de cambio NO son automáticos. El negocio
// los fija manualmente porque en Cuba el tipo de cambio real no
// es el oficial. Se configuran en /admin → Configuración.
// ============================================================

export const CURRENCIES = [
  { code: 'CUP', label: 'Peso cubano',  flag: '🇨🇺', symbol: '$',   decimals: 0, step: 5    },
  { code: 'USD', label: 'Dólar',        flag: '🇺🇸', symbol: 'US$', decimals: 2, step: 0    },
  { code: 'EUR', label: 'Euro',         flag: '🇪🇺', symbol: '€',   decimals: 2, step: 0.5  }
];

const BY_CODE = CURRENCIES.reduce((acc, c) => ({ ...acc, [c.code]: c }), {});
const STORE_KEY = 'solaria-currency';

// Regiones cuya moneda de referencia es el euro.
const EUR_REGIONS = new Set([
  'ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'IE', 'LU',
  'MT', 'CY', 'GR', 'FI', 'SK', 'SI', 'LV', 'LT', 'EE', 'HR'
]);

// Detecta la moneda según el idioma/región del navegador.
// Cuba → CUP · Zona euro → EUR · Todo lo demás → USD (moneda universal).
function detectCurrency() {
  try {
    const parts = (navigator.language || 'en-US').split('-');
    const region = (parts[1] || parts[0] || '').toUpperCase();
    if (region === 'CU') return 'CUP';
    if (EUR_REGIONS.has(region)) return 'EUR';
    return 'USD';
  } catch {
    return 'USD';
  }
}

function readStored() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v && BY_CODE[v] ? v : null;
  } catch {
    return null; // modo privado / navegador sin almacenamiento
  }
}

const fmtAmount = (value, code) => {
  const c = BY_CODE[code] || BY_CODE.USD;
  const n = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: c.decimals
  }).format(value);
  return `${c.symbol}${n}`;
};

const CurrencyContext = createContext({
  currency: 'USD',
  setCurrency: () => {},
  fmt: (v) => String(v),
  convert: (v) => v,
  isBase: true
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
  const { shop } = useShop();
  const [currency, setCurrencyState] = useState(() => readStored() || detectCurrency());

  // La elección manual queda guardada y se respeta en la próxima visita.
  const setCurrency = (code) => {
    if (!BY_CODE[code]) return;
    setCurrencyState(code);
    try { localStorage.setItem(STORE_KEY, code); } catch { /* sin almacenamiento */ }
  };

  const base = shop.currencyBase && BY_CODE[shop.currencyBase] ? shop.currencyBase : 'CUP';
  const rateCUP = Number(shop.rateCUP) || 0;
  const rateEUR = Number(shop.rateEUR) || 0;

  const value = useMemo(() => {
    // Primero pasa a USD (moneda intermedia), luego a la moneda de pantalla.
    const toUsd = (amount) => {
      if (base === 'USD') return amount;
      const rate = base === 'CUP' ? rateCUP : rateEUR;
      return rate ? amount / rate : amount;
    };
    const convert = (amount) => {
      const usd = toUsd(Number(amount) || 0);
      if (currency === 'USD') return usd;
      const rate = currency === 'CUP' ? rateCUP : rateEUR;
      return rate ? usd * rate : usd;
    };
    // Redondea a pasos "de tienda" para que el precio convertido no parezca
    // una calculadora: CUP al múltiplo de 5, EUR al medio euro.
    const fmt = (amount) => {
      const c = BY_CODE[currency] || BY_CODE.USD;
      const raw = convert(amount);
      const stepped = c.step ? Math.round(raw / c.step) * c.step : raw;
      return fmtAmount(stepped, c.code);
    };
    return { currency, setCurrency, convert, fmt, base, isBase: currency === base };
  }, [currency, base, rateCUP, rateEUR]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
