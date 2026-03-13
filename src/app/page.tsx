"use client";

import { useGameStore, useLobbyStore } from "@/store/game-store";
import NicknameEntry from "@/components/NicknameEntry";
import Lobby from "@/components/Lobby";
import TableRoom from "@/components/TableRoom";
import GameBoard from "@/components/GameBoard";
import GameResults from "@/components/GameResults";
import { AnimatePresence, motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export default function Home() {
  const { view } = useGameStore();
  const { nickname } = useLobbyStore();

  // If no nickname yet, always show entry
  if (!nickname) {
    return (
      <motion.div key="entry" {...pageVariants} transition={{ duration: 0.3 }}>
        <NicknameEntry />
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {view === "lobby" && (
        <motion.div key="lobby" {...pageVariants} transition={{ duration: 0.3 }}>
          <Lobby />
        </motion.div>
      )}
      {view === "table" && (
        <motion.div key="table" {...pageVariants} transition={{ duration: 0.3 }}>
          <TableRoom />
        </motion.div>
      )}
      {view === "game" && (
        <motion.div key="game" {...pageVariants} transition={{ duration: 0.3 }}>
          <GameBoard />
        </motion.div>
      )}
      {view === "results" && (
        <motion.div key="results" {...pageVariants} transition={{ duration: 0.3 }}>
          <GameResults />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
