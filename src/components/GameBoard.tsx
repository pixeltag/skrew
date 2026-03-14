"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket-client";
import { useLobbyStore, useGameStore } from "@/store/game-store";
import { ClientCard, ClientPlayerHand } from "@/types/game";
import PlayingCard from "./PlayingCard";
import clsx from "clsx";

// ============================================================
// MAIN GAME BOARD
// ============================================================

export default function GameBoard() {
    const { playerId, nickname, currentTable } = useLobbyStore();
    const { gameState, roundResult, setView, notify } = useGameStore();
    const socket = getSocket();

    const [peekDone, setPeekDone] = useState(false);
    const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
    const [hoveredPile, setHoveredPile] = useState<"deck" | "discard" | null>(null);

    const isMyTurn = gameState?.currentTurn === playerId;
    const hasDrawnCard = !!gameState?.drawnCard;
    const phase = gameState?.phase;

    // Get my hand
    const myHand = gameState?.players.find((p) => p.playerId === playerId);
    // Get other players
    const otherPlayers = gameState?.players.filter((p) => p.playerId !== playerId) ?? [];

    // Map playerId to nickname from gameState
    const playerNames: Record<string, string> = {};
    gameState?.players.forEach((p) => {
        playerNames[p.playerId] = p.nickname;
    });

    // Reset local states for new round
    useEffect(() => {
        if (gameState?.round) {
            setPeekDone(false);
            setSelectedHandIndex(null);
        }
    }, [gameState?.round]);

    // Handle initial peek done
    const handlePeekDone = () => {
        if (!gameState) return;
        setPeekDone(true);
        socket.emit("game:peek_done", { tableId: gameState.tableId });
    };

    // Draw from deck
    const handleDrawDeck = () => {
        if (!gameState || !isMyTurn || hasDrawnCard || (phase !== "playing" && phase !== "screw_called")) return;
        socket.emit("game:draw_deck", { tableId: gameState.tableId });
    };

    // Draw from discard
    const handleDrawDiscard = () => {
        if (!gameState || !isMyTurn || hasDrawnCard || (phase !== "playing" && phase !== "screw_called")) return;
        if (!gameState.discardTop) return;
        socket.emit("game:draw_discard", { tableId: gameState.tableId });
    };

    // Swap drawn card with hand card
    const handleSwapCard = (index: number) => {
        if (!gameState || !isMyTurn || !hasDrawnCard) return;
        socket.emit("game:swap_card", {
            tableId: gameState.tableId,
            handIndex: index,
            drawnCardId: gameState.drawnCard!.id,
        });
        setSelectedHandIndex(null);
    };

    // Discard drawn card
    const handleDiscardDrawn = () => {
        if (!gameState || !isMyTurn || !hasDrawnCard) return;
        socket.emit("game:discard_drawn", { tableId: gameState.tableId, cardId: gameState.drawnCard!.id });
    };

    // Call SCREW
    const handleCallScrew = () => {
        if (!gameState || !isMyTurn || hasDrawnCard || phase !== "playing") return;
        if (confirm("Call SCREW? All players get one more turn, then cards are revealed!")) {
            socket.emit("game:call_screw", { tableId: gameState.tableId });
        }
    };

    if (!gameState) return null;

    const currentPlayerName =
        playerNames[gameState.currentTurn] ?? "Unknown";

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-black/30 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <span className="text-emerald-400 font-black text-lg">🃏 SKREW</span>
                    <div className="bg-white/5 rounded-lg px-3 py-1 text-sm">
                        <span className="text-gray-400">Round </span>
                        <span className="text-white font-bold">{gameState.round}</span>
                    </div>
                    {gameState.phase === "screw_called" && (
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="bg-red-500/20 border border-red-500/50 rounded-lg px-3 py-1 text-red-400 text-sm font-bold"
                        >
                            🚨 SCREW CALLED!
                        </motion.div>
                    )}
                </div>

                {/* Scores */}
                <div className="flex items-center gap-3">
                    {Object.entries(gameState.scores).map(([pid, score]) => (
                        <div
                            key={pid}
                            className={clsx(
                                "px-3 py-1 rounded-lg text-sm",
                                pid === playerId
                                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                                    : "bg-white/5 text-gray-400"
                            )}
                        >
                            <span className="font-semibold">{playerNames[pid] ?? pid.slice(0, 6)}</span>
                            <span className="ml-2 text-xs opacity-70">{score}pts</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main game area */}
            <div className="flex-1 relative flex flex-col">
                {/* Opponent players (top) */}
                <div className="flex justify-around items-start pt-6 px-6">
                    {otherPlayers.map((player, i) => (
                        <OpponentHand
                            key={player.playerId}
                            player={player}
                            name={playerNames[player.playerId] ?? "Player"}
                            isCurrentTurn={gameState.currentTurn === player.playerId}
                            isScrewCaller={gameState.screwCallerId === player.playerId}
                        />
                    ))}
                </div>

                {/* Center table */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative">
                        {/* Felt table surface */}
                        <div className="absolute inset-0 -m-16 rounded-full bg-gradient-radial from-emerald-900/40 to-transparent blur-2xl" />

                        <div className="relative flex items-center gap-12">
                            {/* Deck */}
                            <div className="flex flex-col items-center gap-2">
                                <motion.div
                                    id="deck-pile"
                                    onClick={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? handleDrawDeck : undefined}
                                    whileHover={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? { scale: 1.08 } : {}}
                                    whileTap={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? { scale: 0.95 } : {}}
                                    className={clsx(
                                        "relative w-20 h-28 rounded-xl border-2 transition-all",
                                        isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called")
                                            ? "border-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/30"
                                            : "border-emerald-800/50 cursor-default"
                                    )}
                                >
                                    {/* Stacked card effect */}
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-900 border-2 border-emerald-700/30" />
                                    <div className="absolute inset-0 translate-x-0.5 -translate-y-0.5 rounded-xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-800 border border-emerald-600/30 -z-10" />
                                    <div className="absolute inset-0 translate-x-1 -translate-y-1 rounded-xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-800 border border-emerald-600/20 -z-20" />
                                    <div className="flex items-center justify-center h-full relative z-10">
                                        <span className="text-emerald-300 text-2xl">🂠</span>
                                    </div>
                                </motion.div>
                                <span className="text-gray-500 text-xs">{gameState.deckCount} cards</span>
                                {isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") && (
                                    <span className="text-emerald-400 text-xs font-bold animate-pulse">Draw</span>
                                )}
                            </div>

                            {/* Discard pile */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="relative w-20 h-28">
                                    {gameState.discardTop ? (
                                        <motion.div
                                            id="discard-pile"
                                            onClick={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? handleDrawDiscard : undefined}
                                            whileHover={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? { scale: 1.08 } : {}}
                                            whileTap={isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") ? { scale: 0.95 } : {}}
                                            className={clsx(
                                                "absolute inset-0 transition-all",
                                                isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called")
                                                    ? "cursor-pointer"
                                                    : "cursor-default"
                                            )}
                                        >
                                            <PlayingCard
                                                card={{
                                                    ...gameState.discardTop,
                                                    faceUp: true,
                                                    isHidden: false,
                                                }}
                                                size="md"
                                                className={clsx(
                                                    "w-full h-full",
                                                    isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") && "ring-2 ring-amber-400/50"
                                                )}
                                            />
                                        </motion.div>
                                    ) : (
                                        <div className="w-full h-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                                            <span className="text-gray-600 text-xs">Empty</span>
                                        </div>
                                    )}
                                </div>
                                <span className="text-gray-500 text-xs">Discard</span>
                                {isMyTurn && !hasDrawnCard && (phase === "playing" || phase === "screw_called") && gameState.discardTop && (
                                    <span className="text-amber-400 text-xs font-bold animate-pulse">Take</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Turn indicator */}
                <div className="text-center mb-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={gameState.currentTurn}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={clsx(
                                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold",
                                isMyTurn
                                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                                    : "bg-white/5 border border-white/10 text-gray-400"
                            )}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                className={clsx(
                                    "w-2 h-2 rounded-full",
                                    isMyTurn ? "bg-emerald-400" : "bg-gray-500"
                                )}
                            />
                            {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* My hand + controls */}
                <div className="px-6 pb-6">
                    {/* My hand */}
                    <div className="flex justify-center gap-4 mb-4">
                        {myHand?.cards.map((card, index) => (
                            <div key={card.id} className="flex flex-col items-center gap-1">
                                <PlayingCard
                                    card={card}
                                    selected={selectedHandIndex === index}
                                    onClick={
                                        hasDrawnCard
                                            ? () => handleSwapCard(index)
                                            : undefined
                                    }
                                    disabled={!isMyTurn}
                                    size="lg"
                                />
                                {hasDrawnCard && isMyTurn && (
                                    <span className="text-xs text-amber-400 font-bold animate-pulse">
                                        Swap?
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Drawn card + action buttons */}
                    {hasDrawnCard && isMyTurn && gameState.drawnCard && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="flex flex-col items-center gap-3 mb-4"
                        >
                            <p className="text-amber-300 text-sm font-semibold">
                                You drew:
                            </p>
                            <PlayingCard
                                card={{
                                    ...gameState.drawnCard,
                                    faceUp: true,
                                    isHidden: false,
                                }}
                                size="md"
                                className="ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/30"
                            />
                            <div className="flex gap-3">
                                <motion.button
                                    id="discard-drawn-btn"
                                    onClick={handleDiscardDrawn}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-300 font-semibold px-4 py-2 rounded-xl text-sm"
                                >
                                    Discard
                                </motion.button>
                                <p className="text-gray-400 text-xs self-center">
                                    or click a hand card to swap
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Action buttons */}
                    {isMyTurn && !hasDrawnCard && phase === "playing" && (
                        <div className="flex justify-center gap-3">
                            <motion.button
                                id="call-screw-btn"
                                onClick={handleCallScrew}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-300 font-bold px-6 py-2 rounded-xl text-sm"
                            >
                                🚨 Call SCREW
                            </motion.button>
                        </div>
                    )}

                    {/* Peek phase overlay */}
                    {phase === "peek" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end justify-center pb-40 z-50 pointer-events-none"
                        >
                            <div className="bg-gray-900/90 border border-white/20 rounded-2xl p-6 text-center max-w-sm mx-4 shadow-2xl pointer-events-auto">
                                <h3 className="text-white font-black text-xl mb-2 flex items-center justify-center gap-2">
                                    <span className="animate-bounce">👀</span> Peek Phase
                                </h3>
                                {peekDone ? (
                                    <div className="space-y-4">
                                        <p className="text-emerald-400 font-bold">
                                            Waiting for other players to memorize…
                                        </p>
                                        <div className="flex justify-center">
                                            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-gray-300 text-sm mb-4">
                                            Memorize your 2 outer cards. <br />Everyone else is doing the same!
                                        </p>
                                        <motion.button
                                            id="peek-done-btn"
                                            onClick={handlePeekDone}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-8 py-3 rounded-xl shadow-lg ring-2 ring-emerald-500/20"
                                        >
                                            I've Memorized Them!
                                        </motion.button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Round result modal */}
            <AnimatePresence>
                {roundResult && <RoundResultModal />}
            </AnimatePresence>
        </div>
    );
}

// ============================================================
// OPPONENT HAND COMPONENT
// ============================================================

function OpponentHand({
    player,
    name,
    isCurrentTurn,
    isScrewCaller,
}: {
    player: ClientPlayerHand;
    name: string;
    isCurrentTurn: boolean;
    isScrewCaller: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-2">
            {/* Name badge */}
            <div
                className={clsx(
                    "px-3 py-1 rounded-full text-xs font-semibold border",
                    isCurrentTurn
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                        : "bg-white/5 border-white/10 text-gray-400",
                    isScrewCaller && "ring-2 ring-red-500/50"
                )}
            >
                {isScrewCaller && "🚨 "}
                {name}
                {isCurrentTurn && (
                    <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="ml-1"
                    >
                        ●
                    </motion.span>
                )}
            </div>

            {/* Cards */}
            <div className="flex gap-1">
                {player.cards.map((card, i) => (
                    <PlayingCard
                        key={card.id}
                        card={card}
                        size="sm"
                        className="pointer-events-none"
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================================
// ROUND RESULT MODAL
// ============================================================

function RoundResultModal() {
    const { roundResult, gameState, setView } = useGameStore();
    const { currentTable, playerId } = useLobbyStore();
    const socket = getSocket();

    if (!roundResult || !gameState) return null;

    const playerNames: Record<string, string> = {};
    gameState?.players.forEach((p) => {
        playerNames[p.playerId] = p.nickname;
    });

    const handleNextRound = () => {
        if (!gameState) return;
        socket.emit("game:start", { tableId: gameState.tableId });
    };

    const sortedPlayers = Object.entries(roundResult.cumulative).sort(
        ([, a], [, b]) => a - b
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
        >
            <motion.div
                initial={{ scale: 0.8, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 30 }}
                className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
                <div className="text-center mb-6">
                    <div className="text-5xl mb-2">🎯</div>
                    <h2 className="text-2xl font-black text-white">Round {roundResult.roundNum} Over!</h2>
                    <p className="text-emerald-400 mt-1">
                        Winner: <span className="font-bold">{playerNames[roundResult.winner] ?? roundResult.winner}</span>
                    </p>
                </div>

                {/* Scores table */}
                <div className="space-y-2 mb-6">
                    {sortedPlayers.map(([pid, cumScore], rank) => (
                        <div
                            key={pid}
                            className={clsx(
                                "flex items-center justify-between px-4 py-3 rounded-xl",
                                rank === 0 ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg">
                                    {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "4️⃣"}
                                </span>
                                <span className="text-white font-semibold">
                                    {playerNames[pid] ?? pid.slice(0, 8)}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-400 text-sm">
                                    +{roundResult.scores[pid] ?? 0}{" "}
                                </span>
                                <span className="text-white font-bold">{cumScore} pts</span>
                            </div>
                        </div>
                    ))}
                </div>

                <motion.button
                    onClick={handleNextRound}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black py-3 rounded-xl"
                >
                    Next Round →
                </motion.button>
            </motion.div>
        </motion.div>
    );
}
