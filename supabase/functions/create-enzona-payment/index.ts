// Supabase Edge Function: create-enzona-payment
// Crea un pago en la API Payment v1.0.0 de Enzona y devuelve el enlace de pago.
//
// Flujo oficial de Enzona:
//   1. POST {base}/token  (Basic auth con consumer_key:consumer_secret)
//      body: grant_type=client_credentials&scope=enzona_business_payment
//   2. POST {base}/payment/v1.0.0/payments  (Bearer token)
//      → { transaction_uuid, links: [{ href: <enlace de pago> }, ...] }
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   ENZONA_CONSUMER_KEY     Consumer Key del panel de Enzona
//   ENZONA_CONSUMER_SECRET  Consumer Secret
//   ENZONA_MERCHANT_UUID    UUID del comercio (panel → Comercios → Detalles)
//   ENZONA_ENV              sandbox | production   (por defecto sandbox)
// Opcionales:
//   ENZONA_TERMINAL_ID      Terminal/POS si el panel lo exige
//   ENZONA_API_BASE         Fuerza la base (p. ej. https://apisandbox.enzona.net)
//
// El pedido guarda su total en la moneda base (USD por defecto) y Enzona cobra
// en CUP: se convierte con el tipo de cambio `rateCUP` de la tabla settings.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_BASES: Record<string, string> = {
  sandbox: 'https://apisandbox.enzona.net',
  production: 'https://api.enzona.net',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Método no permitido' }, 405);
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.orderId) {
      return json({ error: 'Falta orderId' }, 400);
    }

    const { orderId, returnUrl, cancelUrl } = body;

    const CONSUMER_KEY = Deno.env.get('ENZONA_CONSUMER_KEY');
    const CONSUMER_SECRET = Deno.env.get('ENZONA_CONSUMER_SECRET');
    const MERCHANT_UUID =
      Deno.env.get('ENZONA_MERCHANT_UUID') || Deno.env.get('ENZONA_MERCHANT_ID');
    const ENV = (Deno.env.get('ENZONA_ENV') || 'sandbox').toLowerCase();
    const API_BASE =
      Deno.env.get('ENZONA_API_BASE') || API_BASES[ENV] || API_BASES.sandbox;
    const TERMINAL_ID = Deno.env.get('ENZONA_TERMINAL_ID') || '';

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !MERCHANT_UUID) {
      return json(
        {
          error:
            'Faltan credenciales de Enzona. Configura ENZONA_CONSUMER_KEY, ' +
            'ENZONA_CONSUMER_SECRET y ENZONA_MERCHANT_UUID en ' +
            'Supabase → Edge Functions → Secrets.',
        },
        500
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = createClient(supabaseUrl, serviceKey);

    // Pedido a cobrar
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, total, payment_method, payment_status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ error: 'Pedido no encontrado' }, 404);
    }

    // Enzona cobra en CUP: convertir desde la moneda base del pedido.
    // Los precios del catálogo están en `currencyBase` y los tipos de cambio
    // (rateCUP, rateEUR) son "por 1 USD", igual que en src/data/currency.js.
    const { data: settings } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['rateCUP', 'rateEUR', 'currencyBase']);

    const setting = (key: string) =>
      (settings || []).find((s: { key: string }) => s.key === key)?.value;

    const rateCUP = Number(setting('rateCUP')) || 0;
    const rateEUR = Number(setting('rateEUR')) || 0;
    const baseCurrency = String(setting('currencyBase') || 'USD').toUpperCase();
    const totalBase = Number(order.total) || 0;

    // 1) Pasar el total a USD (moneda intermedia) y 2) de USD a CUP.
    let totalUsd = totalBase;
    if (baseCurrency === 'CUP' && rateCUP > 0) totalUsd = totalBase / rateCUP;
    if (baseCurrency === 'EUR' && rateEUR > 0) totalUsd = totalBase / rateEUR;
    const amountCUP =
      rateCUP > 0
        ? Math.round(totalUsd * rateCUP * 100) / 100
        : Math.round(totalBase * 100) / 100;

    // 1. Token de acceso
    const token = await getToken(API_BASE, CONSUMER_KEY, CONSUMER_SECRET);

    // 2. Crear el pago
    const invoiceNo = `SV-${String(orderId).slice(0, 8).toUpperCase()}-${Date.now()
      .toString()
      .slice(-6)}`;

    const amountStr = amountCUP.toFixed(2);

    const payload: Record<string, unknown> = {
      merchant_uuid: MERCHANT_UUID,
      description: `Pedido Salud & Vida ${String(orderId).slice(0, 8)}`,
      currency: 'CUP',
      amount: {
        total: amountStr,
        details: {
          shipping: '0.00',
          tax: '0.00',
          discount: '0.00',
          tip: '0.00',
        },
      },
      // Enzona calcula el total a partir de los ítems: usamos una línea
      // consolidada por el total para que el importe coincida exactamente.
      items: [
        {
          name: 'Pedido Salud & Vida',
          description: `Pedido ${String(orderId).slice(0, 8)}`,
          quantity: 1,
          price: amountStr,
          tax: '0.00',
        },
      ],
      merchant_op_id: String(orderId),
      invoice_number: invoiceNo,
      return_url: returnUrl || '',
      cancel_url: cancelUrl || returnUrl || '',
      buyer_identity_code: '',
    };
    if (TERMINAL_ID) payload.terminal_id = TERMINAL_ID;

    const res = await fetch(`${API_BASE}/payment/v1.0.0/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Enzona create-payment error', res.status, data);
      return json(
        {
          error: 'Enzona rechazó la creación del pago',
          status: res.status,
          detail: data,
        },
        502
      );
    }

    const transactionUuid: string = data.transaction_uuid || '';
    if (!transactionUuid) {
      console.error('Enzona sin transaction_uuid:', data);
      return json({ error: 'Enzona no devolvió transaction_uuid', detail: data }, 502);
    }

    // El enlace de pago viene en links[0].href; si no, se construye el checkout.
    const link =
      Array.isArray(data.links) && data.links[0] && data.links[0].href
        ? String(data.links[0].href)
        : `${API_BASE}/payment/v1.0.0/payments/checkout/${transactionUuid}`;

    await db
      .from('orders')
      .update({ payment_ref: transactionUuid, payment_url: link })
      .eq('id', orderId);

    return json({
      paymentUrl: link,
      transactionUuid,
      invoiceNo,
      amountCUP: amountCUP.toFixed(2),
    });
  } catch (err) {
    console.error('Error en create-enzona-payment:', err);
    return json({ error: 'Error interno del servidor', detail: String(err) }, 500);
  }
});

async function getToken(
  apiBase: string,
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  const basic = btoa(`${consumerKey}:${consumerSecret}`);

  const request = (base: string) =>
    fetch(`${base}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=enzona_business_payment',
    });

  let res = await request(apiBase);

  // En sandbox el token a veces vive en la base de producción: reintento.
  if (!res.ok && apiBase !== API_BASES.production) {
    res = await request(API_BASES.production);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `No se pudo obtener el token de Enzona (${res.status}): ${JSON.stringify(data)}`
    );
  }
  return String(data.access_token);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
