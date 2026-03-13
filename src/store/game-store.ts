import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
    TableInfo,
    PlayerInfo,
    GameStateClient,
    RoundResult,
    GameResult,
} from "@/types/game";

// ============================================================
// LOBBY STORE
// ============================================================

interface LobbyState {
    playerId: string | null;
    nickname: string | null;
    tables: TableInfo[];
    currentTable: TableInfo | null;
    isConnected: boolean;
    error: string | null;

    setPlayer: (id: string, nickname: string) => void;
    setTables: (tables: TableInfo[]) => void;
    setCurrentTable: (table: TableInfo | null) => void;
    setConnected: (connected: boolean) => void;
    setError: (error: string | null) => void;
    updateTableInList: (table: TableInfo) => void;
    addPlayerToTable: (player: PlayerInfo) => void;
    removePlayerFromTable: (playerId: string) => void;
    markPlayerDisconnected: (playerId: string) => void;
}

export const useLobbyStore = create<LobbyState>()(
    devtools(
        (set) => ({
            playerId: null,
            nickname: null,
            tables: [],
            currentTable: null,
            isConnected: false,
            error: null,

            setPlayer: (id, nickname) => set({ playerId: id, nickname }),
            setTables: (tables) => set({ tables }),
            setCurrentTable: (table) => set({ currentTable: table }),
            setConnected: (connected) => set({ isConnected: connected }),
            setError: (error) => set({ error }),

            updateTableInList: (table) =>
                set((state) => ({
                    tables: state.tables.some((t) => t.id === table.id)
                        ? state.tables.map((t) => (t.id === table.id ? table : t))
                        : [...state.tables, table],
                    currentTable:
                        state.currentTable?.id === table.id ? table : state.currentTable,
                })),

            addPlayerToTable: (player) =>
                set((state) => {
                    if (!state.currentTable) return state;
                    const already = state.currentTable.players.find(
                        (p) => p.id === player.id
                    );
                    if (already) return state;
                    return {
                        currentTable: {
                            ...state.currentTable,
                            players: [...state.currentTable.players, player],
                        },
                    };
                }),

            removePlayerFromTable: (playerId) =>
                set((state) => {
                    if (!state.currentTable) return state;
                    return {
                        currentTable: {
                            ...state.currentTable,
                            players: state.currentTable.players.filter(
                                (p) => p.id !== playerId
                            ),
                        },
                    };
                }),

            markPlayerDisconnected: (playerId) =>
                set((state) => {
                    if (!state.currentTable) return state;
                    return {
                        currentTable: {
                            ...state.currentTable,
                            players: state.currentTable.players.map((p) =>
                                p.id === playerId ? { ...p, isConnected: false } : p
                            ),
                        },
                    };
                }),
        }),
        { name: "LobbyStore" }
    )
);

// ============================================================
// GAME STORE
// ============================================================

type GameView = "lobby" | "table" | "game" | "results";

interface GameStore {
    view: GameView;
    gameState: GameStateClient | null;
    roundResult: RoundResult | null;
    gameResult: GameResult | null;
    drawnCard: import("@/types/game").Card | null;
    selectedCardIndex: number | null;
    specialPending: {
        cardId: string;
        rank: string;
        step: "pick_own" | "pick_target" | "done";
    } | null;
    notification: { message: string; type: "info" | "success" | "error" | "warning" } | null;

    setView: (view: GameView) => void;
    setGameState: (state: GameStateClient) => void;
    setRoundResult: (result: RoundResult) => void;
    setGameResult: (result: GameResult) => void;
    setSelectedCardIndex: (index: number | null) => void;
    setSpecialPending: (pending: GameStore["specialPending"]) => void;
    clearResults: () => void;
    notify: (message: string, type?: "info" | "success" | "error" | "warning") => void;
    clearNotification: () => void;
}

export const useGameStore = create<GameStore>()(
    devtools(
        (set) => ({
            view: "lobby",
            gameState: null,
            roundResult: null,
            gameResult: null,
            drawnCard: null,
            selectedCardIndex: null,
            specialPending: null,
            notification: null,

            setView: (view) => set({ view }),
            setGameState: (gameState) => set({ gameState }),
            setRoundResult: (roundResult) => set({ roundResult }),
            setGameResult: (gameResult) => set({ gameResult }),
            setSelectedCardIndex: (selectedCardIndex) => set({ selectedCardIndex }),
            setSpecialPending: (specialPending) => set({ specialPending }),
            clearResults: () =>
                set({ roundResult: null, gameResult: null, gameState: null }),
            notify: (message, type = "info") =>
                set({ notification: { message, type } }),
            clearNotification: () => set({ notification: null }),
        }),
        { name: "GameStore" }
    )
);
