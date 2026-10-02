import { describe, expect, it } from "vitest";
import { addPlayer, applyAction, buildRoles, defaultSettings, GameError, isEvil, newGame, validateSetup, type Game } from "./engine";

const rand = () => 0.42;
function game(n: number): Game {
  let g = newGame("p0", "P0", "h0");
  for (let i = 1; i < n; i++) g = addPlayer(g, `p${i}`, `P${i}`, `h${i}`);
  return applyAction(g, "p0", { type: "start" }, rand);
}

describe("engine", () => {
  it("validates setup", () => {
    expect(validateSetup(4, defaultSettings())).toMatch(/Legalább/);
    expect(validateSetup(5, { ...defaultSettings(), morgana: true, mordred: true })).toMatch(/gonosz/);
    expect(validateSetup(10, { ...defaultSettings(), morgana: true, mordred: true, oberon: true })).toBeNull();
    expect(buildRoles(7, defaultSettings()).filter(isEvil)).toHaveLength(3);
  });

  it("rejects illegal moves", () => {
    const g = game(5);
    const leader = g.players[g.leader].id;
    const other = g.players.find((p) => p.id !== leader)!.id;
    expect(() => applyAction(g, other, { type: "propose", team: ["p0", "p1"] }, rand)).toThrow(GameError);
    expect(() => applyAction(g, leader, { type: "propose", team: ["p0"] }, rand)).toThrow(GameError);
    const v = applyAction(g, leader, { type: "propose", team: ["p0", "p1"] }, rand);
    const v2 = applyAction(v, "p0", { type: "vote", approve: true }, rand);
    expect(() => applyAction(v2, "p0", { type: "vote", approve: true }, rand)).toThrow(GameError);
  });

  it("good players cannot fail quests; 5 rejections ends game", () => {
    let g = game(5);
    for (let r = 0; r < 5; r++) {
      const leader = g.players[g.leader].id;
      g = applyAction(g, leader, { type: "propose", team: ["p0", "p1"] }, rand);
      for (const p of g.players) g = applyAction(g, p.id, { type: "vote", approve: false }, rand);
    }
    expect(g.winner).toBe("evil");

    let h = game(5);
    const good = h.players.find((p) => !isEvil(h.roles[p.id]))!.id;
    const other = h.players.find((p) => p.id !== good)!.id;
    h = applyAction(h, h.players[h.leader].id, { type: "propose", team: [good, other] }, rand);
    for (const p of h.players) h = applyAction(h, p.id, { type: "vote", approve: true }, rand);
    expect(h.phase).toBe("quest");
    expect(() => applyAction(h, good, { type: "quest", success: false }, rand)).toThrow(GameError);
  });
});
