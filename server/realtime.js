import { Server } from "socket.io";
import { verifySessionToken } from "./lib/auth.js";
import { findUserById, listChatGroups } from "./lib/news-store.js";
import { groupRoom, villageRoom } from "./lib/news-types.js";

let io = null;

export function getIo() {
  return io;
}

export function attachRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || "";
      const session = verifySessionToken(token);
      if (!session) return next(new Error("auth"));
      const user = await findUserById(session.groupId);
      if (!user) return next(new Error("auth"));
      socket.data.user = user;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;
    socket.join(villageRoom(user.pincode, user.villageName));
    socket.join(`user:${user._id}`);
    try {
      const groups = await listChatGroups(user._id);
      for (const g of groups) socket.join(groupRoom(g._id));
    } catch {
      /* ignore */
    }

    socket.on("chat:join", (roomId) => {
      if (typeof roomId !== "string") return;
      if (roomId.startsWith("dm:") && roomId.includes(user._id)) socket.join(roomId);
      if (roomId.startsWith("group:")) socket.join(roomId);
      if (roomId.startsWith("village:")) socket.join(roomId);
    });
  });

  return io;
}

export function emitVillageAlert(pincode, villageName, payload) {
  if (!io) return;
  io.to(villageRoom(pincode, villageName)).emit("village:alert", payload);
}

export function emitChat(roomId, payload, extraUserIds = []) {
  if (!io) return;
  io.to(roomId).emit("chat:message", payload);
  for (const id of extraUserIds) {
    if (id) io.to(`user:${id}`).emit("chat:message", payload);
  }
}

export function emitChatInbox(userIds, payload) {
  if (!io) return;
  for (const id of userIds) {
    if (id) io.to(`user:${id}`).emit("chat:inbox", payload);
  }
}
