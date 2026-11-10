// ============================================================
// DOCUMENTOS LEGALES · contenido por defecto
//
// Estos textos son el contenido inicial de las páginas legales.
// El negocio puede reescribirlos desde /admin → Configuración →
// "Documentos legales" sin tocar código: lo que haya en la base
// de datos tiene prioridad sobre este archivo.
//
// Formato permitido en el panel (Markdown simple):
//   # Título    ## Subtítulo    ### Sub-subtítulo
//   Párrafo normal con **negritas** y [enlaces](https://…)
//   - Punto de lista
//
// ⚠ Si el negocio tiene razón social, RFC o domicilio fiscal,
//   añádelos en el encabezado del Aviso de privacidad y de los
//   Términos desde el panel. Este texto no los incluye porque
//   no son datos que yo pueda conocer ni inventar.
// ============================================================

export const LEGAL = {
  envios: {
    title: 'Envíos y pagos',
    // Clave en la tabla `settings` que permite reescribir el cuerpo.
    key: 'legal_envios',
    body: `# Envíos y pagos

Última actualización: 21 de octubre de 2026.

## Dónde enviamos

Enviamos **solo dentro de Cuba**, a todas las provincias y municipios.

No hacemos envíos al exterior. Muchos de nuestros clientes piden **desde el exterior para sus familiares en la isla**: tú eliges y pagas desde donde estés, y el pedido se entrega en Cuba.

## Cuánto tarda

- **Preparación del pedido:** 24 a 48 horas después de confirmar el pago.
- **La Habana y alrededores:** 1 a 2 días.
- **Resto del país:** 2 a 5 días.

Los plazos son orientativos y pueden variar por disponibilidad de transporte o condiciones climáticas. Si algo se retrasa te avisamos por WhatsApp.

## Cuánto cuesta el envío

El costo depende de la provincia y del peso del pedido. Se calcula y **te lo confirmamos por WhatsApp antes de enviar**. En pedidos desde el monto indicado en la tienda el envío es **gratuito**.

## Cómo se paga

El sitio **no tiene pasarela de pago**: no introduces datos de tarjeta ni se cobra automáticamente. El pago se acuerda directamente contigo, con el método que te convenga.

### Si estás en Cuba

- **Transfermóvil** — transferencia desde tu banco cubano. Nos envías el comprobante por WhatsApp.
- **Depósito bancario (BPA / BANMET)** — depósito en cuenta. Nos envías el comprobante por WhatsApp.
- **Tarjeta MLC** — pago con tarjeta en MLC.
- **Efectivo al recibir** — pagas en mano al momento de la entrega, según se acuerde.

### Si estás fuera de Cuba

- **Remesa o transferencia internacional** — Zelle, transferencia o remesa. Coordinamos la forma de recepción por WhatsApp.
- **Cripto (USDT / TRON)** — envío de USDT por la red TRON. Nos envías el hash de la transacción por WhatsApp.

> Nunca te pediremos los datos completos de una tarjeta por WhatsApp ni por ningún otro canal.

## Pedidos desde el exterior

1. Armas tu pedido en la canasta.
2. Dejas tu nombre y un teléfono de contacto: puede ser el tuyo o el de tu familiar en Cuba.
3. Te escribimos por WhatsApp para acuerdar el pago y la entrega.

El mensaje que se genera al registrar el pedido indica siempre **"Entrega en Cuba · dirección a confirmar"**, para que no haya confusión.

## ¿Y si algo falla?

Escríbenos por WhatsApp. Si el pedido llega dañado, incompleto o con un defecto de calidad, lo repónemos o devolvemos el importe. Consulta los Términos y condiciones para el plazo y el procedimiento.`
  },

  terminos: {
    title: 'Términos y condiciones',
    key: 'legal_terminos',
    body: `# Términos y condiciones

Última actualización: 21 de octubre de 2026.

## 1. Quiénes somos

Salud & Vida es un taller artesanal de frutas, verduras y hierbas deshidratadas. Este sitio es su catálogo público. Cualquier pedido que hagas aquí se confirma y cierra directamente con nosotros por WhatsApp.

## 2. Cómo se forma un pedido

El sitio **no es una compra automática**. El proceso es:

1. **Armas tu pedido** en la canasta y lo registras.
2. **Te escribimos por WhatsApp** (o nos escribes tú) para confirmar disponibilidad, dirección de entrega y método de pago.
3. **El pedido queda confirmado** cuando acordamos el importe final y tú lo confirmas.

Hasta ese momento no hay cobro ni compromiso de envío.

## 3. Precios y moneda

- Los precios se muestran en **pesos cubanos (CUP)**, **dólares (USD)** o **euros (EUR)**, según la moneda que selecciones en la página.
- La conversión aplica el tipo de cambio que fija la tienda. **Ese tipo de cambio no es automático** y no necesariamente coincide con el tipo de cambio oficial.
- **El importe final se expresa y se cobra en la moneda acordada por WhatsApp.** El precio de pantalla es una referencia.

## 4. Disponibilidad

Trabajamos con producción artesanal y por lotes. Un producto agotado puede tardar en reponerse. La disponibilidad se confirma por WhatsApp antes de cerrar el pedido.

## 5. Envíos

Los envíos se realizan **dentro de Cuba**. No hacemos envíos al exterior. Consulta la página de Envíos y pagos para plazos y costos.

## 6. Devoluciones

Al ser producto alimenticio y artesanal, **no aceptamos devoluciones por cambio de opinión**.

Si tu pedido llega dañado, incompleto o con un defecto de calidad, escríbenos por WhatsApp dentro de las **48 horas** siguientes a la entrega con una fotografía del problema. Lo resolvemos con reposición o devolución del importe.

## 7. Propiedad intelectual

Las fotografías, textos, logotipo y diseño de este sitio son propiedad de Salud & Vida. No pueden reproducirse ni usarse con fines comerciales sin autorización.

## 8. Limitación de responsabilidad

La información sobre propiedades nutricionales es orientativa y no sustituye la opinión de un profesional de la salud. Si tienes alergias o condiciones médicas, revisa la información del producto antes de consumirlo.

## 9. Ley aplicable

Estos términos se rigen por la legislación de la República de Cuba. Cualquier controversia se someterá a los tribunales competentes de Cuba.`
  },

  privacidad: {
    title: 'Aviso de privacidad',
    key: 'legal_privacidad',
    body: `# Aviso de privacidad

Última actualización: 21 de octubre de 2026.

## Quién recoge tus datos

**Salud & Vida** (en adelante, "la Tienda") es responsable de los datos personales que nos facilitas al usar este sitio y al hacer un pedido.

Puedes contactarnos por WhatsApp desde el enlace del pie de página o escribirnos al correo de contacto indicado allí.

## Qué datos recopilamos

- **Datos del pedido:** nombre completo y número de teléfono. Son los únicos datos que necesitamos para contactarte y entregarte el producto.
- **Tu correo electrónico:** solo si te suscribes voluntariamente al boletín. Puedes darte de baja cuando quieras.
- **Tus reseñas:** el nombre que decidas publicar y el texto de tu opinión, si decides dejar una.
- **Tu canasta:** se guarda temporalmente en tu propio navegador para que no se pierda si recargas la página. No sale de tu dispositivo hasta que registras el pedido.

## Qué datos NO recopilamos

- **No recopilamos datos de tarjetas de crédito ni de débito.** Este sitio no tiene pasarela de pago: el pago se acuerda directamente contigo por WhatsApp, con el método que prefieras.
- **No usamos cookies de publicidad ni de terceros.**
- **No instalamos herramientas de analítica** (ni Google Analytics, ni Meta Pixel, ni similares). No medimos ni perfilamos tu comportamiento.
- **No recopilamos tu dirección exacta en el formulario.** La dirección de entrega se acuerda por WhatsApp, solo cuando ya vas a recibir el pedido.

## Para qué usamos tus datos

1. Para contactarte por WhatsApp y confirmar tu pedido.
2. Para coordinar la entrega del producto en Cuba.
3. Para enviarte el boletín, solo si te suscribiste.
4. Para publicar las reseñas que apruebes.

No usamos tus datos para ningún otro fin y **no los vendemos ni los cedemos a terceros con fines comerciales**.

## Dónde se guardan y a quién se transfieren

Tu información se almacena en nuestros sistemas de base de datos, operados por **Supabase**, proveedor tecnológico con servidores en **Estados Unidos**. Al hacer un pedido aceptas esa transferencia, que es necesaria para que la tienda funcione.

El sitio se publica en **GitHub Pages** (GitHub, Estados Unidos), que aloja la página que estás viendo.

Cuando te comunicas por WhatsApp, el mensaje pasa también por los servidores de **WhatsApp / Meta Platforms**. El uso de esa información se rige por los términos de ese servicio.

Estos proveedores actúan como encargados del tratamiento y solo acceden a la información para prestar el servicio.

## Cuánto tiempo la conservamos

- **Pedidos:** mientras el negocio los necesite para su gestión y contabilidad.
- **Suscriptores del boletín:** hasta que pidan darse de baja.
- **Reseñas aprobadas:** mientras estén publicadas; puedes pedir que se eliminen.

## Tus derechos

Puedes solicitar en cualquier momento:

- **Acceso** a qué datos tuyos tenemos.
- **Rectificación** si están incorrectos.
- **Cancelación** (eliminación).
- **Oposición** al uso de tus datos.

Escríbenos al correo de contacto del pie de página con el asunto **"Datos personales"** y atenderemos tu solicitud. Darte de baja del boletín es igualmente gratuito y sin dar explicaciones.

## Menores de edad

Este sitio no está dirigido a menores de 13 años y no recopilamos conscientemente sus datos. Si detectamos que un menor nos ha facilitado información, la eliminamos.

## Cambios en este aviso

Podemos actualizar este aviso para reflejar cambios en la tienda o en la normativa aplicable. La fecha de la última actualización aparece al principio del documento.`
  },

  cookies: {
    title: 'Aviso de cookies',
    key: 'legal_cookies',
    body: `# Aviso de cookies

Última actualización: 21 de octubre de 2026.

## Resumen

Este sitio **no usa cookies de publicidad, ni de terceros, ni de analítica**. Lo único que guardamos en tu navegador es tu canasta de compras y tu moneda preferida.

## Qué guardamos en tu navegador

- **\`solaria-cart\`** — tu canasta de compras (los productos, presentaciones y cantidades que elegiste). Existe solo en tu navegador, en tu dispositivo. Si borras los datos del navegador o usas otro dispositivo, la canasta empieza vacía. No se envía a ningún servidor hasta que registras el pedido.
- **\`solaria-currency\`** — la moneda que elegiste ver (CUP, USD o EUR), para no tener que elegirla cada vez que entras.

Ninguno de estos datos te identifica ni sale de tu equipo.

## Qué NO usamos

- No usamos cookies de publicidad ni de seguimiento (ni Meta Pixel, ni Google Ads).
- No usamos herramientas de analítica (ni Google Analytics ni similares).
- No usamos plugins de redes sociales ni vídeos incrustados de terceros.
- No usamos identificadores de publicidad ni huellas de dispositivo.

## Cómo borrar lo que guardamos

Puedes borrar estos datos en cualquier momento desde la configuración de tu navegador, en la sección de privacidad: **Borrar datos de navegación → Cookies y datos de sitios**.

Si los borras, tu canasta quedará vacía la próxima vez que entres, pero tu pedido ya registrado no se ve afectado.

## Cambios en este aviso

Si en el futuro añadimos alguna herramienta que use cookies, actualizaremos este aviso y te lo indicaremos antes de que se activen.`
  }
};

// Orden en que aparecen en el pie de página.
export const LEGAL_ORDER = ['envios', 'terminos', 'privacidad', 'cookies'];
