// ============================================================
// CARD TYPES
// ============================================================

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;        // unique id per card instance
  suit: Suit;
  rank: Rank;
  value: number;     // point value: A=1, 2-9 face, 10/J/Q/K=10, special rules
  faceUp: boolean;   // whether card is visible to all
}

// ============================================================
// PLAYER TYPES
// ============================================================

export interface PlayerInfo {
  id: string;          // session-based id
  nickname: string;
  position: number;    // seat position (0-3)
  isConnected: boolean;
}

export interface PlayerHand {
  playerId: string;
  cards: Card[];       // all 4 cards (only 2 are initially revealed)
  score: number;       // cumulative score
}

// ============================================================
// TABLE TYPES
// ============================================================

export type TableStatus = "waiting" | "in_game" | "finished";

export interface TableInfo {
  id: string;
  name: string;
  status: TableStatus;
  maxPlayers: number;
  players: PlayerInfo[];
  createdAt: string;
}

// ============================================================
// GAME STATE
// ============================================================

export type GamePhase =
  | "dealing"
  | "peek"          // initial 2-card peek phase
  | "playing"
  | "screw_called"  // someone called SCREW, one final round left
  | "revealing"     // all cards flipped face up
  | "scoring"
  | "finished";

export interface GameState {
  tableId: string;
  phase: GamePhase;
  round: number;
  currentTurn: string;      // playerId whose turn it is
  screwCallerId: string | null;
  deck: Card[];
  discardPile: Card[];
  players: PlayerHand[];
  turnOrder: string[];       // ordered list of playerIds
  lastAction: GameAction | null;
  winner: string | null;     // playerId of round winner
  gameWinner: string | null; // playerId of game winner
  scores: Record<string, number>; // cumulative scores per player
  maxScore: number;          // score threshold to end game (default 100)
}

// ============================================================
// GAME ACTIONS
// ============================================================

export type ActionType =
  | "draw_from_deck"
  | "draw_from_discard"
  | "swap_card"
  | "discard_drawn"
  | "call_screw"
  | "peek_own_card"
  | "peek_other_card"
  | "blind_swap";

export interface GameAction {
  type: ActionType;
  playerId: string;
  cardId?: string;        // card involved
  targetPlayerId?: string; // for peek/swap actions
  targetCardIndex?: number;
  handIndex?: number;     // own card slot index for swap
  timestamp: number;
}

// ============================================================
// SOCKET EVENTS
// ============================================================

// Client -> Server
export interface ClientToServerEvents {
  // Lobby
  "lobby:join": (payload: { nickname: string }) => void;
  "lobby:leave": () => void;
  "lobby:create_table": (payload: { name: string; maxPlayers: number }) => void;
  "lobby:join_table": (payload: { tableId: string }) => void;
  "lobby:leave_table": (payload: { tableId: string }) => void;

  // Game
  "game:start": (payload: { tableId: string }) => void;
  "game:draw_deck": (payload: { tableId: string }) => void;
  "game:draw_discard": (payload: { tableId: string }) => void;
  "game:swap_card": (payload: {
    tableId: string;
    handIndex: number;
    drawnCardId: string;
  }) => void;
  "game:discard_drawn": (payload: { tableId: string; cardId: string }) => void;
  "game:call_screw": (payload: { tableId: string }) => void;
  "game:use_special": (payload: {
    tableId: string;
    cardId: string;
    targetPlayerId?: string;
    targetCardIndex?: number;
    handIndex?: number;
  }) => void;
  "game:peek_done": (payload: { tableId: string }) => void;
}

// Server -> Client
export interface ServerToClientEvents {
  // Lobby
  "lobby:tables_update": (tables: TableInfo[]) => void;
  "lobby:table_update": (table: TableInfo) => void;
  "lobby:error": (message: string) => void;

  // Game
  "game:started": (state: GameStateClient) => void;
  "game:state_update": (state: GameStateClient) => void;
  "game:action": (action: GameAction) => void;
  "game:round_end": (result: RoundResult) => void;
  "game:over": (result: GameResult) => void;
  "game:error": (message: string) => void;

  // System
  "player:joined_table": (player: PlayerInfo) => void;
  "player:left_table": (playerId: string) => void;
  "player:reconnected": (playerId: string) => void;
  "player:disconnected": (playerId: string) => void;
}

// ============================================================
// CLIENT-SAFE GAME STATE (hides opponent cards)
// ============================================================

export interface ClientCard {
  id: string;
  suit?: Suit;
  rank?: Rank;
  value?: number;
  faceUp: boolean;
  isHidden: boolean; // hidden from this client
}

export interface ClientPlayerHand {
  playerId: string;
  cards: ClientCard[];
}

export interface GameStateClient {
  tableId: string;
  phase: GamePhase;
  round: number;
  currentTurn: string;
  screwCallerId: string | null;
  deckCount: number;          // only count, not actual cards
  discardTop: Card | null;
  drawnCard: Card | null;     // only visible to current player
  players: ClientPlayerHand[];
  turnOrder: string[];
  lastAction: GameAction | null;
  winner: string | null;
  gameWinner: string | null;
  scores: Record<string, number>;
  maxScore: number;
}

// ============================================================
// RESULTS
// ============================================================

export interface RoundResult {
  roundNum: number;
  winner: string;   // playerId
  scores: Record<string, number>; // scores this round
  hands: Record<string, Card[]>;  // revealed hands
  cumulative: Record<string, number>;
}

export interface GameResult {
  winner: string; // playerId
  scores: Record<string, number>;
  rounds: number;
}
