import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(branchId?: string): Socket {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

  if (!socket) {
    socket = io(`${WS_URL}/orders`, {
      autoConnect: false,
      auth: {
        token: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
      },
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket?.id);
      if (branchId) socket?.emit("joinBranch", branchId);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}
