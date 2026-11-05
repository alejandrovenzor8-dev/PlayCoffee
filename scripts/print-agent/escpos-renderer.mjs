const ESC = 0x1b;
const GS = 0x1d;

function text(value = '') {
  return Buffer.from(
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e\n]/g, '?'),
    'ascii',
  );
}

function money(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function fit(left, right, columns) {
  const rightText = String(right);
  const available = Math.max(1, columns - rightText.length - 1);
  return `${String(left).slice(0, available).padEnd(available)} ${rightText}\n`;
}

function center(value, columns) {
  const line = String(value).slice(0, columns);
  return `${line.padStart(Math.floor((columns + line.length) / 2))}\n`;
}

export function renderTicket(document) {
  const localTime = value => new Date(value).toLocaleString('es-MX', { timeZone: document.order.timezone ?? 'America/Mexico_City' });
  const cashier = document.cashierDocument;
  const columns = document.width === '58mm' ? 32 : 48;
  const chunks = [
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x61, 0x01]),
    text(center(document.type === 'CUSTOMER' ? document.config.businessName : 'PLAYCOFFEE', columns)),
    ...(document.type !== 'CUSTOMER' ? [text(center(document.type === 'KITCHEN' ? 'COCINA' : 'BARRA', columns))] : []),
    Buffer.from([ESC, 0x61, 0x00]),
    ...(cashier ? [text(cashier.kind === 'PREBILL' ? 'PRECUENTA - NO ES\nCOMPROBANTE DE PAGO\n' : 'COPIA NEGOCIO\nDOCUMENTO NO FISCAL - NO ES CFDI\n'), text(`Comprobante: ${cashier.receiptId}\n`), text(fit('Emision', localTime(cashier.issuedAt), columns)), ...(cashier.reprint ? [text('REIMPRESION AUTORIZADA\n')] : [])] : []),
    text(`${'-'.repeat(columns)}\n`),
    text(fit('Orden', document.order.orderNumber, columns)),
    ...(cashier ? [text(`ID orden: ${document.order.id}\n`), text(fit('Cajero', document.order.cashier ?? '-', columns))] : []),
    text(fit('Mesa', document.order.table ?? 'Mostrador', columns)),
    text(fit('Pedido', localTime(document.order.createdAt), columns)),
    text(fit('Area', document.order.area ?? 'Mostrador', columns)),
    text(fit('Mesero', document.order.waiter ?? '-', columns)),
    ...(document.dispatch ? [
      text(`Comanda:\n${document.dispatch.batchId}\n`),
      text(fit('Envio', localTime(document.dispatch.sentAt), columns)),
      ...(document.dispatch.kind === 'REPRINT' ? [text('REIMPRESION\n')] : []),
      ...(document.dispatch.kind === 'CANCELLATION' ? [text('CANCELACION / CORRECCION\n')] : []),
      ...(document.dispatch.originalBatchId ? [text(`Lote original: ${document.dispatch.originalBatchId}\n`)] : []),
      ...(document.dispatch.reason ? [text(`Motivo: ${document.dispatch.reason}\n`)] : []),
    ] : []),
    text(`${'-'.repeat(columns)}\n`),
  ];

  for (const item of document.items) {
    chunks.push(text(fit(`${item.quantity} x ${item.name}`, item.totalPrice === undefined ? '' : money(item.totalPrice), columns)));
    if (item.unitPrice !== undefined) chunks.push(text(`  Precio unitario: ${money(item.unitPrice)}\n`));
    for (const modifier of item.modifiers ?? []) {
      chunks.push(text(`  + ${modifier.quantity} ${modifier.name}\n`));
    }
    if (item.notes) chunks.push(text(`  NOTA: ${item.notes}\n`));
  }

  if (document.totals) {
    chunks.push(text(`${'-'.repeat(columns)}\n`));
    chunks.push(Buffer.from([ESC, 0x45, 0x01]));
    chunks.push(text(fit('Subtotal', money(document.totals.subtotal), columns)));
    if (document.totals.discountAmount) chunks.push(text(fit('Descuento', money(document.totals.discountAmount), columns)));
    if (document.totals.taxAmount) chunks.push(text(fit('Impuestos', money(document.totals.taxAmount), columns)));
    if (document.totals.tipAmount) chunks.push(text(fit('Propina', money(document.totals.tipAmount), columns)));
    chunks.push(text(fit('TOTAL', money(document.totals.total), columns)));
    chunks.push(Buffer.from([ESC, 0x45, 0x00]));
    chunks.push(text(fit('Pagado', money(document.totals.paid), columns)));
    chunks.push(text(fit('Saldo pendiente', money(Math.max(0, document.totals.total - document.totals.paid)), columns)));
    for (const payment of document.payments ?? []) {
      const method = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia' }[payment.method] ?? payment.method;
      chunks.push(text(fit(method, money(payment.amount), columns)));
      if (payment.receivedAmount != null) chunks.push(text(fit('Recibido', money(payment.receivedAmount), columns)));
      if (payment.changeAmount) chunks.push(text(fit('Cambio pago', money(payment.changeAmount), columns)));
    }
    if (document.totals.changeAmount) chunks.push(text(fit('Cambio', money(document.totals.changeAmount), columns)));
  }

  if (document.order.notes) chunks.push(text(`\nNOTAS: ${document.order.notes}\n`));
  if (document.type === 'CUSTOMER') {
    chunks.push(Buffer.from([ESC, 0x61, 0x01]));
    chunks.push(text(`\n${document.config.ticketMessage}\n`));
  }
  chunks.push(text('\n\n\n'));
  // ESC p: drawer connector pin 2, 100 ms pulse, 500 ms recovery.
  if (document.type === 'CUSTOMER' && (!cashier || (cashier.kind === 'BUSINESS' && !cashier.reprint)) && document.order.status !== 'TEST' &&
      document.payments?.some((payment) => payment.method === 'CASH' && Number(payment.amount) > 0)) {
    chunks.push(Buffer.from([ESC, 0x70, 0x00, 0x32, 0xfa]));
  }
  chunks.push(Buffer.from([GS, 0x56, 0x41, 0x03]));
  return Buffer.concat(chunks);
}
