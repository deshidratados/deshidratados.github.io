# Guía práctica de soporte técnico · Solaria · Deshidratados

> Manual extenso, pensado para aprender la lógica del proyecto y actuar rápido en soporte. Explica **qué hace, por qué lo hace y cómo arreglarlo**.

## Índice

- [1. Visión general del proyecto](#1-visión-general-del-proyecto)
- [2. Stack y servicios utilizados](#2-stack-y-servicios-utilizados)
- [3. Arquitectura general](#3-arquitectura-general)
- [4. Estructura del código](#4-estructura-del-código)
- [5. Frontend: Lógica y flujos](#5-frontend-lógica-y-flujos)
- [6. Supabase: Base de datos, Auth, Storage y RLS](#6-supabase-base-de-datos-auth-storage-y-rls)
- [7. Panel de administración](#7-panel-de-administración)
- [8. Carrito, pedidos y WhatsApp](#8-carrito-pedidos-y-whatsapp)
- [9. Boletines, correos y Edge Functions](#9-boletines-correos-y-edge-functions)
- [10. Despliegue en GitHub Pages](#10-despliegue-en-github-pages)
- [11. Copias de seguridad (Base de datos + Fotos)](#11-copias-de-seguridad-base-de-datos--fotos)
- [12. Restauración (Supabase y Local)](#12-restauración-supabase-y-local)
- [13. Variables, secretos y claves](#13-variables-secretos-y-claves)
- [14. Troubleshooting detallado](#14-troubleshooting-detallado)
- [15. Checklist de soporte](#15-checklist-de-soporte)
- [16. Glosario y referencias](#16-glosario-y-referencias)

## 1. Visión general del proyecto

**Solaria** es una tienda online de frutas, verduras e hierbas deshidratadas. 

**Características clave:**
- **Sin pasarela de pago**: Todo se gestiona por WhatsApp
- **Entrega en Cuba**: El destino SIEMPRE es Cuba, aunque el comprador esté en otro país
- **Multi-moneda**: CUP, USD, EUR con tipos de cambio manuales
- **Panel propio**: Sin WordPress, todo custom
- **Boletines con baja segura**: Sistema completo con Brevo
- **100% editable**: Precios, productos, legales, configuración desde el panel

## 2. Stack y servicios utilizados

| Tecnología/Servicio | Propósito | Razón |
|---|---|---|
| **React 18 + CRA** | Frontend | Sencillo, estable, fácil de mantener |
| **React Router DOM 7** | Ruteo | SPA con hash routing para GitHub Pages |
| **Supabase** | Backend as a Service | Postgres, Auth, Storage, Edge Functions todo en uno |
| **Brevo** | SMTP/API de emails | Plan gratuito, verifica 1 email sin dominio obligatorio |
| **GitHub Pages** | Hosting estático | Gratis, integración directa con Actions |
| **GitHub Actions** | CI/CD + Backups | Automatización completa |

## 3. Arquitectura general

```text
Usuario (navegador)
    ↓
GitHub Pages (deshidratados.github.io)
    ↓
React App (SPA)
    ├── Lee datos de Supabase (Postgres + Storage)
    ├── Auth para panel /admin
    ├── Llama Edge Functions para emails
    └── Genera link WhatsApp para pedido

Supabase
    ├── Postgres (tablas + RLS)
    ├── Auth (usuarios admin)
    ├── Storage bucket product-images
    └── Edge Functions (send-email, unsubscribe)
        └── Llama a Brevo API
```

**Principios importantes:**
- **Frontend lee con anon key**: Protegido por RLS
- **Operaciones sensibles**: Van por Edge Functions con service key
- **Claves nunca en cliente**: BREVO_API_KEY solo en Supabase Secrets
- **Fallback a datos demo**: Si Supabase no configurado, usa `src/data/products.js`

## 4. Estructura del código

| Archivo/Carpeta | Lógica | Cuándo revisar |
|---|---|---|
| `src/App.js` | Punto entrada. Providers, rutas, BootGate | Problemas de navegación/carga |
| `src/data/supabase.js` | Cliente, helpers imágenes, SETTINGS_KEYS | Conexión Supabase, URLs imágenes |
| `src/data/shop.js` | Carga catálogo, precarga imágenes, `submitOrder()` | Catálogo vacío, pedidos no se guardan |
| `src/data/currency.js` | Conversión multi-moneda | Precios mal convertidos |
| `src/context/CartContext.js` | Estado carrito | Errores carrito/checkout |
| `src/admin/` | Todo el panel | Problemas panel/admin |
| `src/components/` | UI tienda pública | Problemas visuales/UX |
| `supabase/schema.sql` | Esquema completo | Crear BD nueva |
| `supabase/functions/send-email/` | Lógica correos | Errores envío boletines/bienvenida |
| `supabase/functions/unsubscribe/` | Baja con HMAC | Errores enlace baja |
| `.github/workflows/backup-db.yml` | Copias automáticas | Fallos backup |

## 5. Frontend: Lógica y flujos

### 5.1 Arranque y BootGate
En `src/App.js` y `src/data/shop.js`:
1. `ShopProvider` arranca `loading: true`
2. Si hay Supabase configurado → llama `loadFromSupabase()`
3. Precarga **solo imágenes principales** con `Image()` 
4. `ready` se activa cuando **todas las imágenes principales cargan** O cuando pasan **4 segundos** (`BOOT_TIMEOUT_MS`)
5. `BootGate` muestra `BootLoader` hasta `ready`

**Razón:** Evita parpadeos/placeholder y UX mejor en conexiones lentas.

### 5.2 Carga de datos
`loadFromSupabase()` hace 5 consultas en paralelo:
```js
Promise.all([
  supabase.from('categories').select('*').order('sort_order'),
  supabase.from('products').select('*').eq('active', true).order('sort_order'),
  supabase.from('variants').select('*').order('weight'),
  supabase.from('settings').select('key, value').in('key', SETTINGS_KEYS),
  supabase.from('presentations').select('*')
])
```

Transforma con `mapProduct()`, fusiona con `SHOP` defaults desde `moneySettings()`. Si falla o no hay productos → vuelve a seeds.

### 5.3 Multi-moneda
`src/data/currency.js`:
- Detecta moneda por idioma navegador
- Usa `rateCUP`, `rateEUR` desde settings (manuales)
- Base configurable (`currencyBase`)
- Formatea según moneda

**Importante:** Los tipos **NO son automáticos**. Se actualizan manualmente desde panel → Configuración.

### 5.4 Imágenes
`publicImageUrl(path)`:
- Si empieza con `http://` o `https://` → devuelve tal cual
- Si configurado → construye `https://<url>/storage/v1/object/public/product-images/<path>`
- Si no configurado → devuelve path tal cual

Las imágenes van en bucket `product-images`. Estructura flexible por carpetas (ej. `products/mango/123.jpg`)

## 6. Supabase: Base de datos, Auth, Storage y RLS

### 6.1 Tablas clave
| Tabla | Propósito | Notas |
|---|---|---|
| `products` | Productos | `active`, `slug`, `category_id`, `image`, `images[]` |
| `variants` | Presentaciones/precios | Relacionado con producto y presentación |
| `presentations` | Unidades (gr, kg...) | Se muestra "Presentación · Label" |
| `categories` | Categorías | Con `sort_order` |
| `orders` | Pedidos | Se guarda antes de abrir WhatsApp |
| `reviews` | Reseñas | Públicas tras aprobar? Se muestran últimas 3 |
| `subscribers` | Suscriptores boletín | Para bienvenida y envíos |
| `newsletter_history` | Historial envíos | Asunto, HTML, count, fecha |
| `settings` | Configuración | Clave/valor. Editables desde panel |

### 6.2 RLS (Row Level Security)
Activado en casi todas. **Lógica general:**
- **Lectura pública**: Productos activos, categorías, presentaciones, variantes, configuraciones públicas, reseñas aprobadas (según lógica)
- **Escritura restringida**: Pedidos pueden insertarse desde frontend (para guardar), resto requiere autenticado/admin
- **Panel requiere auth**: Solo usuarios autenticados acceden a `/admin`

**Regla crítica:** `Authentication > Sign In / Providers > Allow new signups` **DEBE ESTAR DESACTIVADO**

### 6.3 Storage
Bucket `product-images` público para lectura. Panel permite subir/borrar desde admin. Las rutas se guardan en DB (pueden ser relativas al bucket).

### 6.4 Auth
Usuario administrador creado en `Authentication > Users > Add user` con email + contraseña. Ese usuario es el único que puede acceder al panel y enviar boletines.

## 7. Panel de administración

Ruta: `/#/admin`. Requiere login.

| Sección | Función | Detalles |
|---|---|---|
| **Inicio/Dashboard** | Resumen | Vistazo general |
| **Productos** | CRUD completo | Galería, variantes, precios por presentación |
| **Categorías** | Gestión | Orden, slug |
| **Presentaciones** | Unidades | gr, kg, etc. |
| **Pedidos** | Gestión pedidos | Estados, filtros por fecha, agrupados por fecha de cambio, botón WhatsApp |
| **Reseñas** | Moderación | Aprobar/eliminar, se muestran 3 en home |
| **Suscriptores** | Lista | Ver emails suscritos |
| **Boletines** | Envío | Editor texto plano, vista previa, borrador, historial, confirmación envío |
| **Configuración** | Ajustes globales | Moneda, tipos cambio, envío gratis, heroPromo, remitente correo, documentos legales |

**Trucos panel:**
- Documentos legales usan formato simple (`#`, `##`, `**`, listas, `[texto](url)`)
- Boletines validan antes de enviar (avisa si falta `{{UNSUBSCRIBE_URL}}`)
- Historial permite restaurar envíos anteriores

## 8. Carrito, pedidos y WhatsApp

### Flujo
1. Usuario añade productos al carrito
2. Abre carrito/drawer
3. Rellena datos: nombre + teléfono (selector país)
4. Pulsa comprar → `submitOrder()` guarda en `orders` (si Supabase OK)
5. Se abre WhatsApp con mensaje preformateado
6. Mensaje incluye: productos, cantidades, totales, moneda, **"La entrega es siempre en Cuba"**

### Lógica en código
- `src/data/shop.js` → `submitOrder({ customerName, phone, items, total, shopName })`
- Inserta en tabla `orders` con `status: 'Nuevo'`
- Si Supabase no configurado, `submitOrder` devuelve `{ ok: false }` pero **NO rompe el flujo** (sigue abriendo WhatsApp)
- `src/context/CartContext.js` gestiona estado
- Desde panel se cambia estado del pedido → puede enviar aviso WhatsApp

## 9. Boletines, correos y Edge Functions

### 9.1 send-email
**Archivo:** `supabase/functions/send-email/index.ts`

**Tipos de envío:**
- `type: 'welcome'` → Formulario público suscripción. **Sin sesión.** Servidor usa plantilla fija `WELCOME_HTML`, ignora asunto/html del cliente, valida 1 destinatario y que esté en `subscribers`.
- Cualquier otro → **Requiere JWT autenticado** (solo admin con sesión)

**Seguridad:**
- Remitente SIEMPRE desde `settings.newsletter_from`
- Límite `MAX_PER_CALL = 50` por invocación
- Envía **uno a uno** (no pone todos en `To:`)
- Sustituye `{{UNSUBSCRIBE_URL}}` por enlace firmado HMAC por destinatario
- Guarda en `newsletter_history` solo si `type === 'newsletter'`

**Proceso:**
1. Valida body
2. Comprueba auth si no es welcome
3. Limpia/valida emails
4. Lee settings (remitente)
5. Trocea batch 50
6. Por cada uno: genera `makeUnsubscribeUrl()` con HMAC, llama Brevo API
7. Registra historial si es newsletter
8. Devuelve resumen

### 9.2 unsubscribe
**Archivo:** `supabase/functions/unsubscribe/index.ts`

**Ruta pública** (Verify JWT **OFF**)

**Flujo:**
1. **GET** con `?e=email&s=firma` → Redirige 302 a `https://deshidratados.github.io/unsubscribe.html` pasando params
2. Página `public/unsubscribe.html` muestra confirmación con botón
3. **POST** con `e,s` → Valida firma con `hmacHex()` + `safeEqual()` (tiempo constante), borra de `subscribers` con `ilike` escapando comodines
4. Responde `{ ok: true }` o error

**Por qué GET no borra:** Gmail/Outlook precargan enlaces (escáneres). Si borrara al abrir, se darían de baja sin querer. POST solo lo hace al pulsar botón.

**Firma:** `HMAC-SHA256(email.toLowerCase().trim(), SERVICE_KEY)` en hex

### 9.3 Brevo
API: `https://api.brevo.com/v3/smtp/email`
Headers: `api-key: BREVO_API_KEY`, `Content-Type: application/json`
Body: `{ sender, to: [{email}], subject, htmlContent, replyTo? }`

**Errores comunes Brevo:** `not_acceptable` (remitente no verificado), `unauthorized`, `account_under_validation`, `not_enough_credits`

Ver `supabase/NEWSLETTER_SETUP.md` para configuración paso a paso completa.

## 10. Despliegue en GitHub Pages

**Workflow:** `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node 20
      - npm ci || npm install
      - npm run build (con secrets)
      - upload-pages-artifact (build)
  deploy:
    needs: build
    uses actions/deploy-pages
```

**Secrets GitHub Actions:**
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

**Pasos:**
1. Añadir secrets en repo
2. Push a `main` dispara deploy
3. Site: `https://deshidratados.github.io/`

## 11. Copias de seguridad (Base de datos + Fotos)

**Workflow:** `.github/workflows/backup-db.yml`

### Frecuencia
- **Programado:** `cron: '0 4 * * 1'` (Lunes 04:00 UTC)
- **Manual:** `workflow_dispatch`

### Secrets requeridos
| Secret | Uso |
|---|---|
| `BACKUP_DB_URL` | Conexión **directa** puerto 5432 |
| `BACKUP_PASSPHRASE` | Clave AES-256 para cifrado. **CRÍTICO: guardarla fuera** |

### Flujo detallado
1. **Instalar cliente Postgres** desde PGDG
2. **Dump cifrado**:
   - `pg_dump --no-owner --no-privileges --format=custom "$PG_URL"`
   - Pipe a `openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"$BACKUP_PASSPHRASE"`
   - Guarda `solaria-YYYY-MM-DD.dump.enc`
   - Reintentos 3x con 60s si DB dormida
3. **Subir DB artifact**: `solaria-backup` (retention 30 días)
4. **Backup fotos**:
   - Query `storage.objects` WHERE `bucket_id='product-images'` con `psql`
   - Usa **project-ref fijo** `adeyttqsvcnptcvelbdz` (por compatibilidad con pooler)
   - Descarga con `curl` desde `https://<REF>.supabase.co/storage/v1/object/public/product-images/<url-encode>`
   - Respeta estructura carpetas
   - Genera `solaria-storage-YYYY-MM-DD.tar.gz`
   - Sube artifact `solaria-storage` (30 días, warn si vacío)
5. **Finaliza**

### Dónde ver
**SIEMPRE** en `Actions > Copia de seguridad de la base de datos > [run] > Summary` → Artifacts al final. **NO** en pestaña Jobs.

### Acumulación
- Se **acumulan** por ejecución (GitHub v4 crea nuevo artifact por run)
- **Expiran a 30 días** automáticamente
- Recomendado descargar copias importantes manualmente

## 12. Restauración (Supabase y Local)

### A) Restaurar en Supabase / PostgreSQL remoto
Descarga ambos artifacts del **mismo día**.

**Base de datos:**
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -pass pass:'TU_PASSPHRASE' \
  -in solaria-2026-11-XX.dump.enc \
  | pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      -d "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"
```

**Fotos:**
```bash
tar -xzf solaria-storage-2026-11-XX.tar.gz
# Arrastrar carpeta product-images/ a Storage > product-images en Supabase
```

### B) Restaurar localmente
```bash
# Crear BD
createdb solaria_local  # o psql CREATE DATABASE

# Desencriptar a .dump
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -pass pass:'TU_PASSPHRASE' \
  -in solaria-2026-11-XX.dump.enc \
  -out solaria-2026-11-XX.dump

# Restaurar con pg_restore (OBLIGATORIO, NO psql)
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname=postgresql://usuario:pass@localhost:5432/solaria_local \
  solaria-2026-11-XX.dump

# Fotos
tar -xzf solaria-storage-2026-11-XX.tar.gz
# Copiar product-images/ a ruta que sirva tu app local
```

**Trucos restauración:**
- Usar **conexión directa** para restore (evita pooler)
- `pg_restore` >= versión Postgres servidor
- Tras restaurar, revisar RLS/Auth si pruebas app completa
- Edge Functions NO se restauran

## 13. Variables, secretos y claves

### Frontend (.env.local + GitHub)
```env
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...  # o sb_publishable_...
```
**Públicas por diseño.** Protegidas por RLS.

### GitHub Actions Secrets
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `BACKUP_DB_URL`
- `BACKUP_PASSPHRASE`

### Supabase Edge Functions Secrets
- `BREVO_API_KEY`
- `SUPABASE_URL` / claves servicio inyectadas automáticamente

### Regla oro
**NUNCA** subir `.env.local`, **NUNCA** poner `BREVO_API_KEY` en frontend, **GUARDAR** `BACKUP_PASSPHRASE` fuera de Git.

## 14. Troubleshooting detallado

| Problema | Síntoma | Diagnóstico | Solución |
|---|---|---|---|
| **Web no carga** | Pantalla blanca | Consola navegador, Network | Comprobar env/secrets, ver si usa seeds, revisar Build Actions |
| **Panel login falla** | "Invalid login" | Auth Users existe? | Crear usuario en Authentication > Users. Verificar contraseña |
| **Imágenes rotas** | Sin imágenes | Bucket público? URL correcta? | Comprobar bucket `product-images` público, rutas en DB, `publicImageUrl()` |
| **Pedidos no guardan** | No aparece en panel | RLS / `submitOrder()` | Ver RLS `orders`. Aunque falle, WhatsApp sí funciona |
| **Boletín falla auth** | "Sesión no válida" | JWT/session | Salir/entrar panel. Verificar sesión admin |
| **Bienvenida no llega** | No se envía | Email no suscrito? | Suscribirse desde pie primero. Revisar `subscribers` |
| **Baja da 401** | Enlace falla | `unsubscribe` con JWT ON | **Desactivar Verify JWT** en función unsubscribe |
| **Baja da 404** | Página no existe | No pusheado/unsub publish | Esperar deploy GitHub Pages o pushear `public/unsubscribe.html` |
| **Brevo not_acceptable** | Remitente rechazado | No verificado | Verificar remitente en Brevo Senders, usar exacto en panel |
| **Brevo unauthorized** | API key mala | Secret incorrecto | Regenerar key Brevo, actualizar `BREVO_API_KEY` |
| **Backup fotos falla DNS** | `Could not resolve host ...supabase.co.supabase.co` | Pooler mal parseado | Ya corregido con ref fijo. Si persiste, revisar workflow |
| **No veo artifacts** | No aparecen | En pestaña Jobs | Ir a **Summary** → bajar hasta final |
| **Correos a Spam** | Llegan spam | Sin dominio propio | Añadir a contactos, marcar no spam, considerar dominio+SPF/DKIM |

## 15. Checklist de soporte

### Diario/Rápido
- [ ] Web responde
- [ ] Admin accesible
- [ ] Carrito + WhatsApp funciona

### Configuración
- [ ] Secrets GitHub OK
- [ ] Secrets Supabase OK
- [ ] `allow new signups` DESACTIVADO
- [ ] Remitente Brevo verificado
- [ ] `send-email` JWT ON / `unsubscribe` JWT OFF

### Correos
- [ ] Suscripción → bienvenida llega
- [ ] Boletín prueba llega
- [ ] Baja por enlace funciona

### Backups
- [ ] Última ejecución backup VERDE
- [ ] Existen `solaria-backup` + `solaria-storage`
- [ ] Artifacts < 30 días

### Producción
- [ ] GitHub Pages verde
- [ ] Auth URLs configuradas si aplica
- [ ] Edge Functions desplegadas con código actual

## 16. Glosario y referencias

| Término | Explicación |
|---|---|
| **RLS** | Row Level Security - filtra filas por usuario/rol |
| **Edge Function** | Función serverless en Supabase (Deno) |
| **HMAC** | Hash Message Authentication Code - firma para validar enlaces |
| **pg_dump/pg_restore** | Herramientas backup/restauración Postgres |
| **Artifact** | Archivo guardado por GitHub Actions con retención |
| **Pooler/Direct** | Formas conectar a Postgres. Direct mejor para dumps |
| **JWT** | JSON Web Token para auth |
| **Anon key** | Clave pública para cliente |

### Referencias
- [Supabase Docs](https://supabase.com/docs)
- [Brevo Docs](https://developers.brevo.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [React Router](https://reactrouter.com/)
- `supabase/NEWSLETTER_SETUP.md` (guía Brevo detallada)
- `README.md` (inicio rápido)
