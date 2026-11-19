// Production build regression with deliberately stale public API/WS environment values.
// HTTPS and all API/WebSocket traffic are intercepted. Never contacts the customer's computer.
async page => {
  const origin = "https://192.168.1.80:3443";
  const assets = "http://127.0.0.1:3100";
  const requests = [];
  const sockets = [];
  const unexpected = [];
  await page.context().addInitScript(() => {
    // The virtual HTTPS address has no real TLS server for installing a worker.
    if (navigator.serviceWorker) navigator.serviceWorker.register = async () => ({});
  });
  await page.routeWebSocket("**/socket.io/**", socket => {
    sockets.push(socket.url());
    socket.close();
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = request.url();
    if (!url.startsWith(origin + "/")) {
      unexpected.push(url);
      return route.abort();
    }
    const path = url.slice(origin.length).split("?")[0];
    if (path === "/health") {
      requests.push(url);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { status: "ok", database: "ok" } }) });
    }
    if (path.startsWith("/api/")) {
      requests.push(url);
      let data;
      if (path === "/api/v1/auth/login") data = {
        user: { id: "test-user", branchId: "test-branch", email: "test@example.invalid", firstName: "Ana", lastName: "Caja", role: "CASHIER", isActive: true },
        accessToken: "test-token", refreshToken: "test-refresh",
      };
      else if (path === "/api/v1/cash/closing-reminder") data = null;
      else if (path === "/api/v1/payments/config") data = { tipEnabled: false, defaultTipPercentage: 0, tipPercentages: [] };
      else if (path === "/api/v1/print/cashier-policy") data = { confirmClose: false, allowReprint: true };
      else if (["/api/v1/products", "/api/v1/products/categories", "/api/v1/tables", "/api/v1/orders"].includes(path)) data = [];
      else throw new Error(`Unexpected API request ${path}`);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
    }
    const response = await route.fetch({ url: url.replace(origin, assets) });
    return route.fulfill({ response });
  });
  await page.goto(`${origin}/login`);
  await page.locator('input[type="email"]').fill("test@example.invalid");
  await page.locator('input[type="password"]').fill("test-password");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.waitForURL(`${origin}/pos`);
  await page.getByRole("combobox", { name: "Cuentas pendientes sin mesa" }).waitFor();
  // Wait for the health response and the authenticated realtime connection attempt.
  await page.waitForFunction(() => !document.body.innerText.includes("Sin conexión con el servidor local"));
  await page.waitForFunction(() => document.body.innerText.includes("No hay productos") || document.body.innerText.includes("Carrito vacío"));
  if (!requests.some(url => url === `${origin}/api/v1/auth/login`)) throw new Error("Login did not use the current HTTPS address");
  if (!requests.some(url => url === `${origin}/health`)) throw new Error("Health check did not use the current HTTPS address");
  if (!requests.some(url => url.includes("/api/v1/orders"))) throw new Error("Did not load orders");
  if (!sockets.length || sockets.some(url => !url.startsWith("wss://192.168.1.80:3443/"))) throw new Error(`Wrong realtime origins: ${sockets.join(", ")}`);
  if (unexpected.length) throw new Error(`Contacted a stale or external address: ${unexpected.join(", ")}`);
  if (await page.getByText("Sin conexión con el servidor local.", { exact: false }).count()) throw new Error("False offline banner");
  return { login: "same HTTPS origin", health: "same HTTPS origin", orders: "same HTTPS origin", realtime: sockets[0], staleAddressesContacted: unexpected.length, falseOfflineBanner: false };
}
