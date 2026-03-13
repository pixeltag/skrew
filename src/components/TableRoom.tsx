"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket-client";
import { useLobbyStore, useGameStore } from "@/store/game-store";

export default function TableRoom() {
    const { currentTable, nickname, playerId } = useLobbyStore();
    const { setView } = useGameStore();
    const socket = getSocket();

    if (!currentTable) return null;

    const handleLeave = () => {
        socket.emit("lobby:leave_table", { tableId: currentTable.id });
        setView("lobby");
    };

    const handleStart = () => {
        socket.emit("game:start", { tableId: currentTable.id });
    };

    const canStart =
        currentTable.players.length >= 2 && currentTable.status === "waiting";

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={handleLeave}
                        className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        ← Leave Table
                    </button>
                    <span className="text-gray-500 text-sm">Table: {currentTable.id.slice(0, 8)}</span>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
                >
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black text-white mb-2">
                            {currentTable.name}
                        </h1>
                        <p className="text-gray-400">
                            Waiting for players…{" "}
                            <span className="text-emerald-400 font-semibold">
                                {currentTable.players.length}/{currentTable.maxPlayers}
                            </span>
                        </p>
                    </div>

                    {/* Seats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {Array.from({ length: currentTable.maxPlayers }).map((_, i) => {
                            const player = currentTable.players[i];
                            return (
                                <motion.div
                                    key={i}
                                    layout
                                    className={`rounded-2xl border p-5 flex items-center gap-4 ${player
                                            ? "bg-emerald-500/10 border-emerald-500/30"
                                            : "bg-white/3 border-dashed border-white/10"
                                        }`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${player
                                                ? "bg-emerald-500 text-white"
                                                : "bg-white/5 text-gray-600"
                                            }`}
                                    >
                                        {player ? player.nickname.charAt(0).toUpperCase() : i + 1}
                                    </div>
                                    <div>
                                        {player ? (
                                            <>
                                                <p className="text-white font-bold">
                                                    {player.nickname}
                                                    {player.id === playerId && (
                                                        <span className="ml-2 text-xs text-emerald-400 font-normal">
                                                            (You)
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-emerald-400 text-sm">Ready</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-gray-600 font-semibold">
                                                    Seat {i + 1}
                                                </p>
                                                <p className="text-gray-700 text-sm">Waiting…</p>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <motion.button
                            id="start-game-btn"
                            onClick={handleStart}
                            disabled={!canStart}
                            whileHover={canStart ? { scale: 1.02 } : {}}
                            whileTap={canStart ? { scale: 0.98 } : {}}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-lg transition-all shadow-lg shadow-emerald-500/25"
                        >
                            {canStart ? "🃏 Start Game" : `Need ${2 - currentTable.players.length > 0 ? 2 - currentTable.players.length : 0} more player(s)`}
                        </motion.button>

                        {!canStart && currentTable.players.length < currentTable.maxPlayers && (
                            <div className="text-center">
                                <p className="text-gray-500 text-sm">
                                    Share this link to invite players:
                                </p>
                                <p className="text-emerald-400 text-xs mt-1 font-mono bg-white/5 px-3 py-2 rounded-lg">
                                    {typeof window !== "undefined" ? window.location.href : ""}
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Rules reminder */}
                <div className="mt-6 bg-white/3 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-white font-bold mb-3 text-sm">Quick Rules</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                        <div>• Get dealt 4 cards → lowest total wins</div>
                        <div>• Peek 2 of your cards at start</div>
                        <div>• Draw & swap, or discard each turn</div>
                        <div>• K = 0 points (best card!)</div>
                        <div>• 7 = peek your own card</div>
                        <div>• 8 = peek opponent's card</div>
                        <div>• 9 = blind swap with opponent</div>
                        <div>• Call SCREW when ready to reveal!</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
