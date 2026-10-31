// Supabase Edge Function: unsubscribe
// Baja del boletín mediante un enlace firmado (HMAC). El suscriptor recibe
// en su email un enlace personalizado generado por send-email.
//
// Uso:
//   GET  /functions/v1/unsubscribe?e=<email>&s=<firma>
//     → 302 a la página de confirmación de la tienda (unsubscribe.html)
//   POST /functions/v1/unsubscribe  (JSON o formulario: e, s)
//     → valida la firma, borra al suscriptor y responde JSON {ok, error?}
//
// POR QUÉ LA PÁGINA NO VIVE AQUÍ:
//   El runtime de Supabase convierte las respuestas text/html de las
//   funciones en text/plain (con CSP sandbox y nosniff) como protección
//   anti-phishing del dominio *.supabase.co: un navegador mostraría el
//   HTML como texto crudo. Por eso la interfaz (confirmación y resultado)
//   está en public/unsubscribe.html, que GitHub Pages sirve con normalidad,
//   y esta función solo redirige (GET) y procesa (POST).
//
// SEGURIDAD:
//   - La firma es HMAC-SHA256(email, clave de servicio). Sin la clave no se
//     puede dar de baja a un tercero adivinando URLs.
//   - El GET no borra nada: solo el POST de la página (botón del usuario)
//     ejecuta la baja. Gmail y Outlook precargan los enlaces de los correos
//     (escáneres), y esos escáneres no ejecutan JavaScript ni envían POST.
//   - Debe desplegarse con "Verify JWT" DESACTIVADO, porque el navegador
//     del suscriptor no lleva la cabecera Authorization de Supabase.
//     Ver NEWSLETTER_SETUP.md, Paso 3.
//
// NO necesita secretos nuevos: usa la misma clave de servicio de Supabase
// que send-email (inyectada automáticamente por la plataforma).
//
// NUNCA pegues aquí API keys: este fichero va al repositorio.

// El prefijo `npm:` en línea es el patrón que documenta Supabase para
// Edge Functions (no hay deno.json en la nube), por eso se ignora la
// regla que prefiere declararlo como dependencia.
// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Página de confirmación de la tienda (public/unsubscribe.html, publicada
// por GitHub Pages junto con el resto del sitio).
const SHOP_PAGE = 'https://deshidratados.github.io/unsubscribe.html';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- GET: clic en el correo → redirigimos a la página de la tienda ---
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const e = url.searchParams.get('e') || '';
      const s = url.searchParams.get('s') || '';
      // Pasamos los parámetros tal cual (aunque la firma sea incorrecta):
      // la página mostrará el mensaje de error adecuado tras el POST.
      const target = e || s
        ? `${SHOP_PAGE}?e=${encodeURIComponent(e)}&s=${encodeURIComponent(s)}`
        : SHOP_PAGE;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: target },
      });
    }

    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Método no permitido. Usa GET o POST.' }, 405);
    }

    // --- POST: la página de la tienda pide la baja real ---
    const contentType = req.headers.get('content-type') || '';
    let email = '';
    let sig = '';
    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      email = String(body.e ?? '');
      sig = String(body.s ?? '');
    } else {
      const form = new URLSearchParams(await req.text().catch(() => ''));
      email = form.get('e') || '';
      sig = form.get('s') || '';
    }

    email = email.trim().toLowerCase();
    sig = sig.trim();

    if (!email || !sig) {
      return json(
        { ok: false, error: 'El enlace está incompleto: falta el correo o la firma.' },
        400
      );
    }

    const serviceKey = getServiceKey();
    const expected = await hmacHex(email, serviceKey);
    if (!safeEqual(expected, sig)) {
      // Firma incorrecta: no se toca la base de datos.
      console.error('[unsubscribe] Firma no válida para', email);
      return json(
        {
          ok: false,
          error:
            'Este enlace no es válido. Copia el enlace completo del último boletín que recibiste.',
        },
        400
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const db = createClient(supabaseUrl, serviceKey);

    // ilike con los comodines escapados: casa sin distinguir mayúsculas
    // (el índice único de la tabla es sobre lower(trim(email)) y el valor
    // guardado pudo escribirse con otras mayúsculas). Con los comodines
    // escapados solo puede coincidir con esa dirección exacta.
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { error } = await db.from('subscribers').delete().ilike('email', pattern);

    if (error) {
      console.error('[unsubscribe] No se pudo borrar el suscriptor:', error.message);
      return json(
        {
          ok: false,
          error: 'Ha habido un problema técnico. Inténtalo de nuevo en unos minutos.',
        },
        500
      );
    }

    // Idempotente: si ya no estaba suscrito, también responde ok.
    return json({ ok: true });
  } catch (err) {
    console.error('[unsubscribe] Error inesperado:', err);
    return json(
      { ok: false, error: 'Ha habido un problema técnico. Inténtalo de nuevo en unos minutos.' },
      500
    );
  }
});

// ============================================================
// Firma HMAC
// ============================================================

/**
 * HMAC-SHA256 en hexadecimal del correo, con la clave de servicio.
 * Es la misma operación que hace send-email al generar el enlace.
 */
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

/** Comparación en tiempo constante: evita adivinar la firma carácter a carácter. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    throw new Error('Falta la clave de servicio de Supabase en los secrets.');
  }
  return key;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
