import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { SHOP } from '../data/config';
import { LEGAL } from '../data/legalContent';
import { sendNewsletter, DEFAULT_SUBJECT, DEFAULT_BODY, buildNewsletterHtml } from '../services/newsletter';
import { renderMarkdown } from '../components/LegalPage';
import Notice from './Notice';

const FIELDS = [
  { key: 'shopName', label: 'Nombre de la tienda', type: 'text', help: 'Aparece en el logo y el pie de página.' },
  { key: 'whatsapp', label: 'Número de WhatsApp', type: 'text', help: 'Solo dígitos, con código de país. Cuba: 535…' },
  { key: 'freeShip', label: 'Envío gratis a partir de', type: 'number', help: 'Monto en la moneda base (la de los precios del catálogo).' },
  { key: 'heroPromo', label: 'Promoción del inicio', type: 'text', help: 'Texto que se superpone a las fotos del inicio (p. ej. «desde US$23» o «2x1 este fin de semana»). Déjalo vacío para el automático: «desde» + el precio más bajo del catálogo.' },
  { key: 'email', label: 'Correo de contacto', type: 'email', help: 'Aparece en el pie de página.' },
  { key: 'newsletter_from', label: 'Email remitente del boletín', type: 'text', help: 'Remitente que usa Brevo. Debe ser una dirección VERIFICADA en Brevo (SMTP & API → Senders). Admite nombre visible: "Salud & Vida · Deshidratados <solaria024@gmail.com>".' },
  { key: 'instagram', label: 'Instagram', type: 'text', help: 'Con @ o con la URL completa. Déjalo vacío si no lo manejas.' },
  { key: 'hours', label: 'Horario (pie de página)', type: 'textarea', help: 'Un renglón por horario. Déjalo vacío para ocultar la columna.' },
  { key: 'currencyBase', label: 'Moneda de los precios', type: 'select', options: ['USD', 'CUP', 'EUR'], help: 'En qué moneda escribes los precios en Productos. El visitante ve la conversión a su moneda.' },
  { key: 'rateCUP', label: 'CUP por 1 USD', type: 'number', help: 'Tipo de cambio manual. No es automático: ajústalo cada vez que cambie el mercado.' },
  { key: 'rateEUR', label: 'EUR por 1 USD', type: 'number', help: 'Tipo de cambio manual hacia el euro.' }
];

// Configuración del boletín. El contenido es TEXTO LLANO (lo que sabe
// escribir cualquiera): el HTML con el estilo de Salud & Vida y el enlace de
// «Darse de baja» lo construye el sistema al previsualizar y al enviar
// (buildNewsletterHtml en src/services/newsletter.js).
const NEWSLETTER_FIELDS = [
  { key: 'newsletter_subject', label: 'Asunto del boletín', type: 'text', help: 'Lo que aparece en el asunto del email.', default: DEFAULT_SUBJECT },
  // La clave se llama newsletter_html por compatibilidad con lo ya guardado;
  // su valor desde ahora es texto llano (ver htmlToBody al cargar).
  { key: 'newsletter_html', label: 'Mensaje del boletín', type: 'textarea', help: 'Escríbelo con normalidad, como un mensaje. Un renglón en blanco separa párrafos, "#" inicia un título, "-" una lista, **negritas** y [enlaces](https://…) también funcionan. El diseño de Salud & Vida y el enlace de «Darse de baja» se añaden solos.', default: DEFAULT_BODY }
];

// Cada documento legal vive en una clave propia de `settings`.
// Si la clave está vacía, la tienda usa el texto original de src/data/legalContent.js.
const LEGAL_FIELDS = [
  { key: 'legal_envios', slug: 'envios', doc: LEGAL.envios, label: 'Envíos y pagos' },
  { key: 'legal_terminos', slug: 'terminos', doc: LEGAL.terminos, label: 'Términos y condiciones' },
  { key: 'legal_privacidad', slug: 'privacidad', doc: LEGAL.privacidad, label: 'Aviso de privacidad' },
  { key: 'legal_cookies', slug: 'cookies', doc: LEGAL.cookies, label: 'Aviso de cookies' }
];

// Lo que muestra el formulario antes de cargar la base: los mismos valores
// por defecto que usa la tienda. Así guardar sin tocar nada no borra nada.
const DEFAULTS = {
  shopName: SHOP.name,
  whatsapp: SHOP.whatsapp,
  freeShip: String(SHOP.freeShip),
  heroPromo: SHOP.heroPromo || '',
  email: SHOP.email,
  newsletter_from: 'solaria024@gmail.com',
  instagram: SHOP.instagram,
  hours: SHOP.hours,
  currencyBase: SHOP.currencyBase,
  rateCUP: SHOP.rateCUP,
  rateEUR: SHOP.rateEUR,
};

const LEGAL_DEFAULTS = LEGAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.doc.body }), {});
const NEWSLETTER_DEFAULTS = NEWSLETTER_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.default || '' }), {});

// ============================================================
// Validación del boletín
// ============================================================
// Se ejecuta al pulsar "Enviar": primero los ERRORS, que bloquean el envío,
// y después los AVISOS, que se muestran en la confirmación y decide el admin.

/**
 * Comprueba asunto y mensaje antes de enviar.
 *
 * El campo es TEXTO LLANO: el HTML, el estilo y el enlace de baja los genera
 * el sistema (buildNewsletterHtml), así que ya no hay etiquetas que romperse
 * ni marcas que recordar.
 *
 * @param {object} opts
 * @param {string} opts.subject  Asunto actual
 * @param {string} opts.body     Mensaje actual (texto llano)
 * @param {string} opts.baseline Última versión GUARDADA. Se usa para detectar
 *                               borrados accidentales (el típico Ctrl+A),
 *                               comparando contra lo que había y no contra la
 *                               plantilla de fábrica, así un recorte
 *                               intencionado grande solo avisa, no molesta.
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateNewsletter({ subject, body, baseline }) {
  const errors = [];
  const warnings = [];

  if (!String(subject || '').trim()) {
    errors.push('El asunto del boletín está vacío.');
  }

  const content = String(body || '');
  if (!content.trim()) {
    errors.push('El mensaje del boletín está vacío.');
  }

  const prev = String(baseline || '');
  if (content.trim() && prev.trim() && content.length < prev.length * 0.5) {
    warnings.push(
      `El mensaje es mucho más corto que la última versión guardada ` +
      `(${content.length} de ${prev.length} caracteres).`
    );
  }

  return { errors, warnings };
}

/**
 * Convierte un boletín en HTML (guardado en las versiones antiguas o
 * restaurado del historial) a texto llano para el editor.
 * Usa el contenido de .content si existe — ahí vive el cuerpo real — y
 * devuelve texto con ## / - / párrafos, el mismo formato que el editor.
 */
function htmlToBody(html) {
  if (!html) return '';
  const trimmed = String(html).trim();
  // Heurística: si no parece HTML, así queda tal cual.
  if (!/<\/?(html|body|head|div|p|h1|h2|h3|ul|ol|li|style|table|a)\b|<!doctype/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    const root = doc.querySelector('.content') || doc.body;
    const out = [];
    root.childNodes.forEach(node => {
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (/^h[1-3]$/.test(tag)) {
        out.push(`## ${text}`);
      } else if (tag === 'ul' || tag === 'ol') {
        node.querySelectorAll('li').forEach(li => {
          const t = (li.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) out.push(`- ${t}`);
        });
      } else {
        out.push(text);
      }
    });
    return out.join('\n\n') || trimmed;
  } catch {
    return trimmed;
  }
}

/** Fecha corta para el historial; si el formato falla, devuelve el texto crudo. */
function formatSentAt(iso) {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso || '');
  }
}

export default function Settings() {
  const [values, setValues] = useState(DEFAULTS);
  const [legal, setLegal] = useState(LEGAL_DEFAULTS);
  const [newsletter, setNewsletter] = useState(NEWSLETTER_DEFAULTS);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [legalErr, setLegalErr] = useState('');
  const [legalOk, setLegalOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [legalBusy, setLegalBusy] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterErr, setNewsletterErr] = useState('');
  const [newsletterOk, setNewsletterOk] = useState('');

  // Última versión GUARDADA del HTML. Sirve de referencia para avisar si el
  // contenido encoge de golpe al pulsar "Enviar".
  const [savedHtml, setSavedHtml] = useState(NEWSLETTER_DEFAULTS.newsletter_html || '');
  const [subscriberCount, setSubscriberCount] = useState(0);
  // true = se está mostrando la confirmación en línea de envío.
  const [confirming, setConfirming] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyErr, setHistoryErr] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // historial plegado por defecto
  // La vista previa va con debounce: reparsear el mensaje en cada pulsación
  // del textarea es un gasto innecesario. Se inicializa ya construida para
  // no repetir renderMarkdown en cada render del componente.
  const [previewHtml, setPreviewHtml] = useState(() =>
    buildNewsletterHtml(renderMarkdown(NEWSLETTER_DEFAULTS.newsletter_html || '')));

  useEffect(() => {
    supabase.from('settings').select('key, value')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        const map = {};
        (data || []).forEach(r => { map[r.key] = r.value; });
        setValues(v => ({ ...v, ...map }));
        // En documentos: solo pisa el texto por defecto si guardaron algo no vacío.
        setLegal(l => {
          const next = { ...l };
          LEGAL_FIELDS.forEach(f => {
            const stored = map[f.key];
            if (stored !== undefined && String(stored).trim() !== '') next[f.key] = stored;
          });
          return next;
        });
        // En boletín: cargamos lo guardado (si no está vacío) y lo tomamos
        // como referencia para las comparaciones de validación. Lo que esté
        // en HTML (versiones antiguas) se convierte a texto llano.
        const loaded = { ...NEWSLETTER_DEFAULTS };
        NEWSLETTER_FIELDS.forEach(f => {
          const stored = map[f.key];
          if (stored !== undefined && String(stored).trim() !== '') {
            loaded[f.key] = f.key === 'newsletter_html' ? (htmlToBody(stored) || stored) : stored;
          }
        });
        setNewsletter(loaded);
        setSavedHtml(loaded.newsletter_html || '');
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    const rows = FIELDS.map(f => ({ key: f.key, value: String(values[f.key] ?? '').trim() }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk('Configuración guardada ☀');
  };

  const submitLegal = async (e) => {
    e.preventDefault();
    setLegalErr('');
    setLegalOk('');
    setLegalBusy(true);
    const rows = LEGAL_FIELDS.map(f => ({ key: f.key, value: String(legal[f.key] ?? '') }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setLegalBusy(false);
    if (error) { setLegalErr(error.message); return; }
    setLegalOk('Documentos legales guardados ☀  Ya se muestran en la tienda.');
  };

  // ------------------------------------------------------------
  // Recuento de suscriptores: se lee una vez al montar para poder
  // avisar en el propio botón de cuánta gente va a recibir el boletín.
  // ------------------------------------------------------------
  useEffect(() => {
    supabase
      .from('subscribers')
      .select('email', { count: 'exact', head: true })
      .then(({ count }) => setSubscriberCount(count || 0));
  }, []);

  // ------------------------------------------------------------
  // Historial de envíos. La tabla puede no existir en bases antiguas
  // (aún no migradas), y en ese caso dejamos la sección vacía en vez
  // de romper el panel.
  // ------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('newsletter_history')
      .select('id, subject, html, sent_at, recipients_count')
      .order('sent_at', { ascending: false })
      .limit(20);
    if (error) {
      console.warn('[newsletter] No se pudo leer el historial:', error.message);
      return;
    }
    setHistory(data || []);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Vista previa con debounce de 300ms: el texto llano se convierte en HTML
  // con la plantilla de Salud & Vida — exactamente lo que se enviará.
  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewHtml(buildNewsletterHtml(renderMarkdown(newsletter.newsletter_html || '')));
    }, 300);
    return () => clearTimeout(t);
  }, [newsletter.newsletter_html]);

  // ------------------------------------------------------------
  // Acciones del boletín
  // ------------------------------------------------------------

  /** Guarda el contenido en settings. NUNCA envía nada. */
  const saveNewsletterDraft = async () => {
    setNewsletterErr('');
    setNewsletterOk('');
    setNewsletterBusy(true);
    try {
      const rows = NEWSLETTER_FIELDS.map(f => ({
        key: f.key,
        value: String(newsletter[f.key] ?? '')
      }));
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(`No se pudo guardar: ${error.message}`);
      setSavedHtml(newsletter.newsletter_html || '');
      setNewsletterOk('Borrador guardado. No se ha enviado nada ☀');
    } catch (e) {
      setNewsletterErr(e.message || 'Error al guardar el borrador.');
    }
    setNewsletterBusy(false);
  };

  /** Paso 1 del envío: validar y pasar a la confirmación en línea. */
  const startSend = (e) => {
    e.preventDefault();
    setNewsletterErr('');
    setNewsletterOk('');
    setConfirming(false);

    const { errors, warnings: warns } = validateNewsletter({
      subject: newsletter.newsletter_subject,
      body: newsletter.newsletter_html,
      baseline: savedHtml
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setWarnings(warns);
    setConfirming(true);
  };

  /** Paso 2 del envío: lo que ocurre tras pulsar "Sí, enviar". */
  const doSend = async () => {
    setConfirming(false);
    setNewsletterErr('');
    setNewsletterOk('');
    setNewsletterBusy(true);
    try {
      // 1) Guardar: si no, el contenido editado se pierde al recargar.
      const rows = NEWSLETTER_FIELDS.map(f => ({
        key: f.key,
        value: String(newsletter[f.key] ?? '')
      }));
      const { error: saveErr } = await supabase
        .from('settings').upsert(rows, { onConflict: 'key' });
      if (saveErr) throw new Error(`No se pudo guardar el contenido: ${saveErr.message}`);
      setSavedHtml(newsletter.newsletter_html || '');

      // 2) Cargar la lista real de suscriptores en ese momento.
      const { data: subs, error: subErr } = await supabase
        .from('subscribers').select('email');
      if (subErr) throw new Error(`No se pudieron leer los suscriptores: ${subErr.message}`);

      const emails = [...new Set(
        (subs || []).map(s => String(s.email || '').trim().toLowerCase())
      )].filter(Boolean);

      if (emails.length === 0) {
        throw new Error('Todavía no hay suscriptores. Suscríbete primero desde el pie de la tienda.');
      }

      // 3) Enviar (el servicio trocea internamente en lotes de 50).
      // El texto llano viaja envuelto en la plantilla de Salud & Vida, con el
      // enlace de baja que la Edge Function personaliza en cada correo.
      const result = await sendNewsletter(emails, {
        subject: newsletter.newsletter_subject,
        html: buildNewsletterHtml(renderMarkdown(newsletter.newsletter_html || ''))
      });

      if (result.failed > 0) {
        const muestras = result.errors.slice(0, 3).map(e => e.email).join(', ');
        throw new Error(
          `Enviados ${result.sent} de ${result.total}. ` +
          `${result.failed} fallaron: ${muestras}${result.errors.length > 3 ? '…' : ''}`
        );
      }

      setNewsletterOk(
        `Boletín enviado a ${result.sent} suscriptor${result.sent === 1 ? '' : 'es'} ☀`
      );
      setSubscriberCount(result.sent);
      await loadHistory();
    } catch (e) {
      setNewsletterErr(e.message || 'Error desconocido al enviar.');
    }
    setNewsletterBusy(false);
  };

  /** Recupera la plantilla de fábrica. Solo toca el editor: no guarda ni envía. */
  const restoreDefaultTemplate = () => {
    if (!window.confirm('¿Restaurar la plantilla original? Se sustituirá el contenido que tengas en el editor (aún no guardado).')) return;
    setNewsletter(n => ({
      ...n,
      newsletter_subject: DEFAULT_SUBJECT,
      newsletter_html: DEFAULT_BODY
    }));
    setValidationErrors([]);
    setConfirming(false);
    setNewsletterOk('Plantilla original cargada en el editor. Revísala antes de guardar o enviar.');
    document.getElementById('newsletter-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Carga un boletín ya enviado en el editor, para recuperarlo. */
  const restoreFromHistory = (item) => {
    if (!window.confirm(`¿Cargar "${item.subject}" en el editor? Se sustituirá el contenido actual (aún no guardado).`)) return;
    setNewsletter(n => ({
      ...n,
      newsletter_subject: item.subject,
      newsletter_html: htmlToBody(item.html) || item.html
    }));
    setValidationErrors([]);
    setConfirming(false);
    setNewsletterOk('Contenido cargado en el editor. Revísalo antes de guardar o enviar.');
    document.getElementById('newsletter-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ------------------------------------------------------------
  // Borrado del historial. Solo quita filas de newsletter_history:
  // ni toca el borrador del editor ni reenvía nada.
  // ------------------------------------------------------------

  /** Borra un envío concreto del historial. */
  const deleteHistoryItem = async (item) => {
    if (!window.confirm(`¿Eliminar del historial el envío "${item.subject}"?`)) return;
    setHistoryErr('');
    setHistoryBusy(true);
    const { error } = await supabase.from('newsletter_history').delete().eq('id', item.id);
    setHistoryBusy(false);
    if (error) { setHistoryErr(`No se pudo borrar: ${error.message}`); return; }
    // Releemos en vez de filtrar en local: si el borrado no afecta a ninguna
    // fila (p. ej. RLS), la tabla no debe quedar falsamente vacía.
    loadHistory();
  };

  /** Vacia el historial entero (borra todas las filas, no solo las 20 visibles). */
  const clearHistory = async () => {
    // Sin cifra en el mensaje: la tabla solo muestra 20 filas como máximo y
    // el borrado se lleva todas, contadas o no.
    if (!window.confirm('¿Borrar todo el historial de envíos? No se puede deshacer.')) return;
    setHistoryErr('');
    setHistoryBusy(true);
    // PostgREST exige siempre una condición en DELETE: "id IS NOT NULL"
    // cumple (el id es la clave primaria, nunca nulo) y borra todo.
    const { error } = await supabase.from('newsletter_history').delete().not('id', 'is', null);
    setHistoryBusy(false);
    if (error) { setHistoryErr(`No se pudo borrar el historial: ${error.message}`); return; }
    loadHistory();
  };

  return (
    <section>
      <header className="adm-head">
        <div><h2>Configuración</h2><p>Datos generales que usa la tienda y el pie de página.</p></div>
      </header>
      <form className="adm-card adm-form" onSubmit={submit}>
        {FIELDS.map(f => (
          <label key={f.key}>
            {f.label}
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : f.type === 'select' ? (
              <select
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              >
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.type}
                value={values[f.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
            <span className="adm-muted small">{f.help}</span>
          </label>
        ))}
        <Notice kind="error" title="No se ha podido guardar la configuración." onDismiss={() => setErr('')}>
          {err}
        </Notice>
        <Notice kind="ok" onDismiss={() => setOk('')}>{ok}</Notice>
        <button className="adm-btn" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Documentos legales</h2>
          <p>Páginas enlazadas en el pie. Puedes reescribirlas aquí sin tocar código.</p>
        </div>
      </header>
      <form className="adm-card adm-form" onSubmit={submitLegal}>
        <p className="adm-muted small" style={{ marginTop: 0 }}>
          Formato permitido: <code>#</code> y <code>##</code> para títulos, <code>**negritas**</code>,
          listas con <code>-</code>, enlaces con <code>[texto](https://…)</code> y citas con <code>&gt;</code>.
          Deja un renglón en blanco para separar párrafos. Todo lo demás se muestra tal cual.
        </p>
        {LEGAL_FIELDS.map(f => (
          <label key={f.key}>
            {f.label}
            <span className="legal-links">
              <Link className="adm-link" to={`/doc/${f.slug}`} target="_blank">Ver en la tienda ↗</Link>
            </span>
            <textarea
              rows={10}
              spellCheck={true}
              value={legal[f.key] ?? ''}
              onChange={e => setLegal(l => ({ ...l, [f.key]: e.target.value }))}
            />
            <span className="adm-muted small">
              Si vacías este campo, se restaura el texto original de la tienda.
            </span>
          </label>
        ))}
        <Notice kind="error" title="No se han podido guardar los documentos." onDismiss={() => setLegalErr('')}>
          {legalErr}
        </Notice>
        <Notice kind="ok" onDismiss={() => setLegalOk('')}>{legalOk}</Notice>
        <button className="adm-btn" type="submit" disabled={legalBusy}>
          {legalBusy ? 'Guardando…' : 'Guardar documentos'}
        </button>
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Boletín</h2>
          <p>Edita el contenido y revísalo en la vista previa. «Guardar borrador» nunca envía nada: el envío siempre pasa por una confirmación.</p>
        </div>
      </header>
      <form className="adm-card adm-form" onSubmit={startSend}>
        {NEWSLETTER_FIELDS.filter(f => f.type !== 'textarea').map(f => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type}
              value={newsletter[f.key] ?? ''}
              onChange={e => {
                setNewsletter(n => ({ ...n, [f.key]: e.target.value }));
                // Lo que cambia invalida la validación anterior.
                setValidationErrors([]);
                setConfirming(false);
              }}
            />
            <span className="adm-muted small">{f.help}</span>
          </label>
        ))}

        <div className="adm-newsletter-grid" id="newsletter-editor">
          <label>
            {NEWSLETTER_FIELDS.find(f => f.type === 'textarea').label}
            <textarea
              rows={20}
              spellCheck={true}
              placeholder="Escribe aquí tu mensaje…"
              value={newsletter.newsletter_html ?? ''}
              onChange={e => {
                setNewsletter(n => ({ ...n, newsletter_html: e.target.value }));
                setValidationErrors([]);
                setConfirming(false);
              }}
            />
            <span className="adm-muted small">
              {NEWSLETTER_FIELDS.find(f => f.type === 'textarea').help}
            </span>
            <button type="button" className="adm-linkbtn danger adm-newsletter-restore" onClick={restoreDefaultTemplate}>
              Restaurar plantilla original
            </button>
          </label>

          <div className="adm-newsletter-preview">
            <div className="adm-preview-head">
              <span className="adm-muted small">Vista previa · así se verá en la bandeja</span>
              <strong title={newsletter.newsletter_subject || '(sin asunto)'}>
                {newsletter.newsletter_subject || '(sin asunto)'}
              </strong>
            </div>
            <iframe
              sandbox=""
              title="Vista previa del boletín"
              srcDoc={previewHtml}
            />
          </div>
        </div>

        <Notice kind="error" title="No se ha podido completar." onDismiss={() => setNewsletterErr('')}>
          {newsletterErr}
        </Notice>
        <Notice kind="ok" onDismiss={() => setNewsletterOk('')}>{newsletterOk}</Notice>
        <Notice kind="info" title="Trabajando…">
          {newsletterBusy ? 'Guardando contenido y enviando. No cierres esta ventana.' : ''}
        </Notice>
        <Notice kind="error" title="No se puede enviar todavía:">
          {validationErrors.length > 0 && (
            <ul>
              {validationErrors.map(m => <li key={m}>{m}</li>)}
            </ul>
          )}
        </Notice>

        {confirming ? (
          <div className="adm-confirm">
            <p>
              Se enviará a <strong>{subscriberCount} suscriptor{subscriberCount === 1 ? '' : 'es'}</strong>.
              Una vez enviado no se puede deshacer.
            </p>

            {subscriberCount === 0 && (
              <p className="adm-confirm-warn-title">
                Todavía no hay suscriptores: suscríbete desde el pie de la tienda para poder probar.
              </p>
            )}

            {warnings.length > 0 && (
              <>
                <p className="adm-confirm-warn-title">Antes de enviar, revisa:</p>
                <ul className="adm-confirm-warn">
                  {warnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              </>
            )}

            <div className="adm-form-actions">
              <button
                className="adm-btn"
                type="button"
                onClick={doSend}
                disabled={newsletterBusy || subscriberCount === 0}
              >
                {newsletterBusy
                  ? 'Enviando…'
                  : `Sí, enviar a ${subscriberCount} suscriptor${subscriberCount === 1 ? '' : 'es'}`}
              </button>
              <button
                className="adm-btn ghost"
                type="button"
                onClick={() => setConfirming(false)}
                disabled={newsletterBusy}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : newsletterBusy ? (
          // Mientras trabaja no mostramos acciones: solo arriba está el
          // mensaje que dice qué está pasando exactamente.
          <div className="adm-form-actions">
            <button className="adm-btn" type="button" disabled>
              Trabajando…
            </button>
          </div>
        ) : (
          <div className="adm-form-actions">
            <button className="adm-btn ghost" type="button" onClick={saveNewsletterDraft}>
              Guardar borrador
            </button>
            <button className="adm-btn" type="submit">
              {subscriberCount > 0
                ? `Enviar boletín a ${subscriberCount} suscriptor${subscriberCount === 1 ? '' : 'es'}`
                : 'Revisar y enviar boletín'}
            </button>
          </div>
        )}
      </form>

      <header className="adm-head" style={{ marginTop: 30 }}>
        <div>
          <h2>Historial de envíos</h2>
          <p>Últimos boletines enviados. Sirve para recuperar el contenido si algo salió mal.</p>
        </div>
        {history.length > 0 && (
          <div className="adm-head-actions">
            <button type="button" className="adm-linkbtn" onClick={() => setHistoryOpen(o => !o)}>
              {historyOpen ? 'Ocultar historial' : `Ver historial (${history.length})`}
            </button>
            {historyOpen && (
              <button type="button" className="adm-linkbtn danger" onClick={clearHistory} disabled={historyBusy}>
                Borrar todo
              </button>
            )}
          </div>
        )}
      </header>
      {historyErr && (
        <Notice kind="error" title="No se ha podido borrar." onDismiss={() => setHistoryErr('')}>
          {historyErr}
        </Notice>
      )}
      {history.length === 0 ? (
        <p className="adm-status-hint">Todavía no has enviado ningún boletín desde el panel.</p>
      ) : !historyOpen ? null : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Asunto</th>
                <th>Fecha</th>
                <th>Destinatarios</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{h.subject}</td>
                  <td>{formatSentAt(h.sent_at)}</td>
                  <td>{h.recipients_count}</td>
                  <td>
                    <span className="adm-hist-actions">
                      <button type="button" className="adm-linkbtn" onClick={() => restoreFromHistory(h)}>
                        Restaurar
                      </button>
                      <button
                        type="button"
                        className="adm-linkbtn danger"
                        onClick={() => deleteHistoryItem(h)}
                        disabled={historyBusy}
                      >
                        Borrar
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
