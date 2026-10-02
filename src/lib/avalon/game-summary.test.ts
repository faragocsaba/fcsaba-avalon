import { describe, expect, it } from "vitest";
import { createGameSummary } from "./game-summary";
import type { PlayerView } from "./engine";

function finishedView(): PlayerView {
  return {
    me: "p0", phase: "over", players: [{ id: "p0", name: "Aladár" }, { id: "p1", name: "Béla" }],
    hostId: "p0", settings: { merlin: true, assassin: true, percival: false, morgana: false, mordred: false, oberon: false, lady: false },
    leader: 0, quest: 3, results: ["good", "evil", "good", "good"], questFails: [0, 1, 0, 0], rejections: 0,
    team: [], votedIds: [], myVote: null, cardsPlayed: 0, myCard: null, lastVote: null, ladyHolder: null,
    ladyHistory: [], myLadyResults: [], winner: "good", reason: "Három küldetés sikeres.", assassinTarget: null,
    log: [], myRole: "loyal", knowledge: [], allRoles: { p0: "loyal", p1: "assassin" },
  };
}

describe("game summary", () => {
  it("maps the final result and all quest slots", () => {
    const summary = createGameSummary(finishedView(), "abcd");
    expect(summary).toMatchObject({ winnerLabel: "A JÓK GYŐZTEK", roomCode: "ABCD", playerCount: 2 });
    expect(summary?.quests).toEqual([
      { number: 1, result: "good", fails: 0 },
      { number: 2, result: "evil", fails: 1 },
      { number: 3, result: "good", fails: 0 },
      { number: 4, result: "good", fails: 0 },
      { number: 5, result: null, fails: null },
    ]);
  });

  it("does not create a summary before the game ends", () => {
    expect(createGameSummary({ ...finishedView(), phase: "quest", winner: null }, "ABCD")).toBeNull();
  });
});