// Supabase Edge Function: send-email
// Proxy seguro para Brevo (ex-Sendinblue). La API key nunca sale del servidor.
//
// Uso:
//   POST /functions/v1/send-email
//   Body: { to: string[], subject: string, html: string, type?: 'newsletter'|'welcome', replyTo?: string }
//
// Respuesta:
//   { ok, sent, failed, remaining, errors: [{email, error}] }
//
// Enlace de baja: si el HTML contiene el marcador {{UNSUBSCRIBE_URL}},
// se sustituye en CADA email por una URL firmada personalizada que llama
// a la función "unsubscribe". El historial guarda el HTML original, con
// el marcador, para poder restaurarlo en el panel.
//
// El campo "from" SIEMPRE se lee de la tabla settings (newsletter_from),
// nunca del cliente: así nadie puede suplantar el remitente.
//
// QUIÉN PUEDE LLAMAR (para que la función no acabe siendo un correo
// indiscriminado abierto a todo el mundo):
//   - type "welcome" (formulario público de suscripción): sin sesión. El
//     servidor IGNORA el asunto y el HTML del cliente: usa su propia
//     plantilla, exige un único destinatario y que ese correo ya figure
//     como suscriptor. Alguien ajeno solo puede provocar el correo
//     automático de bienvenida, nunca enviar contenido arbitrario.
//   - Cualquier otro envío (boletines): exige JWT de un usuario
//     autenticado. Con los registros públicos desactivados en Supabase,
//     esa sesión solo la tiene el administrador.
//
// CONFIGURACIÓN (una sola vez, desde el dashboard):
//   1. Brevo → SMTP & API → Senders → verificar la dirección remitente
//   2. Brevo → SMTP & API → API Keys → generar una clave
//   3. Supabase → Edge Functions → Secrets → añadir BREVO_API_KEY
//   4. Supabase → Edge Functions → "Deploy a new function" → nombre: send-email
//
// NUNCA pegues aquí la API key: este fichero va al repositorio.

// El prefijo `npm:` en línea es el patrón que documenta Supabase para
// Edge Functions (no hay deno.json en la nube), por eso se ignora la
// regla que prefiere declararlo como dependencia.
// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Límite por invocación: Brevo acepta lotes, pero así no se agota el
// timeout de Supabase. El frontend va troceando solo y sigue el progreso
// real del servidor.
const MAX_PER_CALL = 50;

// Marcador que el frontend (y las plantillas por defecto) dejan en el
// enlace de baja. Se sustituye en cada email por una URL firmada con el
// correo del destinatario; la función "unsubscribe" valida la firma antes
// de borrar, así que nadie puede dar de baja a un tercero.
const UNSUB_PLACEHOLDER = '{{UNSUBSCRIBE_URL}}';

// Plantilla fija del correo de bienvenida. Vive en el servidor a propósito:
// quien llame sin sesión no puede alterar ni el asunto ni el contenido.
const WELCOME_SUBJECT = 'Bienvenido a Solaria · Deshidratados 🌴';

const WELCOME_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Solaria</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f6f0e6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C4531F; }
    .header h1 { margin: 0; color: #C4531F; font-size: 24px; }
    .content { padding: 20px 0; line-height: 1.6; color: #1e1710; }
    .content h2 { margin-top: 0; color: #1e1710; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e7dcc8; color: #8a7a63; font-size: 12px; }
    .footer a { color: #C4531F; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☀ Solaria · Deshidratados</h1>
    </div>
    <div class="content">
      <h2>¡Bienvenido a Solaria!</h2>
      <p>Gracias por suscribirte a nuestro boletín. A partir de ahora recibirás ofertas exclusivas, nuevas presentaciones y consejos para conservar tus deshidratados.</p>
      <p>¿Qué encontrarás en nuestro catálogo?</p>
      <ul>
        <li>🍌 Mango deshidratado de la mejor calidad</li>
        <li>🍍 Piña natural sin conservantes</li>
        <li>🍉 Papaya al 100%</li>
        <li>🥭 Pitaya y más...</li>
      </ul>
      <p>Visítanos en <a href="https://deshidratados.github.io/">solaria.cu</a> para explorar todo nuestro catálogo.</p>
      <p>¡Disfruta tus deshidratados! 🌴</p>
    </div>
    <div class="footer">
      <p>Hecho con ❤️ para Solaria · Deshidratados</p>
      <p>¿No quieres recibir más emails? <a href="{{UNSUBSCRIBE_URL}}">Darse de baja</a></p>
    </div>
  </div>
</body>
</html>`;

/** Error con mensaje ya redactado para el usuario final. */
class EmailError extends Error {}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      return json({
        error:
          'Falta el secret BREVO_API_KEY. ' +
          'Añádelo en Supabase → Edge Functions → Secrets.',
      }, 500);
    }

    if (req.method !== 'POST') {
      return json({ error: 'Método no permitido. Usa POST.' }, 405);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return json({ error: 'El cuerpo de la petición no es JSON válido.' }, 400);
    }

    const { to, subject, html, type, replyTo } = body;
    const isWelcome = type === 'welcome';

    // --- Validaciones ---
    if (!Array.isArray(to) || to.length === 0) {
      return json({ error: 'Debes indicar al menos un destinatario (to).' }, 400);
    }
    // En la bienvenida el cliente no manda asunto ni HTML: los pone el servidor.
    if (!isWelcome) {
      if (!subject || typeof subject !== 'string') {
        return json({ error: 'Falta el asunto (subject).' }, 400);
      }
      if (!html || typeof html !== 'string') {
        return json({ error: 'Falta el contenido (html).' }, 400);
      }
    }

    // --- Cliente de base de datos ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = getServiceKey();
    const db = createClient(supabaseUrl, serviceKey);

    // --- ¿Quién llama? ---
    // Los boletines solo con sesión real de usuario. El welcome no exige
    // sesión (lo pide el formulario público), pero el servidor fija su
    // propio asunto, HTML y destinatario más abajo.
    if (!isWelcome) {
      let callerOk = false;
      try {
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        const { data: userData } = await db.auth.getUser(token);
        // El token de la anon key no trae usuario: solo pasa una sesión real.
        callerOk = !!userData.user && userData.user.role === 'authenticated';
      } catch {
        callerOk = false;
      }
      if (!callerOk) {
        return json({
          error:
            'Sesión no válida: enviar boletines requiere entrar en el ' +
            'panel de administración.',
        }, 401);
      }
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const clean = [...new Set(to.map((e: unknown) => String(e || '').trim().toLowerCase()))]
      .filter((e: string) => e.length > 0);
    const invalid = clean.filter((e: string) => !emailRe.test(e));
    if (invalid.length > 0) {
      return json({ error: `Correos inválidos: ${invalid.join(', ')}` }, 400);
    }

    // --- Bienvenida: manda la plantilla y el destinatario del servidor ---
    const finalSubject: string = isWelcome ? WELCOME_SUBJECT : subject;
    const finalHtml: string = isWelcome ? WELCOME_HTML : html;
    if (isWelcome) {
      if (clean.length !== 1) {
        return json({ error: 'El correo de bienvenida se envía a un único destinatario.' }, 400);
      }
      const { data: subRow } = await db
        .from('subscribers')
        .select('email')
        .eq('email', clean[0])
        .maybeSingle();
      if (!subRow) {
        return json({ error: 'Ese correo no figura como suscriptor del boletín.' }, 403);
      }
    }

    // --- El remitente SIEMPRE sale de la base de datos ---

    const { data: settingsRows, error: settingsError } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['newsletter_from', 'email']);

    if (settingsError) {
      return json({ error: `Error leyendo configuración: ${settingsError.message}` }, 500);
    }

    const map: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

    const from = (map.newsletter_from || '').trim();
    if (!from) {
      return json({
        error:
          'Falta el "Email remitente del boletín". Ve a tu panel → Configuración ' +
          'y rellénalo (debe estar verificado en Brevo: SMTP & API → Senders).',
      }, 500);
    }

    // Brevo separa nombre visible y dirección en el body
    // ("Solaria <solaria024@gmail.com>" → {name, email}).
    const sender = parseSender(from);
    if (!emailRe.test(sender.email)) {
      return json({
        error: `El email remitente ("${from}") no tiene un formato de correo válido.`,
      }, 500);
    }

    // Si quien responde lo hace a la dirección de contacto de la tienda,
    // los correos de los clientes llegan a un buzón real.
    const contactEmail = (map.email || '').trim();
    const replyAddress = replyTo || (emailRe.test(contactEmail) ? contactEmail : undefined);

    // --- Troceado: nunca más de MAX_PER_CALL por invocación ---
    const batch = clean.slice(0, MAX_PER_CALL);
    const remaining = Math.max(0, clean.length - batch.length);

    const errors: { email: string; error: string }[] = [];
    let sent = 0;

    for (const recipient of batch) {
      try {
        // Enlace de baja personalizado por destinatario. Se calcula sobre
        // el HTML original en cada vuelta: nunca sobre el ya sustituido.
        const personalizedHtml = finalHtml.includes(UNSUB_PLACEHOLDER)
          ? finalHtml.split(UNSUB_PLACEHOLDER).join(await makeUnsubscribeUrl(recipient, serviceKey, supabaseUrl))
          : finalHtml;

        const payload: Record<string, unknown> = {
          sender,
          to: [{ email: recipient }], // uno a uno: nadie ve la lista de los demás
          subject: finalSubject,
          htmlContent: personalizedHtml,
        };
        if (replyAddress) {
          payload.replyTo = { email: replyAddress };
        }

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          sent++;
        } else {
          const errText = await res.text();
          console.error(`[send-email] Brevo ${res.status} con ${recipient}:`, errText);
          errors.push({ email: recipient, error: explainBrevoError(res.status, errText) });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'error de red';
        console.error(`[send-email] Excepción con ${recipient}:`, detail);
        errors.push({ email: recipient, error: detail });
      }
    }

    // --- Registrar en el historial (solo boletines) ---
    if (type === 'newsletter' && sent > 0) {
      const { error: histErr } = await db.from('newsletter_history').insert({
        subject,
        html,
        recipients_count: sent,
        sent_by: 'admin',
      });
      if (histErr) {
        console.error('[send-email] No se pudo guardar el historial:', histErr.message);
      }
    }

    return json({
      ok: errors.length === 0,
      sent,
      failed: errors.length,
      remaining,
      errors,
    });
  } catch (err) {
    const msg = err instanceof EmailError ? err.message : 'Error interno del servidor.';
    console.error('[send-email] Error inesperado:', err);
    return json({ error: msg }, 500);
  }
});

/**
 * Extrae nombre visible y dirección de un remitente tipo
 * "Solaria · Deshidratados <solaria024@gmail.com>" o solo "solaria024@gmail.com".
 */
function parseSender(from: string): { email: string; name?: string } {
  const lt = from.indexOf('<');
  const gt = from.lastIndexOf('>');

  if (lt !== -1 && gt > lt) {
    const email = from.slice(lt + 1, gt).trim();
    const name = from.slice(0, lt).trim() || from.slice(gt + 1).trim();
    // El nombre visible de Brevo admite como máximo 70 caracteres.
    return name ? { email, name: name.slice(0, 70) } : { email };
  }

  return { email: from.trim() };
}

/**
 * URL de baja personalizada del destinatario.
 * La función "unsubscribe" recalcula este HMAC y solo borra si coincide,
 * así que un enlace manipulado no sirve para dar de baja a nadie.
 */
async function makeUnsubscribeUrl(
  email: string,
  serviceKey: string,
  supabaseUrl: string
): Promise<string> {
  const sig = await hmacHex(email, serviceKey);
  return `${supabaseUrl}/functions/v1/unsubscribe?e=${encodeURIComponent(email)}&s=${sig}`;
}

/** HMAC-SHA256 en hexadecimal del correo, con la clave de servicio. */
async function hmacHex(email: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(email));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Traduce los códigos de Brevo a algo accionable en castellano.
 * Brevo devuelve JSON {code, message}; aquí lo resumimos.
 */
function explainBrevoError(status: number, raw: string): string {
  let code = '';
  let message = '';
  try {
    const parsed = JSON.parse(raw);
    code = parsed.code || '';
    message = parsed.message || '';
  } catch {
    message = raw.slice(0, 200);
  }

  // Errores de cuenta/configuración (400 con código específico)
  const codeHints: Record<string, string> = {
    unauthorized: 'La API key de Brevo no es válida. Revísala en Edge Functions → Secrets.',
    not_acceptable:
      'Ese remitente no está verificado en Brevo. Ve a Brevo → SMTP & API → Senders ' +
      'y verifica la dirección (te envía un código de confirmación a ese correo).',
    account_under_validation:
      'Tu cuenta de Brevo está en revisión (normal las primeras horas). ' +
      'Completa la validación desde el dashboard de Brevo o espera unos minutos.',
    not_enough_credits: 'Límite diario del plan gratuito de Brevo alcanzado. Inténtalo mañana.',
    permission_denied: 'La API key no tiene permisos de envío. Genera una nueva en Brevo.',
    '': 'Revisa el remitente y los destinatarios.',
  };

  // Errores HTTP sin código (401, 429…)
  const statusHints: Record<number, string> = {
    401: 'La API key de Brevo no es válida o fue revocada. Revísala en Edge Functions → Secrets.',
    429: 'Límite de peticiones de Brevo alcanzado. Espera un momento y reintenta.',
  };

  const hint = codeHints[code] || statusHints[status] || '';
  const detail = message.slice(0, 200);
  return `Brevo respondió ${status}${code ? ` (${code})` : ''}. ${hint}${detail ? ` (${detail})` : ''}`.trim();
}

/** Lee la clave de servicio, soportando ambos sistemas de claves. */
function getServiceKey(): string {
  const fromNew = (() => {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
      return keys['default'] || keys['secret'] || '';
    } catch {
      return '';
    }
  })();

  const key = fromNew || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!key) {
    throw new EmailError('Falta la clave de servicio de Supabase en los secrets.');
  }
  return key;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
