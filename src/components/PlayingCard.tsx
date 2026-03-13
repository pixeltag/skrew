"use client";

import React from "react";
import { motion } from "framer-motion";
import { ClientCard } from "@/types/game";
import clsx from "clsx";

interface PlayingCardProps {
    card: ClientCard;
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    faceDown?: boolean;
    className?: string;
}

const suitColors: Record<string, string> = {
    hearts: "text-red-400",
    diamonds: "text-red-400",
    clubs: "text-white",
    spades: "text-white",
};

const suitSymbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
};

const sizeClasses = {
    sm: "w-14 h-20 text-sm",
    md: "w-20 h-28 text-base",
    lg: "w-24 h-36 text-lg",
};

const SPECIAL_RANKS = ["7", "8", "9", "J", "Q"];
const KING = "K";

export default function PlayingCard({
    card,
    onClick,
    selected,
    disabled,
    size = "md",
    faceDown,
    className,
}: PlayingCardProps) {
    const shouldShowFace = !faceDown && !card.isHidden && card.faceUp;
    const isFaceDown = faceDown || card.isHidden || !card.faceUp;

    const isSpecial = card.rank ? SPECIAL_RANKS.includes(card.rank) : false;
    const isKing = card.rank === KING;

    const suitSymbol = card.suit ? suitSymbols[card.suit] : null;
    const suitColor = card.suit ? suitColors[card.suit] : "text-white";

    return (
        <motion.div
            onClick={disabled ? undefined : onClick}
            whileHover={onClick && !disabled ? { y: -8, scale: 1.05 } : {}}
            whileTap={onClick && !disabled ? { scale: 0.95 } : {}}
            animate={selected ? { y: -12, scale: 1.08 } : { y: 0, scale: 1 }}
            className={clsx(
                sizeClasses[size],
                "relative rounded-xl cursor-pointer select-none transition-shadow",
                selected && "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/50",
                disabled && "cursor-not-allowed opacity-60",
                !onClick && "cursor-default",
                className
            )}
            style={{
                perspective: "1000px",
            }}
        >
            <motion.div
                className="w-full h-full relative"
                animate={{ rotateY: isFaceDown ? 180 : 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* Card Front */}
                <div
                    className={clsx(
                        "absolute inset-0 rounded-xl flex flex-col justify-between p-2 overflow-hidden",
                        "backface-hidden",
                        isKing
                            ? "bg-gradient-to-br from-amber-900 to-amber-950 border-2 border-amber-500/50"
                            : isSpecial
                                ? "bg-gradient-to-br from-purple-900 to-indigo-950 border-2 border-purple-500/30"
                                : "bg-gradient-to-br from-gray-100 to-white border-2 border-gray-200"
                    )}
                    style={{ backfaceVisibility: "hidden" }}
                >
                    {card.rank && card.suit ? (
                        <>
                            {/* Top-left */}
                            <div className="flex flex-col items-start leading-none">
                                <span
                                    className={clsx(
                                        "font-black leading-none",
                                        isKing || isSpecial ? "text-amber-300" : suitColor
                                    )}
                                >
                                    {card.rank}
                                </span>
                                <span
                                    className={clsx(
                                        "text-xs",
                                        isKing || isSpecial ? "text-amber-400" : suitColor
                                    )}
                                >
                                    {suitSymbol}
                                </span>
                            </div>

                            {/* Center */}
                            <div className="flex items-center justify-center">
                                <span
                                    className={clsx(
                                        "text-2xl leading-none",
                                        isKing || isSpecial ? "text-amber-300" : suitColor
                                    )}
                                >
                                    {isKing ? "👑" : isSpecial ? "⚡" : suitSymbol}
                                </span>
                            </div>

                            {/* Bottom-right rotated */}
                            <div className="flex flex-col items-end leading-none rotate-180">
                                <span
                                    className={clsx(
                                        "font-black leading-none",
                                        isKing || isSpecial ? "text-amber-300" : suitColor
                                    )}
                                >
                                    {card.rank}
                                </span>
                                <span
                                    className={clsx(
                                        "text-xs",
                                        isKing || isSpecial ? "text-amber-400" : suitColor
                                    )}
                                >
                                    {suitSymbol}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400">?</span>
                        </div>
                    )}

                    {/* Special ability label */}
                    {isSpecial && size !== "sm" && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-max">
                            <span className="text-purple-300 text-[8px] font-bold uppercase tracking-wide">
                                Special
                            </span>
                        </div>
                    )}
                    {isKing && size !== "sm" && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-max">
                            <span className="text-amber-300 text-[8px] font-bold uppercase tracking-wide">
                                0 pts
                            </span>
                        </div>
                    )}
                </div>

                {/* Card Back */}
                <div
                    className="absolute inset-0 rounded-xl overflow-hidden"
                    style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                    }}
                >
                    <div className="w-full h-full bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-900 border-2 border-emerald-600/30 rounded-xl flex items-center justify-center">
                        <div className="w-4/5 h-4/5 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                            <div className="grid grid-cols-3 gap-0.5 opacity-30">
                                {["♠", "♥", "♣", "♦", "♠", "♥", "♣", "♦", "♠"].map(
                                    (s, i) => (
                                        <span key={i} className="text-emerald-300 text-xs">
                                            {s}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
