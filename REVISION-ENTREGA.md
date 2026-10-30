# Revisión de entrega — 30 de octubre de 2026

Estado: correcciones críticas implementadas y pruebas de software aprobadas; **no constituye aprobación final de entrega**.

## Evidencia ejecutada

- Compilación de producción: backend, frontend y paquete compartido aprobados.
- Backend: 10 pruebas unitarias aprobadas.
- Integración HTTP/BD/WebSocket: 30 aprobadas y 1 omitida preexistente (productos por sucursal; el catálogo actualmente es global).
- Impresión ESC/POS: 2 pruebas aprobadas. No se probó hardware físico.
- ESLint frontend: 0 errores, 11 advertencias existentes. ESLint de archivos backend modificados: aprobado.
- Navegador real automatizado con Playwright, frontend de producción sobre HTTP LAN: login, conexión realtime, cobro de $71.50 en dos pagos de $35.75 (tarjeta y transferencia), cierre exitoso y dos avisos de pago en la campana. Sin errores de consola; advertencia de accesibilidad del diálogo.
- Nuevas pruebas integrales: dos clientes WebSocket reciben el mismo evento, otra sucursal no lo recibe; tickets separados por estación KITCHEN/BAR; edición de precio y estación; inventario con producto repetido; ingreso infantil por cajero/superadministrador y dos salidas simultáneas sin doble extra.

Las pruebas usaron exclusivamente `playcoffee_smoke_20260821`. La prueba de navegador dejó un ticket demo pagado por $71.50 y los datos del seed en esa base. Los servidores temporales y el navegador se detuvieron. No se ejecutó el seed ni se aplicaron migraciones en la base operativa.

## Correcciones

1. Socket.io obtiene el token de la sesión vigente y reconecta al cambiarlo; antes buscaba una clave que ya no escribía el login.
2. Campana conectada a eventos reales de comandas, pagos e ingresos/salidas infantiles, con enlaces y filtro por permisos. Los avisos son de la sesión actual, no un buzón persistente ni notificaciones push/sonoras.
3. Cancelar una orden emite el evento correspondiente. Comandero consulta cada 15 segundos como respaldo ante desconexión.
4. POS retira del carrito los productos que ya se guardaron: el segundo pago no vuelve a tratarlos como extras.
5. Identificador de pago compatible con HTTP LAN mediante `crypto.getRandomValues`, sin exigir `randomUUID` disponible sólo en contexto seguro.
6. División de cuenta en centavos, visualización de propina en tickets cargados y reemplazo de propina previa en backend.
7. Referencia idempotente no puede reutilizarse para otro ticket; inventario lee el saldo actualizado para cada línea repetida.
8. Salida infantil reclama atómicamente el registro dentro de la transacción para impedir cargos extra duplicados.
9. Seed incorpora productos y vínculos infantiles faltantes, sin sobrescribir vínculos existentes. No ejecutar el seed sobre datos operativos para reparar configuración: revisar y completar sólo lo faltante.
10. Superadministrador puede imprimir ticket cliente desde Comandero.
11. Tiempo límite de renovación de sesión; se eliminó la dependencia de claves antiguas de almacenamiento en la API.
12. Orígenes de desarrollo derivados de interfaces locales. `.env.local` y CORS local actualizados para la IP actual `192.168.100.51`; la IP anterior era `192.168.1.158`.

## Pendientes que impiden afirmar “sin fallos”

### Reglas operativas corregidas en la segunda revisión

- **Infantil y prepago, corregido:** al finalizar un acceso prepagado se crea un ticket adicional sólo por los extras. Se conserva el ticket original; el cargo extra queda vinculado por `extraOrderItem`. El botón «Ir a cobrar» abre el nuevo ticket. Prueba con entrada pagada de $99, extra de $49 y salida concurrente aprobada.
- **Cocina/barra y pago anticipado, corregido:** una orden con productos KITCHEN/BAR conserva su estado de preparación y la mesa ocupada al pagar. Al marcarla entregada, se completa si ya está pagada. Si se entrega antes de pagar, se completa al liquidar. Se impide cancelar órdenes con pagos o forzar el cierre de preparación pendiente. Pruebas aprobadas.
- **Caja, corregido:** todo pago nuevo exige turno abierto en la sucursal, para efectivo, tarjeta y transferencia. El POS comprueba caja antes de crear el ticket de cobro y el servidor valida de nuevo dentro de la transacción. Cierre y pago coordinan el mismo turno: el corte incluye el pago o éste se rechaza sin registrar dinero. Prueba concurrente aprobada. El diálogo permite volver al ticket si debe reabrirse caja después de un pago parcial.

### Alcance restante de catálogo
- **Catálogo:** edición de precio y estación comprobada. El catálogo es global, no por sucursal; no se validó un flujo completo para crear categorías/modificadores desde interfaz. Los productos deben tener destino BAR/KITCHEN/NONE configurado; el seed anterior los dejaba en NONE.

### Pruebas en el lugar de instalación

1. Conectar los equipos reales de caja, cocina y barra a la red final. Probar comandas, cancelaciones y reconexión tras pérdida de Wi-Fi.
2. Configurar y probar cada impresora, papel/corte, agente de impresión y recuperación tras fallo. Las pruebas de tickets y cola no sustituyen impresión física.
3. Confirmar IP fija/reserva DHCP, URLs compiladas, CORS y firewall; configurar HTTPS si se usará instalación PWA.
4. Validar datos operativos: productos/destinos, tarifas y vínculos infantiles, apertura/cierre de caja, permisos y copias de seguridad.
5. Aceptar el flujo infantil vigente: primera hora $99, bloques adicionales $49 y 15% a hermanos; el código cobra bloques desde el tiempo contratado al superar tolerancia. La guía TESTING.md contiene referencias antiguas a acceso libre y extras por hora que no describen el comportamiento actual.

## Repetición

Usar `SMOKE_DATABASE_URL` **sólo con una base de pruebas** y migraciones aplicadas:

```powershell
corepack.cmd pnpm --filter backend test -- --runInBand
corepack.cmd pnpm --filter backend test:smoke
node --test scripts/print-agent/escpos-renderer.test.mjs
corepack.cmd pnpm build
corepack.cmd pnpm --filter frontend lint
```

La suite smoke elimina únicamente sus datos por sucursal de prueba; se corrigió una limpieza anterior que seleccionaba pagos por prefijo genérico de folio.
