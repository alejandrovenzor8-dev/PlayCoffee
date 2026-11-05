async page => {
  // Real frontend layout; API fixtures isolate these checks from restaurant data.
  const origin = 'http://127.0.0.1:3059';
  const context = page.context();
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const products = Array.from({ length: 40 }, (_, index) => ({ id: 'p' + index, name: 'Producto ' + String(index + 1).padStart(2, '0'), price: 100, preparationStation: 'KITCHEN', isActive: true, modifiers: [] }));
  const seed = () => products.map((product, index) => ({ id: 'saved-' + index, productId: product.id, product, quantity: 1, totalPrice: 100, unitPrice: 100, notes: 'Preparacion guardada ' + index, modifiers: [], status: 'PENDING' }));
  let items = seed();
  const submissions = [];
  const order = () => ({ id: 'sale', orderNumber: 'QA-LARGE', status: 'PENDING', tableId: 'table-2', total: items.length * 100, items, payments: [], createdAt: '2026-11-01T15:00:00Z' });
  const table = () => ({ id: 'table-2', areaId: 'area', number: '2', status: 'OCCUPIED', capacity: 4, posX: 20, posY: 20, width: 150, height: 130, shape: 'rect', isActive: true, area: { id: 'area', name: 'Terraza' }, orders: [order()] });
  await context.addInitScript(() => localStorage.setItem('playcoffee-auth', JSON.stringify({ version: 0, state: { user: { id: 'qa-user', branchId: 'qa', firstName: 'QA', lastName: 'Cashier', role: 'CASHIER', isActive: true }, accessToken: 'fixture', refreshToken: 'fixture', isAuthenticated: true } })));
  await context.routeWebSocket('**', socket => socket.close());
  await context.route('**/*', async route => {
    const url = route.request().url();
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    const respond = data => route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ data }) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.startsWith(origin + '/') && !path.includes('/api/v1/') && path !== '/health') return path.includes('sw.js') ? route.abort() : route.continue();
    if (path === '/health') return route.fulfill({ status: 200, body: '{}' });
    if (path.endsWith('/print/cashier-policy')) return respond({ cashierMode: 'CUSTOMER_AND_BUSINESS', autoCustomer: false, confirmClose: false, allowReprint: true });
    if (path.endsWith('/products/categories')) return respond([]);
    if (path.endsWith('/products')) return respond(products);
    if (path.endsWith('/tables/areas')) return respond([{ id: 'area', branchId: 'qa', name: 'Terraza', isActive: true, _count: { tables: 1 }, tables: [table()] }]);
    if (path.endsWith('/tables')) return respond([table()]);
    if (path.endsWith('/payments/config')) return respond({ tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [0] });
    if (path.endsWith('/orders/sale')) return respond(order());
    if (path.endsWith('/orders/sale/items')) {
      const data = route.request().postDataJSON(); submissions.push(data);
      items = [...items, ...data.items.map((i, index) => ({ ...i, id: 'new-' + index, product: products.find(p => p.id === i.productId), totalPrice: i.quantity * 100, unitPrice: 100, modifiers: [], status: 'PENDING' }))];
      return respond(order());
    }
    if (path.endsWith('/payments/order/sale')) return respond({ payments: [], summary: { orderId: 'sale', total: order().total, totalPaid: 0, remainingAmount: order().total, paymentStatus: 'UNPAID', changeAmount: 0 } });
    if (path.endsWith('/cash/closing-reminder')) return respond(null);
    if (path.includes('/api/v1/')) throw new Error('Unexpected API request: ' + path);
    return route.abort();
  });
  const results = [];
  for (const viewport of [{ width: 1280, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 390, height: 500 }]) {
    await page.setViewportSize(viewport);
    const mobile = viewport.width < 1024;
    for (const screen of ['pos', 'tables']) {
      items = seed();
      await page.goto(origin + (screen === 'pos' ? '/pos?orderId=sale' : '/tables'));
      if (screen === 'pos') await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
      else await page.getByRole('button').filter({ hasText: 'OCUPADA' }).click();
      const scope = screen === 'tables' ? page.getByRole('dialog') : page.locator('main');
      if (mobile) await scope.getByRole('group', { name: 'Vista del pedido' }).getByRole('button', { name: 'Productos', exact: true }).click();
      for (const product of products) await scope.getByRole('button').filter({ has: page.getByText(product.name, { exact: true }) }).click();
      if (mobile) await scope.getByRole('group', { name: 'Vista del pedido' }).getByRole('button', { name: /^Comanda/ }).click();
      const region = scope.getByRole('region', { name: 'Productos de la comanda', exact: true });
      await region.waitFor();
      const metrics = await region.evaluate(element => ({ visible: element.clientHeight, content: element.scrollHeight, overflow: getComputedStyle(element).overflowY }));
      assert(metrics.visible >= 80 && metrics.content > metrics.visible, `${screen}/${viewport.width}: list has no bounded scroll area ${JSON.stringify(metrics)}`);
      assert(['auto', 'scroll'].includes(metrics.overflow), `${screen}/${viewport.width}: no vertical scrolling`);
      await region.hover();
      await page.mouse.wheel(0, 30000);
      await page.waitForFunction(() => document.querySelector('[aria-label="Productos de la comanda"]').scrollTop > 0);
      const lastNotes = region.getByLabel('Notas de Producto 40');
      await lastNotes.scrollIntoViewIfNeeded();
      await lastNotes.fill('Ultimo producto - bien cocido');
      if (mobile) {
        assert(await lastNotes.evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 16, 'small-screen note font causes focus zoom');
      }
      const action = scope.getByRole('button', { name: 'Agregar al ticket', exact: true });
      await action.scrollIntoViewIfNeeded();
      const bounds = await action.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, `${screen}/${viewport.width}: action outside viewport`);
      if (mobile) {
        assert(bounds.height >= 44, 'touch action too small');
        if (screen === 'pos') {
          const navigation = await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).boundingBox();
          assert(bounds.y + bounds.height <= navigation.y + 1, 'bottom navigation covers order action');
        }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${screen}/${viewport.width}: horizontal overflow`);
      if (viewport.width === 390) await page.screenshot({ path: `build/responsive-${screen}-390.png`, fullPage: true });
      const previous = submissions.length;
      await action.click();
      await page.waitForFunction(() => document.querySelectorAll('textarea').length === 0);
      assert(submissions.length === previous + 1 && submissions[submissions.length - 1].items.length === 40, 'large order lost products');
      assert(submissions[submissions.length - 1].items[39].notes === 'Ultimo producto - bien cocido', 'last product comment lost');
      results.push({ screen, viewport, scroll: metrics, reachableAction: true, submittedProducts: 40 });
    }
  }
  return { passed: results, fixtureApi: true };
}
