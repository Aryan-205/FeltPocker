# ♠ Felt: play & learn poker

A premium poker room for **No-Limit Texas Hold'em** and **Pot-Limit Omaha**, using **play-money chips only**. Real money is never involved.

- **Learn to Play**: illustrated rules course, hand rankings, a "who wins?" quiz, and a **practice game vs bots** with a live coach. The coach shows your win chance, the pot odds, the recommended move and what each choice leads to.
- **Play with Friends**: create a private room and share its 6-character code or invite link. Private rooms are never listed publicly.
- **Play Online**: a public lobby with live updates. Open a table or join one.

## Run it

```bash
pnpm install
pnpm dev          # web on http://localhost:3000, game server on :4000
pnpm test         # engine tests (evaluator, side pots, PLO, 300-hand bot simulation)
```

To play with friends on your Wi-Fi, open `http://<your-LAN-IP>:3000`. The client connects to port 4000 on the same host. To use a different server, set `NEXT_PUBLIC_SERVER_URL` in the web app.

## Structure

| Path | What |
| --- | --- |
| `packages/engine` | Pure TypeScript poker engine shared by client and server: evaluator, betting state machine (min-raise, side pots, pot-limit), player views that hide hole cards, Monte Carlo equity, bots and the coach. Also holds the shared socket protocol types. |
| `apps/server` | Socket.io server. It holds the authoritative game state and the deck, and sends each player only their own cards. Handles rooms and codes, lobby, turn timers, reconnects and zod validation. |
| `apps/web` | Next.js 16 app (Tailwind v4, Motion, Zustand). |

## Notes on chips

Your bankroll (10,000 to start, plus a daily bonus) is stored in your browser. Buying in moves chips to the table, and leaving returns them. If you disconnect, the server cashes you out after 60 seconds and returns the chips the next time you connect. Because the chips are play money, the bankroll is client-side by design.
# FeltPocker
