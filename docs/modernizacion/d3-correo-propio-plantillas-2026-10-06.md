# D3 — Correo propio y plantillas (2026-10-06)

Estado: **plantillas versionadas y validadas en local. Pendiente del gate humano**: cuenta en Resend, registros DNS y credenciales en staging. Sin envío real todavía, así que la etapa **no está cerrada**. No se tocó staging ni producción. No hubo commit, push ni despliegue.

Ejecución: Claude Opus 5.5 (`claude-opus-5-5`), esfuerzo `high`.

## Decisiones tomadas en el chat (2026-10-06)

- **Proveedor: Resend, plan gratuito.** Aprobado por el equipo antes de crear cuentas o registros.
- **Remitente:** `hola@discotica.com`, nombre "Discótica". No cambia sin decisión humana.
- **Buzón de hola@:** queda fuera de D3 (ver H1).
- **Texto plano:** se decide después de la prueba real (ver H3).
- **Cómo llegan las plantillas a staging:** a mano, desde el dashboard. No se usa la Management API ni `supabase config push`.

## Proveedor y límites

| | Resend Free (verificado el 2026-10-06 en resend.com/pricing) |
| --- | --- |
| Volumen | 3.000 correos al mes, con un máximo de **100 al día** |
| Dominios | 3 |
| Retención de logs | 30 días |
| SMTP | `smtp.resend.com`, puerto `465` (TLS implícito). Usuario `resend`; la contraseña es una API key. |
| Límite por SMTP | El mismo que por API |
| Seguimiento de aperturas y clics | Se configura por dominio. **Debe quedar apagado:** Supabase advierte que reescribe los enlaces de Auth. |

Notas sobre los límites:

- **Supabase.** Al activar SMTP propio, Auth impone **30 correos por hora**, ajustable en *Authentication → Rate Limits*. Con 100 al día en Resend, conviene dejarlo en 30.
- **Cuota compartida.** Si staging y producción usan la misma cuenta y el mismo dominio, comparten los 100 diarios.
- **Fallos al pasar el límite.** Pasado el límite, Auth devuelve error al registrar o al pedir recuperación. U12 debe mostrarlo como error genérico.

## Registros DNS

El DNS de discotica.com está en Hostinger (`ns1/ns2.dns-parking.com`). El apex apunta a Cargo. Al 2026-10-06 **no hay MX, SPF ni DMARC** en el apex.

Resend verifica el dominio sin tocar el apex: el Return-Path va en `send.discotica.com` y la firma DKIM en `resend._domainkey`. DMARC queda alineado por DKIM (`d=discotica.com`) y también por SPF en modo relajado.

| Tipo | Nombre | Valor | Estado |
| --- | --- | --- | --- |
| MX | `send` | el que entregue Resend (p. ej. `feedback-smtp.<región>.amazonses.com`), prioridad 10 | pendiente |
| TXT | `send` | el que entregue Resend (p. ej. `v=spf1 include:amazonses.com ~all`) | pendiente |
| TXT | `resend._domainkey` | la clave pública DKIM que entregue Resend (`p=…`) | pendiente |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | pendiente |

Sobre DMARC:

- Arranca en `p=none`, solo observación, sin `rua`, porque no hay buzón que reciba los informes (H1).
- Se endurece a `quarantine` después de unas semanas sin fallos de alineación. Antes de eso hay que confirmar que nada más envía como discotica.com (hoy nada lo hace, porque no hay SPF ni MX).

Los valores exactos se copian aquí cuando Resend los entregue, junto con la salida de `dig` que confirme que resuelven.

## Configuración en staging (`hgocyrzhgohetfpzbmfs`), sin secretos

**SMTP propio** (*Authentication → Emails → SMTP Settings*):

| Campo | Valor |
| --- | --- |
| Enable custom SMTP | sí |
| Sender email | `hola@discotica.com` |
| Sender name | `Discótica` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key de Resend (con permiso de envío, limitada al dominio discotica.com). **No se escribe en el repo ni en el chat.** |

**Plantillas** (*Authentication → Emails → Templates*): se pega el asunto y el HTML de cada archivo.

| Plantilla | Asunto | HTML |
| --- | --- | --- |
| Confirm sign up | Confirma tu cuenta en Discótica | `supabase/templates/confirmation.html` |
| Reset password | Restablece tu contraseña de Discótica | `supabase/templates/recovery.html` |
| Change email address | Confirma el cambio de correo en Discótica | `supabase/templates/email_change.html` |

**Orden obligatorio:** primero el SMTP y después las plantillas. Desde el 2026-06-03, un proyecto free nuevo con el proveedor por defecto no puede editar plantillas.

**Lo que D3 no cambia:** Site URL, Redirect URLs y el destino de confirmación. Este último es de U12 (`emailRedirectTo`).

## Plantillas

En `supabase/templates/` y referenciadas en `supabase/config.toml` (`[auth.email.template.confirmation|recovery|email_change]`):

- `confirmation.html` / `.txt`: confirmación de registro.
- `recovery.html` / `.txt`: recuperación de contraseña.
- `email_change.html` / `.txt`: cambio de correo. Con `double_confirm_changes` llega tanto al correo actual como al nuevo; el texto vale para los dos.

Diseño:

- HTML sencillo en tablas, con estilos en línea y ancho máximo de 520px.
- Paleta oscura de la marca: fondo `#0e0e0e`, panel `#161616`, texto `#f8ffee` y secundario `#a0a0a0`.
- Botón verde acento `#96f719` con texto `#0e0e0e` (contraste ≈ 14:1), más el enlace en texto como alternativa.
- Logo: PNG `static/email/logo-discotica.png` (288×164, mostrado a 144×82, renderizado desde `static/img/logo.svg`), con URL absoluta `https://biblioteca.discotica.com/email/logo-discotica.png`. Si no carga, el `alt` "Discótica" se ve en verde.
- Variables:
  - `{{ .ConfirmationURL }}`, que conserva el `redirect_to` que defina U12;
  - `{{ .Email }}`;
  - `{{ .NewEmail }}`, solo en el cambio de correo.
- Sin datos libres de la persona usuaria, como pide la guía de Supabase.
- El pie no invita a responder a hola@, porque esa dirección no recibe correo (H1).

## Hallazgos

- **H1. hola@discotica.com no recibe correo.** discotica.com no tiene MX, así que las respuestas rebotan. La dirección ya se anuncia como contacto en `/privacidad` y en el diálogo beta (`src/lib/domain/betaInvitation.ts`). El equipo decidió tratarlo fuera de D3. Si se crea un buzón, el MX del apex no choca con los registros de Resend, que viven en `send`.
- **H2. El CLI está enlazado a producción.** `supabase/.temp/project-ref` = `ewntlvugbopokdrvnwvg`, el proyecto final. Cualquier `supabase config push` o comando enlazado sin `--project-ref` afectaría producción. Además, `config push` subiría el `config.toml` local completo (`site_url = http://localhost:5173`, `enable_confirmations = false`, el límite local de 2 correos por hora). D3 no lo usa.
- **H3. Supabase no envía parte de texto plano.**
  - Las plantillas de Auth son solo HTML: no hay campo de texto ni en `config.toml` ni en la API.
  - Los `.txt` quedan versionados como referencia.
  - Pendiente: revisar en el mensaje crudo de la prueba real si el SMTP de Resend añade `text/plain`.
  - Si no lo añade, se decide entre aceptar solo HTML o un Send Email Hook que envíe HTML y texto por la API de Resend. El hook amplía el alcance.
- **H4. El logo depende de un despliegue.** `static/email/logo-discotica.png` solo existe en la URL de producción después del próximo despliegue del frontend, que no es parte de D3. Mientras tanto, los correos de staging muestran el texto alternativo.
- **H5. Escáneres de enlaces.** Los enlaces que contienen el token se consumen si un escáner corporativo (p. ej. Microsoft Safe Links) los abre antes que la persona. Supabase propone confirmar con `token_hash` en una página propia. Eso cambia el destino de confirmación, así que queda como nota para U12.

## Pruebas

**Local, en un stack aislado** (CLI 2.116.0, GoTrue local, Mailpit). Se usó una copia temporal de `supabase/` con `project_id = discotica-d3`, puertos 546xx, sin migraciones y con `enable_confirmations = true` solo en la copia. El stack se detuvo con `--no-backup`.

- `supabase start` resolvió los tres `content_path` desde `config.toml`, relativos a la raíz del proyecto, y Auth arrancó sano.
- Correos disparados por la API de Auth:
  - registro → "Confirma tu cuenta en Discótica";
  - `recover` → "Restablece tu contraseña de Discótica";
  - `PUT /user` con otro correo → dos "Confirma el cambio de correo en Discótica", uno al correo actual y otro al nuevo.
- Las variables se renderizan y no queda ningún `{{` sin resolver. `.Email` y `.NewEmail` son correctos en los dos correos del cambio.
- Los enlaces son `…/auth/v1/verify?token=…&type=signup|recovery|email_change&redirect_to=…`. Conservan el `redirect_to` que manda el cliente, como `/auth/reset?flow=signup` y `?flow=recovery`.
- **MIME:** `Content-Type: text/html; charset=UTF-8`, una sola parte. Confirma H3: GoTrue no envía `text/plain`.
- Revisión visual en Chromium a 390 y 1440 px: el logo se ve, el botón se lee y no hay scroll horizontal. Los correos largos se parten en el guion.

**Staging, con envío real:** pendiente del gate humano.

| Comprobación | Gmail web | Gmail móvil | Apple Mail |
| --- | --- | --- | --- |
| Confirmación en bandeja de entrada | pendiente | pendiente | pendiente |
| Recuperación en bandeja de entrada | pendiente | pendiente | pendiente |
| Cambio de correo en bandeja de entrada | pendiente | pendiente | pendiente |
| SPF / DKIM / DMARC `pass` en encabezados | pendiente | — | — |
| Enlaces apuntan a staging | pendiente | pendiente | pendiente |

## Rollback

- **Staging:** desactivar *Custom SMTP* y restaurar las plantillas por defecto (*Reset to default* en cada plantilla).
- **Resend:** revocar la API key.
- **DNS:** borrar los cuatro registros. Ninguno toca el apex ni el sitio en Cargo.
- **Repo:** borrar `supabase/templates/`, `static/email/` y los tres bloques `[auth.email.template.*]` de `config.toml`.

## Relevo para U12 y U18

Pendiente hasta el envío real: configuración aplicada, registros DNS con valores, capturas y resultado del texto plano.
