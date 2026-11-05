# Guía práctica de soporte técnico · Solaria · Deshidratados

> Manual pensado para uso directo en soporte/diagnóstico. Incluye arquitectura, integraciones, secretos, despliegue, copias de seguridad, restauración y troubleshooting.

## 1. Visión general

| Campo | Valor |
|---|---|
| **Nombre** | Solaria · Deshidratados |
| **Tipo** | Tienda online (catálogo + carrito + pedido por WhatsApp) |
| **Stack** | React 18 (Create React App) + React Router DOM 7 + Supabase (Postgres + Auth + Storage + Edge Functions) |
| **Despliegue** | GitHub Pages (`https://deshidratados.github.io/`) |
| **Dominio actual** | `https://deshidratados.github.io/` (tras migración a org `deshidratados`) |
| **Panel admin** | `/#/admin` |
| **Pasarela de pago** | **No existe**. El pedido se cierra por WhatsApp |

**Modelo de negocio (importante):** El pedido siempre se entrega en Cuba. El comprador puede estar en cualquier parte del mundo. Los métodos de pago se gestionan fuera de la web (Transfermóvil, BPA/BANMET, MLC, efectivo, remesa, USDT/TRON).

## 2. Integraciones y servicios usados

| Servicio | Uso | Dónde se configura | Notas |
|---|---|---|---|
| **[Supabase](https://supabase.com/)** | Base de datos (Postgres), Auth, Storage, Edge Functions | Dashboard Supabase + `.env.local` + GitHub Secrets | Núcleo del proyecto. RLS activo. Bucket `product-images`. |
| **[Brevo](https://www.brevo.com/)** | Envío de correos transaccionales (boletín + bienvenida) | Brevo → SMTP/API + Supabase Edge Functions Secrets | Plan gratuito ~300 correos/día. Verificar remitente. Ver `supabase/NEWSLETTER_SETUP.md`. |
| **[GitHub Pages](https://pages.github.com/)** | Hosting estático de la web | GitHub → Settings → Pages + Actions | Despliegue automático con `.github/workflows/deploy.yml`. |
| **[GitHub Actions](https://github.com/features/actions)** | CI/CD (deploy) + Copias de seguridad (cron/manual) | `.github/workflows/` | Workflow `deploy.yml` (push a `main`) y `backup-db.yml` (semanal + manual). |

## 3. Estructura del proyecto

| Ruta | Descripción |
|---|---|
| `public/` | Archivos estáticos: `index.html`, `sitemap.xml`, `robots.txt`, `unsubscribe.html`, `og.jpg`, etc. |
| `src/` | Código React. |
| `src/App.js` | Rutas, providers (`ShopProvider`, `CartProvider`, `CurrencyProvider`), `BootGate`. |
| `src/data/supabase.js` | Cliente Supabase, `configured`, `publicImageUrl()`, `SETTINGS_KEYS`, `moneySettings()`. Bucket: `product-images`. |
| `src/data/shop.js` | `ShopProvider`, carga desde Supabase o seed, `submitOrder()`, precarga de imágenes principales, `BOOT_TIMEOUT_MS=4000`. |
| `src/data/products.js` | Datos de demostración (fallback si no hay Supabase). |
| `src/data/currency.js` | Multi-moneda (CUP/USD/EUR). Conversión con tipos manuales. |
| `src/data/config.js` | Config por defecto (nombre, WhatsApp, envío gratis, etc.). |
| `src/context/CartContext.js` | Lógica del carrito. |
| `src/components/` | Header, Hero, Catalog, CartDrawer, Footer, Sections, BootLoader, LegalPage, etc. |
| `src/admin/` | Panel de administración completo (`AdminApp`, productos, pedidos, boletines, configuración...). |
| `supabase/schema.sql` | Esquema completo para **base nueva**. |
| `supabase/upgrade-2026-10-24.sql` | Upgrade idempotente para **base existente**. |
| `supabase/upgrade-2026-10-29.sql` | Ajustes para boletines/Brevo. |
| `supabase/functions/send-email/` | Edge Function para envío (boletines + bienvenida). |
| `supabase/functions/unsubscribe/` | Edge Function para baja con firma HMAC (redirige a `public/unsubscribe.html`). |
| `supabase/NEWSLETTER_SETUP.md` | Guía detallada de Brevo + Edge Functions. |
| `.github/workflows/deploy.yml` | Build con secrets e inyección a GitHub Pages. |
| `.github/workflows/backup-db.yml` | Copia semanal + manual con cifrado + backup de fotos. |

## 4. Frontend, rutas y providers

### Ruteo (`src/App.js`)
- `HashRouter` (típico GitHub Pages)
- `/admin/*` → `AdminApp`
- `*` (resto) → `Store`
- Dentro de `Store`: ruta comodín `*` para portada + `doc/:slug` para páginas legales
- `ScrollManager` controla scroll al cambiar de ruta/anchor

### Providers
1. `ShopProvider` (`src/data/shop.js`): Carga productos/categorías/config desde Supabase. Si falla o no está configurado, usa seeds. Precarga imágenes principales. Revela con tope 4s.
2. `CurrencyProvider` (`src/data/currency.js`): Multi-moneda.
3. `CartProvider` (`src/context/CartContext.js`): Carrito persistente.
4. `BootGate`: Muestra `BootLoader` hasta `ready`.

### Configuración cliente
- `.env.local` (local): `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`
- GitHub Actions Secrets (producción): mismos valores inyectados en build
- `src/data/supabase.js`: `configured = Boolean(url && anonKey)`

## 5. Supabase: Base de datos, RLS, Storage

### Tablas principales (según esquema)
- `categories`, `products`, `presentations`, `variants`
- `orders`
- `reviews`
- `subscribers`, `newsletter_history`
- `settings`

### Seguridad
- **RLS activado** en tablas sensibles
- **Políticas** definidas en `schema.sql`
- **Auth**: Usuario administrador creado manualmente en `Authentication > Users`
- **Clave pública**: `anon` key usada en frontend (protegida con RLS)

### Storage
- **Bucket**: `product-images` (público para lectura)
- **Uso**: Imágenes de productos/variantes/galería
- **Helper**: `publicImageUrl()` construye URL pública
- **Subida/Borrado**: Desde panel de administración

### Pedidos
- `orders` guarda: `customer_name`, `phone`, `items` (JSON), `total`, `status`
- `submitOrder()` inserta pedido si Supabase configurado
- El aviso va por **WhatsApp** (no email)

## 6. Panel de administración (`/#/admin`)

Vistas típicas:
- **Dashboard**: Resumen
- **Productos**: CRUD, galería, variantes, presentaciones
- **Categorías / Presentaciones**
- **Pedidos**: Filtros por fecha/estado, agrupados por fecha de cambio de estado, aviso WhatsApp
- **Reseñas**: Aprobar/rechazar, mostrar 3 en portada + "Ver más"
- **Suscriptores**: Lista
- **Boletines**: Editor texto plano, vista previa, borradores, historial plegable, envío con confirmación
- **Configuración**: Datos tienda, moneda/tipos cambio, envío gratis, promoción hero, remitente boletín, documentos legales
- **Documentos legales**: Editables con markdown-like (`#`, `##`, `**`, listas, enlaces)

## 7. Boletines, correos y Edge Functions

### Flujo
1. Frontend llama a `POST https://<project>.supabase.co/functions/v1/send-email`
2. `send-email` valida auth/sesión según tipo
3. Lee `settings.newsletter_from` y `settings.email` desde DB
4. Genera enlaces `{{UNSUBSCRIBE_URL}}` firmados con HMAC-SHA256 por destinatario
5. Llama a **Brevo API** con `BREVO_API_KEY` (secret)
6. Registra en `newsletter_history` (solo boletines)
7. Baja vía `unsubscribe` (GET redirige a `public/unsubscribe.html`, POST borra con firma válida)

### Seguridad clave
- **`send-email`**: requiere sesión autenticada para boletines. Para `type: 'welcome'` usa plantilla fija del servidor, único destinatario y valida que esté en `subscribers`. **Remitente SIEMPRE desde DB**.
- **`unsubscribe`**: **Verify JWT DESACTIVADO**. Protegido con **HMAC-SHA256 + comparación en tiempo constante**. GET solo redirige (evita borrado por precarga de escáneres). POST borra.
- **Claves**: `BREVO_API_KEY` en Supabase Secrets. Servicio key soporta `SUPABASE_SECRET_KEYS` o `SUPABASE_SERVICE_ROLE_KEY`.
- **Sin claves en frontend**.

### Configuración Brevo
Ver `supabase/NEWSLETTER_SETUP.md` completo. Puntos críticos:
- Verificar remitente en Brevo
- Añadir `BREVO_API_KEY` a Edge Functions Secrets
- Desplegar `send-email` (JWT on) y `unsubscribe` (JWT off)
- Poner remitente verificado en `/admin` → Configuración
- `unsubscribe.html` publicado por GitHub Pages

## 8. Despliegue

### GitHub Pages
Workflow `.github/workflows/deploy.yml`:
- Trigger: `push` a `main`
- Build con `npm ci`/`npm install`, `npm run build`
- Env: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` desde GitHub Secrets
- Deploy con `actions/deploy-pages@v4`

### Secrets necesarios (GitHub)
| Secret | Uso |
|---|---|
| `REACT_APP_SUPABASE_URL` | URL proyecto Supabase |
| `REACT_APP_SUPABASE_ANON_KEY` | Anon key Supabase |

### Secrets necesarios (Supabase Edge Functions)
| Secret | Uso |
|---|---|
| `BREVO_API_KEY` | API key de Brevo |
| (Servicio key) | Inyectada por plataforma o `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEYS` |

### Auth URLs (Supabase)
Si hay redirects por auth/password reset, añadir `https://deshidratados.github.io/*` en Auth → URL Configuration.

## 9. Copias de seguridad (Base de datos + Fotos)

Workflow: `.github/workflows/backup-db.yml`

### Frecuencia
- **Cron**: Lunes 04:00 UTC
- **Manual**: `Actions > Copia de seguridad de la base de datos > Run workflow`

Si repo inactivo 60 días, GitHub desactiva cron (se reactiva con Run workflow).

### Secrets
| Secret | Uso |
|---|---|
| `BACKUP_DB_URL` | Conexión **directa** Supabase (puerto 5432) |
| `BACKUP_PASSPHRASE` | Frase para cifrado AES-256. **Guardar fuera de GitHub** |

### Proceso
1. Instalar `postgresql-client` (PGDG)
2. `pg_dump --no-owner --no-privileges --format=custom` → pipe a `openssl enc -aes-256-cbc -pbkdf2 -salt` → `solaria-YYYY-MM-DD.dump.enc`. **Reintentos** si DB dormida.
3. Subir artifact `solaria-backup` (30 días)
4. Listar `storage.objects` donde `bucket_id='product-images'` vía `psql`
5. Descargar cada archivo por URL pública con **project-ref fijo** `adeyttqsvcnptcvelbdz`: `https://adeyttqsvcnptcvelbdz.supabase.co/storage/v1/object/public/product-images/<ruta-url-encodeada>`
6. Comprimir `product-images/` → `solaria-storage-YYYY-MM-DD.tar.gz` y subir como artifact `solaria-storage` (30 días, `if-no-files-found: warn`)

**Notas importantes:**
- `pg_dump` **incluye metadatos** de storage pero **NO binarios** → fotos aparte
- Bucket público → no requiere `SERVICE_ROLE_KEY`
- Artifacts **se acumulan** por ejecución, se borran a los 30 días
- Funciona con **pooler o directo** gracias al ref fijo

### Dónde ver artifacts
`Actions > Copia de seguridad de la base de datos > [run verde] > Summary > Artifacts` (abajo). NO en la pestaña Jobs.

## 10. Restauración

### En Supabase (producción/otro proyecto)
Necesitarás ambos artifacts del mismo día.

**A) Base de datos**
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -pass pass:'TU_FRASE_BACKUP_PASSPHRASE' \
  -in solaria-YYYY-MM-DD.dump.enc \
  | pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      -d "postgresql://postgres:TU_PASSWORD@db.TU_REF.supabase.co:5432/postgres"
```

**B) Fotos**
```bash
tar -xzf solaria-storage-YYYY-MM-DD.tar.gz
```
Arrastrar carpeta `product-images/` entera a **Supabase Dashboard > Storage > bucket `product-images`**.

### En local (Postgres local/Docker)
```bash
# Crear DB
psql -U postgres -h localhost -c "CREATE DATABASE solaria_local;"

# Desencriptar
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -pass pass:'TU_FRASE_BACKUP_PASSPHRASE' \
  -in solaria-YYYY-MM-DD.dump.enc \
  -out solaria-YYYY-MM-DD.dump

# Restaurar con pg_restore
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname=postgresql://postgres:TU_PASSWORD@localhost:5432/solaria_local \
  solaria-YYYY-MM-DD.dump

# Fotos
tar -xzf solaria-storage-YYYY-MM-DD.tar.gz
# Copiar product-images/ a la ruta que use tu app local
```

**Advertencias restauración local:**
- Usar **`pg_restore`**, NO `psql` con `.dump`
- `pg_restore` >= versión servidor idealmente
- `--no-owner --no-privileges` para evitar roles distintos
- Esquema `auth` puede venir, RLS puede dar problemas sin JWT/roles
- Edge Functions **NO** se restauran

## 11. Troubleshooting rápido

| Síntoma | Causa probable | Solución |
|---|---|---|
| Web en blanco / carga infinita | Supabase sin configurar o error carga | Revisar `.env.local` / GitHub Secrets. Ver consola. Usa datos seed si falla. |
| Panel no deja entrar | Sin usuario admin / RLS | Crear usuario en `Authentication > Users`. Comprobar sesión. |
| Imágenes no cargan | Ruta incorrecta / bucket | Comprobar `IMAGES_BUCKET`, `publicImageUrl()`, bucket público `product-images`. |
| Pedido no se guarda | Sin Supabase / RLS | Comprobar `submitOrder()`. Aunque falle, sigue flujo WhatsApp. |
| Boletín no envía | Sin sesión / secret Brevo / remitente no verificado | Ver logs Edge Function, Brevo Dashboard, config remitente, JWT de `send-email`. |
| Bienvenida no llega | No está en `subscribers` / plantilla servidor | Debe suscribirse primero. Servidor valida que exista en `subscribers`. |
| Baja no funciona / 401 | `unsubscribe` con Verify JWT ON | Desactivar **Verify JWT** en función `unsubscribe`. |
| Enlace baja abre texto crudo | Función antigua sirviendo HTML | Redesplegar `unsubscribe` con código actual. |
| Backup falla descargando fotos (pooler) | Mal parseo ref | Ya corregido con **ref fijo** `adeyttqsvcnptcvelbdz`. |
| No veo artifacts | Mirando Jobs en lugar de Summary | Ir a **Summary** y bajar al final. |
| Correos a Spam | Sin dominio propio / Gmail | Añadir contacto, marcar "No es spam". Considerar dominio + SPF/DKIM/DMARC. |

## 12. Checklist de soporte express

- [ ] **Web**: Carga OK en `https://deshidratados.github.io/`
- [ ] **Admin**: Login OK `/#/admin`
- [ ] **Carrito/WhatsApp**: Prueba pedido
- [ ] **Boletines**: Suscripción + envío prueba
- [ ] **Baja**: Probar enlace
- [ ] **Backup**: Último run verde con `solaria-backup` + `solaria-storage`
- [ ] **Secrets**: GitHub + Supabase Edge Functions correctos
- [ ] **Auth URLs**: Añadido si hay auth
- [ ] **Edge Functions**: `send-email` JWT on, `unsubscribe` JWT off

## 13. Comandos útiles

```bash
# Dev
npm install && npm start

# Build
npm run build

# Git
git status -sb
git add -A && git commit -m "mensaje" && git push origin main

# Backup local restore
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass pass:'FRASE' -in solaria-YYYY-MM-DD.dump.enc -out solaria-YYYY-MM-DD.dump
pg_restore --clean --if-exists --no-owner --no-privileges --dbname=postgresql://user:pass@localhost:5432/solaria_local solaria-YYYY-MM-DD.dump
tar -xzf solaria-storage-YYYY-MM-DD.tar.gz
```

## Apéndice: Archivos clave para consulta rápida
- `src/data/supabase.js` / `src/data/shop.js` / `src/App.js`
- `supabase/schema.sql`, `supabase/NEWSLETTER_SETUP.md`, `supabase/functions/*`
- `.github/workflows/deploy.yml`, `.github/workflows/backup-db.yml`
- `README.md`
- `docs/GUIA_SOPORTE_TECNICO_SOLARIA.md` (este documento)
