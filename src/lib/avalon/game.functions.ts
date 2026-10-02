import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addPlayer,
  applyAction,
  GameError,
  newGame,
  publicState,
  viewFor,
  type Action,
  type Game,
} from "./engine";

const nameSchema = z.string().trim().min(1, "Adj meg egy nevet.").max(20, "Legfeljebb 20 karakter.");
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/, "Érvénytelen szobakód.");
const tokenSchema = z.string().min(20).max(100);

const settingsSchema = z.object({
  percival: z.boolean(),
  morgana: z.boolean(),
  mordred: z.boolean(),
  oberon: z.boolean(),
  lady: z.boolean(),
});
const actionSchema: z.ZodType<Action> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("settings"), settings: settingsSchema }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("propose"), team: z.array(z.string().max(64)).max(10) }),
  z.object({ type: z.literal("vote"), approve: z.boolean() }),
  z.object({ type: z.literal("quest"), success: z.boolean() }),
  z.object({ type: z.literal("lady"), target: z.string().max(64) }),
  z.object({ type: z.literal("assassinate"), target: z.string().max(64) }),
  z.object({ type: z.literal("restart") }),
  z.object({ type: z.literal("kick"), target: z.string().max(64) }),
]) as z.ZodType<Action>;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function randomFloat() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! / 2 ** 32;
}
function randomId(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function hash(token: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => letters[Math.floor(randomFloat() * letters.length)]).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findPlayer(game: Game, token: string) {
  const h = await hash(token);
  const id = Object.entries(game.tokens).find(([, v]) => v === h)?.[0];
  if (!id) throw new GameError("Nem vagy tagja ennek a szobának.");
  return id;
}

/** Load, mutate with optimistic locking, save. Retries on concurrent writes. */
async function mutate(code: string, fn: (g: Game) => Promise<Game> | Game): Promise<Game> {
  const db = await admin();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db.from("room_private").select("game, version").eq("code", code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new GameError("Nincs ilyen szoba.");
    const next = await fn(data.game as unknown as Game);
    const { data: upd, error: e2 } = await db
      .from("room_private")
      .update({ game: next as never, version: data.version + 1 })
      .eq("code", code)
      .eq("version", data.version)
      .select("code");
    if (e2) throw new Error(e2.message);
    if (upd && upd.length) {
      await db
        .from("rooms")
        .update({ state: publicState(next) as never, updated_at: new Date().toISOString() })
        .eq("code", code);
      return next;
    }
  }
  throw new GameError("Túl sok egyidejű lépés, próbáld újra.");
}

function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  return fn().then(
    (data) => ({ ok: true as const, data }),
    (e) => {
      if (e instanceof GameError || e instanceof z.ZodError)
        return { ok: false as const, error: e instanceof z.ZodError ? (e.errors[0]?.message ?? "Hibás adat.") : e.message };
      console.error(e);
      return { ok: false as const, error: "Váratlan hiba történt." };
    },
  );
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string() }).parse(d))
  .handler(({ data }) =>
    wrap(async () => {
      const name = nameSchema.parse(data.name);
      const db = await admin();
      const token = randomId();
      const id = randomId(8);
      const game = newGame(id, name, await hash(token));
      for (let i = 0; i < 10; i++) {
        const code = randomCode();
        const { error } = await db.from("rooms").insert({ code, state: publicState(game) as never });
        if (error) continue;
        const { error: e2 } = await db.from("room_private").insert({ code, game: game as never });
        if (e2) throw new Error(e2.message);
        return { code, token };
      }
      throw new Error("Nem sikerült szobát létrehozni.");
    }),
  );

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string(), name: z.string() }).parse(d))
  .handler(({ data }) =>
    wrap(async () => {
      const code = codeSchema.parse(data.code);
      const name = nameSchema.parse(data.name);
      const token = randomId();
      const h = await hash(token);
      const id = randomId(8);
      await mutate(code, (g) => addPlayer(g, id, name, h));
      return { code, token };
    }),
  );

export const getView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: codeSchema, token: tokenSchema }).parse(d))
  .handler(({ data }) =>
    wrap(async () => {
      const db = await admin();
      const { data: row, error } = await db.from("room_private").select("game").eq("code", data.code).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new GameError("Nincs ilyen szoba.");
      const game = row.game as unknown as Game;
      const me = await findPlayer(game, data.token);
      return viewFor(game, me);
    }),
  );

export const doAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: codeSchema, token: tokenSchema, action: actionSchema }).parse(d),
  )
  .handler(({ data }) =>
    wrap(async () => {
      let me = "";
      const game = await mutate(data.code, async (g) => {
        me = await findPlayer(g, data.token);
        return applyAction(g, me, data.action, randomFloat);
      });
      return viewFor(game, me);
    }),
  );
