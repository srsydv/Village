import { io } from "socket.io-client";

let socket = null;
const chatHandlers = new Set();

export function connectNewsSocket(token, handlers = {}) {
  disconnectNewsSocket();
  socket = io({
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
  });
  socket.on("village:alert", (payload) => handlers.onAlert?.(payload));
  socket.on("chat:message", (payload) => {
    handlers.onChat?.(payload);
    for (const fn of chatHandlers) fn(payload);
  });
  socket.on("connect", () => handlers.onStatus?.(true));
  socket.on("disconnect", () => handlers.onStatus?.(false));
  socket.on("connect_error", () => handlers.onStatus?.(false));
  return socket;
}

export function onChatMessage(fn) {
  chatHandlers.add(fn);
  return () => chatHandlers.delete(fn);
}

export function joinChatRoom(roomId) {
  if (roomId) socket?.emit("chat:join", roomId);
}

export function isNewsSocketConnected() {
  return Boolean(socket?.connected);
}

export function disconnectNewsSocket() {
  chatHandlers.clear();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
