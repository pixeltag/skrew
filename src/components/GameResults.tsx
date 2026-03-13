"use client";

import React from "react";
import { motion } from "framer-motion";
import { useLobbyStore, useGameStore } from "@/store/game-store";
import { getSocket } from "@/lib/socket-client";

export default function GameResults() {
    const { gameResult, clearResults, setView } = useGameStore();
    const { currentTable, playerId } = useLobbyStore();
    const socket = getSocket();

    if (!gameResult) return null;

    const playerNames: Record<string, string> = {};
    currentTable?.players.forEach((p) => {
        playerNames[p.id] = p.nickname;
    });

    const isWinner = gameResult.winner === playerId;

    const sortedScores = Object.entries(gameResult.scores).sort(
        ([, a], [, b]) => a - b
    );

    const handlePlayAgain = () => {
        clearResults();
        setView("lobby");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 flex items-center justify-center p-6">
            {/* Confetti-like particles */}
            {isWinner &&
                Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="fixed text-2xl"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10%`,
                        }}
                        animate={{
                            y: ["0vh", "110vh"],
                            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                            opacity: [1, 0],
                        }}
                        transition={{
                            duration: 2 + Math.random() * 2,
                            delay: Math.random() * 2,
                            repeat: Infinity,
                        }}
                    >
                        {["🃏", "♠", "♥", "♣", "♦", "🎉", "⭐"][Math.floor(Math.random() * 7)]}
                    </motion.div>
                ))}

            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    {/* Trophy */}
                    <div className="text-center mb-6">
                        <motion.div
                            animate={{ rotate: [-5, 5, -5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="text-7xl mb-4 inline-block"
                        >
                            {isWinner ? "🏆" : "🎯"}
                        </motion.div>
                        <h1 className="text-3xl font-black text-white">
                            {isWinner ? "You Won! 🎉" : "Game Over!"}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Winner:{" "}
                            <span className="text-emerald-400 font-bold">
                                {playerNames[gameResult.winner] ?? gameResult.winner}
                            </span>{" "}
                            after {gameResult.rounds} rounds
                        </p>
                    </div>

                    {/* Final scores */}
                    <div className="space-y-2 mb-8">
                        {sortedScores.map(([pid, score], rank) => (
                            <motion.div
                                key={pid}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: rank * 0.1 }}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl ${rank === 0
                                        ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30"
                                        : "bg-white/5 border border-white/5"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "4️⃣"}
                                    </span>
                                    <span
                                        className={`font-bold ${pid === playerId ? "text-emerald-400" : "text-white"
                                            }`}
                                    >
                                        {playerNames[pid] ?? pid.slice(0, 8)}
                                        {pid === playerId && (
                                            <span className="ml-1 text-xs font-normal">(you)</span>
                                        )}
                                    </span>
                                </div>
                                <span
                                    className={`font-black text-lg ${rank === 0 ? "text-amber-400" : "text-gray-300"
                                        }`}
                                >
                                    {score} pts
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    <motion.button
                        id="play-again-btn"
                        onClick={handlePlayAgain}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-emerald-500/25"
                    >
                        Play Again →
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
}
