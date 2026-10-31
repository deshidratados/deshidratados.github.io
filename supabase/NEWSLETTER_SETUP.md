# Guía: Envío de correos con Brevo + Supabase Edge Functions

Este documento explica cómo configurar el envío de boletines y emails de
bienvenida de la tienda. **Todo se hace en el navegador: no hace falta
instalar la CLI de Supabase.**

El proveedor es [Brevo](https://www.brevo.com) (antes Sendinblue), en su
**plan gratuito**. Se eligió porque permite verificar **una sola dirección
de correo** como remitente (sin comprar dominio), a diferencia de Resend,
que exige verificar un dominio entero con registros DNS.

---

## Arquitectura

```
Frontend (React)
    ↓  solo llama a la URL de la Edge Function
Supabase Edge Function  send-email
    ↓  1. Lee el remitente de la tabla `settings`
    ↓  2. Valida destinatarios y trocea en lotes de 50
    ↓  3. Sustituye {{UNSUBSCRIBE_URL}} por un enlace firmado por destinatario
    ↓  4. Llama a Brevo con la API key (secret, nunca en el navegador)
Brevo  →  SMTP  →  bandeja del destinatario
                          ↓  el suscriptor pulsa "Darse de baja"
Supabase Edge Function  unsubscribe  →  borra la fila de `subscribers`
```

**El remitente (`newsletter_from`) se lee SIEMPRE desde la base de datos**
dentro de la función. El navegador no puede cambiarlo, así que nadie puede
suplantar al emisor desde las herramientas del desarrollador.

**Qué ve alguien que abra las herramientas del navegador:**

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
sb_publishable_...   (anon key, pública por diseño)
```

No hay ninguna API key en el JavaScript.

---

## Orden de los pasos

| # | Paso | Dónde |
|---|---|---|
| 0 | Crear cuenta gratis en Brevo y verificar el remitente | [brevo.com](https://www.brevo.com) |
| 1 | Ejecutar la migración SQL | Supabase → SQL Editor |
| 2 | Guardar la API key de Brevo | Supabase → Edge Functions → Secrets |
| 3 | Desplegar las Edge Functions `send-email` y `unsubscribe` | Supabase → Edge Functions |
| 4 | Configurar el remitente | Tu tienda → `/admin` |
| 5 | Probar | El propio panel |

---

## Paso 0: Crear la cuenta y verificar el remitente en Brevo

1. Regístrate gratis en [brevo.com](https://www.brevo.com) (no pide tarjeta).
2. Verifica tu correo de cuenta (te envían un código a ese correo).
3. Ve a **SMTP & API → Senders** → **Add a sender**:
   - Email: `solaria024@gmail.com` (o el que uses)
   - Nombre: `Solaria · Deshidratados` (opcional pero recomendado)
4. Brevo te envía **un código de confirmación a esa misma dirección**.
   Ábrela, cópialo y pégalo en Brevo → el sender queda **Verified**.
5. En **SMTP & API → API Keys** → **Generate** → copia la clave
   (empieza por `xkeysib-...`).

> ⚠️ **Validación de cuenta nueva:** Brevo puede poner la cuenta en
> revisión (*under validation*) las primeras horas. Si al enviar aparece
> `account_under_validation`, completa la validación desde su dashboard
> (suelen pedir la URL del sitio) o espera un poco.

---

## Paso 1: Ejecutar la migración SQL

En **Supabase → SQL Editor**, pega y ejecuta, en este orden:

```
supabase/upgrade-2026-10-24.sql
supabase/upgrade-2026-10-29.sql
```

El primero crea la estructura (idempotente). El segundo fija el remitente
del boletín a `solaria024@gmail.com` (el verificado en Brevo).

| Fichero | Cuándo |
|---|---|
| `schema.sql` | Base **nueva** → crea todo e inserta el catálogo |
| `upgrade-2026-10-24.sql` | Base **existente** → la lleva al estado actual |
| `upgrade-2026-10-29.sql` | Base **existente** → cambia el remitente a Brevo |

Son 100 % idempotentes (puede ejecutarse muchas veces) y **no destructivos**.

**Qué debe aparecer:** `Success. No rows affected`. Es correcto.

---

## Paso 2: Guardar la API key de Brevo

1. [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto
2. Sidebar → **Edge Functions → Secrets**
   (directo: `https://supabase.com/dashboard/project/_/functions/secrets`)
3. **Add secret** con estos valores:

| Key | Value |
|---|---|
| `BREVO_API_KEY` | tu API key de Brevo (`xkeysib-...`, del Paso 0) |

4. Pulsa **Save**

> Los secrets tardan hasta **1 minuto** en propagarse. No hace falta
> redesplegar la función: los lee en cada llamada.
>
> **Regla:** el nombre de un secret no puede empezar por `SUPABASE_`.

> Si venías de Resend, puedes **borrar el secret antiguo** `RESEND_API_KEY`
> una vez todo funcione con Brevo: ya no se usa.

---

## Paso 3: Desplegar las Edge Functions

Hay **dos** funciones, y se desplegan igual. Repite los pasos con cada una:

| Función | Contenido | Verify JWT |
|---|---|---|
| `send-email` | `supabase/functions/send-email/index.ts` | ✅ Activado (por defecto) |
| `unsubscribe` | `supabase/functions/unsubscribe/index.ts` | ❌ **Desactivado** (ver aviso) |

**Opción A · Desde el dashboard (recomendada, sin instalar nada)**

1. Sidebar → **Edge Functions**
2. **"Deploy a new function"** → **"Via Editor"**
3. **Name:** `send-email` ← **con guion**
4. Borra la plantilla y pega **todo** el contenido de
   `supabase/functions/send-email/index.ts`
5. **"Deploy function"** al pie del editor
6. Repite 2–5 con `unsubscribe` y
   `supabase/functions/unsubscribe/index.ts`

Quedarán vivas en:

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
https://TU-PROYECTO.supabase.co/functions/v1/unsubscribe
```

> El editor del dashboard no tiene control de versiones. El código fuente de
> verdad está en tu repo: si lo editas desde el dashboard, copia el cambio
> de vuelta al fichero correspondiente de `supabase/functions/`.

### ⚠️ Verify JWT de `unsubscribe`

La función `unsubscribe` **debe ir con "Verify JWT" desactivado**, porque
quien hace clic en el enlace es el navegador del suscriptor, que no lleva
la cabecera `Authorization` de Supabase: con el JWT activado, el enlace
respondería `401` siempre.

Cómo se desactiva (tras desplegarla):

1. **Edge Functions** → `unsubscribe`
2. Pestaña **Settings** (o el icono de engranaje)
3. **Verify JWT** → desactivado → **Save**

Con él desactivado no hay riesgo: la función solo borra filas cuando la
firma HMAC del enlace es correcta (ver *Seguridad* más abajo).
`send-email` **deja el JWT activado**, como hasta ahora.

**Opción B · Con la CLI**

```bash
supabase login
supabase link --project-ref tu-project-ref
supabase functions deploy send-email
supabase functions deploy unsubscribe --no-verify-jwt
```

---

## Paso 4: Configurar el remitente

1. Inicia sesión en `/admin` → **Configuración**
2. **"Email remitente del boletín"** → rellena con la dirección que
   verificaste en Brevo:

```
Solaria · Deshidratados <solaria024@gmail.com>
```

(o solo `solaria024@gmail.com`, si no quieres nombre visible)

3. Guarda

### ⚠️ Reglas del remitente en Brevo

| Remitente | Resultado |
|---|---|
| `solaria024@gmail.com` verificado en Brevo | ✅ **Se envía a cualquier destinatario** |
| Dirección NO verificada en Brevo | ❌ 400 `not_acceptable` |
| `onboarding@resend.dev` (herencia de Resend) | ❌ 400 — no es remitente de Brevo |

**La dirección que pongas aquí DEBE coincidir exactamente con la que
verificaste en Brevo** (Paso 0). Si cambias de remitente, verifica la
nueva dirección en Brevo antes de usarla.

### Sobre la entrega (Inbox vs Spam)

Sin dominio propio, enviar desde un Gmail verificado **funciona y llega
a terceros** (que era el problema de Resend con `onboarding@resend.dev`,
que solo permitía enviarte a ti mismo). Pero la reputación de un remitente
de Gmail para boletines no es ideal: algunos correos pueden caer en Spam.

**Lo que sí puedes hacer para mejorar la entrega:**

1. **Que el destinatario te guarde en contactos.** Es lo más eficaz sin
   dominio propio: una vez guardado, los siguientes suelen entrar a Inbox.
2. **Que marquen "No es spam" la primera vez.** Ayuda para ese buzón.
3. **Contenido limpio:** poco texto en mayúsculas, sin exceso de "¡!",
   con imagen y texto equilibrados.
4. **No enviar varios correos idénticos seguidos** — eso dispara filtros.

**La solución profesional: un dominio propio** (~8–15 $/año; `.cu` suele
ser más caro y burocrático). Con él:

1. Se registra en Brevo → **Senders → Add a domain**
2. Brevo da unos registros DNS (SPF, DKIM) para tu registradora
3. Estado → **Verified**
4. El remitente pasa a ser `hola@tudominio.com`
5. SPF/DKIM/DMARC quedan firmados **por tu dominio** → entrega fiable

---

## El enlace «Darse de baja»

Las plantillas por defecto incluyen en el pie:

```html
<a href="{{UNSUBSCRIBE_URL}}">Darse de baja</a>
```

`{{UNSUBSCRIBE_URL}}` es un **marcador**, no una URL. Al enviar, la función
`send-email` lo sustituye en cada correo por un enlace personalizado:

```
https://TU-PROYECTO.supabase.co/functions/v1/unsubscribe?e=roger@…&s=firma-hmac
```

El flujo del suscriptor:

1. Pulsa «Darse de baja» → la función `unsubscribe` **redirige** (302) a
   la página de la tienda `unsubscribe.html` (GitHub Pages).
2. La página muestra la **confirmación** con un botón.
3. Pulse «Sí, darme de baja» → la página llama por POST a la función,
   que **borra su fila** de `subscribers`.
4. La página muestra «¡Listo!» y deja de recibir boletines en el
   siguiente envío.

### ¿Por qué la página está en la tienda y no en la función?

Porque **Supabase no permite que las funciones sirvan páginas HTML**: el
runtime convierte cualquier respuesta `text/html` en `text/plain` (con
`CSP: sandbox` y `nosniff`) como protección anti-phishing del dominio
`*.supabase.co`, y el navegador mostraría el HTML como texto crudo.
La interfaz vive por eso en `public/unsubscribe.html`, que GitHub Pages
publica junto con el resto del sitio.

### ¿Por qué hay una confirmación y no borra directamente?

Porque **Gmail y Outlook precargan los enlaces** de los correos (escáneres
de seguridad). Si el enlace borrara al abrirse, esas personas quedarían
dadas de baja sin haber pulsado nada. El GET solo redirige, la página
muestra un botón, y el borrado ocurre en el POST — que los escáneres no
ejecutan.

### Reglas para que funcione

- **No borres el marcador** `{{UNSUBSCRIBE_URL}}` del HTML. La validación
  del panel avisa si el texto de baja está pero el marcador falta.
- La función `unsubscribe` debe estar **desplegada** (con el contenido
  actual de `supabase/functions/unsubscribe/index.ts`) y con
  **Verify JWT desactivado** (Paso 3).
- La página `unsubscribe.html` se publica **con el push a GitHub**: si
  aún no has pusheado los cambios, el enlace dará 404 de GitHub Pages.
- El historial guarda el HTML **con el marcador**, así que un boletín
  restaurado sigue siendo válido.
- No hace falta configurar ningún secret nuevo: la firma usa la clave de
  servicio de Supabase, que la plataforma ya inyecta.

### Probarlo

1. Envía un boletín (o el correo de bienvenida) a tu correo.
2. En el correo recibido, pulsa **«Darse de baja»** → debe abrirse la
   página de confirmación de la tienda con el botón.
3. Pulsa **«Sí, darme de baja»** → sale «¡Listo! Ya estás dado de baja».
4. En `/admin` → el recuento de suscriptores baja al recargar la página.

---

## Paso 5: Probar

### Desde el panel

1. `/admin` → **Configuración** → sección **Boletín**
2. Edita asunto y HTML. La **vista previa de la derecha** muestra, en vivo,
   lo que verá el suscriptor (misma plantilla, mismo ancho de 600px).
3. **"Guardar borrador"** si solo quieres conservar los cambios:
   **no envía nada nunca**, se limita a guardar en `settings`.
4. **"Enviar boletín a N suscriptores"** no envía directamente: primero
   valida el HTML y abre una **confirmación en línea** con el recuento de
   destinatarios y cualquier aviso. Hay que pulsar de nuevo para mandarlo.

**Qué bloquea el envío** (errores, no se puede continuar):

- Asunto o contenido vacío, o contenido sin texto visible.

**Qué solo avisa** (aparece en la confirmación, y tú decides):

- Etiquetas sin cerrar — Gmail suele tragar el resto del contenido.
- Falta el bloque `<style>` — llegará sin diseño.
- Falta el enlace de baja — afecta a la reputación y a la normativa.
- Falta el marcador `{{UNSUBSCRIBE_URL}}` — el enlace de baja no funcionará.
- El contenido es mucho más corto que la última versión guardada —
  el típico `Ctrl+A` accidental.

Si algo sale mal, la sección **Historial de envíos** guarda los últimos
boletines enviados y tiene un botón **"Restaurar"** que los carga de vuelta
en el editor. También hay **"Restaurar plantilla original"** para volver a
la plantilla de fábrica.

Para probar sin listas, suscríbete tú primero desde el pie de la tienda.

### Desde el dashboard de Supabase

1. Entra en la función `send-email` → pestaña **Test** → **POST**
2. Headers: `Content-Type: application/json`
3. Body:

```json
{ "to": ["tucuenta@gmail.com"], "subject": "Prueba Solaria", "html": "<h1>Hola</h1>", "type": "welcome" }
```

4. **Send Request**

Respuesta correcta:

```json
{ "ok": true, "sent": 1, "failed": 0, "remaining": 0, "errors": [] }
```

**Mira también en la pestaña Logs**: cada fallo concreto de Brevo se
registra con `console.error` e incluye la respuesta real de la API.

### En el dashboard de Brevo

1. **Transactional → Emails**: aparece cada envío con su estado
   (*delivered*, *bounce*, *failed*…)
2. Si algo falla, el detalle del error está ahí mismo.

---

## Solución de problemas

### «Falta el secret BREVO_API_KEY»
- Añádelo en **Edge Functions → Secrets** (Paso 2). Espera 1 minuto.

### `not_acceptable` — remitente no verificado
- La dirección de `newsletter_from` **no está verificada en Brevo**.
  Ve a Brevo → **SMTP & API → Senders** y verifica esa dirección
  (te envía un código a ese correo). O corrige el remitente en
  `/admin` → Configuración para que coincida con el verificado.

### `unauthorized` — API key inválida
- La API key no es válida o fue revocada. Regenera una en Brevo
  (**SMTP & API → API Keys**) y actualiza el secret `BREVO_API_KEY`.

### `account_under_validation`
- Tu cuenta de Brevo está en revisión (normal las primeras horas).
  Completa la validación desde el dashboard de Brevo o espera.

### `not_enough_credits` — límite diario
- Alcanzaste el límite diario del plan gratuito (~300 correos/día).
  Inténtalo mañana o considera un plan de pago.

### `429` / rate limit
- Demasiadas peticiones seguidas. Espera unos segundos y reintenta.
  La función ya trocea en lotes de 50 para evitarlo.

### `Error leyendo configuración: relation "settings" does not exist`
- Falta la migración. Ejecuta `supabase/upgrade-2026-10-24.sql` (Paso 1).

### Los correos van a Spam
- Es posible con remitente Gmail (sin dominio propio). Ver **Paso 4**.
- Que el destinatario te guarde en contactos mejora mucho.

### El panel dice "Enviados X de Y"
- Es un envío **parcialmente** fallido. La lista `errors` que devuelve la
  función indica exactamente qué correos fallaron y por qué.

### «El boletín aún no está habilitado» en el pie de la tienda
- Faltan las tablas `subscribers` o `settings`. Ejecuta la migración.

### El enlace de baja responde `401 Unauthorized`
- La función `unsubscribe` tiene **Verify JWT activado**. Desactívalo:
  Edge Functions → `unsubscribe` → Settings → **Verify JWT** → off (Paso 3).

### El enlace de baja dice «Este enlace no es válido»
- El enlace está **cortado o incompleto** (algunos clientes de correo lo
  hacen). Copia la URL completa del correo.
- O la **clave de servicio de Supabase cambió** (raro; solo si rotaste las
  llaves): los enlaces antiguos dejan de firmarse igual. El siguiente
  boletín ya llevará enlaces válidos.

### El enlace de baja da 404 (página de GitHub Pages)
- Falta el **push a GitHub**: la página `unsubscribe.html` se publica con
  el sitio. Espera a que termine el workflow de Actions y reintenta.

### El enlace muestra el HTML como texto crudo
- La función `unsubscribe` tiene una versión antigua desplegada (la que
  servía la página ella misma). Vuelve a pegar el contenido actual de
  `supabase/functions/unsubscribe/index.ts` y haz deploy.

### El enlace de baja no aparece en el correo
- El HTML en el editor no contiene `{{UNSUBSCRIBE_URL}}`. Restaura la
  plantilla original desde el panel (botón «Restaurar plantilla original»).

### Revisar el historial
- `newsletter_history` guarda cada boletín enviado (asunto, HTML y
  número de destinatarios). Útil para auditar desde el panel.

---

## Variables de entorno (frontend)

El frontend solo necesita dos, y son **públicas** (no son secretos):

```env
REACT_APP_SUPABASE_URL=https://TU-PROYECTO.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_...
```

Van en `.env.local` (ignorado por git) y en los **secrets de GitHub Actions**
para el despliegue en GitHub Pages.

**Nunca** pongas aquí la API key de Brevo: esa vive en Supabase.

---

## Seguridad

### ¿Qué ve alguien que abra las herramient del navegador?

Solo dos cosas:

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
sb_publishable_...   (anon key, pública por diseño)
```

No hay ninguna API key en el JavaScript. Para abusar de la función
necesitaría la anon key **y** aún así solo podría enviar correos desde tu
configuración, sin poder leer nada.

### ¿Y si alguien manda envíos masivos desde fuera?

Tres defensas:

1. **Verify JWT** — Supabase exige un JWT válido en la cabecera `Authorization`.
2. **Límite de 50 por invocación** — no puede vaciar una lista de un golpe.
3. **Brevo es el último filtro** — su rate limit y tu cuota diaria.

Cada suscriptor recibe **su propio mensaje**: nunca se pone a todos en el
mismo `To`, así que nadie ve la lista de los demás (algo que sí pasaría
si se mandara en un solo envío).

### ¿Y el enlace de baja, que no pide JWT?

La función `unsubscribe` va sin JWT (el navegador del suscriptor no puede
enviar cabeceras de Supabase), pero **cada enlace lleva una firma
HMAC-SHA256** del correo del destinatario, calculada con la clave de
servicio. Sin esa clave no se puede fabricar un enlace válido, así que
nadie puede dar de baja a un tercero. Y el GET solo muestra una página de
confirmación: **borra únicamente el POST** del botón, que los escáneres
de correo no envían.

---

## Límites

| Concepto | Valor |
|---|---|
| Destinatarios por request | **50** |
| Destinatarios por invocación de la función | **50** |
| Envío de un boletín grande | Se trocea desde el frontend, sin límite práctico |
| Plan gratuito de Brevo | **~300 correos/día** (verifica la cifra exacta en tu cuenta) |

---

## Checklist final

**Cuenta Brevo**
- [ ] Cuenta creada y correo verificado
- [ ] Remitente `solaria024@gmail.com` añadido y **Verified** en Senders
- [ ] API key generada (`xkeysib-...`)

**Base de datos**
- [ ] `supabase/upgrade-2026-10-24.sql` ejecutado → `Success. No rows affected`
- [ ] `supabase/upgrade-2026-10-29.sql` ejecutado → remitente fijado

**Supabase**
- [ ] Secret `BREVO_API_KEY` guardado
- [ ] Función `send-email` desplegada (con guion, con Verify JWT activado)
- [ ] Función `unsubscribe` desplegada (con guion, con **Verify JWT desactivado**)
- [ ] Prueba desde el dashboard devuelve `"ok": true`

**Panel**
- [ ] Email remitente = `solaria024@gmail.com` (verificada en Brevo)
- [ ] Suscribirse en el pie → llega el email de bienvenida
- [ ] Enviar el boletín → llega a los suscriptores (incluidos terceros)
- [ ] Revisar `newsletter_history` → aparece el envío
- [ ] En el correo, «Darse de baja» → abre la confirmación → baja al suscriptor

**Entrega**
- [ ] Avisado al destinatario de que el correo está en Spam (si aplica)
- [ ] Guardado en contactos → los siguientes entran a Inbox

---

## Soporte

Si tienes problemas:

1. Supabase Dashboard → **Edge Functions → send-email → Logs** (ahí están
   todos los `console.error` con la respuesta real de Brevo)
2. Brevo Dashboard → **Transactional → Emails** (estado de cada envío)
3. Revisa que el secret esté bien copiado (sin espacios al final)
4. Consola del navegador (F12) para ver errores del frontend

---

## Seguridad del envío (importante)

La función `send-email` está cerrada a visitantes anónimos:

- **Boletines**: solo se envían con la sesión de un usuario autenticado.
  Si el panel avisa de «Sesión no válida», sal y vuelve a entrar en el
  panel de administración.
- **Bienvenida**: el formulario público puede pedirla sin sesión, pero el
  servidor ignora el asunto y el HTML del cliente (usa su propia plantilla),
  exige un único destinatario y que ese correo ya esté suscrito. Así nadie
  puede usar la función como correo indiscriminado.

Esto se suma a lo que ya debe estar en el dashboard de Supabase:

- **Authentication → Sign In / Providers → «Allow new signups»
  DESACTIVADO**: si alguien pudiera registrarse por su cuenta, tendría
  sesión de usuario y con ella acceso de administrador a la base de datos.
- La función `unsubscribe` es pública a propósito (la pican los suscriptores
  desde su propio correo), protegida con firma HMAC.
