"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket-client";
import { useLobbyStore, useGameStore } from "@/store/game-store";
import { TableInfo } from "@/types/game";

export default function Lobby() {
    const { nickname, tables, currentTable, error, setCurrentTable, setError } =
        useLobbyStore();
    const { setView } = useGameStore();
    const [tableName, setTableName] = useState("");
    const [maxPlayers, setMaxPlayers] = useState(4);
    const [showCreate, setShowCreate] = useState(false);

    const socket = getSocket();

    useEffect(() => {
        setError(null);
    }, []);

    const handleCreateTable = () => {
        if (!tableName.trim()) return;
        socket.emit("lobby:create_table", {
            name: tableName.trim(),
            maxPlayers,
        });
        setTableName("");
        setShowCreate(false);
        setView("table");
    };

    const handleJoinTable = (tableId: string) => {
        socket.emit("lobby:join_table", { tableId });
        const table = tables.find((t) => t.id === tableId);
        if (table) setCurrentTable(table);
        setView("table");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950 p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white">
                            🃏 <span className="text-emerald-400">SKREW</span> Lobby
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Welcome back,{" "}
                            <span className="text-emerald-300 font-semibold">{nickname}</span>
                        </p>
                    </div>
                    <motion.button
                        id="create-table-btn"
                        onClick={() => setShowCreate(!showCreate)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25"
                    >
                        + Create Table
                    </motion.button>
                </div>

                {/* Create table panel */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                                <h2 className="text-white font-bold text-lg mb-4">
                                    Create New Table
                                </h2>
                                <div className="flex gap-4 flex-wrap">
                                    <input
                                        id="table-name-input"
                                        type="text"
                                        value={tableName}
                                        onChange={(e) => setTableName(e.target.value)}
                                        placeholder="Table name…"
                                        className="flex-1 min-w-48 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                                    />
                                    <select
                                        id="max-players-select"
                                        value={maxPlayers}
                                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                        className="bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-400"
                                    >
                                        <option value={2} className="bg-gray-900">
                                            2 Players
                                        </option>
                                        <option value={3} className="bg-gray-900">
                                            3 Players
                                        </option>
                                        <option value={4} className="bg-gray-900">
                                            4 Players
                                        </option>
                                    </select>
                                    <motion.button
                                        id="confirm-create-btn"
                                        onClick={handleCreateTable}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-xl"
                                    >
                                        Create
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300">
                        {error}
                    </div>
                )}

                {/* Tables list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {tables.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="col-span-full text-center py-20"
                            >
                                <div className="text-6xl mb-4">🂡</div>
                                <p className="text-gray-400 text-lg">No tables available.</p>
                                <p className="text-gray-600 text-sm mt-2">
                                    Create one to get started!
                                </p>
                            </motion.div>
                        ) : (
                            tables.map((table) => (
                                <TableCard
                                    key={table.id}
                                    table={table}
                                    onJoin={() => handleJoinTable(table.id)}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function TableCard({
    table,
    onJoin,
}: {
    table: TableInfo;
    onJoin: () => void;
}) {
    const isFull = table.players.length >= table.maxPlayers;
    const isPlaying = table.status === "in_game";
    const isFinished = table.status === "finished";

    const statusColor = isPlaying
        ? "text-amber-400 bg-amber-400/10"
        : isFull
            ? "text-red-400 bg-red-400/10"
            : "text-emerald-400 bg-emerald-400/10";

    const statusLabel = isFinished
        ? "Finished"
        : isPlaying
            ? "In Game"
            : isFull
                ? "Full"
                : "Open";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group"
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-white font-bold text-base truncate pr-2">
                        {table.name}
                    </h3>
                    <p className="text-gray-500 text-xs mt-1">
                        {table.players.length}/{table.maxPlayers} players
                    </p>
                </div>
                <span
                    className={`text-xs font-semibold px-2 py-1 rounded-lg ${statusColor}`}
                >
                    {statusLabel}
                </span>
            </div>

            {/* Player avatars */}
            <div className="flex gap-2 mb-4">
                {Array.from({ length: table.maxPlayers }).map((_, i) => {
                    const player = table.players[i];
                    return (
                        <div
                            key={i}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${player
                                    ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                                    : "bg-white/5 border border-white/10 text-gray-600"
                                }`}
                        >
                            {player ? player.nickname.charAt(0).toUpperCase() : "?"}
                        </div>
                    );
                })}
            </div>

            {/* Player names */}
            <div className="flex flex-wrap gap-1 mb-4 min-h-5">
                {table.players.map((p) => (
                    <span key={p.id} className="text-xs text-gray-400">
                        {p.nickname}
                        {!p.isConnected && " (away)"}
                    </span>
                ))}
            </div>

            <motion.button
                id={`join-table-${table.id}`}
                onClick={onJoin}
                disabled={isFull || isPlaying || isFinished}
                whileHover={!isFull && !isPlaying ? { scale: 1.02 } : {}}
                whileTap={!isFull && !isPlaying ? { scale: 0.98 } : {}}
                className="w-full bg-gradient-to-r from-emerald-500/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
            >
                {isFinished ? "Finished" : isPlaying ? "In Progress" : isFull ? "Full" : "Join Table"}
            </motion.button>
        </motion.div>
    );
}
