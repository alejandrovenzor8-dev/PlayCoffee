/** Local installations expose the API and Socket.IO through their HTTPS entry point. */
export function isLocalOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "::1" || hostname === "localhost" || (!hostname.includes(".") && !hostname.includes(":")) ||
      /\.(localhost|local|lan|home\.arpa)$/.test(hostname) || (hostname.includes(":") && /^(fc|fd|fe80:)/.test(hostname))) return true;
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254);
}

export function resolveApiOrigin(configured: string | undefined, browserOrigin?: string): string {
  if (browserOrigin && isLocalOrigin(browserOrigin)) return new URL(browserOrigin).origin;
  return (configured || "").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

export function resolveSocketOrigin(configured: string | undefined, browserOrigin?: string): string {
  if (browserOrigin && isLocalOrigin(browserOrigin)) {
    const current = new URL(browserOrigin);
    if (current.protocol === "https:") return current.origin;
    // Plain HTTP development/legacy installations reach Socket.IO directly.
    let port = "3001";
    if (configured) {
      try {
        const previous = new URL(configured);
        if (["http:", "ws:"].includes(previous.protocol) && previous.port && previous.port !== current.port) port = previous.port;
      } catch { /* Relative configuration uses the default local backend port. */ }
    }
    current.port = port;
    return current.origin;
  }
  return (configured || browserOrigin || "http://localhost:3001").replace(/\/+$/, "");
}
