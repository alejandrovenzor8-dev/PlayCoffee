// Run with: playwright-cli -s=pos-regression run-code --filename=scripts/tests/pos-checkout-navigation.playwright.js
// All API calls are intercepted. This test never opens a real shift or records a real payment.
async page => {
  const orderId = "child-without-table";
  const order = { id: orderId, orderNumber: "INFANTIL-REGRESO", tableId: null, status: "PENDING", total: 99, payments: [] };
  const otherOrders = [
    { id: "paid", orderNumber: "YA-PAGADA", tableId: null, status: "COMPLETED", total: 99, payments: [{ status: "COMPLETED", amount: 99 }] },
    { id: "table", orderNumber: "CON-MESA", tableId: "table-1", status: "PENDING", total: 50, payments: [] },
  ];
  let shift = null;
  let paymentCalls = 0;
  const unexpected = [];
  const summary = () => ({ orderId, total: 99, totalPaid: order.status === "COMPLETED" ? 99 : 0,
    remainingAmount: order.status === "COMPLETED" ? 0 : 99, changeAmount: 0,
    paymentStatus: order.status === "COMPLETED" ? "PAID" : "UNPAID" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = request.url().split("/api/v1")[1].split("?")[0];
    let data;
    if (request.method() === "GET") {
      if (path === "/orders") data = [order, ...otherOrders];
      else if (path === `/orders/${orderId}`) data = order;
      else if (path === `/payments/order/${orderId}`) data = { payments: order.payments, summary: summary() };
      else if (path === "/cash/current") data = shift;
      else if (path === "/cash/history") data = [];
      else if (path === "/cash/closing-reminder") data = null;
      else if (path === "/payments/config") data = { tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [] };
      else if (path === "/print/cashier-policy") data = { confirmClose: false, allowReprint: true };
      else if (["/products", "/products/categories", "/tables"].includes(path)) data = [];
      else unexpected.push(`${request.method()} ${path}`);
    } else if (request.method() === "POST" && path === "/cash/open") {
      shift = { id: "test-shift", openingBalance: 0, closingBalance: null, expectedCash: 0,
        cashDifference: null, totalSales: 0, totalCash: 0, totalCard: 0, totalTransfer: 0,
        totalIn: 0, totalOut: 0, openedAt: new Date().toISOString(), closedAt: null, movements: [] };
      data = shift;
    } else if (request.method() === "POST" && path === "/payments") {
      paymentCalls += 1;
      if (!shift || request.postDataJSON().orderId !== orderId) throw new Error("Wrong shift or order");
      order.status = "COMPLETED";
      const payment = { id: "test-payment", method: "CASH", amount: 99, receivedAmount: 99, changeAmount: 0, status: "COMPLETED", reference: null };
      order.payments.push(payment);
      data = { payment, summary: summary() };
    } else unexpected.push(`${request.method()} ${path}`);
    await route.fulfill({ status: data === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto("http://localhost:3000/login");
  await page.evaluate(() => {
    localStorage.setItem("playcoffee-auth", JSON.stringify({ version: 0, state: {
      user: { id: "test-user", branchId: "test-branch", email: "test@example.invalid", firstName: "Prueba", lastName: "Caja", role: "ADMIN", isActive: true },
      accessToken: "test-token", refreshToken: "test-refresh", isAuthenticated: true,
    } }));
    sessionStorage.removeItem("playcoffee-pos-session");
  });
  await page.goto(`http://localhost:3000/pos?orderId=${orderId}`);
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Agregar Pago", exact: true }).click();
  await page.getByText("Abre caja en Corte de Caja antes de empezar a cobrar.", { exact: true }).waitFor();
  if (paymentCalls !== 0) throw new Error("Closed shift attempted a payment");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("link", { name: "Corte de Caja", exact: true }).click();
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page.getByText("Abierta", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Caja / POS", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  if (!page.url().includes(`orderId=${orderId}`)) throw new Error("Did not restore the selected order after opening cash");
  await page.reload();
  await page.getByRole("dialog").waitFor();
  // Also recover an order when there is no saved selection, including accounts lost before this fix.
  await page.evaluate(() => sessionStorage.removeItem("playcoffee-pos-session"));
  await page.goto("http://localhost:3000/pos");
  await page.getByRole("combobox", { name: "Cuentas pendientes sin mesa" }).click();
  await page.getByRole("option", { name: /INFANTIL-REGRESO/ }).waitFor();
  if (await page.getByRole("option", { name: /YA-PAGADA|CON-MESA/ }).count()) throw new Error("Listed a paid order or table order as pending without table");
  await page.getByRole("option", { name: /INFANTIL-REGRESO/ }).click();
  await page.getByText("Ticket cargado", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar Pago", exact: true }).click();
  await page.getByText("Orden INFANTIL-REGRESO pagada correctamente", { exact: true }).waitFor();
  if (paymentCalls !== 1) throw new Error(`Expected one payment, got ${paymentCalls}`);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("playcoffee-pos-session")).state.selectedOrder);
  if (saved !== null) throw new Error("Paid order was not cleared from the session");
  if (unexpected.length) throw new Error(`Unexpected API routes: ${unexpected.join(", ")}`);
  return { blockedWithClosedShift: true, restoredAfterOpeningCash: true, restoredAfterReload: true,
    recoveredWithoutSavedSelection: true, excludedPaidAndTableOrders: true, paymentCalls, clearedAfterPayment: true };
}
