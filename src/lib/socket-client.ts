import { io, Socket } from "socket.io-client";
import {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@/types/game";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket) {
        socket = io({
            path: "/api/socket",
            transports: ["websocket", "polling"],
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
