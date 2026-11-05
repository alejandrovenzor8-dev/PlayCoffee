# PlayCoffee: tres impresoras, precuenta y copia del negocio

Implementacion local validada con datos aislados. No se modifico la base del restaurante ni se desplego a produccion.

## Diagnostico del sistema revisado

El sistema ya almacenaba destinos separados `printer_kitchen`, `printer_bar` y `printer_cashier` por sucursal. Los productos usan `preparationStation` KITCHEN/BAR/NONE. Las comandas incrementales y sus correcciones usan PrintJobs. El agente en la computadora Windows consume la cola y envia bytes ESC/POS a la impresora Windows nombrada o al destino TCP. Los telefonos de los meseros solo acceden a la API; no necesitan instalar impresoras. No se necesitan computadoras o pantallas en cocina/barra.

Faltaban las siguientes distinciones y garantias:

- El documento CUSTOMER era generico: no diferenciaba precuenta de comprobante del negocio ni aplicaba un modo por sucursal.
- El ticket final se creaba despues de confirmar el pago; una interrupcion del servidor podia dejar una venta sin documento guardado. Tampoco tenia una clave unica de venta para reintentos.
- La identidad del cajero se tomaba del usuario que abrio la orden, que puede ser el mesero.
- La salida ESC/POS omitia descuentos, saldo, detalle de pagos/efectivo recibido y la identificacion no fiscal del negocio.
- El boton de impresion del navegador permitia usar el destino predeterminado, fuera de la cola configurada.
- La ayuda Windows no comprobaba los resultados de EndPagePrinter y EndDocPrinter. Se agrego esa comprobacion y se corrigio la propagacion de errores al preparar el archivo de spool.

## Flujo implementado

| Destino de negocio | Uso | Transporte existente |
| --- | --- | --- |
| KITCHEN | Alimentos nuevos y cancelaciones/correcciones de cocina | PrintJob.type KITCHEN, printer_kitchen |
| BAR | Bebidas nuevas y cancelaciones/correcciones de barra | PrintJob.type BAR, printer_bar |
| CASHIER | Precuenta y copia del negocio | PrintJob.type CUSTOMER, printer_cashier |

Se conserva el nombre interno CUSTOMER por compatibilidad del agente. `payload.cashierDocument.kind` distingue PREBILL y BUSINESS. No hay sustitucion por la impresora predeterminada ni fallback de caja a cocina/barra. Las vistas de ticket usan la cola de servidor; se retiro la impresion mediante window.print().

### Precuenta

Disponible en POS, Mesas y Comandero cuando se configura Cliente + negocio. Cajeros, administradores y meseros pueden imprimirla. Se genera a partir de la orden vigente, incluye productos, precios, descuentos, pagos aplicados y saldo. Dice PRECUENTA - NO ES COMPROBANTE DE PAGO. Usa la zona horaria de la sucursal.

Imprimirla solo crea un PrintJob: no escribe pagos, totales, estado de orden, ocupacion o inventario. Para incluir productos posteriores hay que agregarlos al ticket y solicitar una nueva precuenta. Cada solicitud conserva su propia instantanea. Un reintento con el mismo requestId devuelve el mismo trabajo; una precuenta actualizada lleva otro requestId.

### Liquidacion y comprobante del negocio

El ultimo pago, el descuento de inventario, la terminacion de la orden, la liberacion de mesa y la instantanea definitiva se guardan dentro de una transaccion. La clave unica `business:<orderId>` permite un solo original por venta. No se realiza ninguna comunicacion con la impresora dentro de esa transaccion.

El comprobante contiene folio propio, ID y numero de orden, mesa, mesero, cajero del ultimo pago, fecha local, cantidades/precios, descuentos, total y pagos con efectivo recibido/cambio. Dice COPIA NEGOCIO y Documento no fiscal. No es CFDI.

Con impresion automatica y destino configurado, el trabajo queda PENDING. Con automatica deshabilitada, o sin destino de caja, queda HELD: la venta esta confirmada y su documento guardado, pero el agente no lo imprime. Si falta destino se muestra la causa al consultar el comprobante. Desde Comprobante negocio se puede solicitar la primera impresion manual.

Un error posterior de la impresora no modifica el pago, no ocupa otra vez la mesa y no genera otro cobro. El exito de pago se muestra en POS independientemente de la impresion. Comprobante negocio queda accesible tras cobrar y tambien en las ordenes completadas del Comandero.

Los pagos parciales mantienen la orden activa; no crean comprobante final ni liberan mesa. El control infantil existente bloquea el pago final si hay accesos sin salida: primero registrar salida y agregar extras.

### Reimpresion

Solo ADMIN, SUPER_ADMIN o CASHIER pueden solicitarla. La sucursal puede deshabilitarla. Requiere motivo y confirmacion explicita. Conserva la instantanea, folio, fecha e importes originales, aunque cambien productos, precios o datos de la sucursal despues de la venta. Cada copia es otro PrintJob con el mismo identificador de comprobante y marca de reimpresion; registra usuario, motivo y fecha en auditoria.

El mismo requestId no crea otra copia, incluso despues de completar el trabajo. Si existe una copia en cola/procesandose, no se encola otra en paralelo. Nunca se crea un pago desde este flujo. La primera impresion de un original HELD queda registrada y el original se archiva en CANCELLED sin enviarlo tambien al agente; su payload se conserva.

Precuentas y reimpresiones no abren el cajon. La primera impresion de la copia del negocio con efectivo puede abrirlo mediante ESC/POS, conservando el comportamiento de caja existente.

## Comentarios de preparacion

Mesas y POS muestran Comentarios de preparacion debajo de cada producto. Se puede escribir, por ejemplo, Bien cocidos o Tiernitos, incluyendo varias lineas. La comanda imprime el comentario debajo del producto como NOTA.

Un comentario aplica a la cantidad de esa linea. Si dos porciones llevan distinta preparacion, usar Separar 1 y editar los dos comentarios. Se conserva la cantidad total y el importe. Agregar otra vez un producto ya comentado crea otra linea, evitando que una preferencia termine aplicada a todas las porciones.

Los productos del ticket guardado muestran sus comentarios. Una vez enviada la comanda, los cambios se tramitan con Corregir y la autorizacion existente; no se edita silenciosamente lo enviado. No se agrega una migracion por esta mejora: OrderItem.notes ya existia.

La regresion 27 comprueba dos preparaciones del mismo producto en PostgreSQL y en el payload de cocina, y que no se repitan al agregar otra comanda. El test ESC/POS imprime ambas notas en 58/80 mm. La prueba de navegador `scripts/regression/preparation-notes-browser.js` comprueba las porciones y los comentarios independientes en Mesas y POS, con API simulada.

## Configuracion por sucursal

Entrar como ADMIN/SUPER_ADMIN en Configuracion > Impresoras, en el servidor Windows:

1. Detectar impresoras instaladas o escribir el destino explicitamente. Asignar tres destinos distintos segun su ubicacion fisica.
2. Ejemplo Windows: `windows:///EPSON Cocina`, `windows:///EPSON Barra`, `windows:///EPSON Caja`. Usar el nombre exacto instalado en la computadora del agente. Si el nombre tiene espacios, la URL puede usar %20.
3. Ejemplo red directa: cocina `tcp://192.168.1.62:9100`, barra `tcp://192.168.1.63:9100`, caja `tcp://192.168.1.61:9100`. Reservar las IP en la red y verificar accesibilidad desde Windows. El puerto habitual del envio RAW es 9100; usar el configurado en el equipo.
4. Elegir ancho 58 u 80 mm segun la configuracion actual del negocio. El ancho sigue siendo comun por sucursal.
5. En Tickets en caja seleccionar Solo negocio o Cliente + negocio.
6. Configurar Impresion automatica > Comprobante del negocio, Confirmar cierre al liquidar y Permitir reimpresion autorizada. Guardar cambios.
7. Ejecutar por separado las pruebas de Cocina, Barra y Caja y comprobar fisicamente donde sale cada papel. La confirmacion de software no basta.
8. Configurar productos: alimentos KITCHEN, bebidas BAR; cargos que no requieren preparacion, como acceso infantil, NONE. Mantener encendidos el sistema local y el agente Windows durante la operacion.

Solo negocio oculta y rechaza la precuenta. Cliente + negocio permite precuenta sin cierre; ambos modos guardan la copia final del negocio. El modo por omision es Solo negocio; la confirmacion de cierre empieza deshabilitada para conservar compatibilidad y debe activarse si se desea. La opcion automatica conserva el valor anterior auto_print_customer; las reimpresiones autorizadas empiezan habilitadas.

La configuracion se persiste en Setting por branchId con claves cashier_ticket_mode, auto_print_customer, confirm_close y receipt_reprint_enabled, ademas de los tres destinos existentes. La API de politica para meseros/cajeros solo devuelve opciones de operacion, sin revelar o permitir editar los destinos. Una confirmacion requerida tambien se valida en backend mediante closeConfirmed.

## Agente y fallos de impresion

El servicio usa los destinos del trabajo, no una impresora predeterminada. Windows/USB exige que la impresora este instalada para la cuenta con la que se ejecuta el agente. Red directa TCP requiere una impresora compatible con ESC/POS RAW. No todos los modelos termicos usan el mismo dialecto; hay que validarlo fisicamente.

Los trabajos de caja nuevos tienen un intento automatico. Si falla o vence la reclamacion del agente, se revisa el lote y se solicita una copia autorizada, evitando repetir ciegamente bytes que pudieron haber llegado a la impresora.

Si la caja se desconecta despues del pago: confirmar que la venta figura liquidada, reconectar papel/red/spooler/agente y abrir Comprobante negocio desde Comandero > Completadas. Revisar el estado, escribir motivo y confirmar la reimpresion. No volver a pulsar cobro ni crear otro pago.

El agente confirma entrega de bytes TCP o aceptacion del spooler. No detecta fisicamente papel, atascos o corte; PRINTED no garantiza papel entregado. Ante resultado ambiguo revisar la impresora antes de repetir. Precuenta, copia y reimpresion no son CFDI.

## Migraciones y puesta en staging

Nueva migracion: `apps/backend/prisma/migrations/20261101020000_cashier_documents/migration.sql`.

Agrega HELD al enum PrintJobStatus y una columna nullable PrintJob.dedupKey con indice unico. Los trabajos antiguos conservan dedupKey NULL; no se reescriben ni eliminan documentos historicos. Las opciones por sucursal se guardan al salvar configuracion; sus valores iniciales no requieren modificar historiales.

Depende del esquema actual, incluida la migracion anterior de comandas incrementales. Si esta tampoco fue desplegada, aplicar las migraciones pendientes primero en staging y revisar las ordenes activas duplicadas segun DIAGNOSTICO-PRODUCCION.md. La nueva migracion no borra ni fusiona ventas.

Actualizar backend, frontend y scripts del agente/renderizador como una misma version. No dejar el renderer viejo procesando precuentas nuevas: no conoce sus leyendas ni la proteccion de cajon. Hacer respaldo y revisar la cola antes de la actualizacion en staging. No se ejecuto ninguna migracion en la base del restaurante durante este trabajo.

Los comprobantes anteriores a esta version que no tienen una instantanea definitiva identificada no se reconstruyen automaticamente a partir de productos o precios actuales. Consultar su archivo historico; la API indica cuando no existe un comprobante definitivo guardado. No se crean pagos para recuperar impresiones.

## Pruebas realizadas

| Comprobacion | Resultado |
| --- | --- |
| pnpm build | Backend, frontend y shared correctos |
| pnpm lint | Correcto; seis advertencias preexistentes, sin errores |
| pnpm test | 16 pruebas unitarias aprobadas |
| PostgreSQL real + smoke HTTP | 62 pruebas aprobadas, un caso existente omitido porque el catalogo es global |
| Migraciones en base temporal nueva | 20 aplicadas, incluida la nueva |
| ESC/POS en 58 y 80 mm | 6 pruebas aprobadas, incluidas leyendas, saldo, efectivo, cambio y cajon |
| Prisma validate | Correcto |
| Pedidos largos en navegador, con API simulada | 10 escenarios aprobados: POS y Mesas en cinco tamaños; 40 productos nuevos y 40 guardados por escenario |
| Comentarios en navegador local, con API simulada | 4 comprobaciones aprobadas: separar porciones, agregar producto comentado, notas independientes en Mesas y comentarios guardados visibles |
| Navegador local con API simulada | Seis verificaciones: modos, precuenta, actualizacion, cancelar cierre, pago confirmado con fallo de caja, reimpresion sin otro pago |

La base de prueba fue un PostgreSQL 18 temporal en localhost:55440, con datos generados para la suite, separado de la base del restaurante y apagado al finalizar. Los tests de impresora simulan confirmacion/fallo del agente; no hubo impresion fisica. La prueba de navegador controla las respuestas de confirmacion para verificar ambas ramas y no utiliza la API real.

Cobertura de los doce escenarios solicitados:

| Escenario | Cobertura |
| --- | --- |
| 1 y 2. Alimentos/cocina y bebidas/barra | Regresiones 1-3 y 20; smoke de estaciones |
| 3. Precuenta sin cerrar | Regresion 20 y navegador |
| 4 y 5. Agregar productos y precuenta actualizada | Regresion 20 y navegador |
| 6. Pago dividido | Regresiones 11 y 21 |
| 7. Pago final/cierre/liberacion | Regresiones 7, 21 y 25 |
| 8. Copia negocio | Regresiones 21, 23 y 24; ESC/POS |
| 9. Caja desconectada tras confirmar | Regresion 22; navegador con fallo simulado |
| 10. Reimpresion sin cobro | Regresiones 22-24, incluidos reintentos; navegador y cajon |
| 11. Nueva orden en mesa liquidada | Regresiones 7, 8 y 21 |
| 12. Ambos modos de configuracion | Regresiones 20, 23 y 25; navegador y permisos HTTP |

Para repetir con una base DESECHABLE migrada, configurar TEST_DATABASE_URL y SMOKE_DATABASE_URL explicitamente. No usar la conexion del restaurante:

```powershell
pnpm lint
pnpm build
pnpm test
pnpm --filter backend test:regression
pnpm --filter backend test:smoke
node --test scripts/print-agent/escpos-renderer.test.mjs
pnpm --filter backend exec prisma validate
```

Para la UI, iniciar temporalmente el frontend compilado en 127.0.0.1:3059 y ejecutar:

```powershell
playwright-cli -s=cashier-flow open about:blank
playwright-cli -s=cashier-flow run-code --filename=scripts/regression/cashier-browser.js
playwright-cli -s=cashier-flow close
```

## Archivos de este cambio

Backend y esquema:

- apps/backend/prisma/schema.prisma
- apps/backend/prisma/migrations/20261101020000_cashier_documents/migration.sql (nuevo)
- apps/backend/src/modules/print/print.service.ts
- apps/backend/src/modules/print/print.controller.ts
- apps/backend/src/modules/print/print.types.ts
- apps/backend/src/modules/print/dto/update-print-config.dto.ts
- apps/backend/src/modules/print/dto/cashier-document.dto.ts (nuevo)
- apps/backend/src/modules/payments/payments.service.ts
- apps/backend/src/modules/payments/dto/create-payment.dto.ts

Interfaz:

- apps/frontend/src/app/(dashboard)/settings/page.tsx
- apps/frontend/src/app/(dashboard)/pos/page.tsx
- apps/frontend/src/app/(dashboard)/tables/page.tsx
- apps/frontend/src/app/(dashboard)/orders/page.tsx
- apps/frontend/src/components/print/CashierTicketActions.tsx (nuevo)
- apps/frontend/src/components/print/CustomerReceipt.tsx
- apps/frontend/src/components/print/PrintableTicket.tsx
- apps/frontend/src/hooks/useCashierPrintPolicy.ts (nuevo)
- apps/frontend/src/lib/api.ts
- apps/frontend/src/types/print.types.ts

Agente y pruebas:

- scripts/print-agent/escpos-renderer.mjs
- scripts/print-agent/escpos-renderer.test.mjs
- scripts/print-agent/print-agent.mjs
- scripts/print-agent/send-windows-raw.ps1
- apps/backend/test/production-regression.e2e-spec.ts
- apps/backend/test/smoke.e2e-spec.ts
- scripts/regression/cashier-browser.js (nuevo)
- scripts/regression/pos-browser.js (adaptacion de la respuesta de politica para su fixture)
- GUIA-TRES-IMPRESORAS.md (este archivo)

Los otros cambios locales que ya existian se conservaron. No se agregaron dependencias ni se hizo un despliegue.

## Validacion fisica pendiente

En staging, con la computadora Windows y meseros en Wi-Fi, probar los doce escenarios en las tres impresoras reales. Confirmar ubicacion de cada salida, leyendas legibles, ancho, tildes soportadas, zona local, importes, corte y comportamiento del cajon. Desconectar caja despues de confirmar un pago, revisar que la mesa se libere y que solo se necesite reimprimir. Probar falta de papel y reinicio del agente, para revisar resultados ambiguos antes de repetir.

No desplegar a produccion hasta completar esta prueba fisica de las tres impresoras.


Archivos adicionales de la mejora de comentarios: apps/frontend/src/components/print/PreparationNotes.tsx, apps/frontend/src/store/cart.store.ts y scripts/regression/preparation-notes-browser.js; tambien se actualizaron Mesas, POS, KitchenTicket, las pruebas de regresion/ESC-POS y esta documentacion.


## Adaptacion de celular/tablet y comandas largas

Mesas y POS limitan sus paneles a la altura disponible y permiten desplazar el catalogo y los productos de la comanda. Se quito la altura minima rigida que recortaba el comandero. Una pantalla de poca altura puede desplazar tambien el panel para alcanzar las acciones; no oculta productos por superar el espacio visible.

Por debajo de 1024 px, Productos y Comanda se eligen con dos botones grandes. En escritorio se mantienen los paneles juntos. La seleccion se adapta con CSS al ancho disponible, sin depender de la marca del telefono. Los controles tactiles tienen al menos 44 px y los campos usan texto de 16 px en esas pantallas. El teclado nativo puede cambiar el espacio visible y el panel permite desplazamiento.

La revision incluye margen para la navegacion inferior, encabezados de Mesas que se acomodan en varias filas y pestañas del Comandero que caben en pantalla estrecha. El script scripts/regression/responsive-orders-browser.js prueba pedidos grandes en POS y Mesas en 1280x720, 768x1024, 390x844, 360x640 y 390x500 (altura reducida), con API simulada; comprueba scroll, ultimo comentario, accion alcanzable y ausencia de desbordamiento horizontal.

Archivos de adaptacion: apps/frontend/src/components/orders/OrderPaneSwitcher.tsx; paginas POS, Mesas, Comandero y layout; componentes UI button, input, textarea, select y dialog; PreparationNotes; scripts/regression/responsive-orders-browser.js. No se cambia el esquema ni el flujo de pagos por esta adaptacion.


En POS se muestra Agregar al ticket cuando hay productos pendientes, y Cobrar cuando ya estan guardados. Limpiar carrito esta en el encabezado y conserva la mesa seleccionada. Esto reduce botones simultaneos y deja mas espacio para la lista.


La validacion final de caja en navegador tambien se repitio en 390x844: ambas politicas de precuenta, actualizacion tras agregar productos, cancelar/confirmar cierre y reimprimir sin otro pago. Estas pruebas verifican el build real con respuestas API simuladas; no equivalen a una prueba fisica de impresoras o de todos los modelos de telefono.
