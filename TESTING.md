# PlayCoffee - Suite funcional de preproduccion

Esta guia valida los flujos criticos antes de salir a produccion. No agrega features nuevas: combina checklist manual, datos minimos de prueba y comandos de verificacion tecnica.

## Preflight tecnico

Ejecutar desde la raiz del monorepo:

```powershell
corepack.cmd pnpm install
corepack.cmd pnpm test:preprod
```

El script `test:preprod` ejecuta:

```powershell
corepack.cmd pnpm lint
corepack.cmd pnpm build
corepack.cmd pnpm db:generate
corepack.cmd pnpm --filter backend exec prisma validate
```

Para validar backend con pruebas Jest existentes:

```powershell
corepack.cmd pnpm --filter backend test
corepack.cmd pnpm --filter backend test:e2e
```

## Ambiente requerido

- Backend corriendo con `NODE_ENV` acorde al ambiente probado.
- Frontend apuntando al backend correcto mediante `NEXT_PUBLIC_API_URL`.
- WebSocket apuntando al backend correcto mediante `NEXT_PUBLIC_WS_URL`.
- Base de datos con migraciones aplicadas.
- Navegador A y navegador B, o dos perfiles, para validar realtime.
- Usuario `ADMIN`, `CASHIER` y `WAITER`.

## Datos seed minimos

Crear estos datos en ambiente de QA/staging antes de iniciar la checklist. En produccion no usar passwords demo ni datos ficticios.

| Tipo | Dato minimo | Uso |
| --- | --- | --- |
| Branch | Sucursal QA | Scope multi-sucursal |
| Usuarios | ADMIN, CASHIER, WAITER | RBAC y 403 |
| Areas | Salon principal, Terraza | Mesas, reservas |
| Mesas | Mesa 1, Mesa 2 | POS y realtime |
| Categorias | Bebidas, Alimentos, Infantil | Reportes e impresion |
| Producto BAR | Cafe QA, precio > 0, `preparationStation=BAR` | Ticket barra |
| Producto KITCHEN | Waffle QA, precio > 0, `preparationStation=KITCHEN` | Ticket cocina |
| Producto NONE | Agua QA, `preparationStation=NONE` | Ticket cliente solamente |
| Producto inventariable | Jugo QA, `trackInventory=true` | Descuento de stock |
| InventoryItem | Stock 5, minimo 2 para Jugo QA | Stock bajo |
| Productos infantiles | Acceso por hora, Acceso libre, Hora extra | Control infantil y POS |
| Settings infantiles | `child_hourly_product_id`, `child_free_product_id`, `child_extra_hour_product_id` | Cargos automaticos |
| Paquete | Fiesta QA, 120 min, precio > 0 | Reservas |

## Criterios de aceptacion globales

- Todo dato operativo se filtra por `branchId` del JWT.
- WAITER no puede cobrar, abrir caja, ver reportes ni administrar reservas.
- ADMIN puede operar todos los modulos dentro de su sucursal.
- CASHIER puede operar POS, caja, pagos, inventario basico, mesas, ordenes y reservas permitidas.
- Ningun flujo critico requiere refrescar manualmente si existe evento realtime.
- Las ventas con pagos divididos no se duplican en caja ni reportes.
- La app sigue funcionando por REST si Socket.io se desconecta.

## Checklist funcional

Registrar resultado con `OK`, `FALLA` o `N/A`, mas evidencia cuando aplique.

### 1. Login y permisos

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| ADMIN login | Iniciar sesion como ADMIN | Acceso a dashboard, usuarios, sucursales, reportes, caja y POS |  |
| CASHIER login | Iniciar sesion como CASHIER | Acceso a POS, pagos, caja, inventario basico, mesas, ordenes y reservas operativas |  |
| WAITER login | Iniciar sesion como WAITER | Acceso solo a mesas, ordenes/comandas y productos necesarios |  |
| WAITER bloqueado | Intentar entrar a caja, pagos, reportes o usuarios | HTTP 403 o pantalla de acceso denegado clara |  |
| CASHIER bloqueado admin | Intentar administrar usuarios, sucursales o configuracion critica | HTTP 403 o acceso denegado |  |

### 2. Mesas

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Crear area | ADMIN crea area nueva | Area visible solo en sucursal actual |  |
| Crear mesa | ADMIN/CASHIER crea mesa en area | Mesa aparece en layout |  |
| Mover mesa | Arrastrar mesa en editor/layout | Posicion persiste al recargar |  |
| Cambiar estado | Cambiar libre/ocupada/reservada | Estado visual y backend sincronizados |  |
| Realtime mesas | Abrir dos ventanas y cambiar estado en una | La otra ventana actualiza sin recargar |  |

### 3. POS y pagos divididos

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Crear orden | Desde POS seleccionar mesa y crear orden | Orden abierta con folio |  |
| Agregar productos | Agregar producto BAR, KITCHEN y NONE | Totales correctos |  |
| Dividir cuenta | Separar items o pagos por partes segun UI disponible | Saldo pendiente correcto |  |
| Pago efectivo parcial | Pagar parte en CASH con `receivedAmount` mayor | Cambio calculado solo para efectivo |  |
| Pago tarjeta parcial | Pagar parte en CARD | No excede saldo pendiente |  |
| Pago transferencia | Pagar saldo con TRANSFER | Referencia opcional si configuracion no la exige |  |
| Pago dividido completo | Completar total con varios metodos | `paymentStatus=PAID`, saldo 0 |  |
| Orden completada | Confirmar cierre/completado | Orden no permite nuevos pagos |  |
| WAITER no cobra | WAITER intenta registrar pago | HTTP 403 |  |

### 4. Caja

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Abrir caja | ADMIN/CASHIER abre turno con fondo inicial | Turno abierto con branch y usuario |  |
| Evitar doble apertura | Abrir otro turno en misma sucursal/caja | Error claro de turno abierto |  |
| Pago ligado a turno | Registrar pago con turno abierto | `shiftId` queda asociado |  |
| Movimiento entrada | Registrar entrada manual con motivo | Suma a movimientos de entrada |  |
| Movimiento salida | Registrar salida manual con motivo | Suma a movimientos de salida |  |
| Cerrar caja | Capturar efectivo contado | Calcula esperado, contado y diferencia |  |
| Evitar doble cierre | Reintentar cerrar el mismo turno | Error claro |  |

### 5. Inventario

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Producto inventariable | Activar `trackInventory` en producto QA | Producto aparece como controlado |  |
| Stock inicial | Crear/editar InventoryItem con stock 5 y minimo 2 | Stock visible en inventario |  |
| Venta descuenta stock | Vender 4 unidades y completar/pagar orden | Stock baja a 1 con movimiento OUT automatico |  |
| Stock bajo | Consultar inventario y reportes | Badge/alerta de stock bajo |  |
| Bloqueo stock negativo | Intentar salida mayor al stock | Error claro salvo setting explicito |  |
| Cancelacion revierte | Cancelar una orden ya descontada si el flujo existe | Movimiento de reversa o riesgo documentado si no existe cancelacion formal |  |

### 6. Impresion

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Ticket cliente | Imprimir ticket cliente de orden pagada | Muestra productos, precios, pagos, total y cambio |  |
| Ticket cocina | Imprimir cocina con producto KITCHEN | Solo items `preparationStation=KITCHEN`, sin precios |  |
| Ticket barra | Imprimir barra con producto BAR | Solo items `preparationStation=BAR`, sin precios |  |
| NONE excluido | Incluir producto NONE en orden | No aparece en cocina/barra, si en cliente |  |
| Branch scope | Intentar imprimir orden de otra sucursal | HTTP 403/404 segun estrategia del backend |  |

### 7. Control infantil

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Registrar HOURLY | Crear acceso por hora con minutos contratados | Entrada automatica, codigo unico, item base en ticket |  |
| Registrar FREE | Crear acceso libre | Sin cobro extra por temporizador |  |
| Varios ninos | Registrar varios accesos en el mismo ticket | Todos quedan ligados a la misma orden |  |
| Warning | Simular o esperar hasta 10 min antes | Estado `WARNING` |  |
| Tolerancia | Simular fin + hasta 15 min | Estado `GRACE`, sin extra |  |
| Extra | Simular minuto 76 para acceso de 60 min | Cobra una hora extra completa |  |
| Extra en ticket | Finalizar con extra | Item de hora extra se agrega una sola vez |  |
| Validar codigo/tutor | Finalizar con codigo/tutor correcto | Acceso `COMPLETED` |  |
| Cobrar ticket | Ir a POS y pagar orden asociada | Ticket pagado con cargos infantiles |  |

Formula esperada para HOURLY:

```text
limite_sin_extra = contractedMinutes + graceMinutes
si elapsedMinutes <= limite_sin_extra: extraHours = 0
si elapsedMinutes > limite_sin_extra: extraHours = ceil((elapsedMinutes - limite_sin_extra) / 60)
extraAmount = extraHours * hourlyRate
```

### 8. Reservas y paquetes

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Crear paquete | ADMIN crea paquete con duracion y precio | Paquete activo visible |  |
| Reserva con paquete | Crear reserva usando paquete | `endTime` calculado por duracion |  |
| Reserva sin paquete | Crear reserva con duracion manual | Horarios validos |  |
| Solapamiento | Crear otra reserva en misma area y horario | Error de solapamiento |  |
| Anticipo | Capturar anticipo menor o igual al total | Saldo pendiente correcto |  |
| Cancelar reserva | Cancelar reserva confirmada | Estado `CANCELLED`, libera disponibilidad |  |
| WAITER bloqueado | WAITER intenta administrar reservas | HTTP 403 |  |

### 9. Reportes

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Pagos divididos | Revisar summary despues de pago dividido | Suma `Payment.amount`, no duplica total de orden |  |
| Ventas por categoria | Orden con productos de 2 categorias | Agrupacion por categoria correcta |  |
| Metodos de pago | Orden con CASH/CARD/TRANSFER | Totales por metodo correctos |  |
| Stock bajo | Producto bajo minimo | Aparece en reporte de inventario |  |
| Caja | Turno cerrado con diferencia | Reporte muestra esperado/contado/diferencia |  |
| Ninos | Accesos activos/completados/overtime | Metricas infantiles correctas |  |
| Reservas | Reservas por estados | Conteos y anticipos correctos |  |
| WAITER bloqueado | WAITER entra a reportes | HTTP 403 |  |

### 10. Realtime

Usar dos ventanas autenticadas en la misma sucursal. Mantener una en vista operativa y ejecutar cambios en la otra.

| Evento | Accion | Esperado | Resultado |
| --- | --- | --- | --- |
| `order.created` | Crear orden en POS | La otra ventana muestra la orden |  |
| `payment.created` | Registrar pago parcial | POS/caja actualiza saldo |  |
| `inventory.stock.changed` | Vender producto inventariable | Inventario actualiza stock |  |
| `child_access.status.changed` | Cambiar estado por timer/finalizacion | Tablero infantil actualiza badge |  |
| `reservation.created` | Crear reserva | Calendario actualiza evento |  |
| Socket fallback | Desconectar red o backend temporalmente | Indicador cambia y REST sigue operando al reconectar |  |

### 11. Deploy Railway

| Caso | Pasos | Esperado | Resultado |
| --- | --- | --- | --- |
| Healthcheck | Abrir `GET /health` del backend publico | HTTP 200 con estado saludable |  |
| Frontend API | Revisar `NEXT_PUBLIC_API_URL` en Railway | No apunta a localhost |  |
| Socket.io | Revisar `NEXT_PUBLIC_WS_URL` y conectar app | Socket conectado en `/realtime` |  |
| CORS | Probar origen del frontend real | Permitido; otros origenes no autorizados bloqueados |  |
| Migraciones | Ejecutar `prisma migrate deploy` en Railway | Migraciones aplicadas sin `migrate dev` |  |
| Prisma Client | Ejecutar/generar cliente en build/start | Backend arranca sin error de Prisma Client |  |
| Secrets | Revisar Railway variables | JWT secrets fuertes y sin `.env` subido |  |

## Checklist de cierre

- [ ] `corepack.cmd pnpm lint` pasa.
- [ ] `corepack.cmd pnpm build` pasa.
- [ ] `corepack.cmd pnpm db:generate` pasa.
- [ ] `corepack.cmd pnpm --filter backend exec prisma validate` pasa.
- [ ] Login y RBAC validados con los tres roles.
- [ ] Branch scope validado con al menos dos sucursales o intento cruzado controlado.
- [ ] Caja cerrada con pagos divididos y diferencia revisada.
- [ ] Inventario descuenta solo productos con `trackInventory=true`.
- [ ] Tickets cocina/barra usan `preparationStation`, no heuristicas.
- [ ] Control infantil genera cargos base y extras sin duplicarlos.
- [ ] Reservas bloquean solapamientos por area.
- [ ] Reportes no duplican ventas por pagos divididos.
- [ ] Realtime funciona con dos ventanas y no filtra datos entre sucursales.
- [ ] Deploy usa dominios reales, CORS restringido y migraciones aplicadas.

## Riesgos a vigilar

- La mayor parte de esta suite es funcional/manual; automatizarla con Playwright requeriria definir fixtures estables, credenciales de QA y una base efimera.
- La cancelacion con reversa de inventario depende de que exista un flujo formal de cancelacion de orden pagada/descontada. Si el flujo no esta disponible, registrar el caso como riesgo operativo antes de produccion.
- Las pruebas de Railway dependen de dominios finales, variables reales y base de datos de staging; no se pueden validar por completo en local.
- Si se reutiliza seed demo, hacerlo solo en desarrollo o QA. En produccion crear el ADMIN inicial con password fuerte y rotar secretos.
