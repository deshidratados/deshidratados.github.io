// Supabase Edge Function: qvapay-webhook
// Webhook para confirmar pagos de QvaPay

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        body[k] = String(v);
      }
    } else {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { body = {}; }
    }

    console.log('QVAPAY_WEBHOOK_BODY:', JSON.stringify(body).slice(0, 500));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const db = createClient(supabaseUrl, serviceKey);

    const orderId = body.remote_id || body.order_id || body.reference;
    const status = (body.status || body.state || '').toString().toLowerCase();

    if (!orderId) {
      return json({ ok: true, message: 'Sin pedido asociado' });
    }

    const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();

    if (!order) {
      return json({ ok: true, message: 'Pedido no encontrado' });
    }

    if (order.payment_status === 'pagado') {
      return json({ ok: true, message: 'Ya marcado como pagado' });
    }

    const isPaid = status.includes('paid') || status.includes('completed') || status.includes('success') || status.includes('approved');

    if (isPaid) {
      await db.from('orders').update({
        payment_status: 'pagado',
        paid_at: new Date().toISOString(),
        payment_ref: body.txn_id || body.id || order.payment_ref
      }).eq('id', order.id);

      console.log(`Pedido ${order.id} marcado como PAGADO via QvaPay`);
      return json({ ok: true, status: 'pagado' });
    }

    if (status.includes('cancel') || status.includes('fail') || status.includes('expired')) {
      await db.from('orders').update({ payment_status: 'fallido' }).eq('id', order.id);
      return json({ ok: true, status: 'fallido' });
    }

    return json({ ok: true, status: order.payment_status });
  } catch (err) {
    console.error('Error en qvapay-webhook:', err);
    return json({ ok: false, error: 'Error interno' }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
