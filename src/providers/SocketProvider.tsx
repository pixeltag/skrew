"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-client";
import { useLobbyStore } from "@/store/game-store";
import { useGameStore } from "@/store/game-store";
import {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@/types/game";

interface SocketContextValue {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

    const {
        setTables,
        setPlayer,
        setCurrentTable,
        setConnected,
        updateTableInList,
        addPlayerToTable,
        removePlayerFromTable,
        markPlayerDisconnected,
        setError,
    } = useLobbyStore();

    const { setGameState, setRoundResult, setGameResult, setView, notify } =
        useGameStore();

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        socket.on("connect", () => {
            setIsConnected(true);
            setConnected(true);
            console.log("[Socket] Connected:", socket.id);
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            setConnected(false);
            console.log("[Socket] Disconnected");
        });

        // Lobby events
        socket.on("lobby:joined", (player) => {
            setPlayer(player.id, player.nickname);
        });

        socket.on("lobby:tables_update", (tables) => {
            setTables(tables);
        });

        socket.on("lobby:table_update", (table) => {
            updateTableInList(table);
            const { currentTable } = useLobbyStore.getState();
            const { view } = useGameStore.getState();

            // If this is the table we're currently at, or we are waiting for it
            if (currentTable?.id === table.id || view === "table") {
                setCurrentTable(table);
            }
        });

        socket.on("lobby:error", (message) => {
            setError(message);
            notify(message, "error");
        });

        // Player events
        socket.on("player:joined_table", (player) => {
            addPlayerToTable(player);
            notify(`${player.nickname} joined the table`, "info");
        });

        socket.on("player:left_table", (playerId) => {
            removePlayerFromTable(playerId);
        });

        socket.on("player:disconnected", (playerId) => {
            markPlayerDisconnected(playerId);
            notify("A player disconnected", "warning");
        });

        socket.on("player:reconnected", (playerId) => {
            notify("A player reconnected", "success");
        });

        // Game events
        socket.on("game:started", (state) => {
            setGameState(state);
            setView("game");
            notify("Game started! Peek at 2 of your cards.", "success");
        });

        socket.on("game:state_update", (state) => {
            setGameState(state);
        });

        socket.on("game:round_end", (result) => {
            setRoundResult(result);
            notify(`Round ${result.roundNum} ended! Winner: ${result.winner}`, "info");
        });

        socket.on("game:over", (result) => {
            setGameResult(result);
            setView("results");
            notify("Game over!", "success");
        });

        socket.on("game:error", (message) => {
            notify(message, "error");
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("lobby:tables_update");
            socket.off("lobby:table_update");
            socket.off("lobby:error");
            socket.off("player:joined_table");
            socket.off("player:left_table");
            socket.off("player:disconnected");
            socket.off("player:reconnected");
            socket.off("game:started");
            socket.off("game:state_update");
            socket.off("game:round_end");
            socket.off("game:over");
            socket.off("game:error");
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
