// Supabase Edge Function: create-enzona-payment
// Genera la URL de pago para Enzona y redirige/retorna al frontend
//
// Uso:
//   POST /functions/v1/create-enzona-payment
//   Body: { orderId, amount, customerName, phone, items, returnUrl, cancelUrl }
//
// Secrets necesarios:
//   ENZONA_MERCHANT_ID
//   ENZONA_SECRET_KEY (o ENZONA_API_KEY)
//   ENZONA_ENV = sandbox | production (opcional, por defecto sandbox)
//
// NOTA: La integración exacta de Enzona puede variar. Ajustar según
// la documentación que recibas del panel de comerciante.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    if (!body) {
      return json({ error: 'JSON inválido' }, 400);
    }

    const { orderId, amount, customerName, phone, items, returnUrl, cancelUrl } = body;

    if (!orderId || !amount) {
      return json({ error: 'Faltan datos obligatorios' }, 400);
    }

    const MERCHANT_ID = Deno.env.get('ENZONA_MERCHANT_ID');
    const SECRET_KEY = Deno.env.get('ENZONA_SECRET_KEY') || Deno.env.get('ENZONA_API_KEY');
    const ENV = Deno.env.get('ENZONA_ENV') || 'sandbox';

    if (!MERCHANT_ID || !SECRET_KEY) {
      return json({ 
        error: 'Faltan credenciales de Enzona. Configura ENZONA_MERCHANT_ID y ENZONA_SECRET_KEY en Edge Functions > Secrets.' 
      }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEYS') || '';
    const db = createClient(supabaseUrl, serviceKey);

    // Verificar que el pedido existe
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, total, payment_method')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ error: 'Pedido no encontrado' }, 404);
    }

    // URLs base según entorno
    // NOTA: Ajustar estas URLs cuando tengas la documentación oficial de Enzona
    const baseUrl = ENV === 'production' 
      ? 'https://www.enzona.net' 
      : 'https://sandbox.enzona.net';

    // Generar referencia única
    const invoiceNo = `SOL-${orderId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Parámetros para Enzona (formato genérico - AJUSTAR SEGÚN DOCUMENTACIÓN)
    const params: Record<string, string> = {
      merchant_id: MERCHANT_ID,
      invoice_number: invoiceNo,
      amount: Number(amount).toFixed(2),
      currency: 'CUP', // Ajustar si es USD
      description: `Pedido Solaria - ${orderId.slice(0, 8)}`,
      return_url: returnUrl || '',
      cancel_url: cancelUrl || returnUrl || '',
      customer_name: customerName || '',
      customer_phone: phone || '',
    };

    // Generar firma HMAC-SHA256 (método común - AJUSTAR SEGÚN DOC)
    const signature = await generateSignature(params, SECRET_KEY);
    params.signature = signature;

    // Intentar crear pago vía API o generar URL
    // Opción 1: POST a API de Enzona
    try {
      const apiUrl = `${baseUrl}/api/v1/payments/create`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SECRET_KEY}`
        },
        body: JSON.stringify({
          merchantId: MERCHANT_ID,
          invoiceNumber: invoiceNo,
          amount: Number(amount).toFixed(2),
          currency: 'CUP',
          description: params.description,
          returnUrl: params.return_url,
          cancelUrl: params.cancel_url,
          metadata: { orderId }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const paymentUrl = data.paymentUrl || data.url || data.redirectUrl;
        if (paymentUrl) {
          // Guardar referencia
          await db.from('orders').update({ 
            payment_ref: invoiceNo 
          }).eq('id', orderId);
          
          return json({ paymentUrl, invoiceNo });
        }
      }
    } catch (e) {
      console.log('API call failed, trying form redirect:', e.message);
    }

    // Opción 2: Formulario POST redirect (más común en Cuba)
    const formHtml = generatePaymentForm(baseUrl + '/checkout', params);
    
    return new Response(formHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    console.error('Error en create-enzona-payment:', err);
    return json({ error: 'Error interno del servidor' }, 500);
  }
});

async function generateSignature(params: Record<string, string>, secret: string): Promise<string> {
  // Ordenar parámetros alfabéticamente y concatenar
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + secret;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(signString);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generatePaymentForm(action: string, params: Record<string, string>): string {
  const inputs = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join('\n    ');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirigiendo a Enzona...</title>
</head>
<body>
  <form id="enzonaForm" method="POST" action="${escapeHtml(action)}">
    ${inputs}
  </form>
  <script>document.getElementById('enzonaForm').submit();</script>
  <p style="text-align:center;font-family:sans-serif;margin-top:50px;">Redirigiendo a Enzona...</p>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
