import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { doAction, getView } from "@/lib/avalon/game.functions";
import {
  EVIL_COUNT,
  failsNeeded,
  isEvil,
  TEAM_SIZES,
  validateSetup,
  type Action,
  type PlayerView,
  type Role,
  type Settings,
} from "@/lib/avalon/engine";
import { loadToken } from "@/lib/avalon/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Avalon – ${params.code} szoba` },
      { name: "description", content: "Csatlakozz az Avalon játékszobához." },
      { property: "og:title", content: `Avalon – ${params.code} szoba` },
      { property: "og:description", content: "Csatlakozz az Avalon játékszobához." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

const ROLE_NAMES: Record<Role, string> = {
  merlin: "Merlin",
  percival: "Percival",
  loyal: "Arthur hű szolgája",
  assassin: "Orgyilkos",
  morgana: "Morgana",
  mordred: "Mordred",
  oberon: "Oberon",
  minion: "Mordred csatlósa",
};
const ROLE_DESC: Record<Role, string> = {
  merlin: "Ismered a gonoszokat (Mordred kivételével). Vigyázz, az Orgyilkos a végén rád vadászik!",
  percival: "Látod Merlint és Morganát, de nem tudod, melyik melyik.",
  loyal: "Segítsd a küldetések sikerét, és leplezd le a gonoszokat.",
  assassin: "Ha a jók nyernek három küldetést, kitalálhatod, ki Merlin – ha eltalálod, a gonosz győz.",
  morgana: "Percival számára Merlinnek tűnsz.",
  mordred: "Merlin nem lát téged.",
  oberon: "Nem ismered a gonosz társaidat, és ők sem ismernek téged.",
  minion: "Ismered a gonosz társaidat. Buktasd el a küldetéseket!",
};

function RoomPage() {
  const { code } = Route.useParams();
  const fetchView = useServerFn(getView);
  const act = useServerFn(doAction);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(loadToken(code)), [code]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const res = await fetchView({ data: { code, token } });
    if (res.ok) setView(res.data);
    else setError(res.error);
  }, [code, token, fetchView]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const channel = supabase
      .channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () =>
        refresh(),
      )
      .subscribe();
    const interval = setInterval(refresh, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [token, code, refresh]);

  const send = useCallback(
    async (action: Action) => {
      if (!token) return;
      setBusy(true);
      try {
        const res = await act({ data: { code, token, action } });
        if (res.ok) setView(res.data);
        else toast.error(res.error);
      } finally {
        setBusy(false);
      }
    },
    [act, code, token],
  );

  if (token === undefined) return <Centered>Betöltés…</Centered>;
  if (token === null || error)
    return (
      <Centered>
        <p>{error ?? "Nem vagy tagja ennek a szobának."}</p>
        <Button asChild className="mt-4">
          <Link to="/">Vissza a főoldalra</Link>
        </Button>
      </Centered>
    );
  if (!view) return <Centered>Betöltés…</Centered>;

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-display text-2xl font-bold text-primary">Avalon</Link>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Szobakód</div>
          <div className="font-display text-xl tracking-[0.3em]">{code}</div>
        </div>
      </header>
      {view.phase === "lobby" ? (
        <Lobby view={view} send={send} busy={busy} />
      ) : (
        <GameScreen view={view} send={send} busy={busy} />
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</div>;
}

type Props = { view: PlayerView; send: (a: Action) => void; busy: boolean };

const nameOf = (v: PlayerView, id: string) => v.players.find((p) => p.id === id)?.name ?? "?";

function Lobby({ view, send, busy }: Props) {
  const isHost = view.me === view.hostId;
  const n = view.players.length;
  const err = validateSetup(n, view.settings);
  const opts: { key: keyof Settings; label: string; desc: string }[] = [
    { key: "percival", label: "Percival", desc: "Jó: látja Merlint (és Morganát)." },
    { key: "morgana", label: "Morgana", desc: "Gonosz: Percivalnak Merlinnek tűnik." },
    { key: "mordred", label: "Mordred", desc: "Gonosz: rejtve marad Merlin elől." },
    { key: "oberon", label: "Oberon", desc: "Gonosz: nem ismeri társait, ők sem őt." },
    { key: "lady", label: "A Tó Úrnője", desc: "A 2., 3. és 4. küldetés után valaki hűségét meg lehet vizsgálni." },
  ];
  return (
    <div className="space-y-5">
      <Panel title={`Játékosok (${n}/10)`}>
        <ul className="space-y-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
              <span>
                {p.name}
                {p.id === view.hostId && <span className="ml-2 text-sm text-primary">házigazda</span>}
                {p.id === view.me && <span className="ml-2 text-sm text-muted-foreground">(te)</span>}
              </span>
              {isHost && p.id !== view.hostId && (
                <button className="text-sm text-muted-foreground hover:text-destructive" onClick={() => send({ type: "kick", target: p.id })}>
                  eltávolítás
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">Oszd meg a szobakódot a többiekkel.</p>
      </Panel>

      <Panel title="Karakterek">
        <p className="mb-3 text-sm text-muted-foreground">Merlin és az Orgyilkos mindig játékban van.</p>
        <div className="space-y-3">
          {opts.map((o) => (
            <label key={o.key} className="flex items-start justify-between gap-4">
              <span>
                <span className="font-semibold">{o.label}</span>
                <span className="block text-sm text-muted-foreground">{o.desc}</span>
              </span>
              <Switch
                checked={view.settings[o.key]}
                disabled={!isHost || busy}
                onCheckedChange={(c) => send({ type: "settings", settings: { ...view.settings, [o.key]: c } })}
              />
            </label>
          ))}
        </div>
        {view.settings.morgana && !view.settings.percival && (
          <p className="mt-3 text-sm text-primary">Tipp: Morgana Percival nélkül nem sokat ér.</p>
        )}
        {n >= 5 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {n} játékos: {n - EVIL_COUNT[n]!} jó, {EVIL_COUNT[n]} gonosz.
          </p>
        )}
      </Panel>

      {isHost ? (
        <div>
          <Button className="w-full" size="lg" disabled={!!err || busy} onClick={() => send({ type: "start" })}>
            Játék indítása
          </Button>
          {err && <p className="mt-2 text-center text-sm text-muted-foreground">{err}</p>}
        </div>
      ) : (
        <p className="text-center text-muted-foreground">Várakozás a házigazdára…</p>
      )}
    </div>
  );
}

function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      {title && <h2 className="mb-3 text-lg font-semibold text-primary">{title}</h2>}
      {children}
    </section>
  );
}

function GameScreen({ view, send, busy }: Props) {
  const [showRole, setShowRole] = useState(false);
  const n = view.players.length;
  const sizes = TEAM_SIZES[n] ?? [];
  const leaderId = view.players[view.leader]?.id;
  const evilMe = view.myRole ? isEvil(view.myRole) : false;

  return (
    <div className="space-y-5">
      {/* Quest track */}
      <Panel>
        <div className="flex justify-between gap-2">
          {sizes.map((s, i) => {
            const r = view.results[i];
            return (
              <div
                key={i}
                className={cn(
                  "flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-lg font-bold",
                  r === "good" && "border-good bg-good/30",
                  r === "evil" && "border-evil bg-evil/30",
                  !r && i === view.quest && view.phase !== "over" && "border-primary",
                )}
              >
                {s}
                {failsNeeded(n, i) === 2 && <span className="text-[10px] font-normal">2 kudarc</span>}
                {r && <span className="text-[10px] font-normal">{view.questFails[i]} ✗</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Elutasítások:
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-3 w-3 rounded-full border", i < view.rejections && "bg-evil border-evil")} />
          ))}
        </div>
      </Panel>

      {/* Role */}
      {view.myRole && view.phase !== "over" && (
        <Panel>
          <button className="w-full text-left" onClick={() => setShowRole((s) => !s)}>
            <div className="flex items-center justify-between">
              <span className="font-display">Szereped</span>
              <span className="text-sm text-muted-foreground">{showRole ? "elrejtés" : "megmutatás"}</span>
            </div>
          </button>
          {showRole && (
            <div className="mt-3">
              <div className={cn("font-display text-2xl", evilMe ? "text-evil" : "text-good")}>
                {ROLE_NAMES[view.myRole]}
              </div>
              <p className="text-sm text-muted-foreground">{evilMe ? "Gonosz" : "Jó"} – {ROLE_DESC[view.myRole]}</p>
              {view.knowledge.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {view.knowledge.map((k) => (
                    <li key={k.id}>
                      <b>{nameOf(view, k.id)}</b> – {k.label}
                    </li>
                  ))}
                </ul>
              )}
              {view.myLadyResults.map((r) => (
                <p key={r.target} className="mt-1 text-sm">
                  Tó Úrnője: <b>{nameOf(view, r.target)}</b> {r.evil ? "gonosz" : "jó"}.
                </p>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Phase view={view} send={send} busy={busy} />

      {/* Players */}
      <Panel title="Játékosok">
        <ul className="space-y-1">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>
                {p.name}
                {p.id === view.me && <span className="text-muted-foreground"> (te)</span>}
              </span>
              <span className="flex gap-2 text-sm">
                {p.id === leaderId && view.phase !== "over" && <span className="text-primary">vezető</span>}
                {view.ladyHolder === p.id && <span className="text-good">Tó Úrnője</span>}
                {view.team.includes(p.id) && ["vote", "quest"].includes(view.phase) && <span>csapattag</span>}
                {view.phase === "vote" && view.votedIds.includes(p.id) && <span className="text-muted-foreground">szavazott</span>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {view.lastVote && (
        <Panel title="Utolsó szavazás">
          <p className="mb-2 text-sm text-muted-foreground">
            Vezető: {nameOf(view, view.lastVote.leaderId)} · Csapat: {view.lastVote.team.map((id) => nameOf(view, id)).join(", ")} ·{" "}
            {view.lastVote.approved ? "elfogadva" : "elutasítva"}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(view.lastVote.votes).map(([id, v]) => (
              <span key={id} className={cn("rounded px-2 py-0.5 text-sm", v ? "bg-good/30" : "bg-evil/30")}>
                {nameOf(view, id)}: {v ? "igen" : "nem"}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Napló">
        <ol className="max-h-48 space-y-1 overflow-y-auto text-sm text-muted-foreground">
          {[...view.log].reverse().map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function PickPlayers({
  view,
  count,
  eligible,
  onConfirm,
  label,
  busy,
}: {
  view: PlayerView;
  count: number;
  eligible: (id: string) => boolean;
  onConfirm: (ids: string[]) => void;
  label: string;
  busy: boolean;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : count === 1 ? [id] : s.length < count ? [...s, id] : s));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {view.players.map((p) => {
          const ok = eligible(p.id);
          return (
            <button
              key={p.id}
              disabled={!ok}
              onClick={() => toggle(p.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-40",
                sel.includes(p.id) ? "border-primary bg-primary/20" : "bg-muted",
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      <Button className="w-full" disabled={busy || sel.length !== count} onClick={() => onConfirm(sel)}>
        {label} ({sel.length}/{count})
      </Button>
    </div>
  );
}

function Phase({ view, send, busy }: Props) {
  const n = view.players.length;
  const leaderId = view.players[view.leader]?.id;
  const iLead = leaderId === view.me;
  const size = TEAM_SIZES[n]?.[Math.min(view.quest, 4)] ?? 0;

  if (view.phase === "team")
    return (
      <Panel title={`${view.quest + 1}. küldetés – csapatválasztás`}>
        {iLead ? (
          <>
            <p className="mb-3">Te vagy a vezető. Válassz {size} játékost a küldetésre.</p>
            <PickPlayers view={view} count={size} eligible={() => true} busy={busy} label="Csapat javaslása"
              onConfirm={(team) => send({ type: "propose", team })} />
          </>
        ) : (
          <p className="text-muted-foreground">{nameOf(view, leaderId ?? "")} választja ki a {size} fős csapatot…</p>
        )}
      </Panel>
    );

  if (view.phase === "vote")
    return (
      <Panel title="Szavazás a csapatról">
        <p className="mb-3">
          Javasolt csapat: <b>{view.team.map((id) => nameOf(view, id)).join(", ")}</b>
        </p>
        {view.myVote === null ? (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" disabled={busy} className="bg-good text-foreground hover:bg-good/80" onClick={() => send({ type: "vote", approve: true })}>
              Elfogadom
            </Button>
            <Button size="lg" disabled={busy} variant="destructive" onClick={() => send({ type: "vote", approve: false })}>
              Elutasítom
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Szavazatod: {view.myVote ? "igen" : "nem"}. Várakozás ({view.votedIds.length}/{n})…
          </p>
        )}
      </Panel>
    );

  if (view.phase === "quest") {
    const onTeam = view.team.includes(view.me);
    const canFail = view.myRole ? isEvil(view.myRole) : false;
    return (
      <Panel title={`${view.quest + 1}. küldetés folyamatban`}>
        <p className="mb-3">Csapat: <b>{view.team.map((id) => nameOf(view, id)).join(", ")}</b></p>
        {onTeam && view.myCard === null ? (
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" disabled={busy} className="bg-good text-foreground hover:bg-good/80" onClick={() => send({ type: "quest", success: true })}>
              Siker
            </Button>
            <Button size="lg" disabled={busy || !canFail} variant="destructive" onClick={() => send({ type: "quest", success: false })}>
              Kudarc
            </Button>
            {!canFail && <p className="col-span-2 text-sm text-muted-foreground">Jó játékosként csak sikert játszhatsz ki.</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">Lapok kijátszva: {view.cardsPlayed}/{view.team.length}</p>
        )}
      </Panel>
    );
  }

  if (view.phase === "lady") {
    const mine = view.ladyHolder === view.me;
    return (
      <Panel title="A Tó Úrnője">
        {mine ? (
          <>
            <p className="mb-3">Válassz valakit, akinek megtudod a hűségét.</p>
            <PickPlayers view={view} count={1} busy={busy} label="Megvizsgálás"
              eligible={(id) => id !== view.me && !view.ladyHistory.includes(id)}
              onConfirm={([t]) => send({ type: "lady", target: t! })} />
          </>
        ) : (
          <p className="text-muted-foreground">{nameOf(view, view.ladyHolder ?? "")} vizsgál meg valakit…</p>
        )}
      </Panel>
    );
  }

  if (view.phase === "assassin") {
    const iAssassin = view.myRole === "assassin";
    return (
      <Panel title="A jók három küldetést nyertek!">
        {iAssassin ? (
          <>
            <p className="mb-3">Orgyilkos, ki Merlin? Egyetlen esélyed van.</p>
            <PickPlayers view={view} count={1} busy={busy} label="Merénylet"
              eligible={(id) => id !== view.me && !view.knowledge.some((k) => k.id === id)}
              onConfirm={([t]) => send({ type: "assassinate", target: t! })} />
          </>
        ) : (
          <p className="text-muted-foreground">Az Orgyilkos megpróbálja kitalálni, ki Merlin…</p>
        )}
      </Panel>
    );
  }

  // over
  return (
    <Panel className={view.winner === "good" ? "border-good" : "border-evil"}>
      <h2 className={cn("text-center text-3xl font-bold", view.winner === "good" ? "text-good" : "text-evil")}>
        {view.winner === "good" ? "A jók győztek!" : "A gonosz győzött!"}
      </h2>
      <p className="mt-2 text-center text-muted-foreground">{view.reason}</p>
      {view.allRoles && (
        <ul className="mt-4 space-y-1">
          {view.players.map((p) => {
            const r = view.allRoles![p.id] ?? "loyal";
            return (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className={isEvil(r) ? "text-evil" : "text-good"}>{ROLE_NAMES[r]}</span>
              </li>
            );
          })}
        </ul>
      )}
      {view.me === view.hostId ? (
        <Button className="mt-4 w-full" disabled={busy} onClick={() => send({ type: "restart" })}>
          Új játék ugyanitt
        </Button>
      ) : (
        <p className="mt-4 text-center text-sm text-muted-foreground">A házigazda indíthat új játékot.</p>
      )}
    </Panel>
  );
}
