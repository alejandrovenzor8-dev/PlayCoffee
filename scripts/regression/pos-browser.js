async page => {
  // Run with playwright-cli run-code --filename=scripts/regression/pos-browser.js.
  // UI-only regression: API responses are fixtures; database behavior is tested separately.
  const origin = 'http://127.0.0.1:3059';
  const context = page.context();
  let closed = false;
  let createdOrder = null;
  let recordedPayment = null;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const product = { id: 'pizza', name: 'Pizza QA', price: 150, preparationStation: 'KITCHEN', isActive: true, modifiers: [] };
  const oldPayment = { id: 'old-payment', method: 'CARD', amount: 20, status: 'COMPLETED', reference: 'OLD PAYMENT' };
  const oldOrder = () => ({ id: 'old-order', orderNumber: 'OLD-ORDER', status: closed ? 'COMPLETED' : 'PREPARING', tableId: 'table-2', total: 100, items: [{ id: 'old-breakfast', productId: 'breakfast', quantity: 1 }], payments: [oldPayment] });
  const oldSummary = () => ({ orderId: 'old-order', total: 100, totalPaid: closed ? 100 : 20, remainingAmount: closed ? 0 : 80, changeAmount: 0, paymentStatus: closed ? 'PAID' : 'PARTIALLY_PAID' });
  await context.addInitScript(() => {
    localStorage.setItem('playcoffee-auth', JSON.stringify({ version: 0, state: {
      user: { id: 'qa-user', branchId: 'qa-branch', email: 'qa@invalid.test', firstName: 'QA', lastName: 'Cashier', role: 'CASHIER', isActive: true },
      accessToken: 'fixture-not-a-real-token', refreshToken: 'fixture', isAuthenticated: true,
    } }));
  });
  await context.routeWebSocket('**', socket => socket.close());
  await context.route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    const requestOrigin = /^https?:\/\/[^/]+/.exec(requestUrl)?.[0];
    const path = requestUrl.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    const respond = data => route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ data }) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/health') return route.fulfill({ status: 200, body: '{}' });
    if (path.endsWith('/products/categories')) return respond([]);
    if (path.endsWith('/products')) return respond([product]);
    if (path.endsWith('/tables')) return respond([{ id: 'table-2', number: '2', capacity: 4, status: closed ? 'AVAILABLE' : 'OCCUPIED', area: { id: 'area', name: 'Terraza' }, orders: closed ? [] : [oldOrder()] }]);
    if (path.endsWith('/print/cashier-policy')) return respond({ cashierMode: 'BUSINESS_ONLY', autoCustomer: false, confirmClose: false, allowReprint: true });
    if (path.endsWith('/payments/config')) return respond({ tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [0] });
    if (path.endsWith('/orders/old-order')) return respond(oldOrder());
    if (path.endsWith('/payments/order/old-order')) return respond({ payments: [oldPayment], summary: oldSummary() });
    if (path.endsWith('/cash/closing-reminder')) return respond(null);
    if (path.endsWith('/cash/current')) return respond({ id: 'shift', closedAt: null });
    if (path.endsWith('/orders') && request.method() === 'POST') {
      createdOrder = request.postDataJSON();
      return respond({ id: 'new-order', orderNumber: 'NEW-ORDER', status: 'PENDING', total: 150, tableId: 'table-2', payments: [], items: createdOrder.items });
    }
    if (path.endsWith('/payments') && request.method() === 'POST') {
      recordedPayment = request.postDataJSON();
      return respond({ payment: { id: 'new-payment', method: 'CARD', amount: 150, changeAmount: 0, reference: null }, summary: { orderId: 'new-order', total: 150, totalPaid: 150, remainingAmount: 0, changeAmount: 0, paymentStatus: 'PAID' } });
    }
    if (path.includes('/api/v1/')) throw new Error('Unexpected fixture API request: ' + path);
    // Do not allow any request to the production API or external services.
    if (requestOrigin === origin && !path.includes('sw.js')) return route.continue();
    return route.abort();
  });
  const second = await context.newPage();
  for (const device of [page, second]) {
    await device.goto(origin + '/pos?orderId=old-order');
    await device.getByRole('dialog').getByText('OLD PAYMENT', { exact: true }).waitFor();
    await device.getByRole('button', { name: 'Volver al ticket', exact: true }).click();
    await device.getByRole('button', { name: /Pizza QA/ }).click();
    await device.getByLabel('Notas de Pizza QA').fill('Pending extra from old customers');
  }
  closed = true; // Simulate the final payment received by another device.
  await Promise.all([page, second].map(device => device.waitForURL(url => !url.searchParams.has('orderId'), { timeout: 22000 })));
  for (const device of [page, second]) {
    await device.getByText('Carrito vacío', { exact: true }).waitFor();
    assert(await device.getByText('OLD-ORDER', { exact: true }).count() === 0, 'old order remains in POS');
    assert(await device.getByLabel('Notas de Pizza QA').count() === 0, 'pending extras were not cleared');
    await device.reload();
    await device.getByText('Carrito vacío', { exact: true }).waitFor();
    assert(!device.url().includes('old-order'), 'closed order restored by reload');
  }
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Mesa 2/ }).click();
  await page.getByRole('button', { name: /Pizza QA/ }).click();
  await page.getByLabel('Notas de Pizza QA').fill('New customers');
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: 'Tarjeta', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar Pago', exact: true }).click();
  await page.getByText('Orden NEW-ORDER pagada correctamente', { exact: true }).waitFor();
  assert(createdOrder?.tableId === 'table-2', 'new order lost the table');
  assert(createdOrder.items.length === 1 && createdOrder.items[0].productId === 'pizza' && createdOrder.items[0].quantity === 1, 'new order contains previous customer products');
  assert(createdOrder.items[0].notes === 'New customers', 'notes were mixed between customers');
  assert(Boolean(createdOrder.requestId), 'missing create retry identifier');
  assert(recordedPayment.orderId === 'new-order' && recordedPayment.amount === 150, 'old payment or order reused');
  // A direct historical URL must also clear itself, without leaving POS stuck loading.
  await page.goto(origin + '/pos?orderId=old-order');
  await page.waitForURL(url => !url.searchParams.has('orderId'));
  await page.getByText('Carrito vacío', { exact: true }).waitFor();
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Mesa 2/ }).click();
  await page.screenshot({ path: 'build/pos-browser-regression.png', fullPage: true });
  await second.close();
  return { passed: ['two-device closed-order cleanup', 'pending cart cleanup', 'reload does not restore history', 'new table order and payment IDs', 'direct historical link releases loading'], fixtureApi: true };
}
