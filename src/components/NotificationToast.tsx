"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";

export default function NotificationToast() {
    const { notification, clearNotification } = useGameStore();

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => clearNotification(), 3500);
            return () => clearTimeout(timer);
        }
    }, [notification, clearNotification]);

    const colorMap = {
        info: "bg-blue-500/20 border-blue-500/30 text-blue-300",
        success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
        error: "bg-red-500/20 border-red-500/30 text-red-300",
        warning: "bg-amber-500/20 border-amber-500/30 text-amber-300",
    };

    const iconMap = {
        info: "ℹ️",
        success: "✅",
        error: "❌",
        warning: "⚠️",
    };

    return (
        <div className="fixed top-4 right-4 z-[100] pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notification && (
                    <motion.div
                        key={notification.message + Date.now()}
                        initial={{ opacity: 0, x: 60, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.9 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl max-w-sm ${colorMap[notification.type]
                            }`}
                    >
                        <span className="text-base">{iconMap[notification.type]}</span>
                        <p className="text-sm font-medium">{notification.message}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
