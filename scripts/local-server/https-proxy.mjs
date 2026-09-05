import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const frontendPort = Number(process.env.FRONTEND_PORT ?? 3000);
const backendPort = Number(process.env.PORT ?? 3001);
const httpsPort = Number(process.env.HTTPS_PORT ?? 3443);
const pfxPath = process.env.TLS_PFX_PATH;
const passphrase = process.env.TLS_PFX_PASSWORD;

if (!pfxPath || !passphrase) {
  throw new Error("TLS_PFX_PATH and TLS_PFX_PASSWORD are required");
}

function targetFor(pathname) {
  return pathname === "/health" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/socket.io/")
    ? { port: backendPort, name: "backend" }
    : { port: frontendPort, name: "frontend" };
}

const server = https.createServer(
  { pfx: fs.readFileSync(pfxPath), passphrase },
  (request, response) => {
    const target = targetFor(
      new URL(request.url ?? "/", "https://playcoffee.local").pathname,
    );
    const headers = {
      ...request.headers,
      host: `127.0.0.1:${target.port}`,
      "x-forwarded-host": request.headers.host ?? "playcoffee.local",
      "x-forwarded-proto": "https",
    };
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: target.port,
        path: request.url,
        method: request.method,
        headers,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );
    upstream.on("error", (error) => {
      if (!response.headersSent)
        response.writeHead(502, {
          "content-type": "text/plain; charset=utf-8",
        });
      response.end(`Servicio ${target.name} no disponible: ${error.message}`);
    });
    request.pipe(upstream);
  },
);

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url ?? "/", "https://playcoffee.local")
    .pathname;
  const target = targetFor(pathname);
  const upstream = net.connect(target.port, "127.0.0.1", () => {
    const headerLines = Object.entries(request.headers).map(([name, value]) => {
      const rendered = Array.isArray(value) ? value.join(", ") : (value ?? "");
      return `${name}: ${rendered}`;
    });
    upstream.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headerLines.join("\r\n")}\r\n\r\n`,
    );
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
});

server.listen(httpsPort, "0.0.0.0", () => {
  process.stdout.write(
    `PlayCoffee HTTPS proxy listening on port ${httpsPort}\n`,
  );
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
