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
  const columns = document.width === '58mm' ? 32 : 48;
  const chunks = [
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x61, 0x01]),
    text(center(document.type === 'CUSTOMER' ? document.config.businessName : document.type, columns)),
    Buffer.from([ESC, 0x61, 0x00]),
    text(`${'-'.repeat(columns)}\n`),
    text(fit('Orden', document.order.orderNumber, columns)),
    text(fit('Mesa', document.order.table ?? 'Mostrador', columns)),
    text(fit('Fecha', new Date(document.order.createdAt).toLocaleString('es-MX'), columns)),
    text(`${'-'.repeat(columns)}\n`),
  ];

  for (const item of document.items) {
    chunks.push(text(fit(`${item.quantity} x ${item.name}`, item.totalPrice === undefined ? '' : money(item.totalPrice), columns)));
    for (const modifier of item.modifiers ?? []) {
      chunks.push(text(`  + ${modifier.quantity} ${modifier.name}\n`));
    }
    if (item.notes) chunks.push(text(`  NOTA: ${item.notes}\n`));
  }

  if (document.totals) {
    chunks.push(text(`${'-'.repeat(columns)}\n`));
    chunks.push(Buffer.from([ESC, 0x45, 0x01]));
    chunks.push(text(fit('TOTAL', money(document.totals.total), columns)));
    chunks.push(Buffer.from([ESC, 0x45, 0x00]));
    chunks.push(text(fit('Pagado', money(document.totals.paid), columns)));
    if (document.totals.changeAmount) chunks.push(text(fit('Cambio', money(document.totals.changeAmount), columns)));
  }

  if (document.order.notes) chunks.push(text(`\nNOTAS: ${document.order.notes}\n`));
  if (document.type === 'CUSTOMER') {
    chunks.push(Buffer.from([ESC, 0x61, 0x01]));
    chunks.push(text(`\n${document.config.ticketMessage}\n`));
  }
  chunks.push(text('\n\n\n'));
  chunks.push(Buffer.from([GS, 0x56, 0x41, 0x03]));
  return Buffer.concat(chunks);
}
