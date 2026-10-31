// Servicio de envío de emails mediante Supabase Edge Function.
//
// La API key de Brevo vive como secret en Supabase y NUNCA llega al
// frontend: el navegador solo conoce la URL de la función y la anon key
// pública (que es pública por diseño).
//
// El remitente se resuelve dentro de la función, leyendo
// settings → newsletter_from. El cliente no puede cambiarlo.
//
// Marcador de baja: las plantillas usan href="{{UNSUBSCRIBE_URL}}".
// La Edge Function lo sustituye en cada email por un enlace firmado
// personalizado que llama a la función "unsubscribe". No lo borres del
// HTML si quieres que el enlace de baja funcione.
//
// Quién envía qué: los boletines van con la sesión del administrador (la
// Edge Function la exige); el formulario público de suscripción no tiene
// sesión y solo puede pedir la bienvenida, cuyo asunto y HTML los fija el
// servidor.

import { supabase } from '../data/supabase';

const EDGE_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-email`;

/**
 * Llama a la Edge Function send-email de Supabase.
 * La API key de Brevo vive como secret en Supabase:
 * el navegador solo ve la URL de la función y la anon key pública.
 * @param {object} payload
 * @param {string[]} payload.to - Destinatarios
 * @param {string} [payload.subject] - Asunto (opcional en la bienvenida)
 * @param {string} [payload.html] - Contenido HTML (opcional en la bienvenida)
 * @param {'newsletter'|'welcome'} [payload.type] - Tipo (para el historial)
 * @param {string} [payload.replyTo] - Dirección de respuesta
 * @returns {Promise<{ok: boolean, sent: number, failed: number, remaining: number, errors: Array}>}
 */
async function callEdgeFunction(payload) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('REACT_APP_SUPABASE_URL no está definida');
  }

  // El panel manda la sesión del administrador: la Edge Function exige un
  // usuario autenticado para los boletines. El formulario público de
  // bienvenida no tiene sesión y se queda con la anon key (pública por
  // diseño); sin sesión, la función solo acepta su correo automático.
  let bearer = anonKey || '';
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) bearer = data.session.access_token;
  } catch {
    /* sin sesión: se usa la anon key */
  }

  const headers = {
    'Content-Type': 'application/json',
    // La Edge Function valida este header (apikey) igual que cualquier
    // endpoint de Supabase. No es un secreto: es la anon key pública.
    'apikey': anonKey || '',
    'Authorization': `Bearer ${bearer}`,
  };

  let res;
  try {
    res = await fetch(EDGE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    // "Failed to fetch" no explica nada, y la causa no siempre es la misma.
    // Si la URL es de Supabase y es correcta, lo normal es que la función
    // no esté desplegada: mientras no exista, el preflight CORS responde
    // 404, y el navegador exige 2xx en el preflight → network error →
    // "Failed to fetch", sin llegar a leerse el 404 real.
    console.error('[newsletter] Fallo de red llamando a', EDGE_URL, networkErr);

    const isSupabaseFn = /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\//i.test(EDGE_URL);

    if (isSupabaseFn) {
      throw new Error(
        'No se pudo conectar con la función de correo de Supabase.\n' +
        `URL intentada: ${EDGE_URL}\n` +
        'La URL es correcta, así que lo más probable es que la función ' +
        '"send-email" AÚN NO ESTÉ DESPLEGADA. Mientras no exista, el ' +
        'navegador recibe un 404 al pedir permisos (CORS) y lo traduce a ' +
        '"Failed to fetch" sin más detalle.\n' +
        'Desplégala en Supabase → Edge Functions → Deploy a new function → ' +
        'Via Editor, con el nombre EXACTO "send-email" (con guion). ' +
        'Ver NEWSLETTER_SETUP.md, Paso 3.'
      );
    }

    throw new Error(
      'No se pudo conectar con el servidor de correo.\n' +
      `URL intentada: ${EDGE_URL}\n` +
      'Casi siempre es que la URL de Supabase está mal en .env.local. ' +
      'Corrígela y reinicia "npm start": las variables de entorno NO se recargan solas.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Cada status habitual se traduce a la acción concreta que hay que
    // hacer, en vez de devolver el código crudo.
    const detail = data.error || data.message || '';
    let msg;

    if (res.status === 404) {
      msg =
        'La función de correo "send-email" no está desplegada en Supabase.\n' +
        'Ve a Supabase → Edge Functions → Deploy a new function → Via Editor, ' +
        'con el nombre EXACTO "send-email" (con guion), y pega el contenido de ' +
        'supabase/functions/send-email/index.ts. Ver NEWSLETTER_SETUP.md, Paso 3.' +
        (detail ? `\nDetalle: ${detail}` : '');
    } else if (res.status === 401 || res.status === 403) {
      msg =
        'La función de correo ha rechazado el envío por falta de permisos.\n' +
        'Si estás en el panel de administración, sal y vuelve a entrar ' +
        '(la sesión puede haber caducado). Si el problema continúa, ' +
        'revisa REACT_APP_SUPABASE_ANON_KEY en .env.local y reinicia "npm start".' +
        (detail ? `\nDetalle: ${detail}` : '');
    } else {
      msg = detail || `El servidor de correo respondió con error ${res.status}.`;
    }

    console.error(`[newsletter] HTTP ${res.status} desde ${EDGE_URL}:`, data);
    throw new Error(msg);
  }

  return data;
}

// Tamaño de lote: la Edge Function procesa como mucho 50 correos por
// invocación para no agotar su timeout. Este servicio va troceando y
// los va sumando, así el panel solo hace una llamada "lógica".
const CHUNK_SIZE = 50;

/**
 * Envía un boletín a una lista de correos.
 * Procesa la lista completa en lotes internos.
 * @param {string[]} emails - Lista de correos a enviar
 * @param {object} options
 * @param {string} options.subject - Asunto del email
 * @param {string} options.html - HTML del email
 * @returns {Promise<{ok: boolean, sent: number, failed: number, total: number, errors: Array}>}
 */
export async function sendNewsletter(emails, options = {}) {
  if (!emails || emails.length === 0) {
    throw new Error('Debe proporcionar al menos un email');
  }
  if (!options.subject) {
    throw new Error('Falta el asunto del boletín');
  }
  if (!options.html) {
    throw new Error('Falta el contenido HTML del boletín');
  }

  // Sin duplicados y con formato limpio.
  const unique = [...new Set(
    emails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean)
  )];
  if (unique.length === 0) {
    throw new Error('Debe proporcionar al menos un email válido');
  }

  let sent = 0;
  const errors = [];

  // Avanza según lo que el servidor haya procesado de verdad, no según
  // un tamaño de lote fijado aquí: así, si cambia MAX_PER_CALL en la
  // Edge Function, no se pierde ningún destinatario en silencio.
  let pending = unique;
  let guard = 0;

  while (pending.length > 0 && guard++ < 1000) {
    const batch = pending.slice(0, CHUNK_SIZE);
    const res = await callEdgeFunction({
      to: batch,
      subject: options.subject,
      html: options.html,
      type: 'newsletter',
    });

    sent += res.sent || 0;
    if (Array.isArray(res.errors) && res.errors.length) {
      errors.push(...res.errors);
    }

    const processed = (res.sent || 0) + (res.failed || 0);
    if (processed <= 0) break; // nada progresó: cortamos para no buclear
    pending = pending.slice(processed);
  }

  return {
    ok: errors.length === 0,
    sent,
    failed: errors.length,
    total: unique.length,
    errors,
  };
}

/**
 * Pide el correo de bienvenida a un nuevo suscriptor.
 * El asunto y el HTML los fija la Edge Function (plantilla del servidor):
 * el formulario público no inyecta contenido, solo puede pedir la
 * bienvenida del correo que ya se ha suscrito.
 * @param {string} email - Email del suscriptor
 * @returns {Promise<{ok: boolean, sent: number, failed: number, errors: Array}>}
 */
export async function sendWelcomeEmail(email) {
  if (!email) {
    throw new Error('Falta el email del suscriptor');
  }

  return callEdgeFunction({
    to: [email],
    type: 'welcome',
  });
}

// ============================================================
// Plantillas por defecto
// ============================================================

export const DEFAULT_SUBJECT = '📰 Solaria · Boletín de ofertas';

// Mensaje por defecto del boletín en TEXTO LLANO (lo que escribe el admin).
// El sistema lo envuelve en buildNewsletterHtml con el estilo de Solaria y
// el enlace de «Darse de baja»: el admin nunca toca HTML.
export const DEFAULT_BODY = `## Bienvenido al boletín de Solaria

En este boletín encontrarás:

- ✨ Nuevas presentaciones disponibles
- 🎁 Ofertas especiales de temporada
- 🌱 Tips para conservar tus deshidratados

## ¿Qué encontrarás?

Las frutas deshidratadas al 100% sin conservantes, listas para llevarte a cualquier lugar. Desde nuestros clásicos (mango, piña, papaya) hasta nuestras nuevas incorporaciones.

## Consejo de la semana

Guarda tus deshidratados en un lugar fresco y seco, lejos de la luz directa del sol. Así mantendrás su sabor y textura por más tiempo.`;

/**
 * Envuelve el contenido ya renderizado (HTML de renderMarkdown) en la
 * plantilla de email de Solaria: estilos, cabecera y pie con el enlace de
 * baja {{UNSUBSCRIBE_URL}} que la Edge Function personaliza en cada correo.
 * @param {string} contentHtml - Cuerpo ya convertido a HTML
 * @returns {string} HTML completo del email
 */
export function buildNewsletterHtml(contentHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solaria · Boletín</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f6f0e6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C4531F; }
    .header h1 { margin: 0; color: #C4531F; font-size: 24px; }
    .header p { margin: 8px 0 0; color: #8a7a63; font-size: 14px; }
    .content { padding: 20px 0; line-height: 1.6; color: #1e1710; }
    .content h2 { margin-top: 0; color: #1e1710; }
    .content p { margin-bottom: 16px; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e7dcc8; color: #8a7a63; font-size: 12px; }
    .footer a { color: #C4531F; }
    .unsubscribe { margin-top: 20px; padding: 12px; background: #f6f0e6; border-radius: 8px; text-align: center; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☀ Solaria · Deshidratados</h1>
      <p>Tu boletín semanal de ofertas y novedades</p>
    </div>
    <div class="content">
${contentHtml || ''}
    </div>
    <div class="footer">
      <p>Hecho con ❤️ para Solaria · Deshidratados</p>
      <p>¿No quieres recibir más emails? <a href="{{UNSUBSCRIBE_URL}}">Darse de baja</a></p>
    </div>
    <div class="unsubscribe">
      <p>Este es un email automático. No responder a este mensaje.</p>
    </div>
  </div>
</body>
</html>`;
}
