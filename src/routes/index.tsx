import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRoom, joinRoom } from "@/lib/avalon/game.functions";
import { loadName, saveName, saveToken } from "@/lib/avalon/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avalon – online társasjáték" },
      { name: "description", content: "Hozz létre egy szobát, és játszd az Avalont barátaiddal a saját telefonjaitokon." },
      { property: "og:title", content: "Avalon – online társasjáték" },
      { property: "og:description", content: "Merlin, Percival, Morgana és a többiek – játszd az Avalont online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const join = useServerFn(joinRoom);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(loadName()), []);

  async function run(kind: "create" | "join") {
    setBusy(true);
    try {
      const res = kind === "create" ? await create({ data: { name } }) : await join({ data: { name, code } });
      if (!res.ok) return toast.error(res.error);
      saveName(name.trim());
      saveToken(res.data.code, res.data.token);
      navigate({ to: "/room/$code", params: { code: res.data.code } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Arthur lovagjai</p>
        <h1 className="mt-2 text-5xl font-bold text-primary">Avalon</h1>
        <p className="mt-3 text-muted-foreground">
          Jók és gonoszok harca. 5–10 játékos, mindenki a saját telefonján.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border bg-card p-5">
        <label className="text-sm text-muted-foreground" htmlFor="name">A neved</label>
        <Input id="name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="pl. Lancelot" />
        <Button className="w-full" disabled={busy || !name.trim()} onClick={() => run("create")}>
          Új játék
        </Button>
        <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> vagy <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex gap-2">
          <Input
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Szobakód"
            className="uppercase tracking-widest"
          />
          <Button variant="secondary" disabled={busy || !name.trim() || code.length !== 4} onClick={() => run("join")}>
            Csatlakozás
          </Button>
        </div>
      </section>
    </main>
  );
}
