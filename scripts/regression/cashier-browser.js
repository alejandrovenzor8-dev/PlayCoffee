async page => {
  // UI fixtures only; PostgreSQL and HTTP permissions are covered by e2e regressions.
  const origin = 'http://127.0.0.1:3059';
  const context = page.context();
  let mode = 'BUSINESS_ONLY';
  let status = 'PREPARING';
  let total = 100;
  let additions = 0;
  const prebillRequests = [];
  const paymentRequests = [];
  const copyRequests = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const product = { id: 'pizza', name: 'Pizza QA', price: 150, preparationStation: 'KITCHEN', isActive: true, modifiers: [] };
  const order = () => ({ id: 'sale', orderNumber: 'SALE-QA', tableId: 'table-2', status, total });
  const document = kind => ({
    type: 'CUSTOMER', width: '80mm', config: { businessName: 'PLAYCOFFEE', branchName: 'QA', ticketMessage: 'Gracias' },
    cashierDocument: { kind, receiptId: kind === 'PREBILL' ? 'pre-' + additions : 'receipt-fixed', issuedAt: '2026-10-31T18:00:00Z' },
    order: { ...order(), table: '2', waiter: 'Ana', cashier: 'Caja', timezone: 'America/Mexico_City', createdAt: '2026-10-31T18:00:00Z' },
    items: [{ id: 'breakfast', quantity: 1, name: 'Desayuno QA', unitPrice: 100, totalPrice: 100, modifiers: [] }, ...(additions ? [{ id: 'pizza-line', name: 'Pizza QA', quantity: 1, unitPrice: 150, totalPrice: 150, modifiers: [] }] : [])],
    totals: { subtotal: total, total, paid: status === 'COMPLETED' ? total : 0, discountAmount: 0, taxAmount: 0, tipAmount: 0, changeAmount: 0 },
    payments: status === 'COMPLETED' ? [{ id: 'payment', method: 'CARD', amount: total, receivedAmount: null, changeAmount: 0 }] : [],
  });
  await context.addInitScript(() => localStorage.setItem('playcoffee-auth', JSON.stringify({ version: 0, state: { user: { id: 'qa-user', branchId: 'qa', firstName: 'QA', lastName: 'Cashier', role: 'CASHIER', isActive: true }, accessToken: 'fixture', refreshToken: 'fixture', isAuthenticated: true } })));
  await context.routeWebSocket('**', socket => socket.close());
  await context.route('**/*', async route => {
    const url = route.request().url();
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    const respond = data => route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ data }) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/health') return route.fulfill({ status: 200, body: '{}' });
    if (path.endsWith('/print/cashier-policy')) return respond({ cashierMode: mode, autoCustomer: true, confirmClose: true, allowReprint: true });
    if (path.endsWith('/products/categories')) return respond([]);
    if (path.endsWith('/products')) return respond([product]);
    if (path.endsWith('/tables')) return respond([{ id: 'table-2', number: '2', capacity: 4, status: status === 'COMPLETED' ? 'AVAILABLE' : 'OCCUPIED', orders: status === 'COMPLETED' ? [] : [order()] }]);
    if (path.endsWith('/payments/config')) return respond({ tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [0] });
    if (path.endsWith('/orders/sale')) return respond(order());
    if (path.endsWith('/orders/sale/items')) { additions++; total = 250; return respond(order()); }
    if (path.endsWith('/payments/order/sale')) return respond({ payments: [], summary: { orderId: 'sale', total, totalPaid: 0, remainingAmount: total, paymentStatus: 'UNPAID', changeAmount: 0 } });
    if (path.endsWith('/cash/closing-reminder')) return respond(null);
    if (path.endsWith('/cash/current')) return respond({ id: 'shift', closedAt: null });
    if (path.endsWith('/prebill')) {
      if (route.request().method() === 'POST') { prebillRequests.push({ ...route.request().postDataJSON(), total }); return respond({ id: 'prebill-job', status: 'PENDING' }); }
      return respond(document('PREBILL'));
    }
    if (path.endsWith('/payments') && route.request().method() === 'POST') {
      paymentRequests.push(route.request().postDataJSON()); status = 'COMPLETED';
      return respond({ payment: { id: 'payment', method: 'CARD', amount: total, receivedAmount: null, changeAmount: 0 }, receipt: { id: 'receipt-fixed', status: 'PENDING', lastError: null }, summary: { orderId: 'sale', total, totalPaid: total, remainingAmount: 0, changeAmount: 0, paymentStatus: 'PAID' } });
    }
    if (path.endsWith('/business-receipt')) return respond({ id: 'receipt-fixed', status: 'FAILED', lastError: 'Caja desconectada', document: document('BUSINESS') });
    if (path.endsWith('/business-receipt/print')) { copyRequests.push(route.request().postDataJSON()); return respond({ id: 'copy-job', status: 'PENDING' }); }
    if (path.includes('/api/v1/')) throw new Error('Unexpected API request: ' + path);
    if (url.startsWith(origin + '/') && !path.includes('sw.js')) return route.continue();
    return route.abort();
  });
  const enter = async () => {
    await page.goto(origin + '/pos?orderId=sale');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: /^Cobrar/ }).waitFor();
  };
  await enter();
  assert(await page.getByRole('button', { name: 'Imprimir precuenta', exact: true }).count() === 0, 'Solo negocio must hide prebill');
  mode = 'CUSTOMER_AND_BUSINESS';
  await enter();
  const printPrebill = async () => {
    await page.getByRole('button', { name: 'Imprimir precuenta', exact: true }).click();
    await page.getByText('PRECUENTA — NO ES COMPROBANTE DE PAGO', { exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Imprimir precuenta', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  };
  await printPrebill();
  assert(paymentRequests.length === 0 && status === 'PREPARING', 'prebill must not pay or close');
  const views = page.getByRole('group', { name: 'Vista del pedido' });
  if (await views.isVisible()) await views.getByRole('button', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: /Pizza QA/ }).click();
  if (await views.isVisible()) await views.getByRole('button', { name: /^Comanda/ }).click();
  await page.getByRole('button', { name: 'Agregar al ticket', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('textarea').length === 0);
  await printPrebill();
  assert(prebillRequests.length === 2 && prebillRequests[0].total === 100 && prebillRequests[1].total === 250, 'updated prebill missing additions');
  assert(prebillRequests[0].requestId !== prebillRequests[1].requestId, 'updated prebill must be a new request');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: 'Tarjeta', exact: true }).click();
  await page.evaluate(() => { window.__qaCancelled = false; window.confirm = () => { window.__qaCancelled = true; return false; }; });
  await page.getByRole('button', { name: 'Agregar Pago', exact: true }).click();
  await page.waitForFunction(() => window.__qaCancelled === true);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Agregar Pago' && !button.disabled));
  assert(paymentRequests.length === 0 && status !== 'COMPLETED', 'cancelled confirmation must not pay');
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Agregar Pago', exact: true }).click();
  await page.getByText('Orden SALE-QA pagada correctamente', { exact: true }).waitFor();
  assert(paymentRequests.length === 1 && paymentRequests[0].closeConfirmed === true, 'final payment must be confirmed once');
  await page.getByRole('button', { name: 'Comprobante negocio', exact: true }).click();
  await page.getByText('COPIA NEGOCIO', { exact: true }).waitFor();
  await page.getByText('Documento no fiscal. No es CFDI.', { exact: true }).waitFor();
  await page.getByLabel('Motivo de reimpresion').fill('Printer reconnected');
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Reimprimir comprobante', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert(paymentRequests.length === 1 && copyRequests.length === 1, 'reprint must not register a new payment');
  assert(copyRequests[0].reason === 'Printer reconnected' && Boolean(copyRequests[0].requestId), 'reprint needs audit reason and retry key');
  return { passed: ['Solo negocio hides prebill', 'prebill without payment or closing', 'updated prebill after additions', 'cancelled final confirmation does not pay', 'confirmed payment success despite printer failure', 'business reprint without new payment'], fixtureApi: true, viewport: page.viewportSize() };
}
