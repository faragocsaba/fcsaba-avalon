# Avalon – online, Hungarian

Players join a shared game room from their own phones using a short code. All text in Hungarian. The server enforces every rule, so illegal moves are impossible.

## Player flow
1. Home: enter a name, then "Új játék" (create) or "Csatlakozás" (enter a room code). No account needed; an anonymous session identifies each player.
2. Lobby: player list (5–10). The host turns optional characters on or off: Merlin and Assassin are always in; Percival, Morgana, Mordred, Oberon and the Lady of the Lake are optional. Start is disabled until the setup is valid (enough evil seats for the chosen evil roles, Morgana only with Percival recommended, and so on).
3. Secret role screen: each player sees only their own role and what that role knows (Merlin sees evil players except Mordred; Percival sees Merlin/Morgana without knowing which; evil players see each other except Oberon).
4. Rounds: a quest track (5 quests, team sizes per player count, 2 fails needed on quest 4 with 7+ players), a vote track (5 rejections in a row = evil wins), and the leader marker.
   - Leader picks exactly the required number of players. Only the leader can do this.
   - Everyone votes approve/reject in secret; the votes are revealed together.
   - Team members play success/fail in secret. Good players can only pick success. Only the number of fail cards is shown.
   - Lady of the Lake (if on): after quests 2, 3 and 4 the holder checks another player's loyalty. Players who held it before can't be checked again.
5. Endgame: 3 successes, then the Assassin picks one target; hitting Merlin means evil wins. 3 fails or 5 rejections means evil wins at once.
6. Results screen shows everyone's role, plus a "Play again" option in the same room.

Extras: reconnects automatically after a page refresh, a game history log, and a phone-friendly dark "medieval" look (parchment and gold, a serif heading font).

## Technical details
- Enable Lovable Cloud, with anonymous sign-in for player identity.
- Tables: `rooms` (code, host, status, settings, phase, leader index, quest results, rejection count, Lady holder), `room_players` (seat, name, user), `player_secrets` (role; RLS lets each player read only their own row), `votes`, `quest_cards`, `lady_checks` (visible only to the checker). Every table gets GRANTs and RLS.
- All moves go through authenticated server functions (`createServerFn` + `requireSupabaseAuth`) that check phase, actor and legality, then update the state with the admin client. Clients can't write to game tables directly.
- Role assignment and shuffling happen on the server. Hidden votes and quest cards are only revealed once everyone has submitted.
- Live updates use realtime subscriptions on `rooms`/`room_players`; secret data is fetched through server functions.
- Pure rules module (team sizes, role knowledge, setup validation, transitions) with vitest unit tests.
- Routes: `/` (home), `/room/$code` (lobby/game/results by phase).
