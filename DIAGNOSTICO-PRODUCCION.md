# Estabilizacion operativa de PlayCoffee

Trabajo local; sin despliegue ni cambios en la base del restaurante.

## Diagnostico y plan entregado antes de implementar

| Problema | Causa comprobada en el codigo | Cambio aplicado |
| --- | --- | --- |
| Cocina recibe otra vez el desayuno al agregar pizzas | El envio automatico filtraba IDs nuevos, pero `PrintService.queueTicket` reconstruia y encolaba todos los productos. No habia estado de envio persistido por linea. | Seleccion transaccional de lineas PENDING, reserva por lote y estacion, y confirmacion del agente. El envio manual y automatico comparten el mismo bloqueo. |
| Mesa pagada conserva la orden anterior | `PaymentsService` no completaba ordenes con preparacion pendiente hasta DELIVERED. Crear orden no comprobaba otra activa en esa mesa. POS retenia referencias y Mesas conservaba el detalle abierto cuando otro dispositivo cobraba. | El ultimo pago completa y libera dentro de la misma transaccion. Bloqueo por mesa, indice unico parcial, limpieza de POS/Mesas y actualizacion por eventos y consulta periodica. |
| No hay correccion segura de comandas | No existia una mutacion por producto con motivo, rol, historial y aviso de cancelacion. | Correccion auditada; conserva la linea original cancelada y crea el reemplazo pendiente. Para lineas enviadas exige ADMIN/SUPER_ADMIN/CASHIER y encola cancelacion de la instantanea original. |
| Tickets sin informacion suficiente | Faltaban area, lote y hora de envio. El renderizador ESC/POS usaba la zona del equipo. | Incluye PLAYCOFFEE, estacion, mesa, area, mesero, orden, lote, pedido, envio, notas y modificaciones. Fechas con `Branch.timezone`. |
| Acceso infantil separado de la mesa | La vinculacion existente aceptaba orderId, pero no resolvia mesa/orden activa. Se permitia pagar antes de calcular extras de salida. | Selector de mesa, reutilizacion o creacion bajo bloqueo, cargo atomico e identificador de reintento. El pago final se rechaza con accesos sin salida. Los extras se agregan antes del cobro final. |

Se implementaron primero las protecciones P0 y despues la informacion de tickets y vinculacion infantil P1. Se preservaron los cambios locales anteriores y no se agregaron dependencias.

## Semantica de envio

- `OrderItem.preparationStatus`: PENDING (nuevo), QUEUED (reservado en un lote), SENT (agente confirmo transporte/spool), LEGACY (historial de envio anterior desconocido).
- `preparationJobId` identifica el lote; `sentAt` registra su envio a la cola y `printedAt` la confirmacion del agente. El payload de PrintJob conserva la instantanea enviada.
- No se usa la fecha de la orden para detectar productos nuevos. Cocina y barra seleccionan por estacion y estado persistido.
- La reserva de lineas y la creacion de PrintJob ocurren en la misma transaccion, con bloqueo de la orden. En dos dispositivos solo uno puede reservar cada linea.
- Las comandas nuevas tienen un solo intento automatico. Ante fallo o perdida de confirmacion, el lote queda FAILED y sus lineas no se marcan SENT ni vuelven a seleccionarse como nuevas.
- La reimpresion exige ADMIN/CASHIER, motivo y confirmacion en pantalla. Repite un lote concreto, registra auditoria y evita duplicar una reimpresion que ya este pendiente o procesandose.
- La impresion de navegador queda disponible para recibos de cliente. Cocina/barra utilizan la cola del agente; una vista previa no marca lineas enviadas.

**Limite fisico:** el agente confirma escritura TCP o aceptacion del spooler de Windows, no sensores de papel/corte. `PrintJob.PRINTED` es la denominacion existente de esa confirmacion. No garantiza salida fisica. Si el transporte se interrumpe despues de enviar bytes, el operador debe revisar la impresora antes de reimprimir. No se promete entrega fisica exactamente una vez.

## Operacion y correcciones

En Mesas/POS se pueden cambiar cantidades, retirar productos y agregar notas antes de persistirlos. En Comandero, Corregir admite cantidad cero para cancelar. Un reemplazo conserva precio/modificadores y queda pendiente de nuevo envio. Las cantidades canceladas se excluyen de totales operativos, recibos, inventario y reportes.

Una linea en transito no se corrige hasta resolver su lote. Una correccion de linea enviada conserva la estacion y los datos originalmente enviados, aunque cambie despues la configuracion del producto. Si no se puede encolar la cancelacion por falta de impresora, la correccion se revierte completa. El aviso queda sujeto a la misma validacion fisica de impresion.

La auditoria de correccion/reimpresion se escribe dentro de la transaccion y contiene usuario, fecha del registro, motivo, producto/linea original, cantidades, notas y referencia al reemplazo/lote. No se borran lineas silenciosamente.

Las cuentas cerradas o con pagos registrados no admiten correcciones monetarias; se requiere tramitar una devolucion por separado. No se implemento un modulo nuevo de devoluciones. El inventario sigue descontandose al pago completo; una correccion previa cambia las cantidades que se descontaran y no toca existencias de ventas historicas.

El pago dividido conserva la mesa ocupada hasta liquidar el saldo. El ultimo pago libera la mesa aunque la preparacion no este DELIVERED. No se reutiliza la orden cerrada. Accesos infantiles activos bloquean ese ultimo pago y tambien el cierre/cancelacion manual: primero se registra salida, se calculan extras y despues se cobra. El acceso y sus horarios permanecen asociados a la orden historica. Para accesos antiguos que ya estuvieran pagados, se conserva el comportamiento de cargo extra en otro ticket para no modificar la venta pagada.

## Migracion y revision previa en staging

Nueva migracion: `apps/backend/prisma/migrations/20261101010000_incremental_preparation/migration.sql`.

Agrega columnas e identificadores de idempotencia, una tabla de solicitudes de adicion y un indice unico para una sola orden activa por mesa. Esta envuelta en BEGIN/COMMIT; no borra ni fusiona ordenes o pagos. Las lineas ya existentes reciben LEGACY para evitar reimpresiones masivas. Solo las creadas despues reciben PENDING.

Antes de migrar, ejecutar esta consulta de solo lectura en la copia de staging y revisar el resultado:

```sql
SELECT "tableId", COUNT(*) AS active_orders, ARRAY_AGG(id) AS order_ids
FROM orders
WHERE "tableId" IS NOT NULL AND "deletedAt" IS NULL
  AND status NOT IN ('COMPLETED', 'CANCELLED')
GROUP BY "tableId"
HAVING COUNT(*) > 1;
```

Si hay duplicados activos, la migracion se detiene: requieren conciliacion operativa, sin borrar historia ni cancelar ventas masivamente. Revisar tambien las ordenes antiguas ya pagadas que sigan abiertas. No se ha ejecutado ninguna conciliacion sobre datos del restaurante.

Conviene actualizar con las mesas sin cuentas activas y con la cola de impresion revisada. LEGACY no significa impreso: significa desconocido. Las lineas heredadas no se reenviaran automaticamente. Si hay un PrintJob anterior se puede revisar y reimprimir ese lote con autorizacion. Sin lote previo, debe conciliarse con cocina antes de registrar una correccion o reemplazo autorizado.

## Validacion automatizada

Comandos reproducibles desde la raiz, con dependencias ya instaladas:

```powershell
pnpm test:preprod
pnpm --filter backend test --runInBand
# Configurar TEST_DATABASE_URL exclusivamente con una base desechable migrada:
pnpm --filter backend test:regression
# SMOKE_DATABASE_URL debe apuntar tambien a la base desechable:
pnpm --filter backend test:smoke
node --test scripts/print-agent/escpos-renderer.test.mjs
```

`test:preprod` ejecuta lint, build, generacion de Prisma y validacion del esquema; no ejecuta las regresiones de negocio. Estas se ejecutaron por separado. Las suites de base de datos requieren sus variables explicitas; no se debe interpretar una suite omitida por falta de configuracion como validacion del negocio.

Se uso PostgreSQL 18 temporal en localhost:55440, con datos generados para las pruebas y apagado al terminar. Se aplicaron las 19 migraciones en una base nueva. No se utilizo DATABASE_URL del restaurante ni se conecto una impresora real.

Resultado final registrado:

| Validacion | Resultado |
| --- | --- |
| `test:preprod` (lint, build, Prisma generate/validate) | Correcto; 6 advertencias de lint existentes, sin errores |
| Unitarias de backend | 16 aprobadas, 7 suites |
| Regresiones PostgreSQL nuevas y smoke HTTP | 53 aprobadas; 1 caso omitido del catalogo global |
| Renderizador ESC/POS | 4 aprobadas |
| Migraciones en una base temporal nueva | 19 aplicadas |
| POS en navegador local, con API simulada | 5 verificaciones aprobadas en dos pestanas |

La suite nueva `apps/backend/test/production-regression.e2e-spec.ts` cubre:

1. Primera comanda: 2 desayunos a cocina y 2 cafes a barra.
2. Segundo pedido: SOLO 2 pizzas, manteniendo la fecha original de la orden.
3. Dos envios simultaneos y reintentos sin duplicar lote/lineas.
4. Fallo de envio, ausencia de marcado de impresion y reimpresion explicita auditada.
5. Correccion pendiente, notas, cantidades y cancelacion sin borrar historia.
6. Autorizacion para corregir enviado y aviso con la cantidad original.
7. Pago completo, liberacion, nueva orden con otro ID y sin productos/pagos anteriores.
8. Dos dispositivos creando orden en la misma mesa.
9. Payload con mesero, mesa, area, horarios, zona y lote.
10. Acceso infantil vinculado a mesa/orden, reintento, bloqueo de cobro y extras antes del pago.
11. Pago dividido, reintento de pago y cierre de caja con saldos exactos.
12. Idempotencia de creacion/adicion.
13. Aislamiento entre sucursales.
14. Inventario y recibo despues de corregir cantidades.
15. No reenvio de lineas LEGACY.
16. Correccion bloqueada durante envio y rollback si falta impresora para cancelar.
17. Restriccion unica de mesa activa incluso al insertar fuera del servicio.
18. Salida infantil concurrente, cargo extra unico e historial de tiempos finalizado.
19. Cancelacion en la estacion original aun si cambia el producto.

La suite HTTP smoke comprueba ademas RBAC, eventos para dos dispositivos y aislamiento de sucursales, pagos concurrentes, caja y escenarios operativos existentes. El caso omitido corresponde a productos por sucursal: el catalogo actual es global y no tiene branchId. Los tests del renderizador verifican texto y fechas en 58/80 mm, conservando la apertura del cajon solo para recibos de efectivo.

## Regresion de interfaz ejecutada

Se ejecuto `scripts/regression/pos-browser.js` con playwright-cli sobre el build real del frontend en localhost:3059, en un navegador aislado. La API se simulo y se bloquearon conexiones externas/WebSocket y el service worker. Verifico cinco condiciones: limpieza de cuenta cerrada en dos pestanas, limpieza de extras pendientes, recarga sin restaurar historial, nueva venta/pago para mesa 2 con ID distinto y enlace directo a orden historica sin dejar POS cargando.

Esta prueba de interfaz complementa las pruebas de PostgreSQL y HTTP; no es una prueba integrada con la API real ni con dispositivos fisicos. Para repetirla despues de compilar:

```powershell
# En una terminal local temporal:
pnpm --filter frontend start --port 3059 --hostname 127.0.0.1
# En otra terminal, desde la raiz:
playwright-cli -s=production-regression open about:blank
playwright-cli -s=production-regression run-code --filename=scripts/regression/pos-browser.js
playwright-cli -s=production-regression close
```

## Pendiente antes de produccion

Validar este cambio en el staging real de la sucursal, con copia de sus datos, zona horaria y configuracion de impresoras. No se ha desplegado a staging ni a produccion.

Con dos equipos y la impresora real, realizar: primera comanda de mesa 2 (2 desayunos y 2 cafes); agregar 2 pizzas y comprobar que solo salgan pizzas; verificar cancelacion/correccion, falta de papel, desconexion del agente y reimpresion autorizada. Confirmar encabezados, notas y horas en ambos anchos usados por el restaurante.

Comprobar tambien visualmente en POS/Mesas: cobrar totalmente, observar liberacion en el otro equipo, recargar ambos navegadores, abrir mesa 2 para otros clientes y comprobar ID nuevo, carrito limpio y ausencia de productos/pagos antiguos. Las pruebas automaticas verifican transacciones, API, eventos y nuevas consultas; no sustituyen esta prueba de interfaz en los equipos de operacion.
