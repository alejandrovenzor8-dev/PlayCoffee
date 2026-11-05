import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTicket } from './escpos-renderer.mjs';

test('opens the drawer only for customer cash receipts', () => {
  const pulse = Buffer.from([0x1b, 0x70, 0, 0x32, 0xfa]);
  const receipt = {
    type: 'CUSTOMER', width: '80mm', config: {},
    order: { orderNumber: '1', createdAt: new Date(), status: 'PAID' },
    items: [], payments: [{ method: 'CASH', amount: 10 }],
  };
  assert.ok(renderTicket(receipt).includes(pulse));
  for (const change of [
    { type: 'KITCHEN' }, { type: 'BAR' },
    { payments: [{ method: 'CARD', amount: 10 }] },
    { payments: [] }, { order: { ...receipt.order, status: 'TEST' } },
  ]) assert.equal(renderTicket({ ...receipt, ...change }).includes(pulse), false);
});

test('renders customer ticket with initialization, totals and cut command', () => {
  const result = renderTicket({
    type: 'CUSTOMER',
    width: '80mm',
    config: { businessName: 'Play Café', ticketMessage: 'Gracias' },
    order: { orderNumber: 'PC-123', table: '4', createdAt: '2026-08-21T18:00:00.000Z', notes: null },
    items: [{ quantity: 2, name: 'Latte', totalPrice: 90, notes: 'Sin azúcar', modifiers: [{ quantity: 1, name: 'Extra shot' }] }],
    totals: { total: 90, paid: 100, changeAmount: 10 },
  });
  assert.deepEqual([...result.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(result.toString('ascii'), /2 x Latte/);
  assert.match(result.toString('ascii'), /TOTAL/);
  assert.deepEqual([...result.subarray(-4)], [0x1d, 0x56, 0x41, 0x03]);
});

test('uses the compact width for 58mm production tickets', () => {
  const result = renderTicket({
    type: 'KITCHEN', width: '58mm', config: {},
    order: { orderNumber: 'PC-9', table: null, createdAt: '2026-08-21T18:00:00.000Z', notes: 'Urgente' },
    items: [{ quantity: 1, name: 'Sandwich muy largo para cocina', modifiers: [] }],
  });
  const lines = result.toString('ascii').split('\n');
  assert.ok(lines.some((line) => line.length === 32));
  assert.match(result.toString('ascii'), /NOTAS: Urgente/);
});


test('production ticket includes identity, local branch time, batch, waiter, area and correction notes', () => {
  for (const width of ['58mm', '80mm']) {
    const document = {
      type: 'KITCHEN', width, config: {},
      order: { orderNumber: 'PC-LOCAL', table: '2', area: 'Terraza', waiter: 'Ana Mesera', timezone: 'America/Mexico_City', createdAt: '2026-10-31T18:00:00Z' },
      dispatch: { batchId: 'batch-123', sentAt: '2026-10-31T18:05:00Z', kind: 'CANCELLATION', reason: 'Cliente corrige' },
      items: [{ quantity: 2, name: 'Pizza', notes: 'Sin cebolla', modifiers: [{ quantity: 1, name: 'Extra queso' }] }],
    };
    const printed = renderTicket(document).toString('ascii');
    for (const value of ['PLAYCOFFEE', 'COCINA', 'PC-LOCAL', 'Mesa', '2', 'Terraza', 'Ana Mesera', 'batch-123', '12:00', '12:05', 'CANCELACION / CORRECCION', 'Cliente corrige', '2 x Pizza', 'Sin cebolla', 'Extra queso']) assert.ok(printed.includes(value), `${width}: missing ${value}`);
    assert.ok(!printed.includes('18:00'), 'must use branch timezone instead of host timezone');
  }
});


test('prebill shows outstanding balance and prices without drawer pulse; business copy shows split methods and received cash', () => {
  const pulse = Buffer.from([0x1b, 0x70, 0, 0x32, 0xfa]);
  const base = {
    type: 'CUSTOMER', width: '80mm', config: { businessName: 'PLAYCOFFEE', ticketMessage: 'Gracias' },
    order: { id: 'order-123', orderNumber: 'PC-123', table: '2', waiter: 'Ana', cashier: 'Caja Dos', timezone: 'America/Mexico_City', status: 'COMPLETED', createdAt: '2026-10-31T18:00:00Z' },
    items: [{ quantity: 1, name: 'Desayuno', unitPrice: 100, totalPrice: 100, modifiers: [] }],
    payments: [{ id: 'cash', method: 'CASH', amount: 40, receivedAmount: 50, changeAmount: 10 }, { id: 'card', method: 'CARD', amount: 40, changeAmount: 0 }],
    totals: { subtotal: 110, discountAmount: 10, total: 100, paid: 80, changeAmount: 10 },
    cashierDocument: { kind: 'PREBILL', receiptId: 'pre-123', issuedAt: '2026-10-31T18:05:00Z' },
  };
  for (const width of ['58mm', '80mm']) {
    const prebill = renderTicket({ ...base, width });
    const preText = prebill.toString('ascii');
    for (const word of ['PRECUENTA', 'COMPROBANTE DE PAGO', 'Saldo pendiente', '$20.00', 'Precio unitario', '$100.00', 'Descuento', 'Ana', '12:05']) assert.ok(preText.includes(word), `${width}: ${word}`);
    assert.ok(!prebill.includes(pulse));
    const business = renderTicket({ ...base, width, cashierDocument: { ...base.cashierDocument, kind: 'BUSINESS', receiptId: 'receipt-123' }, totals: { ...base.totals, paid: 100 } });
    for (const word of ['COPIA NEGOCIO', 'NO ES CFDI', 'receipt-123', 'order-123', 'Caja Dos', 'Efectivo', 'Tarjeta', 'Recibido', 'Cambio']) assert.ok(business.toString('ascii').includes(word));
    assert.ok(business.includes(pulse));
    const copy = renderTicket({ ...base, width, cashierDocument: { ...base.cashierDocument, kind: 'BUSINESS', reprint: true } });
    assert.ok(!copy.includes(pulse), 'reprints must not reopen the drawer');
    assert.match(copy.toString('ascii'), /REIMPRESION AUTORIZADA/);
  }
});


test('prints distinct preparation comments below each serving of the same product', () => {
  for (const width of ['58mm', '80mm']) {
    const printed = renderTicket({
      type: 'KITCHEN', width, config: {},
      order: { orderNumber: 'PC-HUEVOS', table: '2', createdAt: '2026-11-01T15:00:00Z' },
      items: [
        { quantity: 1, name: 'Huevos estrellados', notes: 'Bien cocidos\nSin cebolla', modifiers: [] },
        { quantity: 1, name: 'Huevos estrellados', notes: 'Tiernitos', modifiers: [] },
      ],
    }).toString('ascii');
    assert.equal(printed.split('1 x Huevos estrellados').length - 1, 2);
    assert.match(printed, /1 x Huevos estrellados[^]*NOTA: Bien cocidos\nSin cebolla[^]*1 x Huevos estrellados[^]*NOTA: Tiernitos/);
  }
});
