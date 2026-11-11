// Supabase Edge Function: enzona-confirm
// Confirma el resultado de un pago de Enzona cuando el cliente vuelve a la tienda.
//
// Enzona NO usa webhooks: al terminar, redirige a `return_url` añadiendo
// `?transaction_uuid=...`. El comercio debe cerrar la transacción llamando a:
//   POST {base}/payment/v1.0.0/payments/{transaction_uuid}/complete
// y luego marcar el pedido como pagado si Enzona lo confirma.
//
// Se puede llamar de dos formas:
//   POST { transaction_uuid, orderId? }
//   GET  ?transaction_uuid=...&order=...
//
// Secrets: los mismos que create-enzona-payment
//   ENZONA_CONSUMER_KEY, ENZONA_CONSUMER_SECRET, ENZONA_MERCHANT_UUID
//   ENZONA_ENV (sandbox | production), ENZONA_API_BASE (opcional)

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    let transactionUuid = '';
    let orderId = '';

    if (req.method === 'GET') {
      const url = new URL(req.url);
      transactionUuid =
        url.searchParams.get('transaction_uuid') ||
        url.searchParams.get('transactionUuid') ||
        '';
      orderId = url.searchParams.get('order') || url.searchParams.get('orderId') || '';
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      transactionUuid = body.transaction_uuid || body.transactionUuid || '';
      orderId = body.orderId || body.order || '';
    } else {
      return json({ error: 'Método no permitido' }, 405);
    }

    const CONSUMER_KEY = Deno.env.get('ENZONA_CONSUMER_KEY');
    const CONSUMER_SECRET = Deno.env.get('ENZONA_CONSUMER_SECRET');
    const ENV = (Deno.env.get('ENZONA_ENV') || 'sandbox').toLowerCase();
    const API_BASE =
      Deno.env.get('ENZONA_API_BASE') || API_BASES[ENV] || API_BASES.sandbox;

    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      return json(
        {
          error:
            'Faltan credenciales de Enzona (ENZONA_CONSUMER_KEY / ENZONA_CONSUMER_SECRET).',
        },
        500
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = createClient(supabaseUrl, serviceKey);

    // Localizar el pedido por transaction_uuid (payment_ref) o por id.
    let order: { id: string; payment_status: string; payment_ref: string | null } | null =
      null;

    if (transactionUuid) {
      const { data } = await db
        .from('orders')
        .select('id, payment_status, payment_ref')
        .eq('payment_ref', transactionUuid)
        .maybeSingle();
      order = data;
    }

    if (!order && orderId) {
      const { data } = await db
        .from('orders')
        .select('id, payment_status, payment_ref')
        .eq('id', orderId)
        .maybeSingle();
      order = data;
      if (order && !transactionUuid) transactionUuid = order.payment_ref || '';
    }

    if (!transactionUuid) {
      return json(
        { ok: false, paid: false, error: 'Falta transaction_uuid' },
        400
      );
    }

    const token = await getToken(API_BASE, CONSUMER_KEY, CONSUMER_SECRET);
    const uuidPath = encodeURIComponent(transactionUuid);

    // 1) Completar la transacción (cierra el pago).
    let statusData: Record<string, unknown> = {};
    let completeOk = false;

    const completeRes = await fetch(
      `${API_BASE}/payment/v1.0.0/payments/${uuidPath}/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: '{}',
      }
    );
    statusData = await completeRes.json().catch(() => ({}));
    completeOk = completeRes.ok;

    if (!completeRes.ok) {
      console.log('Enzona complete no OK:', completeRes.status, statusData);
      // 2) Si no se pudo completar, consultar el estado actual del pago.
      const getRes = await fetch(
        `${API_BASE}/payment/v1.0.0/payments/${uuidPath}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      statusData = await getRes.json().catch(() => ({}));
      console.log('Enzona status:', getRes.status, statusData);
    }

    const status = extractStatus(statusData);
    const paid = completeOk || isPaidStatus(status, statusData);

    if (order && paid && order.payment_status !== 'pagado') {
      await db
        .from('orders')
        .update({
          payment_status: 'pagado',
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      console.log(`Pedido ${order.id} marcado como PAGADO via Enzona`);
    } else if (
      order &&
      order.payment_status === 'pendiente' &&
      isFailedStatus(status)
    ) {
      await db.from('orders').update({ payment_status: 'fallido' }).eq('id', order.id);
    }

    return json({
      ok: true,
      paid,
      status,
      completeOk,
      orderId: order?.id || orderId || null,
    });
  } catch (err) {
    console.error('Error en enzona-confirm:', err);
    return json({ ok: false, paid: false, error: 'Error interno', detail: String(err) }, 500);
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

// Enzona devuelve `status_denom` como lista (p. ej. ["Confirmada"]) y, según
// el endpoint, también `status`/`state` o `operations[].status_denom`.
function extractStatus(data: Record<string, unknown>): string {
  if (!data || typeof data !== 'object') return '';

  const candidates: unknown[] = [
    data.status_denom,
    data.statusDenom,
    data.status,
    data.state,
  ];

  const ops = data.operations;
  if (Array.isArray(ops)) {
    for (const op of ops) {
      if (op && typeof op === 'object') {
        const o = op as Record<string, unknown>;
        candidates.push(o.status_denom, o.statusDenom, o.status, o.state);
      }
    }
  }

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return String(c[0]);
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number') return String(c);
  }
  return '';
}

function isPaidStatus(status: string, data: Record<string, unknown>): boolean {
  const s = (status || '').toLowerCase();
  // 1116 = Confirmada, 1111 = Aceptada
  if (s === '1116' || s === '1111') return true;
  if (/confirm|acept|accepted|complet|pagad|paid|success|aprob/.test(s)) return true;

  // Algunas respuestas anidan el estado en operations[].
  const ops = data.operations;
  if (Array.isArray(ops)) {
    return ops.some((op) => {
      if (!op || typeof op !== 'object') return false;
      const o = op as Record<string, unknown>;
      const raw = o.status_denom || o.statusDenom || o.status || o.state;
      const val = Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
      return /confirm|acept|accepted|complet|pagad|paid|success|aprob/i.test(val);
    });
  }
  return false;
}

function isFailedStatus(status: string): boolean {
  return /cancel|fail|fallid|expir|rechaz|deneg/i.test(status || '');
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
