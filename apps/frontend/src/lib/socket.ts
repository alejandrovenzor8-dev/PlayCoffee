import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";

let socket: Socket | null = null;

useAuthStore.subscribe((state, previous) => {
  if (!socket || state.accessToken === previous.accessToken) return;
  socket.disconnect();
  if (state.accessToken) socket.connect();
});

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

function getWsUrl() {
  const value = process.env.NEXT_PUBLIC_WS_URL;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_WS_URL is required");
  }
  if (value) return value.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const url = new URL(window.location.origin);
    url.port = "3001";
    return url.origin;
  }
  return "http://localhost:3001";
}

export function getSocket(): Socket {
  const wsUrl = getWsUrl();
  const token = useAuthStore.getState().accessToken;

  if (!socket) {
    socket = io(`${wsUrl}/realtime`, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    });
  } else {
    // A refreshed token must also be used on the next reconnection.
    socket.auth = (callback) => callback({ token: useAuthStore.getState().accessToken });
  }

  if (token && !socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
