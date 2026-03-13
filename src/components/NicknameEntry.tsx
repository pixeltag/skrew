"use client";

import React, { useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { useLobbyStore, useGameStore } from "@/store/game-store";
import { motion } from "framer-motion";

export default function NicknameEntry() {
    const [nickname, setNickname] = useState("");
    const [loading, setLoading] = useState(false);
    const { setPlayer } = useLobbyStore();
    const { setView } = useGameStore();

    const handleJoin = () => {
        const trimmed = nickname.trim();
        if (!trimmed || trimmed.length < 2) return;

        setLoading(true);
        const socket = getSocket();

        socket.once("connect", () => {
            socket.emit("lobby:join", { nickname: trimmed });
        });

        if (socket.connected) {
            socket.emit("lobby:join", { nickname: trimmed });
        }

        // Store nickname locally 
        setPlayer(socket.id ?? "local", trimmed);
        setView("lobby");
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 flex items-center justify-center p-4">
            {/* Animated background cards */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {["♠", "♥", "♦", "♣"].map((suit, i) => (
                    <motion.div
                        key={suit}
                        className="absolute text-8xl opacity-5 text-white font-bold select-none"
                        style={{
                            left: `${15 + i * 22}%`,
                            top: `${20 + (i % 2) * 40}%`,
                        }}
                        animate={{
                            y: [0, -20, 0],
                            rotate: [0, 5, -5, 0],
                        }}
                        transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        {suit}
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Glass card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30"
                        >
                            <span className="text-4xl">🃏</span>
                        </motion.div>
                        <h1 className="text-4xl font-black text-white tracking-tight">
                            SKREW
                        </h1>
                        <p className="text-emerald-400 text-sm font-medium mt-1 tracking-widest uppercase">
                            Multiplayer Card Game
                        </p>
                    </div>

                    {/* Description */}
                    <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
                        Get the lowest hand. Call SCREW when you're ready. Don't get caught
                        bluffing.
                    </p>

                    {/* Input */}
                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                id="nickname-input"
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                                placeholder="Enter your nickname…"
                                maxLength={20}
                                className="w-full bg-white/5 border border-white/20 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all text-base"
                                autoFocus
                            />
                        </div>

                        <motion.button
                            id="join-lobby-btn"
                            onClick={handleJoin}
                            disabled={!nickname.trim() || nickname.trim().length < 2 || loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-base tracking-wide"
                        >
                            {loading ? "Joining…" : "Enter the Lobby →"}
                        </motion.button>
                    </div>

                    {/* Rules teaser */}
                    <div className="mt-8 grid grid-cols-3 gap-3">
                        {[
                            { icon: "🎯", label: "Lowest wins" },
                            { icon: "👁️", label: "Peek cards" },
                            { icon: "🔀", label: "Blind swap" },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 border border-white/5"
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="text-gray-400 text-xs font-medium">
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
