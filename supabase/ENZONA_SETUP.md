# Configuración de pagos con Enzona

Integración con la **API Payment v1.0.0** de Enzona (Cuba). Cobra en **CUP**.
Si la moneda base de la tienda es **CUP** (valor por defecto), el importe se
envía tal cual; si es USD o EUR, se convierte a CUP con `rateCUP` de la tabla
`settings` (igual que la tienda).

## Cómo funciona

1. El cliente elige **Enzona** en el checkout. Se crea el pedido (`pendiente`).
2. `create-enzona-payment` pide un token OAuth2 y crea el pago en Enzona.
   - Devuelve `transaction_uuid` y el enlace de pago (`links[0].href`).
   - Guarda en el pedido `payment_ref = transaction_uuid` y `payment_url`.
3. El cliente paga en Enzona y vuelve a `/#/pago/exito?transaction_uuid=...`.
4. `enzona-confirm` cierra la transacción (`POST /payments/{uuid}/complete`) y,
   si Enzona la confirma, marca el pedido como **pagado**.

> Enzona **no usa webhooks**: la confirmación se hace al volver el cliente.
> Si el cliente cierra la pestaña antes de volver, el pedido queda `pendiente`;
> se puede revisar/confirmar a mano desde el panel de Enzona o llamando a
> `enzona-confirm` con el `transaction_uuid`.

## Secrets (Supabase → Edge Functions → Secrets)

| Secret | Obligatorio | Descripción |
| --- | --- | --- |
| `ENZONA_CONSUMER_KEY` | Sí | Consumer Key del panel de Enzona |
| `ENZONA_CONSUMER_SECRET` | Sí | Consumer Secret |
| `ENZONA_MERCHANT_UUID` | Sí | UUID del comercio (panel → Comercios → Detalles) |
| `ENZONA_ENV` | Sí | `sandbox` o `production` |
| `ENZONA_TERMINAL_ID` | No | Terminal/POS, solo si el panel lo exige |
| `ENZONA_API_BASE` | No | Fuerza la URL base (por defecto según `ENZONA_ENV`) |

Bases usadas:

- `sandbox` → `https://apisandbox.enzona.net`
- `production` → `https://api.enzona.net`

Si el token de sandbox falla, la función reintenta automáticamente contra
`https://api.enzona.net/token` (algunas cuentas lo tienen ahí).

## Desplegar las funciones

Con la CLI de Supabase:

```bash
supabase functions deploy create-enzona-payment
supabase functions deploy enzona-confirm
```

O desde el Dashboard → **Edge Functions** → crear/pegar el contenido de:

- `supabase/functions/create-enzona-payment/index.ts`
- `supabase/functions/enzona-confirm/index.ts`

Ambas deben tener **Verify JWT** activado (el frontend envía el `apikey` y el
`Authorization: Bearer <anon key>`).

## Probar en sandbox

1. Pon `ENZONA_ENV=sandbox` y los secrets de sandbox.
2. Haz un pedido pequeño en la tienda y elige Enzona.
3. Debes ser redirigido a la pasarela de sandbox; paga con los datos de prueba.
4. Al volver, la página muestra **“¡Pago recibido!”** y el pedido pasa a `pagado`.

Prueba manual del token (sin exponer las claves en el historial):

```bash
curl -X POST "https://apisandbox.enzona.net/token" \
  -u "CONSUMER_KEY:CONSUMER_SECRET" \
  -d "grant_type=client_credentials&scope=enzona_business_payment"
```

Respuesta esperada: `{ "access_token": "...", ... }`.

## Pasar a producción

1. Cambia los secrets a los de producción y pon `ENZONA_ENV=production`.
2. Vuelve a desplegar (o guarda los secrets; las funciones los leen en cada llamada).
3. Haz una compra real pequeña para validar.

## Errores comunes

| Síntoma | Causa probable |
| --- | --- |
| `No se pudo obtener el token (401)` | Consumer key/secret incorrectos o `ENZONA_ENV` equivocado |
| `Enzona rechazó la creación del pago` | `ENZONA_MERCHANT_UUID` incorrecto, falta `terminal_id`, o el total no coincide con los ítems |
| `Falta transaction_uuid` | El `return_url` no llegó con el parámetro (revisa la URL configurada en Enzona) |
| Pedido queda `pendiente` | El cliente no volvió a la tienda o `complete` falló; revisa los logs de `enzona-confirm` |
