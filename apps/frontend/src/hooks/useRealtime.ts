"use client";

import { useEffect, useState } from "react";
import { getSocket, RealtimeStatus } from "@/lib/socket";

type RealtimeHandler = (payload: unknown) => void;

export function useRealtime(events: Record<string, RealtimeHandler>) {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onConnectError = () => setStatus("disconnected");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("connect_error", onConnectError);

    const entries = Object.entries(events);
    entries.forEach(([event, handler]) => socket.on(event, handler));

    if (socket.connected) setStatus("connected");

    return () => {
      entries.forEach(([event, handler]) => socket.off(event, handler));
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("connect_error", onConnectError);
    };
  }, [events]);

  return { status };
}
