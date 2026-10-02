<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Avalon rules live in the pure `src/lib/avalon/engine.ts` (unit-tested); server functions in `game.functions.ts` are the only writers — why: illegal moves must be impossible regardless of client.
- Full game state (incl. secrets, hashed player tokens) is stored in the service-role-only `room_private` table; `rooms` holds only a secret-free snapshot used as a realtime refresh trigger — why: no hidden info leaks to clients.
- Players are identified and may reconnect by a random per-room token in localStorage, not accounts — why: quick join from phones without allowing name-based seat theft.
- Finished-game share images are rendered locally from the secret-free `PlayerView` — why: summaries remain downloadable without uploading game data.
