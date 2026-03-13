import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    TableInfo,
    PlayerInfo,
    GameState,
} from "@/types/game";
import {
    initializeGameState,
    buildClientState,
    drawFromDeck,
    drawFromDiscard,
    swapCard,
    discardDrawn,
    callScrew,
    useSpecialAbility,
    resolveRound,
    getHeldCard,
} from "@/lib/game-engine";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// ============================================================
// IN-MEMORY STATE (fast access; persisted to DB on key events)
// ============================================================

interface TableRoom {
    info: TableInfo;
    players: Map<string, PlayerInfo>; // socketId -> PlayerInfo
    gameState: GameState | null;
    peekDone: Set<string>; // playerIds who finished initial peek
}

const tableRooms = new Map<string, TableRoom>(); // tableId -> TableRoom
const socketPlayerMap = new Map<string, { playerId: string; tableId: string | null }>(); // socketId -> { playerId, tableId }

export function initSocketServer(httpServer: HTTPServer) {
    const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
        httpServer,
        {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            },
            path: "/api/socket",
        }
    );

    io.on("connection", (socket: Socket) => {
        console.log("[Socket] Connected:", socket.id);

        // --------------------------------------------------------
        // LOBBY: JOIN (authenticate with nickname)
        // --------------------------------------------------------
        socket.on("lobby:join", async ({ nickname }) => {
            try {
                // Create or update player in DB
                const player = await prisma.player.upsert({
                    where: { sessionId: socket.id },
                    update: { nickname },
                    create: {
                        id: uuidv4(),
                        nickname,
                        sessionId: socket.id,
                    },
                });

                socketPlayerMap.set(socket.id, { playerId: player.id, tableId: null });

                // Send current tables
                const tables = await getPublicTables();
                socket.emit("lobby:tables_update", tables);
            } catch (err) {
                console.error("[lobby:join] Error:", err);
                socket.emit("lobby:error", "Failed to join lobby");
            }
        });

        // --------------------------------------------------------
        // LOBBY: CREATE TABLE
        // --------------------------------------------------------
        socket.on("lobby:create_table", async ({ name, maxPlayers }) => {
            try {
                const playerMeta = socketPlayerMap.get(socket.id);
                if (!playerMeta) {
                    socket.emit("lobby:error", "Not authenticated");
                    return;
                }

                const player = await prisma.player.findUnique({
                    where: { sessionId: socket.id },
                });
                if (!player) {
                    socket.emit("lobby:error", "Player not found");
                    return;
                }

                // Create table in DB
                const table = await prisma.table.create({
                    data: {
                        id: uuidv4(),
                        name: name || `${player.nickname}'s Table`,
                        maxPlayers: Math.min(Math.max(maxPlayers, 2), 4),
                    },
                });

                // Seat the creator at position 0
                await prisma.seat.create({
                    data: {
                        id: uuidv4(),
                        tableId: table.id,
                        playerId: player.id,
                        position: 0,
                    },
                });

                const playerInfo: PlayerInfo = {
                    id: player.id,
                    nickname: player.nickname,
                    position: 0,
                    isConnected: true,
                };

                // Create in-memory room
                const tableInfo: TableInfo = {
                    id: table.id,
                    name: table.name,
                    status: "waiting",
                    maxPlayers: table.maxPlayers,
                    players: [playerInfo],
                    createdAt: table.createdAt.toISOString(),
                };

                const room: TableRoom = {
                    info: tableInfo,
                    players: new Map([[socket.id, playerInfo]]),
                    gameState: null,
                    peekDone: new Set(),
                };

                tableRooms.set(table.id, room);

                // Join socket room
                socket.join(`table:${table.id}`);
                socketPlayerMap.set(socket.id, { playerId: player.id, tableId: table.id });

                // Broadcast updated tables
                broadcastTablesUpdate(io);
                socket.emit("lobby:table_update", tableInfo);
            } catch (err) {
                console.error("[lobby:create_table] Error:", err);
                socket.emit("lobby:error", "Failed to create table");
            }
        });

        // --------------------------------------------------------
        // LOBBY: JOIN TABLE
        // --------------------------------------------------------
        socket.on("lobby:join_table", async ({ tableId }) => {
            try {
                const playerMeta = socketPlayerMap.get(socket.id);
                if (!playerMeta) {
                    socket.emit("lobby:error", "Not authenticated");
                    return;
                }

                const room = tableRooms.get(tableId);
                if (!room) {
                    socket.emit("lobby:error", "Table not found");
                    return;
                }

                if (room.info.status !== "waiting") {
                    socket.emit("lobby:error", "Game already in progress");
                    return;
                }

                if (room.info.players.length >= room.info.maxPlayers) {
                    socket.emit("lobby:error", "Table is full");
                    return;
                }

                const player = await prisma.player.findUnique({
                    where: { sessionId: socket.id },
                });
                if (!player) {
                    socket.emit("lobby:error", "Player not found");
                    return;
                }

                // Check player isn't already in room
                const alreadyIn = [...room.players.values()].find(
                    (p) => p.id === player.id
                );
                if (alreadyIn) {
                    socket.emit("lobby:error", "Already at this table");
                    return;
                }

                const position = room.info.players.length;

                await prisma.seat.create({
                    data: {
                        id: uuidv4(),
                        tableId,
                        playerId: player.id,
                        position,
                    },
                });

                const playerInfo: PlayerInfo = {
                    id: player.id,
                    nickname: player.nickname,
                    position,
                    isConnected: true,
                };

                room.players.set(socket.id, playerInfo);
                room.info.players.push(playerInfo);

                socket.join(`table:${tableId}`);
                socketPlayerMap.set(socket.id, { playerId: player.id, tableId });

                // Notify room
                io.to(`table:${tableId}`).emit("player:joined_table", playerInfo);
                io.to(`table:${tableId}`).emit("lobby:table_update", room.info);
                broadcastTablesUpdate(io);
            } catch (err) {
                console.error("[lobby:join_table] Error:", err);
                socket.emit("lobby:error", "Failed to join table");
            }
        });

        // --------------------------------------------------------
        // LOBBY: LEAVE TABLE
        // --------------------------------------------------------
        socket.on("lobby:leave_table", async ({ tableId }) => {
            handleLeaveTable(socket, io, tableId);
        });

        // --------------------------------------------------------
        // GAME: START
        // --------------------------------------------------------
        socket.on("game:start", async ({ tableId }) => {
            try {
                const room = tableRooms.get(tableId);
                if (!room) {
                    socket.emit("game:error", "Table not found");
                    return;
                }

                if (room.info.players.length < 2) {
                    socket.emit("game:error", "Need at least 2 players to start");
                    return;
                }

                if (room.info.status === "in_game") {
                    socket.emit("game:error", "Game already started");
                    return;
                }

                room.info.status = "in_game";
                room.peekDone.clear();

                // Build previous scores from existing game state
                const prevScores = room.gameState?.scores ?? {};

                const gameState = initializeGameState(
                    tableId,
                    room.info.players,
                    (room.gameState?.round ?? 0) + 1,
                    prevScores
                );

                room.gameState = gameState;

                // Update DB
                await prisma.table.update({
                    where: { id: tableId },
                    data: { status: "IN_GAME", currentRound: gameState.round },
                });

                // Save round to DB
                await prisma.round.create({
                    data: {
                        id: uuidv4(),
                        tableId,
                        roundNum: gameState.round,
                        gameState: gameState as any,
                    },
                });

                // Send personalized state to each player
                for (const [socketId, playerInfo] of room.players) {
                    const clientState = buildClientState(gameState, playerInfo.id);
                    io.to(socketId).emit("game:started", clientState);
                }

                broadcastTablesUpdate(io);
            } catch (err) {
                console.error("[game:start] Error:", err);
                socket.emit("game:error", "Failed to start game");
            }
        });

        // --------------------------------------------------------
        // GAME: PEEK DONE (initial peek phase)
        // --------------------------------------------------------
        socket.on("game:peek_done", ({ tableId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            room.peekDone.add(playerMeta.playerId);

            // When all players are done peeking, start playing
            if (room.peekDone.size >= room.info.players.length) {
                room.gameState = {
                    ...room.gameState,
                    phase: "playing",
                };

                broadcastGameState(io, room);
            }
        });

        // --------------------------------------------------------
        // GAME: DRAW FROM DECK
        // --------------------------------------------------------
        socket.on("game:draw_deck", ({ tableId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            const result = drawFromDeck(room.gameState, playerMeta.playerId);
            if (!result.success) {
                socket.emit("game:error", result.error);
                return;
            }

            room.gameState = result.state;
            broadcastGameState(io, room);
        });

        // --------------------------------------------------------
        // GAME: DRAW FROM DISCARD
        // --------------------------------------------------------
        socket.on("game:draw_discard", ({ tableId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            const result = drawFromDiscard(room.gameState, playerMeta.playerId);
            if (!result.success) {
                socket.emit("game:error", result.error);
                return;
            }

            room.gameState = result.state;
            broadcastGameState(io, room);
        });

        // --------------------------------------------------------
        // GAME: SWAP CARD
        // --------------------------------------------------------
        socket.on("game:swap_card", ({ tableId, handIndex, drawnCardId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            const result = swapCard(room.gameState, playerMeta.playerId, handIndex);
            if (!result.success) {
                socket.emit("game:error", result.error);
                return;
            }

            room.gameState = result.state;
            handleRoundEnd(io, room);
        });

        // --------------------------------------------------------
        // GAME: DISCARD DRAWN
        // --------------------------------------------------------
        socket.on("game:discard_drawn", ({ tableId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            const result = discardDrawn(room.gameState, playerMeta.playerId);
            if (!result.success) {
                socket.emit("game:error", result.error);
                return;
            }

            room.gameState = result.state;
            handleRoundEnd(io, room);
        });

        // --------------------------------------------------------
        // GAME: CALL SCREW
        // --------------------------------------------------------
        socket.on("game:call_screw", ({ tableId }) => {
            const playerMeta = socketPlayerMap.get(socket.id);
            if (!playerMeta) return;

            const room = tableRooms.get(tableId);
            if (!room || !room.gameState) return;

            const result = callScrew(room.gameState, playerMeta.playerId);
            if (!result.success) {
                socket.emit("game:error", result.error);
                return;
            }

            room.gameState = result.state;
            broadcastGameState(io, room);
        });

        // --------------------------------------------------------
        // GAME: USE SPECIAL ABILITY
        // --------------------------------------------------------
        socket.on(
            "game:use_special",
            ({ tableId, cardId, targetPlayerId, targetCardIndex, handIndex }) => {
                const playerMeta = socketPlayerMap.get(socket.id);
                if (!playerMeta) return;

                const room = tableRooms.get(tableId);
                if (!room || !room.gameState) return;

                const result = useSpecialAbility(
                    room.gameState,
                    playerMeta.playerId,
                    cardId,
                    targetPlayerId,
                    targetCardIndex,
                    handIndex
                );
                if (!result.success) {
                    socket.emit("game:error", result.error);
                    return;
                }

                room.gameState = result.state;
                broadcastGameState(io, room);

                // After 3 seconds, hide peeked cards again
                setTimeout(() => {
                    if (room.gameState) {
                        room.gameState = {
                            ...room.gameState,
                            players: room.gameState.players.map((p) => ({
                                ...p,
                                cards: p.cards.map((c) => ({ ...c, faceUp: false })),
                            })),
                        };
                        broadcastGameState(io, room);
                    }
                }, 3000);
            }
        );

        // --------------------------------------------------------
        // DISCONNECT
        // --------------------------------------------------------
        socket.on("disconnect", () => {
            console.log("[Socket] Disconnected:", socket.id);
            const playerMeta = socketPlayerMap.get(socket.id);

            if (playerMeta?.tableId) {
                const room = tableRooms.get(playerMeta.tableId);
                if (room) {
                    const playerInfo = room.players.get(socket.id);
                    if (playerInfo) {
                        playerInfo.isConnected = false;
                        io.to(`table:${playerMeta.tableId}`).emit(
                            "player:disconnected",
                            playerInfo.id
                        );
                    }
                }
            }

            socketPlayerMap.delete(socket.id);
        });
    });

    return io;
}

// ============================================================
// HELPERS
// ============================================================

async function getPublicTables(): Promise<TableInfo[]> {
    const tables = [...tableRooms.values()]
        .filter((r) => r.info.status !== "finished")
        .map((r) => r.info);
    return tables;
}

function broadcastTablesUpdate(io: SocketIOServer) {
    const tables = [...tableRooms.values()]
        .filter((r) => r.info.status !== "finished")
        .map((r) => r.info);
    io.emit("lobby:tables_update", tables);
}

function broadcastGameState(io: SocketIOServer, room: TableRoom) {
    if (!room.gameState) return;

    for (const [socketId, playerInfo] of room.players) {
        const clientState = buildClientState(room.gameState, playerInfo.id);
        io.to(socketId).emit("game:state_update", clientState);
    }
}

async function handleRoundEnd(io: SocketIOServer, room: TableRoom) {
    if (!room.gameState) return;

    if (
        room.gameState.phase === "revealing" ||
        room.gameState.phase === "scoring" ||
        room.gameState.phase === "finished"
    ) {
        const { result, newState } = resolveRound(room.gameState);
        room.gameState = newState;

        // Persist to DB
        try {
            await prisma.round.update({
                where: {
                    tableId_roundNum: {
                        tableId: room.info.id,
                        roundNum: result.roundNum,
                    },
                },
                data: {
                    status: "FINISHED",
                    endedAt: new Date(),
                    gameState: newState as any,
                },
            });
        } catch (e) {
            console.error("[handleRoundEnd] DB error:", e);
        }

        io.to(`table:${room.info.id}`).emit("game:round_end", result);

        if (newState.gameWinner) {
            io.to(`table:${room.info.id}`).emit("game:over", {
                winner: newState.gameWinner,
                scores: newState.scores,
                rounds: newState.round,
            });
            room.info.status = "finished";

            await prisma.table.update({
                where: { id: room.info.id },
                data: { status: "FINISHED" },
            });

            broadcastTablesUpdate(io);
        } else {
            broadcastGameState(io, room);
        }
    } else {
        broadcastGameState(io, room);
    }
}

function handleLeaveTable(
    socket: Socket,
    io: SocketIOServer,
    tableId: string
) {
    const room = tableRooms.get(tableId);
    if (!room) return;

    const playerInfo = room.players.get(socket.id);
    if (!playerInfo) return;

    room.players.delete(socket.id);
    room.info.players = room.info.players.filter((p) => p.id !== playerInfo.id);

    socket.leave(`table:${tableId}`);
    socketPlayerMap.set(socket.id, {
        playerId: playerInfo.id,
        tableId: null,
    });

    io.to(`table:${tableId}`).emit("player:left_table", playerInfo.id);
    io.to(`table:${tableId}`).emit("lobby:table_update", room.info);

    if (room.players.size === 0) {
        tableRooms.delete(tableId);
    }

    broadcastTablesUpdate(io);
}
