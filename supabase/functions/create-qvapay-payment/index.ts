// Supabase Edge Function: create-qvapay-payment
// Genera la URL de pago para QvaPay
// Secrets necesarios:
//   QVAPAY_APP_ID
//   QVAPAY_APP_SECRET
//   QVAPAY_ENV = sandbox | production

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

    const APP_ID = Deno.env.get('QVAPAY_APP_ID');
    const APP_SECRET = Deno.env.get('QVAPAY_APP_SECRET');
    const ENV = Deno.env.get('QVAPAY_ENV') || 'sandbox';

    if (!APP_ID || !APP_SECRET) {
      return json({ 
        error: 'Faltan credenciales de QvaPay. Configura QVAPAY_APP_ID y QVAPAY_APP_SECRET en Edge Functions > Secrets.' 
      }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, total, payment_method')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ error: 'Pedido no encontrado' }, 404);
    }

    const baseUrl = ENV === 'production' 
      ? 'https://app.qvapay.com' 
      : 'https://sandbox.qvapay.com';

    const invoiceNo = `SOL-QV-${orderId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Intentar crear pago vía API
    try {
      const apiUrl = `${baseUrl}/api/v1/create_invoice`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: APP_ID,
          app_secret: APP_SECRET,
          amount: Number(amount).toFixed(2),
          description: `Pedido Salud & Vida - ${orderId.slice(0, 8)}`,
          remote_id: orderId,
          callback_url: returnUrl,
          cancel_url: cancelUrl || returnUrl
        })
      });

      if (res.ok) {
        const data = await res.json();
        const paymentUrl = data.url || data.payment_url || data.invoice_url;
        if (paymentUrl) {
          await db.from('orders').update({ 
            payment_ref: invoiceNo 
          }).eq('id', orderId);
          
          return json({ paymentUrl, invoiceNo });
        }
      }
    } catch (e) {
      console.log('QvaPay API call failed:', e.message);
    }

    return json({ error: 'No se pudo generar el enlace de pago con QvaPay. Ajustar según documentación.' }, 500);

  } catch (err) {
    console.error('Error en create-qvapay-payment:', err);
    return json({ error: 'Error interno del servidor' }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
