import { v4 as uuidv4 } from "uuid";
import {
    Card,
    GameState,
    GameStateClient,
    Rank,
    Suit,
    PlayerInfo,
    RoundResult,
    GameResult,
    ActionType,
} from "@/types/game";

// ============================================================
// CARD VALUES
// Special cards in Screw:
//   7  = peek your own card
//   8  = peek an opponent's card
//   9  = blind swap with opponent
//   J  = peek own + swap
//   Q  = peek opponent
//   K  = 0 points (best card)
//   Black K (clubs/spades) = 0 points
//   Red K (hearts/diamonds) = 0 points
// ============================================================

const CARD_VALUES: Record<Rank, number> = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 10,
    Q: 10,
    K: 0, // K is always 0 (Screw specific rule)
};

const SPECIAL_RANKS: Rank[] = ["7", "8", "9", "J", "Q"];

export function getCardValue(card: Card): number {
    return CARD_VALUES[card.rank];
}

export function isSpecialCard(card: Card): boolean {
    return SPECIAL_RANKS.includes(card.rank);
}

export function getSpecialAbility(rank: Rank): string {
    switch (rank) {
        case "7":
            return "Peek one of your own face-down cards";
        case "8":
            return "Peek one of an opponent's face-down cards";
        case "9":
            return "Blind swap one of your cards with an opponent's card";
        case "J":
            return "Peek one of your own cards, then swap with opponent";
        case "Q":
            return "Peek any opponent's card";
        default:
            return "";
    }
}

// ============================================================
// DECK MANAGEMENT
// ============================================================

export function createDeck(): Card[] {
    const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
    const ranks: Rank[] = [
        "A",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
    ];
    const deck: Card[] = [];

    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({
                id: uuidv4(),
                suit,
                rank,
                value: CARD_VALUES[rank],
                faceUp: false,
            });
        }
    }

    return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ============================================================
// GAME INITIALIZATION
// ============================================================

export function initializeGameState(
    tableId: string,
    players: PlayerInfo[],
    round: number,
    prevScores: Record<string, number> = {}
): GameState {
    const deck = shuffleDeck(createDeck());
    const turnOrder = [...players].map((p) => p.id);

    // Deal 4 cards to each player
    const playerHands = players.map((player) => {
        const cards = deck.splice(0, 4).map((card, i) => ({
            ...card,
            faceUp: false, // all start face-down
        }));

        return {
            playerId: player.id,
            nickname: player.nickname,
            cards,
            score: prevScores[player.id] ?? 0,
        };
    });

    return {
        tableId,
        phase: "peek",
        round,
        currentTurn: turnOrder[0],
        screwCallerId: null,
        deck,
        discardPile: [],
        players: playerHands,
        turnOrder,
        lastAction: null,
        winner: null,
        gameWinner: null,
        scores: prevScores,
        maxScore: 100,
    };
}

// ============================================================
// GAME ACTIONS
// ============================================================

export type ActionResult =
    | { success: true; state: GameState; events: string[] }
    | { success: false; error: string };

/** Player draws from deck */
export function drawFromDeck(
    state: GameState,
    playerId: string
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };
    if (state.phase !== "playing" && state.phase !== "screw_called")
        return { success: false, error: "Cannot draw now" };
    if (state.deck.length === 0) {
        // Reshuffle discard into deck
        const top = state.discardPile[state.discardPile.length - 1];
        const reshuffled = shuffleDeck(
            state.discardPile.slice(0, -1).map((c) => ({ ...c, faceUp: false }))
        );
        state = {
            ...state,
            deck: reshuffled,
            discardPile: [top],
        };
    }

    const [drawnCard, ...remainingDeck] = state.deck;
    // Store drawn card temporarily (in deck slot 0 with special marker)
    const newState: GameState = {
        ...state,
        deck: remainingDeck,
        lastAction: {
            type: "draw_from_deck",
            playerId,
            cardId: drawnCard.id,
            timestamp: Date.now(),
        },
    };

    // We store drawnCard in a special property via hack: push back to deck with faceUp marker
    // Actually we'll use a convention: the drawn card is stored in discardPile with a "held" marker
    // Better: use a separate field. Let's add it to GameState via the `deck` array negatively indexed approach
    // We'll use deck[-1] concept by storing in a special marker
    // Simplest: store the drawn card at deck[-1] by adding it to a temporary holder
    // Using lastAction.cardId to track and storing the card itself in a side channel

    // We add it as deck[0] with faceUp=true as the "held" card marker
    return {
        success: true,
        state: {
            ...newState,
            deck: [{ ...drawnCard, faceUp: true }, ...newState.deck],
        },
        events: ["draw_from_deck"],
    };
}

/** Player draws top card from discard pile */
export function drawFromDiscard(
    state: GameState,
    playerId: string
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };
    if (state.phase !== "playing" && state.phase !== "screw_called")
        return { success: false, error: "Cannot draw now" };
    if (state.discardPile.length === 0)
        return { success: false, error: "Discard pile is empty" };

    const drawnCard = state.discardPile[state.discardPile.length - 1];
    const newDiscardPile = state.discardPile.slice(0, -1);

    return {
        success: true,
        state: {
            ...state,
            discardPile: newDiscardPile,
            // Store drawn card in deck[0] with faceUp=true
            deck: [{ ...drawnCard, faceUp: true }, ...state.deck],
            lastAction: {
                type: "draw_from_discard",
                playerId,
                cardId: drawnCard.id,
                timestamp: Date.now(),
            },
        },
        events: ["draw_from_discard"],
    };
}

/** Get the currently held (drawn) card */
export function getHeldCard(state: GameState): Card | null {
    if (state.deck.length > 0 && state.deck[0].faceUp) {
        return state.deck[0];
    }
    return null;
}

/** Player swaps drawn card with one of their hand cards */
export function swapCard(
    state: GameState,
    playerId: string,
    handIndex: number
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };

    const heldCard = getHeldCard(state);
    if (!heldCard) return { success: false, error: "No card in hand to swap" };

    const playerHand = state.players.find((p) => p.playerId === playerId);
    if (!playerHand) return { success: false, error: "Player not found" };

    if (handIndex < 0 || handIndex >= playerHand.cards.length)
        return { success: false, error: "Invalid card index" };

    const oldCard = playerHand.cards[handIndex];
    const newCards = [...playerHand.cards];
    newCards[handIndex] = { ...heldCard, faceUp: false };

    // Discard the old card
    const newDiscardPile = [
        ...state.discardPile,
        { ...oldCard, faceUp: true },
    ];

    const newPlayers = state.players.map((p) =>
        p.playerId === playerId ? { ...p, cards: newCards } : p
    );

    // Remove held card from deck[0]
    const newDeck = state.deck.slice(1);

    const updatedState: GameState = {
        ...state,
        deck: newDeck,
        discardPile: newDiscardPile,
        players: newPlayers,
        lastAction: {
            type: "swap_card",
            playerId,
            cardId: heldCard.id,
            handIndex,
            timestamp: Date.now(),
        },
    };

    // Check if held card was special and can trigger an ability
    if (isSpecialCard(heldCard)) {
        // Special ability was used via swap; let client handle the flow
    }

    return {
        success: true,
        state: advanceTurn(updatedState),
        events: ["swap_card", "turn_changed"],
    };
}

/** Player discards the drawn card without swapping */
export function discardDrawn(
    state: GameState,
    playerId: string
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };

    const heldCard = getHeldCard(state);
    if (!heldCard) return { success: false, error: "No card to discard" };

    const newDiscardPile = [...state.discardPile, { ...heldCard, faceUp: true }];
    const newDeck = state.deck.slice(1);

    const updatedState: GameState = {
        ...state,
        deck: newDeck,
        discardPile: newDiscardPile,
        lastAction: {
            type: "discard_drawn",
            playerId,
            cardId: heldCard.id,
            timestamp: Date.now(),
        },
    };

    // If they discard a special, they can optionally use the ability
    // but in this implementation discarding = no ability
    return {
        success: true,
        state: advanceTurn(updatedState),
        events: ["discard_drawn", "turn_changed"],
    };
}

/** Player calls SCREW (must be their turn, after first full round) */
export function callScrew(
    state: GameState,
    playerId: string
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };
    if (state.phase !== "playing")
        return { success: false, error: "Cannot call SCREW now" };
    if (state.screwCallerId !== null)
        return { success: false, error: "SCREW already called" };

    const updatedState: GameState = {
        ...state,
        phase: "screw_called",
        screwCallerId: playerId,
        lastAction: {
            type: "call_screw",
            playerId,
            timestamp: Date.now(),
        },
    };

    return {
        success: true,
        state: advanceTurn(updatedState),
        events: ["screw_called", "turn_changed"],
    };
}

/** Use special ability of a card (peek own/opponent, blind swap) */
export function useSpecialAbility(
    state: GameState,
    playerId: string,
    cardId: string,
    targetPlayerId?: string,
    targetCardIndex?: number,
    ownCardIndex?: number
): ActionResult {
    if (state.currentTurn !== playerId)
        return { success: false, error: "Not your turn" };

    // Find the card to use (it should be the held card)
    const heldCard = getHeldCard(state);
    if (!heldCard || heldCard.id !== cardId)
        return { success: false, error: "Invalid card" };

    let newState = { ...state };

    switch (heldCard.rank) {
        case "7": {
            // Peek own card - temporarily reveal it to the player
            const playerHand = newState.players.find((p) => p.playerId === playerId);
            if (!playerHand) return { success: false, error: "Player not found" };
            if (ownCardIndex === undefined)
                return { success: false, error: "Must specify own card index" };

            const newCards = playerHand.cards.map((c, i) =>
                i === ownCardIndex ? { ...c, peekedBy: playerId } : c
            );
            newState = {
                ...newState,
                players: newState.players.map((p) =>
                    p.playerId === playerId ? { ...p, cards: newCards } : p
                ),
            };
            break;
        }

        case "8":
        case "Q": {
            // Peek opponent's card
            if (!targetPlayerId || targetCardIndex === undefined)
                return { success: false, error: "Must specify target" };

            const targetHand = newState.players.find(
                (p) => p.playerId === targetPlayerId
            );
            if (!targetHand) return { success: false, error: "Target not found" };

            const newCards = targetHand.cards.map((c, i) =>
                i === targetCardIndex ? { ...c, peekedBy: playerId } : c
            );
            newState = {
                ...newState,
                players: newState.players.map((p) =>
                    p.playerId === targetPlayerId ? { ...p, cards: newCards } : p
                ),
            };
            break;
        }

        case "9": {
            // Blind swap: swap own card with opponent's card
            if (
                !targetPlayerId ||
                targetCardIndex === undefined ||
                ownCardIndex === undefined
            )
                return { success: false, error: "Must specify both cards" };

            const playerHand = newState.players.find((p) => p.playerId === playerId);
            const targetHand = newState.players.find(
                (p) => p.playerId === targetPlayerId
            );
            if (!playerHand || !targetHand)
                return { success: false, error: "Player not found" };

            const myCard = playerHand.cards[ownCardIndex];
            const theirCard = targetHand.cards[targetCardIndex];

            const newPlayerCards = [...playerHand.cards];
            newPlayerCards[ownCardIndex] = { ...theirCard, faceUp: false };

            const newTargetCards = [...targetHand.cards];
            newTargetCards[targetCardIndex] = { ...myCard, faceUp: false };

            newState = {
                ...newState,
                players: newState.players.map((p) => {
                    if (p.playerId === playerId) return { ...p, cards: newPlayerCards };
                    if (p.playerId === targetPlayerId)
                        return { ...p, cards: newTargetCards };
                    return p;
                }),
            };
            break;
        }

        default:
            return { success: false, error: "Card has no special ability" };
    }

    // Discard the special card after using it
    const newDiscardPile = [
        ...newState.discardPile,
        { ...heldCard, faceUp: true },
    ];
    const newDeck = newState.deck.slice(1);

    return {
        success: true,
        state: advanceTurn({
            ...newState,
            deck: newDeck,
            discardPile: newDiscardPile,
            lastAction: {
                type: "peek_own_card",
                playerId,
                cardId,
                targetPlayerId,
                targetCardIndex,
                timestamp: Date.now(),
            },
        }),
        events: ["special_used", "turn_changed"],
    };
}

// ============================================================
// TURN MANAGEMENT
// ============================================================

function advanceTurn(state: GameState): GameState {
    const currentIdx = state.turnOrder.indexOf(state.currentTurn);
    const nextIdx = (currentIdx + 1) % state.turnOrder.length;
    const nextPlayer = state.turnOrder[nextIdx];

    // Check if we wrapped around to the screw caller (end of round)
    if (
        state.phase === "screw_called" &&
        nextPlayer === state.screwCallerId
    ) {
        return revealAndScore(state);
    }

    return {
        ...state,
        currentTurn: nextPlayer,
    };
}

// ============================================================
// ROUND END & SCORING
// ============================================================

function revealAndScore(state: GameState): GameState {
    // Flip all cards face up
    const revealedPlayers = state.players.map((p) => ({
        ...p,
        cards: p.cards.map((c) => ({ ...c, faceUp: true })),
    }));

    return {
        ...state,
        phase: "revealing",
        players: revealedPlayers,
    };
}

export function calculateRoundScores(state: GameState): Record<string, number> {
    const roundScores: Record<string, number> = {};

    let lowestScore = Infinity;
    let lowestPlayerId = "";

    for (const player of state.players) {
        const total = player.cards.reduce((sum, card) => sum + card.value, 0);
        roundScores[player.playerId] = total;
        if (total < lowestScore) {
            lowestScore = total;
            lowestPlayerId = player.playerId;
        }
    }

    // Screw caller gets penalty if not lowest (doubled if not winning)
    if (state.screwCallerId) {
        const callerScore = roundScores[state.screwCallerId];
        if (state.screwCallerId !== lowestPlayerId) {
            // Caller penalty: score is doubled
            roundScores[state.screwCallerId] = callerScore * 2;
        }
        // Otherwise caller wins with 0 points for the round
        else {
            roundScores[state.screwCallerId] = 0;
        }
    }

    return roundScores;
}

export function resolveRound(state: GameState): {
    result: RoundResult;
    newState: GameState;
} {
    const roundScores = calculateRoundScores(state);

    // Update cumulative scores
    const newCumulative: Record<string, number> = { ...state.scores };
    for (const [pid, score] of Object.entries(roundScores)) {
        newCumulative[pid] = (newCumulative[pid] ?? 0) + score;
    }

    // Find round winner (lowest hand value)
    let roundWinner = "";
    let minScore = Infinity;
    for (const player of state.players) {
        const handValue = player.cards.reduce((s, c) => s + c.value, 0);
        if (handValue < minScore) {
            minScore = handValue;
            roundWinner = player.playerId;
        }
    }

    // Check if any player has exceeded maxScore (game over)
    let gameWinner: string | null = null;
    const eliminatedPlayers = Object.entries(newCumulative)
        .filter(([, score]) => score >= state.maxScore)
        .map(([pid]) => pid);

    if (eliminatedPlayers.length > 0) {
        // Game ends; lowest cumulative score wins
        let minCumulative = Infinity;
        for (const [pid, score] of Object.entries(newCumulative)) {
            if (score < minCumulative) {
                minCumulative = score;
                gameWinner = pid;
            }
        }
    }

    const hands: Record<string, Card[]> = {};
    state.players.forEach((p) => {
        hands[p.playerId] = p.cards;
    });

    const result: RoundResult = {
        roundNum: state.round,
        winner: roundWinner,
        scores: roundScores,
        hands,
        cumulative: newCumulative,
    };

    const newState: GameState = {
        ...state,
        phase: gameWinner ? "finished" : "scoring",
        scores: newCumulative,
        winner: roundWinner,
        gameWinner,
    };

    return { result, newState };
}

// ============================================================
// CLIENT STATE BUILDER (hides information from other players)
// ============================================================

export function buildClientState(
    state: GameState,
    forPlayerId: string
): import("@/types/game").GameStateClient {
    const heldCard = getHeldCard(state);

    return {
        tableId: state.tableId,
        phase: state.phase,
        round: state.round,
        currentTurn: state.currentTurn,
        screwCallerId: state.screwCallerId,
        deckCount: Math.max(0, state.deck.length - (heldCard ? 1 : 0)),
        discardTop:
            state.discardPile.length > 0
                ? state.discardPile[state.discardPile.length - 1]
                : null,
        drawnCard:
            state.currentTurn === forPlayerId && heldCard ? heldCard : null,
        players: state.players.map((player) => ({
            playerId: player.playerId,
            nickname: player.nickname,
            cards: player.cards.map((card, idx) => {
                const isOwn = player.playerId === forPlayerId;

                // Rules for revealing card info to this client:
                // 1. It's faceUp (visible to all)
                // 2. It's the peek phase, it's our own hand, and it's an outer card (0 or 3)
                // 3. We are currently peeking this card privately
                const isPeekPhaseOuter = state.phase === "peek" && isOwn && (idx === 0 || idx === 3);
                const isPeekedByMe = card.peekedBy === forPlayerId;

                const shouldReveal = card.faceUp || isPeekPhaseOuter || isPeekedByMe;

                return {
                    id: card.id,
                    suit: shouldReveal ? card.suit : undefined,
                    rank: shouldReveal ? card.rank : undefined,
                    value: shouldReveal ? card.value : undefined,
                    faceUp: card.faceUp,
                    isHidden: !shouldReveal,
                };
            }),
        })),
        turnOrder: state.turnOrder,
        lastAction: state.lastAction,
        winner: state.winner,
        gameWinner: state.gameWinner,
        scores: state.scores,
        maxScore: state.maxScore,
    };
}
