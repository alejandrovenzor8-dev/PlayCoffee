# Actualizacion de PlayCoffee

## Correccion de conexion en celulares HTTPS

El paquete Conexion-Celulares incluye las tres mejoras de Cuentas-Reportes-Correcciones y corrige la eleccion de direcciones en instalaciones locales. Cuando se abre https://IP-DEL-SERVIDOR:3443, la API, el control de salud y el tiempo real usan esa misma direccion y puerto, aunque NEXT_PUBLIC_API_URL o NEXT_PUBLIC_WS_URL hayan quedado compiladas con una IP anterior o con http. No se cambia la IP de Windows, no se desactiva la validacion de certificados ni se modifican datos de la base.

Las instalaciones de nube con frontend y API separados conservan sus direcciones configuradas. Para desarrollo o instalaciones antiguas en HTTP, la API pasa por el frontend y el tiempo real conecta al backend local.

Se actualiza la version de cache de la aplicacion para retirar recursos anteriores. Al terminar ACTUALIZAR.cmd y confirmar que no hay operaciones pendientes, recarga cada celular en la direccion HTTPS correcta. Si usas un acceso instalado, abre tambien esa direccion en Safari o Chrome y vuelve a entrar. No es necesario reinstalar PostgreSQL ni restablecer la base de datos.

Verificacion de esta correccion: cinco pruebas de direcciones, compilacion de produccion y prueba en navegador con IP antigua configurada. La prueba simula https://192.168.1.80:3443, verifica inicio de sesion, consulta de cuentas, /health y wss en el puerto 3443, sin contactar al equipo del cliente. La comprobacion final debe realizarse en los celulares de la sucursal despues de instalar.

## Nueva actualizacion Cuentas Reportes Correcciones

Paquete del 18 de noviembre de 2026 que agrega tres funciones:

1. En Caja / POS, selecciona una cuenta pendiente sin mesa y pulsa **Borrar cuenta sin mesa**. Revisa el numero, escribe el motivo y pulsa **Confirmar borrado**. La cuenta queda cancelada, deja de aparecer entre pendientes y conserva su historial. No se permiten cuentas con pagos registrados o en proceso, accesos infantiles sin finalizar ni envios de comanda en proceso.
2. En Reportes aparece **Comandas del periodo**, con todas las cuentas creadas dentro de las fechas Desde y Hasta, incluidos ambos dias segun la zona horaria de la sucursal. Incluye pendientes, pagadas y canceladas, productos, mesa, responsable, total, pagado y saldo. Permite exportar las comandas a CSV. Las canceladas se identifican con su estado y no tienen saldo por cobrar.
3. En Caja / POS se muestran los **Productos de la cuenta**, tambien dentro de la pantalla de cobro. Usa **Corregir**, ajusta la cantidad (0 elimina el producto), escribe el motivo y guarda. Se recalcula el total y se conserva la linea original como cancelada. Solo se permite antes de recibir pagos; los cargos infantiles se corrigen desde Control Infantil. Si ya se envio un producto a preparacion, se genera un aviso de cancelacion a su estacion y se conserva el historial del envio.

Estas funciones no requieren nuevas migraciones. Si vienes de una version antigua, el actualizador aplica las migraciones pendientes que ya formen parte del paquete. No borres carpetas ni reinstales PostgreSQL para actualizar.

Pruebas de esta version: 33 comprobaciones de backend, recorrido de navegador con operaciones simuladas y consulta de fechas en PostgreSQL local. La revision fisica de las impresoras de la sucursal sigue pendiente y debe realizarse antes de usar las cancelaciones de productos enviados durante el servicio.

## Paquete del 18 de noviembre de 2026

Esta actualizacion incluye los cambios actuales del sistema:

- Edicion de precio por hora y media hora adicional en Configuracion > Control Infantil, con el boton Guardar precios. Los ingresos en curso conservan sus tarifas originales.
- Recuperacion de la cuenta seleccionada al salir del POS para abrir caja y regresar.
- Selector Cuentas pendientes sin mesa para retomar cuentas infantiles y otras ventas abiertas sin mesa.
- Conexion local sin depender de una IP antigua en la configuracion de desarrollo.
- Migraciones pendientes de la base de datos, aplicadas por el proceso de arranque despues del respaldo.
- Manual de usuario en PDF y Word editable dentro de docs\manual-usuario.

No vuelvas a instalar el sistema para aplicar estas mejoras. Usa ACTUALIZAR.cmd desde la carpeta extraida de este paquete.

## Alcance del paquete

Paquete para una instalacion existente del servidor Windows. Incluye comandas incrementales, correcciones autorizadas, reutilizacion de mesas y el flujo de tres impresoras con precuenta y copia del negocio.

**Primero validar en staging con las tres impresoras reales. No aplicar a produccion hasta completar esa prueba.** Las pruebas automaticas pasaron; no sustituyen la validacion fisica de papel, corte, destinos y cajon.

## Antes de actualizar

- Leer GUIA-TRES-IMPRESORAS.md y DIAGNOSTICO-PRODUCCION.md incluidos en este paquete.
- Confirmar que se actualiza la computadora Windows del servidor local. Los telefonos/tablets de meseros solo necesitaran recargar la pagina.
- Terminar operaciones, liquidar las mesas, registrar las salidas infantiles y cerrar caja. Revisar la cola de impresion antes de detener el agente.
- Revisar en staging que no existan dos ordenes activas para una mesa; la nueva restriccion rechaza esos duplicados sin borrarlos o fusionarlos. La consulta de revision esta en DIAGNOSTICO-PRODUCCION.md.
- Tener disponible una copia de respaldo fuera del disco del servidor y conexion a Internet para instalar las dependencias que falten.

## Aplicar el paquete en el equipo destino

1. Copiar el ZIP y su archivo .sha256 al servidor. Comprobar el hash SHA-256 con Get-FileHash antes de extraerlo.
2. Extraer el ZIP en Descargas, fuera de C:\PlayCoffee y de la carpeta del programa instalado.
3. Ejecutar **ACTUALIZAR.cmd como administrador**, usando la cuenta de Windows que instalo y ejecuta PlayCoffee. No usar un instalador nuevo para actualizar.
4. El actualizador usa la instalacion identificada por C:\ProgramData\PlayCoffee\server.env. Revisar la ruta que muestra y escribir **ACTUALIZAR** para continuar.
5. Esperar a que termine. No abrir Iniciar PlayCoffee ni apagar Windows durante el proceso.
6. Al ver ACTUALIZACION COMPLETADA, recargar PlayCoffee en todos los dispositivos. Guardar las opciones de caja y recargar tambien los POS abiertos para que tomen la nueva politica.
7. En Configuracion > Impresoras asignar por separado Cocina, Barra y Caja. Probar fisicamente cada destino y confirmar los escenarios de la guia.

El paquete de actualizacion no incluye INSTALAR.cmd ni instaladores de PostgreSQL/Node. El programa se compila en el equipo destino con las dependencias fijadas por pnpm-lock.yaml; no es un paquete offline de binarios precompilados.

## Que conserva y que cambia

El actualizador conserva server.env, certificados, credenciales y la base existente. No ejecuta seed, db:reset ni una reinstalacion de PostgreSQL. Detiene solo los procesos identificados como esta instalacion, verifica que no haya puertos ocupados por procesos ajenos y aplica las migraciones pendientes al iniciar la nueva version.

Antes de reemplazar archivos crea un respaldo PostgreSQL y comprueba que pg_restore pueda leerlo. Guarda el programa anterior y server.env en la carpeta privada PLAYCOFFEE_DATA\updates\FECHA-HORA (habitualmente C:\ProgramData\PlayCoffee\updates). No compartir esa carpeta: contiene configuracion privada. Copiar el respaldo tambien a otro disco.

Las migraciones nuevas permiten pruebas de impresora sin venta, estado de envio por producto, una sola orden activa por mesa, claves de reintento y comprobantes definitivos retenidos para impresion manual. No borran ventas ni pagos. Los productos anteriores al seguimiento incremental quedan LEGACY: no se reenviaran automaticamente y requieren revision si aun hay cuentas abiertas.

Actualizar juntos backend, frontend y agente/renderizador incluidos. El agente anterior no distingue las nuevas precuentas de las copias del negocio.

## Comentarios de preparacion por producto

En Mesas y POS, agrega el producto y escribe debajo en **Comentarios de preparacion**: por ejemplo, bien cocidos, tiernitos o sin cebolla. El comentario se guarda con ese producto y aparece como NOTA en la comanda de su estacion.

Si hay dos porciones del mismo producto con preparaciones distintas, pulsa **Separar 1** y escribe el comentario de cada una. Separar no aumenta la cantidad ni cambia el total. Si agregas otra vez un producto que ya tiene comentarios, se crea una linea nueva para no mezclar preparaciones. Los comentarios admiten varias lineas y se siguen viendo en el ticket guardado.

Antes de enviar se pueden editar libremente. Despues del envio se usa Corregir en Comandero con la autorizacion existente y aviso a cocina; no se cambia silenciosamente una comanda enviada ni una venta pagada. Esta mejora usa el campo notes existente y no requiere otra migracion.

Este paquete incluye todos los cambios del paquete Comandas-Caja anterior y agrega estas mejoras.

## Pedidos largos y pantallas pequenas

La lista de productos tiene desplazamiento propio en Mesas y POS; no se recorta al agregar productos. Se puede llegar al ultimo producto, sus comentarios y las acciones de la cuenta.

En celulares, tablets y ventanas menores de 1024 px aparecen dos vistas: **Productos** para elegir y **Comanda** para revisar cantidades, comentarios y enviar. El contador indica lo agregado. En POS se muestra Agregar al ticket mientras hay productos pendientes y Cobrar cuando ya estan guardados. Limpiar carrito esta en el encabezado y conserva la mesa elegida. En computadora se mantienen ambos paneles lado a lado. La adaptacion depende del ancho de la ventana, sin tener que configurar el tipo de dispositivo.

Los botones tactiles y campos de captura son mas grandes en pantallas pequenas. Los menus de areas/categorias se desplazan cuando no caben, y la barra inferior de navegacion conserva su espacio para no tapar las acciones. Si la pantalla es muy baja o aparece el teclado, el panel tambien permite desplazarse para alcanzar las acciones.

## Operacion despues de actualizar

- Cocina recibe solo alimentos nuevos y sus correcciones. Barra recibe bebidas nuevas y sus correcciones.
- Caja tiene modo Solo negocio o Cliente + negocio. Solo el segundo muestra Imprimir precuenta; imprimirla no cobra ni cierra.
- El ultimo pago cierra la orden, libera la mesa y guarda una copia del negocio con sus importes definitivos. La impresora desconectada no revierte un pago confirmado.
- Si falta configurar caja o la impresion automatica esta deshabilitada, el comprobante queda guardado y retenido (HELD), disponible para primera impresion manual.
- Reimprimir exige cajero/administrador, motivo y confirmacion. No genera otro pago. Las precuentas y reimpresiones no abren el cajon; la primera copia del negocio con efectivo puede enviar el pulso ESC/POS al pin 2.
- Si hay ninos sin salida registrada, primero finalizar sus accesos y agregar extras antes del pago final.

## Si algo falla

Conservar el mensaje y el archivo error.txt del respaldo. El sistema puede quedar detenido; no borrar datos, no reinstalar PostgreSQL y no restaurar automaticamente solo el programa. Una migracion aplicada puede necesitar recuperacion coordinada del programa y de la base. Corregir la causa antes de reintentar.

Si el cobro ya aparece confirmado y falla caja, revisar papel, red/spooler y agente; abrir Comprobante negocio desde Comandero > Completadas y solicitar reimpresion autorizada. No registrar otro pago.

La aceptacion del spooler o transporte TCP no confirma papel fisico. Revisar la impresora antes de repetir un trabajo cuyo resultado sea ambiguo.
