# Manual de usuario de PlayCoffee

Guía de operación para cafetería y área infantil

Edición de uso diario · 17 de noviembre de 2026

PlayCoffee permite atender mesas, registrar consumos, controlar ingresos infantiles, cobrar cuentas y consultar existencias. Este manual explica qué hacer en cada pantalla, qué resultado debes comprobar y cómo actuar cuando una operación no se completa.

Está dirigido a administradores, cajeros, meseros y personal de cocina. Cada persona verá únicamente los módulos permitidos por su rol. Si una opción no aparece, consulta al administrador antes de intentar operar con otra cuenta.

## Cómo usar este manual

- Si es tu primer día, comienza por los capítulos 1 y 2 y después lee los de tu puesto.
- Para atender una mesa, consulta los capítulos 3 a 5.
- Para registrar niños y cobrar su estancia, consulta los capítulos 6 y 7.
- Para controlar botellas de agua u otros productos por unidad, consulta los capítulos 10 y 11.
- Si aparece un error, consulta el capítulo 19 antes de repetir la operación.

## Recorrido habitual del día

1. Inicia sesión con tu usuario y verifica la conexión.
2. Abre caja con el efectivo que realmente hay en el cajón.
3. Registra las mesas, consumos, ingresos infantiles y reservas que correspondan.
4. Revisa los productos nuevos y envía las comandas a cocina o barra.
5. Finaliza los accesos infantiles antes de liquidar su cuenta.
6. Cobra, comprueba la confirmación del pago y entrega el documento correspondiente.
7. Revisa pendientes, cuenta el efectivo y realiza el cierre de caja.

**Regla principal:** una cuenta registrada, una comanda impresa y un pago confirmado son operaciones distintas. Comprueba el resultado de cada una.

# 1 Acceso y orientación

## Iniciar sesión

1. Abre la dirección de PlayCoffee que te indique el encargado. En la computadora del servidor puede ser http://localhost:3000; desde una tablet utiliza la dirección local del servidor, no localhost.
2. En el acceso con contraseña, escribe tu correo y contraseña y pulsa el botón de inicio de sesión.
3. Si tienes PIN habilitado, elige el acceso con PIN, escribe tu correo, captura los cuatro dígitos y pulsa **Entrar con PIN**.
4. Espera a que aparezca tu pantalla de trabajo. Si tus datos no funcionan, pide al administrador que revise tu usuario y su estado.

**Importante:** el PIN identifica a una persona junto con su correo. Usa tus propios datos de acceso para que las operaciones queden asociadas al responsable correcto.

## Ubicarse en la pantalla

El menú permite entrar a los módulos disponibles. En computadora aparece a un lado; en pantallas pequeñas se adapta a la navegación móvil. En captura de pedidos, las vistas de productos y ticket pueden mostrarse por separado: cambia a la vista del ticket para revisar lo registrado.

| Módulo | Para qué se utiliza |
| --- | --- |
| Dashboard | Consultar indicadores generales de la operación |
| Caja / POS | Preparar cuentas, recuperar tickets y registrar pagos |
| Corte de Caja | Abrir turno, registrar movimientos y cerrar caja |
| Mesas | Abrir mesas y agregar consumos |
| Comandero | Consultar pedidos, preparación e impresión de comandas |
| Control Infantil | Registrar ingresos, tiempos, salida y cargos infantiles |
| Reservas | Consultar calendario, registrar eventos y administrar paquetes |
| Inventario | Consultar existencias, mínimos y movimientos |
| Catálogo | Consultar o administrar productos y precios según permisos |
| Reportes | Consultar resultados por periodo y exportarlos |
| Usuarios y Configuración | Administrar accesos y ajustes del negocio |

## Cerrar la sesión

Antes de salir, termina o revisa las operaciones pendientes. Utiliza **Cerrar sesión** cuando dejes de trabajar en el dispositivo. Cerrar sesión no sustituye el cierre de caja: son acciones diferentes.

# 2 Responsabilidades y preparación del turno

## Qué puede hacer cada usuario

| Rol | Trabajo principal | Límites de uso |
| --- | --- | --- |
| Super admin | Administración completa y gestión de administradores | Reservado al responsable general |
| Admin | Operación, catálogo, reportes, configuración y personal operativo | La administración de otros administradores depende del super admin |
| Cajero | Cobros, caja, mesas, pedidos, niños, reservas e inventario operativo | Sin Usuarios, Configuración ni reportes administrativos |
| Mesero | Mesas, captura de pedidos, comandero y consulta del catálogo | Sin cobros, caja ni edición del catálogo |
| Cocinero | Consulta del comandero y catálogo y avance de preparación | Sin cobros ni edición de productos |

La aparición de un módulo no significa que todas sus acciones estén habilitadas. Por ejemplo, consultar el catálogo y editar precios tienen permisos distintos.

## Lista de apertura

1. Confirma que el servidor esté encendido y que el dispositivo esté conectado a la red del negocio.
2. Inicia sesión y verifica que no aparezca el aviso rojo de desconexión.
3. En **Corte de Caja**, comprueba si ya hay un turno abierto. No intentes abrir otro para la misma sucursal.
4. Si no hay turno, cuenta el fondo inicial y abre caja como se explica en el capítulo 8.
5. Revisa mesas ocupadas, cuentas sin mesa e ingresos infantiles activos de la operación anterior.
6. Consulta las reservas del día y las existencias con stock bajo.
7. Comprueba papel y disponibilidad de las impresoras. Si corresponde, solicita una prueba al administrador.

## Tres comprobaciones antes de cobrar

- **Cuenta correcta:** coincide el número de ticket y, si existe, la mesa o el niño.
- **Saldo correcto:** los productos nuevos ya están agregados y los accesos infantiles ya finalizaron.
- **Caja abierta:** existe un turno activo para registrar el pago.

**Ejemplo:** un ingreso infantil puede generar una cuenta aunque todavía no haya caja abierta. La cuenta existe, pero el cobro permanecerá bloqueado hasta abrir el turno.

# 3 Mesas y toma de pedidos

## Abrir una mesa

1. Entra a **Mesas** y elige el área correspondiente.
2. Localiza y selecciona la mesa por su número. Revisa su estado y si ya tiene una cuenta abierta.
3. Si no hay cuenta, pulsa **Abrir mesa**. Si aparece el campo de personas, captura el número de comensales.
4. Confirma que el ticket quedó abierto antes de registrar el consumo.

Si la mesa ya tiene una cuenta activa, el sistema carga esa cuenta para continuar trabajando sobre ella. Revisa el número de ticket para evitar agregar productos a otra mesa.

## Agregar consumo

1. Busca los productos y agrégalos a la selección de nuevos consumos.
2. Ajusta las cantidades con los controles de sumar o restar.
3. Captura las instrucciones de preparación, por ejemplo, “sin azúcar”.
4. Si una unidad lleva una preparación diferente, utiliza **Separar 1** y agrega la nota a esa unidad.
5. Comprueba los importes de **Orden actual**, **Nuevos** y **Total mesa**.
6. Pulsa **Agregar al ticket** y espera la confirmación.

**Resultado esperado:** los nuevos productos quedan integrados en la cuenta y dejan de estar únicamente en la selección temporal.

## Guardar e imprimir son pasos distintos

Después de agregar productos, revisa su envío a cocina o barra en **Comandero**. La impresión automática depende de la configuración de la estación y de las impresoras. Si el personal no recibió una comanda, verifica el estado antes de volver a enviarla.

## Continuar o cobrar una mesa

Para agregar otro consumo, vuelve a seleccionar la misma mesa. Para cobrar, entra a **Caja / POS**, selecciona la mesa y comprueba la cuenta pendiente.

La mesa se libera al completar el pago y cerrar la cuenta según las reglas del sistema. Marcar una orden como entregada en cocina no equivale a pagarla.

**Antes de cerrar la ventana:** comprueba que hayas pulsado **Agregar al ticket**. Los productos que siguen en la selección de nuevos consumos todavía requieren esa acción para quedar guardados.

# 4 Caja POS y cuentas sin mesa

## Preparar una venta

1. Entra a **Caja / POS**.
2. Selecciona una mesa o **Sin mesa / para llevar**, según corresponda.
3. Busca los productos por nombre o categoría y agrégalos al carrito.
4. Ajusta cantidades y notas. Revisa el total antes de continuar.
5. Pulsa **Cobrar** para abrir la pantalla de pago y sigue el capítulo 5.

Si estás trabajando sobre un ticket existente, el panel puede mostrar **Extras del ticket**. Los productos que agregues allí son nuevos consumos: pulsa la acción para agregarlos al ticket antes de cobrar. El sistema bloquea el cobro mientras esos productos estén pendientes de integrar.

## Recuperar una cuenta sin mesa

1. Busca el selector **Cuentas pendientes sin mesa** en el panel del ticket.
2. Selecciona el número de cuenta que necesitas.
3. Comprueba que aparezcan **Ticket cargado**, el número correcto y el importe pendiente.
4. Pulsa **Cobrar** cuando hayas revisado el consumo.

La lista permite recuperar cuentas infantiles sin mesa y otras cuentas abiertas sin mesa. Las cuentas completadas, canceladas o sin saldo pendiente dejan de aparecer.

Si el carrito tiene productos nuevos, termina esa operación o limpia el carrito antes de cambiar de cuenta. Esto evita mezclar consumos de clientes distintos.

## Salir para abrir caja y regresar

Cuando seleccionas una cuenta, el POS conserva su referencia en la sesión de esa pestaña y para tu usuario y sucursal. Puedes ir a **Corte de Caja**, abrir el turno y volver a **Caja / POS** para retomar el ticket.

Si regresaste desde otra pestaña o la selección no se recuperó, búscala en **Cuentas pendientes sin mesa**. También puedes abrirla desde **Ir a cobrar** en Control Infantil o seleccionando su mesa.

**Importante:** conservar la referencia de una cuenta no guarda automáticamente productos nuevos que aún no agregaste al ticket. Comprueba siempre que el consumo ya esté registrado.

# 5 Cobros y pagos parciales

## Registrar un pago

1. Carga la cuenta y pulsa **Cobrar**.
2. Revisa **Total a cobrar**, **Pagado** y **Saldo**.
3. Si la propina está habilitada, selecciona el porcentaje acordado con el cliente antes del primer pago.
4. Elige **Efectivo**, **Tarjeta** o **Transferencia**.
5. Captura el importe y, cuando corresponda, la referencia.
6. Pulsa **Agregar Pago** una sola vez y espera el resultado.

## Qué capturar según el método

| Método | Dato principal | Qué comprobar |
| --- | --- | --- |
| Efectivo | Efectivo recibido del cliente | El cambio calculado y el saldo aplicado |
| Tarjeta | Monto a aplicar y referencia opcional | La aprobación en la terminal externa y la confirmación en PlayCoffee |
| Transferencia | Monto a aplicar y referencia opcional | La recepción del dinero y la confirmación en PlayCoffee |

Registrar una tarjeta o transferencia en PlayCoffee deja constancia del pago; la validación del movimiento bancario se realiza con el medio de cobro del negocio.

## Pagos parciales o combinados

Puedes registrar una parte con un método y el resto con otro. Después de cada pago, revisa el nuevo saldo y los **Pagos aplicados**. En tarjeta y transferencia, el monto no debe exceder el saldo pendiente.

**Ejemplo sin propina:** una cuenta de $250 recibe $100 con tarjeta. El saldo queda en $150. Si después recibes $200 en efectivo, aplica $150 y entrega $50 de cambio.

La propina deja de ser modificable cuando hay pagos registrados. Si necesitas corregir una cuenta con pagos, consulta al encargado antes de continuar.

## Confirmar que terminó

Cuando el saldo queda liquidado, la cuenta se completa y el POS muestra la confirmación. Si la configuración solicita confirmar el cierre final, lee la pregunta y confirma solo después de revisar la cuenta.

**Si falla la conexión:** consulta los pagos y el saldo antes de repetir. Si aparece “el pago sí fue registrado”, no vuelvas a cobrar. La falta de papel o una falla de impresión no anula un pago confirmado.

# 6 Control infantil y registro de ingresos

## Registrar a un niño

1. Entra a **Control Infantil** y abre el formulario de registro de ingreso.
2. Captura el nombre del niño. Agrega la edad cuando corresponda.
3. Escribe el nombre del tutor y, de preferencia, un teléfono de contacto.
4. Selecciona el **Tiempo contratado** y revisa el precio mostrado.
5. Elige cómo se asociará el cobro: **Crear ticket nuevo**, **Usar ticket abierto** o **Vincular a mesa**.
6. Si usas una cuenta o mesa existente, selecciónala y comprueba que sea la correcta.
7. Agrega observaciones y pulsa **Registrar**.

**Resultado esperado:** aparece el acceso activo con su tiempo y código. También se genera el cargo correspondiente en la cuenta asociada.

El registro por tiempo comienza en una hora y permite incrementos de treinta minutos. El precio por media hora corresponde a los bloques adicionales a la primera hora.

## Elegir dónde se cobrará

| Opción | Cuándo usarla |
| --- | --- |
| Crear ticket nuevo | El niño no tiene una cuenta abierta o no se asociará a una mesa |
| Usar ticket abierto | Ya existe una cuenta del cliente a la que se agregará el acceso |
| Vincular a mesa | El consumo y el acceso deben quedar asociados a una mesa |

## Supervisar la estancia

Consulta las tarjetas de accesos activos. El sistema muestra tiempo transcurrido, tiempo restante y estado.

- **Normal:** la estancia sigue dentro del tiempo contratado.
- **Por terminar:** se acerca el vencimiento.
- **Tolerancia:** terminó el tiempo contratado y aún está dentro del margen registrado.
- **Excedido:** ya corresponde calcular tiempo adicional.
- **Finalizado:** se registró la salida.

El tiempo de advertencia y tolerancia efectivo es el que tiene guardado cada ingreso. Verifica la tarjeta o el resumen; no supongas que mover un ajuste visible cambió un acceso ya registrado.

## Corregir un registro

Usa **Corregir registro** en un acceso activo, modifica los datos necesarios y guarda la corrección. Revisa el nuevo cargo si cambiaste el tiempo contratado. La corrección puede bloquearse si la cuenta tiene pagos. Un acceso ya finalizado no se edita desde este flujo.

# 7 Salida infantil y cálculo del cargo

## Finalizar antes de liquidar la cuenta

1. Localiza la tarjeta del niño y pulsa **Finalizar acceso**.
2. Verifica el niño y el tutor conforme al procedimiento del negocio.
3. Captura el código de salida o los datos del tutor que permitan validar el registro.
4. Pulsa **Finalizar** y espera la confirmación.
5. Revisa hora de ingreso, salida, tiempo contratado, tolerancia, cargo base, extra y total.
6. Pulsa **Ir a cobrar** para abrir la cuenta que corresponde.

**Importante:** el sistema no permite liquidar una cuenta si todavía tiene niños sin salida. Finalizar el acceso determina el tiempo y los extras; cobrar registra el dinero recibido.

## Cómo se calcula el tiempo

El cargo contratado utiliza el precio de la primera hora y los bloques de treinta minutos adicionales. Si hay tiempo excedido después de la tolerancia, se cobra por bloques de treinta minutos iniciados. Al superarse la tolerancia, el cálculo del extra toma el tiempo desde que terminó el periodo contratado.

**Ejemplo con tarifas ilustrativas:** primera hora de $99 y cada media hora adicional de $49.

| Tiempo contratado | Cargo sin descuento |
| --- | --- |
| 60 minutos | $99 |
| 90 minutos | $148 |
| 120 minutos | $197 |

Con 60 minutos contratados y 15 de tolerancia registrados, una salida a los 75 minutos no genera extra. A los 76 minutos corresponde un bloque adicional de $49. A los 91 minutos corresponden dos bloques de $49. Revisa siempre el resumen que calculó el sistema.

Las tarifas del ejemplo pueden cambiar. Cada ingreso conserva los precios con los que se registró, aunque después se actualice la configuración.

## Hermanos y cuentas de extras

El sistema puede aplicar el descuento configurado al detectar otro acceso activo en la misma cuenta o con el mismo teléfono del tutor. El valor predeterminado es 15 %. No captures teléfonos compartidos de personas distintas para obtener un descuento.

Si corresponde cobrar extras en una cuenta distinta, utiliza **Ir a cobrar** del resumen de salida: ese botón abre el ticket de cobro que devolvió el sistema. No crees manualmente otro cargo por el mismo tiempo.

# 8 Apertura y movimientos de caja

## Abrir el turno

1. Entra a **Corte de Caja**.
2. Comprueba que la caja muestre **Sin turno**.
3. Cuenta el efectivo del fondo inicial y escríbelo en **Fondo inicial**.
4. Agrega una nota si necesitas identificar la entrega del turno.
5. Pulsa **Abrir caja** y espera a que el estado cambie a **Abierta**.

Si ya existe una caja abierta, revisa el turno actual con el encargado. El sistema no permite abrir otro turno de la misma sucursal mientras el anterior siga activo.

**El fondo inicial no es una venta.** Es el dinero disponible en el cajón al comenzar. El bloqueo de cobro con caja cerrada es una protección del sistema.

## Registrar entradas o salidas de efectivo

Usa los movimientos de caja para dinero que entra o sale del cajón por motivos distintos de una venta.

1. Con la caja abierta, elige el tipo de movimiento.
2. Captura un importe mayor que cero.
3. Escribe un motivo claro y guarda.
4. Comprueba el movimiento y el nuevo efectivo esperado.

**Ejemplos:** una entrada de $200 para aumentar el fondo o una salida de $100 para una compra autorizada. No registres de nuevo como entrada el efectivo de una venta que ya cobraste en el POS.

## Leer los importes de caja

- **Ventas totales:** pagos registrados en el turno, según sus métodos.
- **Efectivo:** pagos realizados en efectivo.
- **Tarjeta y transferencia:** pagos registrados con esos métodos; no aumentan el efectivo físico.
- **Entradas y salidas:** movimientos manuales que modifican el cajón.
- **Efectivo esperado:** fondo inicial más pagos en efectivo más entradas menos salidas.

**Ejemplo:** fondo de $500, ventas en efectivo de $300, entrada de $100 y salida de $50 dan un efectivo esperado de $850. Las ventas con tarjeta no se suman a esos $850.

Antes de abandonar un turno, entrega al siguiente responsable las cuentas pendientes y los movimientos que deba conocer.

# 9 Cierre y revisión de caja

## Preparar el cierre

1. Revisa las mesas y las **Cuentas pendientes sin mesa** del POS.
2. Comprueba los accesos infantiles activos y finaliza los que realmente hayan concluido.
3. Revisa pagos pendientes o errores de conexión antes de repetir cobros.
4. Verifica que estén registrados los movimientos autorizados de efectivo.
5. Cuenta físicamente el dinero del cajón.

El cierre de caja registra el resultado del turno. No lo uses como sustituto de liquidar cuentas, terminar accesos infantiles o confirmar pagos pendientes.

## Cerrar el turno

1. Entra a **Corte de Caja** y revisa la caja actual.
2. En la sección **Cerrar caja**, captura el efectivo realmente contado.
3. Comprueba la diferencia frente al efectivo esperado.
4. Escribe una nota si existe faltante, sobrante o alguna incidencia.
5. Pulsa **Cerrar caja** y espera la confirmación.
6. Verifica el registro del turno en el historial.

**Atención:** el campo de cierre puede venir precargado con el efectivo esperado. Sustitúyelo por el monto que contaste; aceptar el importe sugerido sin contar no constituye un arqueo.

## Interpretar la diferencia

| Diferencia | Significado |
| --- | --- |
| Cero | El efectivo contado coincide con el esperado |
| Positiva | Hay más efectivo del que el sistema espera |
| Negativa | Hay menos efectivo del que el sistema espera |

**Ejemplo:** esperado de $850 y contado de $830 producen una diferencia de menos $20. Revisa cambios entregados, movimientos y cobros; no modifiques ventas únicamente para hacer coincidir el cierre.

## Consultar un turno anterior

En el historial revisa fecha, estado, ventas, efectivo esperado, efectivo contado y diferencia. Para un análisis por periodo utiliza **Reportes** con un usuario autorizado.

Los recordatorios de caja abierta ayudan a detectar turnos sin cierre. Antes de cerrar sesión o apagar la computadora, confirma con el encargado que el turno y las operaciones pendientes quedaron atendidos.

# 10 Catálogo y alta de productos

## Crear un producto

Esta tarea corresponde al administrador. El resto del personal consulta el catálogo según sus permisos.

1. Entra a **Catálogo** y pulsa la opción de nuevo producto.
2. Captura nombre, descripción y categoría disponible.
3. Selecciona la **Estación de preparación**.
4. Captura precio de venta, costo e impuesto cuando correspondan.
5. Completa SKU, código de barras o dirección de imagen si los utilizas.
6. Activa **Controlar inventario** si deben descontarse unidades al vender.
7. Revisa los datos, guarda y comprueba que el producto aparezca en la lista.

| Estación | Uso habitual |
| --- | --- |
| Sin impresión especial | Productos que no requieren una comanda a cocina o barra |
| Cocina | Alimentos preparados por cocina |
| Barra | Bebidas u otros productos preparados en barra |

La estación define el destino de preparación; la impresora debe estar configurada aparte. Cambiar la estación no garantiza por sí solo que salga papel.

## Diferencia entre precio y costo

El **precio** es lo que se cobra al cliente. El **costo** representa el valor interno del producto y no sustituye el precio. Revisa los impuestos con el encargado antes de cambiar porcentajes.

## Editar o retirar un producto

Busca el producto y usa **Editar** para modificarlo. Para dejar de ofrecerlo, utiliza la acción de activar o desactivar y confirma el resultado. Si usas una opción de eliminación, lee la confirmación y verifica antes que sea el producto correcto.

Los cambios de catálogo deben revisarse antes del siguiente pedido. Para corregir un producto que ya está en una cuenta, utiliza el flujo de corrección de la cuenta; editar el catálogo no reemplaza esa operación.

## Ejemplo de agua natural

Crea “Agua natural 600 ml”, asigna su precio, elige la estación apropiada y activa **Controlar inventario**. Después crea su artículo vinculado en **Inventario**, como se explica en el capítulo 11.

**Importante:** activar el control de inventario sin crear el artículo vinculado puede bloquear la liquidación de una venta por falta de configuración de existencias.

# 11 Inventario y aviso de stock bajo

## Registrar existencias de un producto

1. Confirma en **Catálogo** que el producto tenga **Controlar inventario** activado.
2. Entra a **Inventario** y pulsa **+ Item**.
3. En **Producto**, selecciona el producto exacto. No elijas **Sin producto ligado** si debe descontarse al venderlo.
4. Revisa el nombre y captura una unidad comprensible, por ejemplo, “botella” o “pieza”.
5. Captura el **Stock actual**, el **Stock mínimo** y el costo unitario si lo necesitas.
6. Pulsa **Crear** y verifica la cantidad en la lista.

**Ejemplo:** Agua natural 600 ml, unidad botella, stock actual 24 y mínimo 5. Cuando liquides una cuenta con dos aguas, las existencias pasan de 24 a 22. Al llegar a 5 o menos, el artículo se identifica con stock bajo.

El descuento automático ocurre al liquidar completamente la cuenta. Agregar un producto al carrito o recibir únicamente un pago parcial no representa todavía ese descuento final.

## Consultar y reponer

La vista **Stock** muestra las existencias y el mínimo. Usa la búsqueda y el filtro de stock bajo para localizar lo que necesitas reponer. El aviso de stock bajo aparece en Inventario; el catálogo también muestra el estado y Reportes permite consultar artículos con faltante de stock.

**Alcance del aviso:** la campana de notificaciones no incluye actualmente alertas de inventario. Revisa Inventario durante el turno; no esperes una notificación general mientras cobras.

## Registrar un movimiento

Selecciona el artículo y abre **Registrar Movimiento**. Elige tipo, captura cantidad y motivo y pulsa **Guardar**.

| Tipo | Qué hace | Ejemplo desde 22 botellas |
| --- | --- | --- |
| Entrada | Suma lo recibido | Entrada de 12 deja 34 |
| Salida | Resta una entrega distinta de la venta automática | Salida de 2 deja 20 |
| Merma | Resta pérdidas o daño | Merma de 1 deja 21 |
| Ajuste | Fija el total de existencias | Ajuste a 18 deja 18, no suma 18 |

Los movimientos quedan en el historial. No registres una salida manual por una venta que ya descontó el sistema: duplicarías la reducción. El ajuste es para corregir un conteo; en esta pantalla su cantidad debe ser mayor que cero. Para existencias agotadas o una corrección a cero que no puedas registrar, pide apoyo al administrador.

# 12 Comandero y correcciones

## Seguir la preparación

1. Entra a **Comandero**.
2. Busca la orden por su número y, si corresponde, su mesa.
3. Revisa productos, cantidades, notas e importes.
4. Cambia al siguiente estado disponible conforme avanza el servicio.
5. Usa **Actualizar** si necesitas volver a consultar las órdenes.

Las pestañas separan órdenes activas, entregadas, completadas y canceladas. El flujo de preparación utiliza estados como pendiente, confirmada, preparando, lista y entregada. La pantalla muestra la acción que corresponde a cada orden.

**Entregada no significa pagada.** Una orden entregada puede seguir mostrando saldo pendiente y debe cobrarse en el POS.

## Enviar cocina o barra

Usa **Nueva cocina** o **Nueva barra** para preparar la comanda de la estación correspondiente. Revisa la vista previa y utiliza la acción de envío a la impresora local cuando sea necesaria.

Los envíos de preparación se manejan por productos nuevos. Para imprimir una comanda anterior, utiliza **Reimprimir comanda anterior**, elige el lote y captura el motivo. No agregues de nuevo los productos para conseguir otra impresión.

Si una línea antigua no aparece entre los productos nuevos pendientes, revisa los lotes y consulta al encargado. Los productos con historial anterior pueden requerir revisión para evitar reenviar instrucciones que ya se prepararon.

## Corregir una línea

1. Localiza el producto en una cuenta que todavía permita cambios.
2. Pulsa **Corregir**.
3. Ajusta cantidad o notas y captura el **Motivo obligatorio**.
4. Guarda y revisa el nuevo total.
5. Si el producto ya había sido enviado, coordina la corrección con cocina o barra.

La cantidad de una corrección es un entero igual o mayor que cero. Una corrección a cero sirve para retirar la línea mediante este flujo, sujeta a las validaciones de la cuenta. Las cuentas con pagos o ya cerradas pueden impedir cambios.

**Una reimpresión no corrige una cuenta.** La reimpresión repite un documento existente; la corrección modifica la información registrada y necesita su motivo.

# 13 Reservas y paquetes de fiestas

## Crear una reserva

1. Entra a **Reservas** y pulsa la opción de nueva reserva.
2. Captura responsable, teléfono y correo cuando corresponda.
3. Captura fecha, hora de inicio, hora de fin y cantidad de niños.
4. Selecciona el área o salón para que el sistema pueda revisar cruces de horario en ese espacio.
5. Elige un paquete disponible o **Sin paquete**.
6. Revisa cantidad de paquetes, alimentos externos, total, anticipo y saldo.
7. Agrega notas, guarda y comprueba que aparezca en el calendario.

Las vistas **Día**, **Semana** y **Mes**, los controles **Anterior**, **Hoy** y **Siguiente** y el filtro de estado ayudan a localizar reservas.

Si seleccionas un paquete, revisa nuevamente inicio y fin antes de guardar. Las fiestas de paquetes tienen duración fija de cuatro horas y un máximo de 25 niños. El total considera el paquete, su cantidad y los cargos que correspondan. Sin paquete, el total se captura manualmente.

**Para evitar cruces:** elige el área correcta. Una reserva guardada sin área no identifica un salón específico para esa comprobación.

## Confirmar o cambiar una reserva

Abre la reserva en el calendario para editar sus datos o utilizar **Confirmar**, **Completar** o **Cancelar**, según corresponda. Revisa el resultado antes de prometer el horario al cliente.

El anticipo no puede ser negativo ni mayor que el total. Si el paquete tiene un mínimo y registras un anticipo, debe cumplirlo. Si no permite guardar, revisa el horario, los cruces del área, el paquete y los importes.

## Administrar paquetes

Un administrador puede entrar a la pestaña **Paquetes**, crear o editar nombre, descripción, precio, anticipo mínimo y cuota por alimentos externos. La duración y el límite de niños se muestran fijos. Usa activar o desactivar para controlar qué paquetes están disponibles.

**Importante:** capturar el anticipo de una reserva guarda ese dato en la reserva; este flujo no registra automáticamente un pago en el turno de caja. Sigue el procedimiento del negocio para recibir y conciliar ese dinero. No lo cuentes como una venta cobrada por el POS sin comprobar su registro correspondiente.

# 14 Dashboard y reportes

## Consultar la operación

El **Dashboard** muestra indicadores generales, como ventas, órdenes, mesas y niños activos, junto con gráficas de ventas. Es una vista de consulta disponible para perfiles administrativos.

Usa **Reportes** cuando necesites revisar un periodo específico o exportar información.

## Generar un reporte

1. Entra a **Reportes** con un usuario autorizado.
2. Selecciona las fechas **Desde** y **Hasta**.
3. Pulsa **Aplicar** y espera a que termine la carga.
4. Comprueba las fechas antes de interpretar los importes.
5. Revisa los indicadores y las secciones que correspondan a tu consulta.
6. Pulsa **Exportar CSV** si necesitas una copia para abrirla en una hoja de cálculo.

## Qué puedes revisar

| Sección | Qué ayuda a identificar |
| --- | --- |
| Ventas por día | Cómo cambian los resultados entre fechas |
| Métodos de pago | Distribución del dinero registrado por método |
| Ventas por categoría | Participación de los grupos de productos |
| Horarios pico | Horas con mayor actividad |
| Ventas por mesero o cajero | Resultados asociados al personal |
| Control infantil | Indicadores de ingresos y operación infantil |
| Reservas | Actividad y datos de reservas del periodo |
| Stock bajo | Artículos que requieren revisión o reposición |
| Cortes de caja | Resultados y diferencias de los turnos |

## Leer los datos correctamente

Una orden creada, una orden entregada y una orden pagada no representan el mismo momento. Si comparas una cifra con otra pantalla, verifica el periodo, la sucursal y el estado de las cuentas.

El saldo de una reserva y su anticipo tampoco sustituyen los pagos del POS. Consulta la reserva y la caja según el tipo de operación que estés conciliando.

**Si una sección está vacía:** revisa las fechas, los filtros y si existen operaciones del tipo consultado. Una pantalla vacía no confirma por sí sola una falla del sistema.

El archivo CSV es una exportación de consulta. Modificarlo no cambia los datos de PlayCoffee.

# 15 Usuarios y administración del acceso

## Crear un usuario

1. Entra a **Usuarios** con un perfil autorizado.
2. Pulsa **Nuevo usuario**.
3. Captura nombre, apellido y correo electrónico.
4. Asigna la contraseña temporal y, si se utilizará, un PIN rápido de cuatro dígitos.
5. Completa teléfono u otros datos opcionales.
6. Selecciona el rol que corresponde al trabajo de la persona.
7. Guarda y comprueba que aparezca como usuario activo.

La lista permite buscar y filtrar por rol o estado. Úsala para localizar a la persona antes de crear otro registro: el correo identifica su acceso.

## Editar un usuario

Localiza a la persona y pulsa **Editar**. Modifica únicamente los datos necesarios y guarda. La creación o modificación de cuentas con un nivel de administración superior está restringida por el rol del responsable.

El administrador gestiona al personal operativo; el super admin puede administrar también perfiles de administrador. No uses una cuenta de alto privilegio como acceso compartido para todo el turno.

## Desactivar o retirar un acceso

Cuando una persona deje de operar, utiliza la acción de desactivación y verifica el nuevo estado. Si necesitas eliminar un registro, lee la confirmación y las restricciones antes de continuar. El sistema protege ciertas acciones sobre la propia cuenta y sobre perfiles superiores.

## Problemas de acceso

- Si la persona no entra, revisa correo, estado activo y credenciales.
- Si no ve una pantalla, comprueba el rol y sus permisos.
- Si el PIN falla, verifica que tenga cuatro dígitos y que se esté usando con el correo correcto.
- Si olvidó sus datos, el administrador debe revisar las opciones de edición de usuario o escalar la recuperación al responsable del sistema.

**Antes de entregar una cuenta nueva:** comprueba con la persona que ve solo los módulos necesarios y explícale cómo cerrar sesión al terminar.

La administración de accesos no sustituye la apertura de caja. Un cajero con usuario válido necesita un turno abierto para registrar pagos.

# 16 Configuración de sucursal precios y propinas

## Datos de la sucursal

1. Entra a **Configuración → Sucursal**.
2. Revisa nombre, dirección, teléfono, correo, moneda y zona horaria.
3. Modifica los datos necesarios y pulsa **Guardar cambios**.
4. Espera el mensaje de confirmación.

Los impuestos se configuran por producto en el catálogo. La indicación de impuestos en la sucursal no sustituye esos porcentajes individuales.

## Tarifas infantiles

1. Entra a **Configuración → Control Infantil**.
2. En **Precios de tiempo**, captura el **Precio por hora** y el **Precio por media hora adicional**.
3. Usa importes iguales o mayores que cero, con hasta dos decimales.
4. Pulsa **Guardar precios**.
5. Comprueba la confirmación y, en un nuevo registro infantil, revisa los precios que se muestran.

Las tarifas se guardan por sucursal y se aplican a nuevos ingresos. Los accesos en curso conservan los precios originales. Cambiar el precio no modifica retroactivamente las cuentas de esos ingresos.

La primera hora y cada media hora adicional son importes independientes. No es obligatorio que la media hora cueste exactamente la mitad.

## Propinas del POS

En **Configuración → POS**, revisa **Propina habilitada**, el porcentaje predeterminado y los porcentajes sugeridos. Guarda y comprueba el resultado en la pantalla de pago. Los porcentajes sugeridos se capturan separados por comas, por ejemplo, 10, 15, 20.

La selección de propina al cobrar está disponible antes de que existan pagos sobre la cuenta.

## Ajustes visibles que requieren precaución

En esta versión, varios controles de configuración no tienen guardado operativo completo: tiempo máximo infantil, porcentaje de advertencia, pulsera obligatoria, aviso automático al tutor y preferencias generales de notificaciones. Tampoco todos los interruptores operativos del POS se persisten como las propinas.

**Para trabajar:** confirma las reglas efectivas con el administrador y verifica el resultado en la operación. No prometas una notificación al tutor, un correo o un cambio de tiempo únicamente porque el interruptor aparezca activo.

# 17 Impresoras precuentas y comprobantes

## Diferenciar los documentos

| Documento | Cuándo utilizarlo | Efecto sobre el pago |
| --- | --- | --- |
| Comanda de cocina o barra | Informar productos que deben prepararse | No cobra la cuenta |
| Precuenta | Mostrar el consumo y saldo antes del pago | No confirma un cobro |
| Comprobante del negocio | Consultar o imprimir el documento de una cuenta liquidada | Refleja el cobro ya confirmado |

## Configurar las impresoras

Esta tarea corresponde al administrador y puede requerir apoyo técnico para la instalación física.

1. Entra a **Configuración → Impresoras**.
2. Usa **Detectar impresoras** para consultar las instaladas en el servidor.
3. Asigna la impresora de Caja, Cocina y Barra según corresponda.
4. Para una impresora local, utiliza el nombre exacto instalado en el servidor. Para una de red, captura su dirección con el formato que muestra la pantalla.
5. Selecciona el ancho de papel de 58 u 80 mm.
6. Revisa impresión automática, modo de tickets, confirmación de cierre y reimpresión autorizada.
7. Pulsa **Guardar impresoras** y realiza una prueba.

**La impresora local es la instalada en el servidor**, no necesariamente la conectada a la tablet. El servidor y el servicio de impresión deben permanecer activos.

## Imprimir durante la operación

Para un ticket abierto utiliza **Imprimir precuenta**, revisa la vista previa y envía el documento cuando corresponda. Para una cuenta liquidada, utiliza **Comprobante negocio** y revisa su estado de impresión.

Si se permite reimpresión, captura el motivo solicitado. Para comandas anteriores utiliza su flujo específico por lotes en Comandero.

## Si el papel no sale

Revisa encendido, papel, tapa, conexión y destino de la impresora. Un trabajo en cola o en proceso todavía puede salir; revisa su estado antes de reenviarlo. Si falla, informa al responsable con el número de ticket y el mensaje.

**Una falla de impresión no significa una falla de pago.** Comprueba el saldo y los pagos aplicados; no registres otro pago para intentar imprimir de nuevo.

# 18 Áreas distribución y conexión

## Administrar áreas

Un administrador puede entrar a **Configuración → Áreas** para crear, editar, ordenar, activar o desactivar espacios del negocio. Usa nombres fáciles de reconocer, por ejemplo, Salón, Terraza o Área infantil.

Antes de retirar un área, revisa sus mesas y reservas. Si el sistema bloquea la acción por información relacionada, consulta al responsable en lugar de intentar eliminar registros operativos para liberar el espacio.

## Editar la distribución de mesas

1. Entra a **Mesas** y selecciona el área.
2. Usa la opción de edición de distribución.
3. Agrega mesas o selecciona una existente para ajustar su número, capacidad, forma o posición.
4. Comprueba que la distribución sea fácil de identificar para el personal.
5. Guarda para aplicar los cambios o cancela para salir sin aplicarlos.

No intentes eliminar mesas ocupadas o con cuentas relacionadas. Los cambios de distribución se preparan antes del servicio o bajo coordinación del encargado.

## Entender los avisos de conexión

- **Conectado:** la conexión de eventos en tiempo real está activa.
- **Reconectando o Sin realtime:** la actualización inmediata está interrumpida. Comprueba la conexión y usa Actualizar cuando esté disponible.
- **Sin conexión con el servidor local:** el navegador no pudo comprobar que el servidor responde. Conserva las operaciones pendientes y comunica el incidente.
- **Sin internet y servidor local disponible:** la operación puede continuar en la red local mientras el servidor responda.

La conexión al servidor local y el acceso a internet son cosas distintas. Una tablet debe estar conectada a una red que pueda alcanzar la computadora del servidor.

## Notificaciones e instalación

La campana reúne avisos operativos de órdenes, pagos y accesos infantiles que recibe la sesión. No es un historial completo de todas las operaciones ni incluye actualmente el aviso general de stock bajo.

Si aparece **Instalar PlayCoffee**, puedes instalar el acceso desde el navegador. La instalación no permite cobrar sin conexión al servidor. Mantén encendido el servidor y usa la dirección indicada por el encargado.

# 19 Problemas frecuentes y solución

## No permite cobrar

1. Revisa si la caja está abierta. Si no lo está, entra a **Corte de Caja**, abre el turno y regresa al POS.
2. Si la cuenta tiene niños activos, registra primero su salida.
3. Si hay productos nuevos en el carrito de una cuenta existente, agrégalos al ticket.
4. Revisa que el monto sea válido y no exceda el saldo cuando uses tarjeta o transferencia.
5. Si el aviso menciona existencias, consulta el inventario vinculado y el stock disponible.

## La cuenta infantil no aparece al regresar

Busca en **Caja / POS → Cuentas pendientes sin mesa**. Si estaba vinculada a mesa, selecciona esa mesa. También puedes usar **Ir a cobrar** del registro infantil. Revisa número de ticket y saldo antes de crear una cuenta nueva.

## No cargan órdenes inventario o control infantil

Comprueba si aparece el aviso de desconexión y si otras pantallas responden. No interpretes el mensaje genérico “verifica que la API esté disponible” como prueba de que la cuenta se borró. Informa al responsable del módulo y del momento en que ocurrió. Los errores de servicio o base de datos deben revisarse con soporte.

## No puedo confirmar si se registró un pago

Conserva la pantalla, revisa saldo y pagos aplicados y espera la confirmación. Si se indicó que el servidor confirmó el pago, no vuelvas a cobrar. Si el estado sigue incierto, solicita revisión con número de ticket, importe, método y hora aproximada.

## El inventario no se descuenta

Comprueba que el producto tenga **Controlar inventario** activo, que exista un artículo vinculado en la misma sucursal y que la cuenta esté completamente liquidada. Un artículo sin producto ligado no se descuenta automáticamente por vender un producto del catálogo.

## La reserva no se guarda o la impresora no responde

Para reservas, revisa inicio y fin, área, cruces de horario, paquete y anticipo. Para impresión, revisa papel, conexión, destino y estado del trabajo. No repitas un pago para resolver una falla de papel.

**Al pedir ayuda:** comunica la pantalla, número de ticket o reserva, hora aproximada, acción realizada y texto exacto del aviso. No compartas contraseñas ni PIN.

# 20 Consulta rápida y glosario

## Qué hacer según la situación

| Necesito | Dónde ir |
| --- | --- |
| Abrir el fondo del día | Corte de Caja → Abrir caja |
| Registrar consumo de una mesa | Mesas → seleccionar mesa → Agregar al ticket |
| Cobrar una cuenta sin mesa | Caja / POS → Cuentas pendientes sin mesa |
| Registrar un pago dividido | Caja / POS → Cobrar → Agregar Pago por cada parte |
| Registrar un niño | Control Infantil → registro de ingreso |
| Terminar y cobrar una estancia | Control Infantil → Finalizar acceso → Ir a cobrar |
| Cambiar tarifas infantiles | Configuración → Control Infantil → Guardar precios |
| Saber cuántas aguas quedan | Inventario → Stock → buscar el artículo |
| Ingresar botellas recibidas | Inventario → movimiento → Entrada |
| Revisar una fiesta | Reservas → Calendario |
| Consultar resultados | Reportes → fechas → Aplicar |
| Repetir una impresión | Usar la reimpresión del documento correspondiente |

## Palabras del sistema

- **POS:** pantalla de venta y cobro.
- **Ticket o cuenta:** registro de consumos y cargos de un cliente.
- **Comanda:** instrucciones de productos que deben prepararse.
- **Saldo:** importe que todavía falta pagar.
- **Pago parcial:** abono que cubre solo una parte del saldo.
- **Turno de caja:** periodo entre la apertura y el cierre de caja.
- **Fondo inicial:** efectivo disponible al abrir el turno.
- **Arqueo:** conteo físico del dinero para compararlo con el esperado.
- **Stock:** cantidad registrada de un artículo.
- **Stock mínimo:** umbral que identifica existencias bajas.
- **Merma:** pérdida de existencias por daño, caducidad u otro motivo.
- **Tolerancia infantil:** margen registrado después del tiempo contratado.

## Comprobaciones al terminar el día

Confirma cuentas pendientes y niños activos; revisa incidencias de pago e impresión; cuenta el efectivo; registra movimientos pendientes; realiza el cierre y verifica el historial. Después cierra sesión y coordina con el encargado cuándo se puede apagar el servidor.

**Antes de repetir cualquier operación, comprueba su resultado.** Esto evita duplicar productos, pagos, movimientos de inventario y documentos.
