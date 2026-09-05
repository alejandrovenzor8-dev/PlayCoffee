import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTicket } from './escpos-renderer.mjs';

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
