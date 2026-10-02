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

  it("supports Resistance mode without Merlin and Assassin", () => {
    const s = { ...defaultSettings(), merlin: false, assassin: false };
    expect(validateSetup(5, s)).toBeNull();
    const roles = buildRoles(5, s);
    expect(roles).not.toContain("merlin");
    expect(roles).not.toContain("assassin");
    expect(validateSetup(5, { ...s, percival: true })).toMatch(/Merlin/);
    // 3 successful quests end the game immediately, no assassination phase
    let g = newGame("p0", "P0", "h0");
    for (let i = 1; i < 5; i++) g = addPlayer(g, `p${i}`, `P${i}`, `h${i}`);
    g = applyAction(g, "p0", { type: "settings", settings: s }, rand);
    g = applyAction(g, "p0", { type: "start" }, rand);
    for (let q = 0; q < 3; q++) {
      const size = [2, 3, 2][q]!;
      const leader = g.players[g.leader]!.id;
      g = applyAction(g, leader, { type: "propose", team: g.players.slice(0, size).map((p) => p.id) }, rand);
      for (const p of g.players) if (!(p.id in g.votes)) g = applyAction(g, p.id, { type: "vote", approve: true }, rand);
      for (const id of g.team) if (!(id in g.cards)) g = applyAction(g, id, { type: "quest", success: true }, rand);
    }
    expect(g.phase).toBe("over");
    expect(g.winner).toBe("good");
  });

  it("rejects illegal moves", () => {
    const g = game(5);
    const leader = g.players[g.leader]!.id;
    const other = g.players.find((p) => p.id !== leader)!.id;
    expect(() => applyAction(g, other, { type: "propose", team: ["p0", "p1"] }, rand)).toThrow(GameError);
    expect(() => applyAction(g, leader, { type: "propose", team: ["p0"] }, rand)).toThrow(GameError);
    const v = applyAction(g, leader, { type: "propose", team: ["p0", "p1"] }, rand);
    const v2 = applyAction(v, "p0", { type: "vote", approve: true }, rand);
    expect(() => applyAction(v2, "p0", { type: "vote", approve: true }, rand)).toThrow(GameError);
  });

  it("lists yes and no voters by name in the log", () => {
    let g = game(5);
    const leader = g.players[g.leader]!.id;
    g = applyAction(g, leader, { type: "propose", team: ["p0", "p1"] }, rand);
    g = applyAction(g, "p3", { type: "vote", approve: false }, rand);
    g = applyAction(g, "p1", { type: "vote", approve: true }, rand);
    g = applyAction(g, "p4", { type: "vote", approve: false }, rand);
    g = applyAction(g, "p0", { type: "vote", approve: true }, rand);
    g = applyAction(g, "p2", { type: "vote", approve: false }, rand);

    expect(g.log.at(-1)).toBe("Szavazás: 2 igen (P0, P1), 3 nem (P2, P3, P4) – elutasítva.");
  });

  it("good players cannot fail quests; 5 rejections ends game", () => {
    let g = game(5);
    for (let r = 0; r < 5; r++) {
      const leader = g.players[g.leader]!.id;
      g = applyAction(g, leader, { type: "propose", team: ["p0", "p1"] }, rand);
      for (const p of g.players) g = applyAction(g, p.id, { type: "vote", approve: false }, rand);
    }
    expect(g.winner).toBe("evil");

    let h = game(5);
    const good = h.players.find((p) => !isEvil(h.roles[p.id]))!.id;
    const other = h.players.find((p) => p.id !== good)!.id;
    h = applyAction(h, h.players[h.leader]!.id, { type: "propose", team: [good, other] }, rand);
    for (const p of h.players) h = applyAction(h, p.id, { type: "vote", approve: true }, rand);
    expect(h.phase).toBe("quest");
    expect(() => applyAction(h, good, { type: "quest", success: false }, rand)).toThrow(GameError);
  });
});
