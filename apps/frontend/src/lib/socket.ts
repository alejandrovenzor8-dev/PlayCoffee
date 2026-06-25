import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

function getWsUrl() {
  const value = process.env.NEXT_PUBLIC_WS_URL;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_WS_URL is required");
  }
  return value ?? "http://localhost:3001";
}

export function getSocket(): Socket {
  const wsUrl = getWsUrl();
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  if (!socket) {
    socket = io(`${wsUrl}/realtime`, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: { token },
    });
  } else {
    socket.auth = { token };
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
