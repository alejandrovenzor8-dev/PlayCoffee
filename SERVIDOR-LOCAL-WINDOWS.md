# Servidor local de PlayCoffee para Windows

Este runtime convierte la computadora principal de la sucursal en el servidor de PlayCoffee. Las tablets se conectan a ella por la red Wi-Fi local y no dependen de Railway para operar dentro del negocio.

## Alcance actual

- Ejecuta PostgreSQL, backend y frontend localmente.
- Aplica migraciones antes de iniciar.
- Mantiene frontend y API escuchando en la red local.
- Publica ambos servicios bajo un unico origen HTTPS para instalar la PWA.
- Arranca los procesos sin ventanas visibles.
- Guarda PID y hora de inicio para no detener procesos ajenos.
- Comprueba frontend, API y base de datos.
- Conserva logs separados.
- Genera respaldos PostgreSQL con retencion configurable.
- Programa un respaldo diario a las 02:00 cuando se solicita inicio automatico.
- Puede iniciar PlayCoffee automaticamente al entrar a Windows.
- Ejecuta el agente de impresion ESC/POS y conserva una cola persistente.

La PWA, HTTPS local y el agente de impresion ya estan incluidos.

## Requisitos

- Windows 10/11.
- Node.js disponible en `PATH`.
- Corepack y pnpm.
- PostgreSQL ejecutandose como servicio local.
- IP reservada para la computadora en el router.
- Build ejecutado desde una copia estable del proyecto, no desde una carpeta temporal.

## Instalacion

## Preparar el paquete desde la computadora de desarrollo

No se instala el servidor en la computadora usada para programar. Desde ella se genera un paquete sin `.env`, contraseñas, base de datos, `node_modules` ni artefactos temporales:

```powershell
.\scripts\local-server\new-pilot-package.ps1 -Version piloto-1
```

El resultado queda en `releases\PlayCoffee-Pilot-piloto-1.zip`, acompañado por su archivo `.sha256`. Copia ambos al equipo definitivo y verifica el hash antes de descomprimir.

Abre PowerShell en la raiz del proyecto. Sustituye la IP por la reservada para la computadora:

Primero ejecuta el diagnostico, que no modifica el equipo:

```powershell
.\scripts\local-server\test-installation-readiness.ps1 `
  -LanAddress 192.168.1.50 `
  -DatabaseUrl 'postgresql://usuario:contrasena@localhost:5432/playcoffee' `
  -RequireAdministrator
```

```powershell
.\scripts\local-server\install-local-server.ps1 `
  -LanAddress 192.168.1.50 `
  -RegisterStartup `
  -ConfigureFirewall
```

El instalador reutiliza `DATABASE_URL` de `apps/backend/.env`, exige que PostgreSQL sea local, genera secretos JWT nuevos, compila producción e inicia los servicios.

Antes de hacer cambios, el instalador ejecuta el diagnostico. Al terminar verifica procesos, HTTPS y certificados, y crea un respaldo PostgreSQL de prueba. Si alguna verificacion falla, la instalacion no se considera terminada.

También genera una autoridad certificadora exclusiva de la sucursal y un certificado con la IP indicada. La clave privada del servidor permanece en la computadora principal. El archivo público que debe instalarse en las tablets queda en:

```text
C:\ProgramData\PlayCoffee\certificates\playcoffee-local-ca.cer
```

En iPad/iPhone se instala el perfil y después se habilita la confianza completa en **Configuración > General > Información > Configuración de confianza de certificados**. En Android se instala como certificado CA desde las opciones de seguridad. Nunca distribuyas el archivo `.pfx` ni su contraseña.

También puede recibir una URL explícita:

```powershell
.\scripts\local-server\install-local-server.ps1 `
  -LanAddress 192.168.1.50 `
  -DatabaseUrl 'postgresql://usuario:contrasena@localhost:5432/playcoffee'
```

La configuración real queda en `scripts/local-server/server.env`, ignorada por Git. Logs, respaldos y estado se guardan por defecto en `C:\ProgramData\PlayCoffee`.

## Operacion

```powershell
# Estado y diagnostico
.\scripts\local-server\status-local-server.ps1

# Verificacion completa posterior, incluyendo respaldo
.\scripts\local-server\verify-local-installation.ps1 -TestBackup

# Detener
.\scripts\local-server\stop-local-server.ps1

# Iniciar
.\scripts\local-server\start-local-server.ps1

# Respaldo con retencion de 30 dias
.\scripts\local-server\backup-local-server.ps1

# Quitar inicio automatico
.\scripts\local-server\unregister-startup.ps1
```

## Impresoras de tickets

En PlayCoffee abre **Configuracion > Impresoras** y asigna los destinos de caja, cocina y barra.

- Impresora Ethernet/Wi-Fi ESC/POS: `tcp://192.168.1.61:9100`
- Impresora instalada en Windows: `windows:///Nombre de la impresora`
- Prueba sin papel: `file:///prueba`

Se recomienda reservar una IP para cada impresora en el router. Los trabajos permanecen en PostgreSQL, cada impresora falla de forma independiente y el agente reintenta con espera creciente hasta ocho veces. Los trabajos de prueba se guardan en `C:\ProgramData\PlayCoffee\test-prints`.

En la misma pantalla se puede activar o desactivar por separado:

- Comandas automaticas de cocina al enviar productos nuevos.
- Comandas automaticas de barra al enviar productos nuevos.
- Ticket automatico de caja cuando la orden queda totalmente pagada.

Una comanda automatica incluye solamente los productos nuevos de su estacion; agregar otro producto no vuelve a imprimir los anteriores. Si una estacion no tiene destino configurado, se omite sin impedir la venta.

Desde **Comandero**, abre Cliente, Cocina o Barra y pulsa **Enviar a impresora**. El botón **Imprimir** sigue disponible como respaldo mediante el diálogo del navegador.

## Red

Los puertos utilizados son:

- TCP 3000: interfaz web interna detrás del proxy HTTPS.
- TCP 3001: API y Socket.io internos.
- TCP 3443: origen HTTPS para computadora y tablets.
- TCP 5432: PostgreSQL; debe permanecer bloqueado para otros equipos.

Sólo el puerto HTTPS 3443 se permite en el Firewall de Windows para el perfil de red privada cuando se usa `-ConfigureFirewall`. Los puertos 3000, 3001 y PostgreSQL permanecen internos. Esta opción requiere abrir PowerShell como administrador.

Una vez confiado el certificado, abre `https://IP-DE-LA-COMPUTADORA:3443`. Chrome/Edge mostrará **Instalar PlayCoffee**; en Safari se usa **Compartir > Agregar a pantalla de inicio**.

## Recuperacion

Si el diagnóstico falla, revisa:

- `C:\ProgramData\PlayCoffee\logs\backend.error.log`
- `C:\ProgramData\PlayCoffee\logs\frontend.error.log`
- `C:\ProgramData\PlayCoffee\logs\print-agent.error.log`

No borres manualmente `processes.json` mientras existan procesos activos. Usa primero `stop-local-server.ps1`.
