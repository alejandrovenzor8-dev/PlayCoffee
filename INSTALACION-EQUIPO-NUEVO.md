# Instalar PlayCoffee en el equipo definitivo

Este paquete es para **Windows 10/11 de 64 bits, Intel o AMD**, con una **base nueva**. No contiene los usuarios, ventas ni menu de la computadora de desarrollo. La version **con-postgresql** incluye los instaladores verificados de Node.js y PostgreSQL en `prerequisites`; los copia sin descargarlos en el equipo definitivo. La version ligera los descarga. Ambas versiones necesitan Internet para pnpm y las dependencias de la aplicacion, y compilan el sistema en el equipo definitivo. Necesitas una cuenta administradora de Windows y espacio libre para las dependencias y la base (recomendado: 10 GB libres y 8 GB de RAM).

## Pasos

1. Copia el ZIP al equipo definitivo y elige **Extraer todo**. No ejecutes archivos dentro del ZIP. Puedes extraerlo en Descargas o en una memoria USB.
2. Abre la carpeta extraida `PlayCoffee-Instalador`.
3. Haz clic derecho sobre **INSTALAR.cmd** y elige **Ejecutar como administrador**. Hazlo con la cuenta de Windows que se usara diariamente para el servidor.
4. Confirma la IP que se muestra (debe ser la del equipo definitivo, no la del equipo anterior). Si Windows pregunta por el perfil privado, acepta solamente si estas conectado a la red del negocio.
5. Escribe el nombre de la sucursal, el correo del administrador y una contrasena nueva de al menos 12 caracteres. Guarda esos datos: **no hay una contrasena predeterminada**.
6. Define las tarifas de una hora infantil y media hora extra. Se sugieren $99 y $49, pero puedes cambiarlas durante la instalacion.
7. Espera hasta que aparezca **Instalacion verificada**. Se comprueban los servicios, el respaldo, HTTPS y el acceso del administrador. Si se produce un error, corrige lo indicado y vuelve a ejecutar INSTALAR; no borres la base ni la carpeta de datos.
8. Abre **PlayCoffee** desde el escritorio e ingresa con la cuenta que creaste.

Si ya existe PostgreSQL 18, se pedira su puerto y la contrasena de su usuario `postgres`. El instalador crea una base y un usuario propios, sin borrar bases existentes. Si PostgreSQL no esta instalado, se instala automaticamente. Si el puerto 5432 esta ocupado por otra version o programa, el instalador se detiene para evitar modificarlo.

Si el instalador anterior fallo al descargar PostgreSQL, extrae el nuevo ZIP **con-postgresql** en otra carpeta y ejecuta su `INSTALAR.cmd` como administrador. Conserva `C:\ProgramData\PlayCoffee`: contiene el estado necesario para reanudar. No desinstales PostgreSQL ni borres bases para reintentar. El paquete nuevo incluye tambien los avisos de cierre de caja. Si vuelve a fallar, el paso exacto y el mensaje quedan en `C:\ProgramData\PlayCoffee\ultimo-error-instalacion.txt`.

## Antes de atender al cliente

- Configura categorias, productos, precios, destinos de cocina/barra, mesas y usuarios. La base incluye solamente el administrador y los dos conceptos de cobro infantil; **no incluye un menu de ejemplo**.
- Revisa las reglas del area infantil en Configuracion: periodo de gracia, avisos y descuentos, ademas de las tarifas elegidas.
- Configura y prueba las impresoras fisicas. Las impresoras de Windows deben estar disponibles para la cuenta que inicia el servidor.
- En **Corte de Caja**, pulsa **Abrir caja**. El sistema exige caja abierta para efectivo, tarjeta y transferencia.
- Mientras la caja siga abierta, cajeros y administradores veran un recordatorio de cierre. Si la apertura pertenece a un dia anterior en la zona horaria de la sucursal, el aviso se destaca en rojo. Al cerrar sesion se solicita confirmacion si el corte esta pendiente. Los demas dispositivos actualizan el aviso cada 30 segundos o al volver a la aplicacion. Apagar Windows no realiza el corte: cierra la caja y respalda antes de apagar.
- Prueba una orden de cocina/barra entre dos dispositivos, un pago dividido y una entrada/salida infantil antes de comenzar la operacion real.

## Tablets, cocina, barra y otras computadoras

En el escritorio se creara `PlayCoffee-LEEME.txt` con la direccion exacta, por ejemplo `https://192.168.1.50:3443`. Todos los dispositivos deben estar en la misma red local, con acceso entre clientes habilitado (evita la red Wi-Fi de invitados).

Instala en cada dispositivo el certificado publico `PlayCoffee-certificado-tablets.cer`, tambien ubicado en el escritorio. En otro Windows, importalo en **Entidades de certificacion raiz de confianza**. En Android, usa la opcion de instalar certificado CA de la configuracion de seguridad. En iPhone/iPad, instala el perfil y habilita la confianza completa en Configuracion > General > Informacion > Configuracion de confianza de certificados. Despues abre la direccion indicada. No distribuyas archivos `.pfx` ni `server.env`.

Reserva la IP del equipo definitivo en el router para que no cambie al reiniciar. El servidor debe permanecer encendido, conectado a la red y sin suspenderse durante el servicio. Se habilita el puerto 3443 para el perfil privado del Firewall de Windows.

## Arranque, respaldo y ubicaciones

- Programa: `C:\PlayCoffee`.
- Configuracion y datos auxiliares: `C:\ProgramData\PlayCoffee`.
- Base PostgreSQL: administrada por el servicio de PostgreSQL 18.
- Respaldos: `C:\ProgramData\PlayCoffee\backups`. Se programa uno diario a las 02:00 (al volver a estar disponible si se omitio), conservando 30 dias. Copia regularmente los respaldos a otro medio; la copia local no protege contra una falla del disco.
- Logs: `C:\ProgramData\PlayCoffee\logs`.
- Arranque automatico: **al iniciar sesion en Windows con la cuenta que instalo**. PostgreSQL arranca como servicio de Windows. Si aun no se ha iniciado sesion, la aplicacion no arranca.
- Accesos en el escritorio: **PlayCoffee**, **Iniciar PlayCoffee** y **Respaldar PlayCoffee**.

No ejecutes `setup.ps1`, `db:reset` ni `db:seed` sobre esta instalacion: son herramientas de desarrollo. No reinstales para cambiar el menu. Una instalacion ya completada no se sobrescribe al volver a ejecutar INSTALAR.

## Procedencia y verificacion

El ZIP tiene un archivo `.sha256` y un manifiesto interno por archivo. El instalador valida los hashes antes de copiar. No contiene dependencias preinstaladas de la aplicacion, datos de clientes, archivos `.env` ni credenciales de desarrollo. La version con-postgresql incluye los archivos oficiales de instalacion indicados abajo, sin instalarlos en la computadora donde se prepara el paquete.

Descargas fijadas y comprobadas mediante SHA-256:

- [Node.js 22.23.4, distribucion oficial](https://nodejs.org/dist/v22.23.4/).
- [PostgreSQL 18.6-5, distribucion EDB](https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64.exe), hash contrastado con el [manifiesto de Microsoft WinGet](https://github.com/microsoft/winget-pkgs/blob/master/manifests/p/PostgreSQL/PostgreSQL/18/18.6-5/PostgreSQL.PostgreSQL.18.installer.yaml).
- pnpm 9.15.9, con las versiones de dependencias fijadas en `pnpm-lock.yaml`.

Las opciones del instalador PostgreSQL siguen la [documentacion de EDB](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/).
