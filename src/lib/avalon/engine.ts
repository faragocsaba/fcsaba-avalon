// Pure Avalon rules engine. Every action validates legality and throws GameError otherwise.

export type Role =
  | "merlin"
  | "percival"
  | "loyal"
  | "assassin"
  | "morgana"
  | "mordred"
  | "oberon"
  | "minion";

export type Phase = "lobby" | "team" | "vote" | "quest" | "lady" | "assassin" | "over";

export interface Settings {
  merlin: boolean;
  assassin: boolean;
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
  lady: boolean;
}

export interface Player {
  id: string;
  name: string;
}

export interface VoteRecord {
  quest: number;
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
}

export interface Game {
  phase: Phase;
  players: Player[];
  hostId: string;
  settings: Settings;
  tokens: Record<string, string>;
  roles: Record<string, Role>;
  leader: number;
  quest: number;
  results: ("good" | "evil")[];
  questFails: number[];
  rejections: number;
  team: string[];
  votes: Record<string, boolean>;
  lastVote: VoteRecord | null;
  cards: Record<string, boolean>;
  ladyHolder: string | null;
  ladyHistory: string[];
  ladyResults: { holder: string; target: string; evil: boolean }[];
  winner: "good" | "evil" | null;
  reason: string | null;
  assassinTarget: string | null;
  log: string[];
}

export type Action =
  | { type: "settings"; settings: Settings }
  | { type: "start" }
  | { type: "propose"; team: string[] }
  | { type: "vote"; approve: boolean }
  | { type: "quest"; success: boolean }
  | { type: "lady"; target: string }
  | { type: "assassinate"; target: string }
  | { type: "restart" }
  | { type: "kick"; target: string };

export class GameError extends Error {}

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export const EVIL_COUNT: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };

export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export const EVIL_ROLES: Role[] = ["assassin", "morgana", "mordred", "oberon", "minion"];
export const isEvil = (r: Role | undefined) => !!r && EVIL_ROLES.includes(r);

export function failsNeeded(n: number, quest: number) {
  return quest === 3 && n >= 7 ? 2 : 1;
}

export const defaultSettings = (): Settings => ({
  merlin: true,
  assassin: true,
  percival: false,
  morgana: false,
  mordred: false,
  oberon: false,
  lady: false,
});

export function newGame(hostId: string, hostName: string, tokenHash: string): Game {
  return {
    phase: "lobby",
    players: [{ id: hostId, name: hostName }],
    hostId,
    settings: defaultSettings(),
    tokens: { [hostId]: tokenHash },
    roles: {},
    leader: 0,
    quest: 0,
    results: [],
    questFails: [],
    rejections: 0,
    team: [],
    votes: {},
    lastVote: null,
    cards: {},
    ladyHolder: null,
    ladyHistory: [],
    ladyResults: [],
    winner: null,
    reason: null,
    assassinTarget: null,
    log: [],
  };
}

/** Returns a Hungarian error message if setup is invalid for n players, else null. */
export function validateSetup(n: number, s: Settings): string | null {
  if (n < MIN_PLAYERS) return `Legalább ${MIN_PLAYERS} játékos kell.`;
  if (n > MAX_PLAYERS) return `Legfeljebb ${MAX_PLAYERS} játékos lehet.`;
  const evil = EVIL_COUNT[n]!;
  const evilSpecials = (s.assassin !== false ? 1 : 0) + (s.morgana ? 1 : 0) + (s.mordred ? 1 : 0) + (s.oberon ? 1 : 0);
  if (evilSpecials > evil)
    return `${n} játékosnál csak ${evil} gonosz van, de ${evilSpecials} gonosz karakter van kiválasztva.`;
  if (s.merlin === false && (s.percival || s.morgana))
    return "Percival és Morgana csak Merlinnel együtt játszható.";
  return null;
}

export function buildRoles(n: number, s: Settings): Role[] {
  const evil = EVIL_COUNT[n]!;
  const roles: Role[] = [];
  if (s.merlin !== false) roles.push("merlin");
  if (s.percival) roles.push("percival");
  while (roles.length < n - evil) roles.push("loyal");
  const evilRoles: Role[] = [];
  if (s.assassin !== false) evilRoles.push("assassin");
  if (s.morgana) evilRoles.push("morgana");
  if (s.mordred) evilRoles.push("mordred");
  if (s.oberon) evilRoles.push("oberon");
  while (evilRoles.length < evil) evilRoles.push("minion");
  return [...roles, ...evilRoles];
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const name = (g: Game, id: string) => g.players.find((p) => p.id === id)?.name ?? "?";

export function addPlayer(g: Game, id: string, playerName: string, tokenHash: string): Game {
  if (g.phase !== "lobby") throw new GameError("A játék már elkezdődött.");
  if (g.players.length >= MAX_PLAYERS) throw new GameError("A szoba megtelt.");
  if (g.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase()))
    throw new GameError("Ez a név már foglalt ebben a szobában.");
  return {
    ...g,
    players: [...g.players, { id, name: playerName }],
    tokens: { ...g.tokens, [id]: tokenHash },
  };
}

/** Reuses an existing seat only when both its name and secret token match. */
export function addOrReconnectPlayer(g: Game, id: string, playerName: string, tokenHash: string): Game {
  const existing = g.players.find((p) => p.name.toLocaleLowerCase("hu") === playerName.toLocaleLowerCase("hu"));
  if (!existing) return addPlayer(g, id, playerName, tokenHash);
  if (g.tokens[existing.id] !== tokenHash)
    throw new GameError("Ez a név már foglalt ebben a szobában.");
  return g;
}

function nextLeader(g: Game): Game {
  return { ...g, leader: (g.leader + 1) % g.players.length, team: [], votes: {}, phase: "team" };
}

function startRound(g: Game, rand: () => number): Game {
  const n = g.players.length;
  const roles = shuffle(buildRoles(n, g.settings), rand);
  const roleMap: Record<string, Role> = {};
  g.players.forEach((p, i) => (roleMap[p.id] = roles[i]!));
  const leader = Math.floor(rand() * n);
  return {
    ...g,
    phase: "team",
    roles: roleMap,
    leader,
    quest: 0,
    results: [],
    questFails: [],
    rejections: 0,
    team: [],
    votes: {},
    lastVote: null,
    cards: {},
    ladyHolder: g.settings.lady ? g.players[(leader - 1 + n) % n]!.id : null,
    ladyHistory: [],
    ladyResults: [],
    winner: null,
    reason: null,
    assassinTarget: null,
    log: ["A játék elkezdődött."],
  };
}

export function applyAction(g: Game, actor: string, action: Action, rand: () => number): Game {
  if (!g.players.some((p) => p.id === actor)) throw new GameError("Nem vagy tagja a szobának.");
  const n = g.players.length;
  const isHost = actor === g.hostId;

  switch (action.type) {
    case "settings": {
      if (g.phase !== "lobby") throw new GameError("A beállítások csak a váróban módosíthatók.");
      if (!isHost) throw new GameError("Csak a házigazda módosíthatja a beállításokat.");
      return { ...g, settings: { ...action.settings } };
    }
    case "kick": {
      if (g.phase !== "lobby") throw new GameError("Csak a váróban lehet játékost eltávolítani.");
      if (!isHost) throw new GameError("Csak a házigazda távolíthat el játékost.");
      if (action.target === g.hostId) throw new GameError("A házigazda nem távolítható el.");
      const tokens = { ...g.tokens };
      delete tokens[action.target];
      return { ...g, players: g.players.filter((p) => p.id !== action.target), tokens };
    }
    case "start": {
      if (g.phase !== "lobby") throw new GameError("A játék már elkezdődött.");
      if (!isHost) throw new GameError("Csak a házigazda indíthatja a játékot.");
      const err = validateSetup(n, g.settings);
      if (err) throw new GameError(err);
      return startRound(g, rand);
    }
    case "restart": {
      if (g.phase !== "over") throw new GameError("A játék még tart.");
      if (!isHost) throw new GameError("Csak a házigazda indíthat új játékot.");
      return { ...g, phase: "lobby", roles: {}, log: [] };
    }
    case "propose": {
      if (g.phase !== "team") throw new GameError("Most nem lehet csapatot javasolni.");
      if (g.players[g.leader]!.id !== actor) throw new GameError("Csak a vezető javasolhat csapatot.");
      const size = TEAM_SIZES[n]![g.quest]!;
      const team = [...new Set(action.team)];
      if (team.length !== size) throw new GameError(`Pontosan ${size} játékost kell választani.`);
      if (!team.every((id) => g.players.some((p) => p.id === id)))
        throw new GameError("Ismeretlen játékos.");
      return {
        ...g,
        phase: "vote",
        team,
        votes: {},
        log: [...g.log, `${name(g, actor)} csapatot javasolt: ${team.map((id) => name(g, id)).join(", ")}.`],
      };
    }
    case "vote": {
      if (g.phase !== "vote") throw new GameError("Most nincs szavazás.");
      if (actor in g.votes) throw new GameError("Már szavaztál.");
      const votes = { ...g.votes, [actor]: action.approve };
      if (Object.keys(votes).length < n) return { ...g, votes };
      const yes = Object.values(votes).filter(Boolean).length;
      const approved = yes > n / 2;
      const record: VoteRecord = {
        quest: g.quest,
        leaderId: g.players[g.leader]!.id,
        team: g.team,
        votes,
        approved,
      };
      const yesNames = g.players.filter((p) => votes[p.id]).map((p) => p.name).join(", ");
      const noNames = g.players.filter((p) => votes[p.id] === false).map((p) => p.name).join(", ");
      const log = [
        ...g.log,
        `Szavazás: ${yes} igen (${yesNames}), ${n - yes} nem (${noNames}) – ${approved ? "elfogadva" : "elutasítva"}.`,
      ];
      if (approved) return { ...g, votes, lastVote: record, phase: "quest", cards: {}, rejections: 0, log };
      const rejections = g.rejections + 1;
      if (rejections >= 5)
        return {
          ...g,
          votes,
          lastVote: record,
          rejections,
          phase: "over",
          winner: "evil",
          reason: "Öt csapatjavaslatot utasítottak el egymás után.",
          log,
        };
      return nextLeader({ ...g, lastVote: record, rejections, log });
    }
    case "quest": {
      if (g.phase !== "quest") throw new GameError("Most nincs küldetés.");
      if (!g.team.includes(actor)) throw new GameError("Nem vagy tagja a küldetésnek.");
      if (actor in g.cards) throw new GameError("Már kijátszottad a lapodat.");
      if (!action.success && !isEvil(g.roles[actor]))
        throw new GameError("A jók csak sikert játszhatnak ki.");
      const cards = { ...g.cards, [actor]: action.success };
      if (Object.keys(cards).length < g.team.length) return { ...g, cards };
      const fails = Object.values(cards).filter((c) => !c).length;
      const result: "good" | "evil" = fails >= failsNeeded(n, g.quest) ? "evil" : "good";
      const results = [...g.results, result];
      const questFails = [...g.questFails, fails];
      const log = [
        ...g.log,
        `${g.quest + 1}. küldetés: ${result === "good" ? "sikeres" : "sikertelen"} (${fails} kudarc lap).`,
      ];
      const base: Game = { ...g, cards, results, questFails, log };
      const goodWins = results.filter((r) => r === "good").length;
      const evilWins = results.filter((r) => r === "evil").length;
      if (evilWins >= 3)
        return { ...base, phase: "over", winner: "evil", reason: "Három küldetés elbukott." };
      if (goodWins >= 3) {
        const canAssassinate = g.settings.merlin !== false && g.settings.assassin !== false;
        if (!canAssassinate)
          return { ...base, phase: "over", winner: "good", reason: "Három küldetés sikeres." };
        return { ...base, phase: "assassin" };
      }
      const finished = g.quest;
      const next = { ...base, quest: g.quest + 1 };
      if (g.settings.lady && finished >= 1 && finished <= 3) return { ...next, phase: "lady" };
      return nextLeader(next);
    }
    case "lady": {
      if (g.phase !== "lady") throw new GameError("Most nem használható a Tó Úrnője.");
      if (g.ladyHolder !== actor) throw new GameError("Nem nálad van a Tó Úrnője.");
      if (action.target === actor) throw new GameError("Magadat nem vizsgálhatod meg.");
      if (!g.players.some((p) => p.id === action.target)) throw new GameError("Ismeretlen játékos.");
      if (g.ladyHistory.includes(action.target))
        throw new GameError("Aki már birtokolta a Tó Úrnőjét, nem vizsgálható meg.");
      return nextLeader({
        ...g,
        ladyResults: [
          ...g.ladyResults,
          { holder: actor, target: action.target, evil: isEvil(g.roles[action.target]) },
        ],
        ladyHistory: [...g.ladyHistory, actor],
        ladyHolder: action.target,
        log: [...g.log, `${name(g, actor)} megvizsgálta ${name(g, action.target)} hűségét.`],
      });
    }
    case "assassinate": {
      if (g.phase !== "assassin") throw new GameError("Most nincs merénylet.");
      if (g.roles[actor] !== "assassin") throw new GameError("Csak az Orgyilkos választhat célpontot.");
      const targetRole = g.roles[action.target];
      if (!targetRole) throw new GameError("Ismeretlen játékos.");
      if (isEvil(targetRole)) throw new GameError("Csak jó játékost választhatsz.");
      const hit = targetRole === "merlin";
      return {
        ...g,
        phase: "over",
        assassinTarget: action.target,
        winner: hit ? "evil" : "good",
        reason: hit
          ? `Az Orgyilkos megölte Merlint (${name(g, action.target)}).`
          : `Az Orgyilkos tévedett (${name(g, action.target)} nem Merlin).`,
        log: [...g.log, `Az Orgyilkos ${name(g, action.target)} játékost választotta.`],
      };
    }
  }
}

export interface Knowledge {
  id: string;
  label: string;
}

/** What a role sees at the start of the game. */
export function knowledgeFor(g: Game, me: string): Knowledge[] {
  const role = g.roles[me];
  if (!role) return [];
  const others = g.players.filter((p) => p.id !== me);
  if (role === "merlin")
    return others
      .filter((p) => isEvil(g.roles[p.id]) && g.roles[p.id] !== "mordred")
      .map((p) => ({ id: p.id, label: "Gonosz" }));
  if (role === "percival")
    return others
      .filter((p) => g.roles[p.id] === "merlin" || g.roles[p.id] === "morgana")
      .map((p) => ({ id: p.id, label: "Merlin vagy Morgana" }));
  if (isEvil(role) && role !== "oberon")
    return others
      .filter((p) => isEvil(g.roles[p.id]) && g.roles[p.id] !== "oberon")
      .map((p) => ({ id: p.id, label: "Gonosz társ" }));
  return [];
}

export interface PlayerView {
  me: string;
  phase: Phase;
  players: Player[];
  hostId: string;
  settings: Settings;
  leader: number;
  quest: number;
  results: ("good" | "evil")[];
  questFails: number[];
  rejections: number;
  team: string[];
  votedIds: string[];
  myVote: boolean | null;
  cardsPlayed: number;
  myCard: boolean | null;
  lastVote: VoteRecord | null;
  ladyHolder: string | null;
  ladyHistory: string[];
  myLadyResults: { target: string; evil: boolean }[];
  winner: "good" | "evil" | null;
  reason: string | null;
  assassinTarget: string | null;
  log: string[];
  myRole: Role | null;
  knowledge: Knowledge[];
  allRoles: Record<string, Role> | null;
}

export function viewFor(g: Game, me: string): PlayerView {
  return {
    me,
    phase: g.phase,
    players: g.players,
    hostId: g.hostId,
    settings: { ...defaultSettings(), ...g.settings },
    leader: g.leader,
    quest: g.quest,
    results: g.results,
    questFails: g.questFails,
    rejections: g.rejections,
    team: g.team,
    votedIds: g.phase === "vote" ? Object.keys(g.votes) : [],
    myVote: g.phase === "vote" ? (g.votes[me] ?? null) : null,
    cardsPlayed: g.phase === "quest" ? Object.keys(g.cards).length : 0,
    myCard: g.phase === "quest" ? (g.cards[me] ?? null) : null,
    lastVote: g.lastVote,
    ladyHolder: g.ladyHolder,
    ladyHistory: g.ladyHistory,
    myLadyResults: g.ladyResults.filter((r) => r.holder === me).map(({ target, evil }) => ({ target, evil })),
    winner: g.winner,
    reason: g.reason,
    assassinTarget: g.assassinTarget,
    log: g.log,
    myRole: g.roles[me] ?? null,
    knowledge: knowledgeFor(g, me),
    allRoles: g.phase === "over" ? g.roles : null,
  };
}

/** Public, secret-free snapshot (used only to trigger realtime refreshes). */
export function publicState(g: Game) {
  return { phase: g.phase, players: g.players.length, quest: g.quest, log: g.log.length };
}
