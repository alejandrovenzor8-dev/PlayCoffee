// Open a dedicated playwright-cli session, then use run-code --filename with this file.
// Every API request is intercepted; no real sales, payments or accounts are changed.
async page => {
  const base = "http://localhost:3100";
  const line = (id, name, quantity, price) => ({ id, productId: id, quantity, unitPrice: price, totalPrice: quantity * price,
    status: "PENDING", product: { name, preparationStation: "NONE" }, notes: null, modifiers: [] });
  const current = { id: "edit-order", orderNumber: "PC-CORREGIR", status: "PENDING", tableId: null, total: 100,
    createdAt: "2026-11-18T18:30:00Z", payments: [], items: [line("water", "Agua natural", 2, 25), line("bread", "Pan", 1, 50)] };
  const old = { ...current, id: "old-order", orderNumber: "PC-VIEJA", total: 99, items: [] };
  const paid = { ...old, id: "paid-order", orderNumber: "PC-PAGADA", status: "COMPLETED", payments: [{ amount: 99, status: "COMPLETED" }] };
  let cancelled = 0;
  let corrections = 0;
  let reportRequest = "";
  const failures = [];
  const orderFor = id => [current, old, paid].find(order => order.id === id);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/health", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { status: "ok", database: "ok" } }) }));
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const suffix = request.url().split("/api/v1")[1];
    const path = suffix.split("?")[0];
    let data;
    if (request.method() === "GET") {
      if (path === "/orders") data = [current, old, paid];
      else if (/^\/orders\/[^/]+$/.test(path)) data = orderFor(path.split("/")[2]);
      else if (path.startsWith("/payments/order/")) {
        const order = orderFor(path.split("/")[3]);
        data = { payments: order.payments, summary: { orderId: order.id, total: order.total, totalPaid: 0, remainingAmount: order.total, paymentStatus: "UNPAID" } };
      } else if (path === "/payments/config") data = { tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [] };
      else if (path === "/print/cashier-policy") data = { confirmClose: false, allowReprint: true };
      else if (path === "/cash/closing-reminder") data = null;
      else if (["/products", "/products/categories", "/tables"].includes(path)) data = [];
      else if (path === "/reports/orders") {
        reportRequest = suffix;
        data = { timezone: "America/Mexico_City", orders: [current, old, paid].map(order => ({ ...order,
          table: null, responsible: "Ana Caja", totalPaid: order.status === "COMPLETED" ? 99 : 0,
          remainingAmount: ["COMPLETED", "CANCELLED"].includes(order.status) ? 0 : order.total,
          items: order.items.map(item => ({ ...item, name: item.product.name })) })) };
      } else if (["/reports/summary", "/reports/child-access", "/reports/reservations"].includes(path)) data = {};
      else if (path.startsWith("/reports/")) data = [];
      else failures.push(`${request.method()} ${path}`);
    } else if (request.method() === "PATCH" && path === "/orders/edit-order/items/water") {
      const body = request.postDataJSON();
      if (body.quantity !== 0 || !body.reason.trim()) throw new Error("Correction must remove the line with a reason");
      corrections += 1;
      current.items = current.items.filter(item => item.id !== "water");
      current.total = 50;
      data = current;
    } else if (request.method() === "POST" && path === "/orders/old-order/cancel-unpaid") {
      const body = request.postDataJSON();
      if (!body.confirmed || !body.reason.trim()) throw new Error("Missing cancellation confirmation");
      cancelled += 1;
      old.status = "CANCELLED";
      data = old;
    } else failures.push(`${request.method()} ${path}`);
    await route.fulfill({ status: data === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto(`${base}/login`);
  await page.evaluate(() => {
    localStorage.setItem("playcoffee-auth", JSON.stringify({ version: 0, state: { user: { id: "test-user", branchId: "test-branch", email: "test@example.invalid", firstName: "Ana", lastName: "Caja", role: "ADMIN", isActive: true }, accessToken: "test-token", refreshToken: "test-refresh", isAuthenticated: true } }));
    sessionStorage.removeItem("playcoffee-pos-session");
  });
  await page.goto(`${base}/pos?orderId=edit-order`);
  await page.getByRole("dialog").getByRole("button", { name: "Corregir", exact: true }).first().click();
  await page.getByRole("dialog").getByLabel("Cantidad", { exact: true }).fill("0");
  await page.getByRole("dialog").getByLabel("Motivo obligatorio", { exact: true }).fill("Producto capturado por error");
  await page.getByRole("button", { name: "Guardar corrección", exact: true }).click();
  await page.getByText("Comanda corregida. Revisa el nuevo total antes de cobrar.", { exact: true }).waitFor();
  if (corrections !== 1 || current.total !== 50) throw new Error("Incorrect correction total");
  await page.getByRole("button", { name: /^Cobrar/ }).click();
  await page.getByRole("dialog").getByText("Pan", { exact: false }).waitFor();
  if (await page.getByRole("dialog").getByText("Agua natural", { exact: false }).count()) throw new Error("Removed product still shown at checkout");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("combobox", { name: "Cuentas pendientes sin mesa" }).click();
  await page.getByRole("option", { name: /PC-VIEJA/ }).click();
  await page.getByRole("button", { name: "Borrar cuenta sin mesa", exact: true }).click();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  if (cancelled) throw new Error("Cancelled without confirmation");
  await page.getByRole("button", { name: "Borrar cuenta sin mesa", exact: true }).click();
  if (await page.getByRole("button", { name: "Confirmar borrado", exact: true }).isEnabled()) throw new Error("Cancellation does not require a reason");
  await page.getByRole("dialog").getByLabel("Motivo obligatorio", { exact: true }).fill("Cuenta vieja que no se cobrara");
  await page.getByRole("button", { name: "Confirmar borrado", exact: true }).click();
  await page.getByText("Cuenta cancelada y retirada de pendientes. Su historial se conserva.", { exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Cuentas pendientes sin mesa" }).click();
  if (await page.getByRole("option", { name: /PC-VIEJA/ }).count()) throw new Error("Cancelled account remains pending");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Reportes", exact: true }).click();
  await page.getByText("Comandas del periodo", { exact: true }).waitFor();
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill("2026-11-18");
  await dates.nth(1).fill("2026-11-18");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.getByRole("cell", { name: /PC-VIEJA/ }).waitFor();
  await page.getByRole("cell", { name: /PC-PAGADA/ }).waitFor();
  if (!reportRequest.includes("start=2026-11-18") || !reportRequest.includes("end=2026-11-18")) throw new Error("Wrong report range");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar comandas CSV", exact: true }).click()]);
  if (!download.suggestedFilename().includes("2026-11-18")) throw new Error("CSV period mismatch");
  if (failures.length) throw new Error(`Unexpected requests: ${failures.join(", ")}`);
  return { corrections, newTotal: current.total, cancelled, confirmationRequired: true, historyListedInReports: true, reportDateRange: reportRequest, csvExported: true };
}
