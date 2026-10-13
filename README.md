# ♠ Felt: play & learn poker

A premium poker room for **No-Limit Texas Hold'em** and **Pot-Limit Omaha**, using **play-money chips only**. Real money is never involved.

- **Learn to Play**: illustrated rules course, hand rankings, a "who wins?" quiz, and a **practice game vs bots** with a live coach. The coach shows your win chance, the pot odds, the recommended move and what each choice leads to. No account needed.
- **Play with Friends**: create a private room and share its 6-character code or invite link. Private rooms are never listed publicly.
- **Play Online**: a public lobby with live updates. Open a table or join one.

Online play needs a Google sign-in. Chips are stored on the server, so they can't be duplicated or edited in the browser.

## Run it locally

```bash
pnpm install
docker compose up -d db redis          # Postgres on :5432, Redis on :6380
cp .env.example apps/server/.env       # local defaults, dev sign-in enabled
printf 'NEXT_PUBLIC_SERVER_URL=http://localhost:4000\nNEXT_PUBLIC_DEV_LOGIN=1\n' > apps/web/.env.local
pnpm dev                               # web on http://localhost:3000, game server on :4000
pnpm test                              # engine tests (evaluator, side pots, PLO, 300-hand bot simulation)
```

With `DEV_LOGIN=1` (local only, ignored when `NODE_ENV=production`), "Continue with Google" asks for a username instead. Each name is its own account, which makes it easy to test with several players in different browsers.

`docker compose up --build` runs the game server in Docker too.

## Structure

| Path | What |
| --- | --- |
| `packages/engine` | Pure TypeScript poker engine shared by client and server: evaluator, betting state machine (min-raise, side pots, pot-limit), player views that hide hole cards, Monte Carlo equity, bots and the coach. Also holds the shared socket protocol types. |
| `apps/server` | Socket.io game server. It holds the authoritative game state and the deck, and sends each player only their own cards. Also handles Google sign-in, the chip bankroll (Postgres), sessions and rate limits (Redis), rooms, turn timers and reconnects. |
| `apps/web` | Next.js 16 app (Tailwind v4, Motion, Zustand), exported as a static site. |

## Accounts and chips

- **Sign-in**: Google OAuth (code flow with PKCE) runs on the game server. It creates a session token, stores only its hash in Redis (30 days), and hands it to the site in the URL fragment. The socket sends it when connecting.
- **Bankroll**: `users.chips` in Postgres. New accounts get 10,000 chips, plus a daily bonus (doubled when below 1,000). Every change is recorded in `chip_ledger`.
- **Chips on a table** are tracked in `users.in_play`. A buy-in moves chips from `chips` to `in_play` before the player sits, the stack is saved after every hand, and leaving moves it back.
  - **Deploys**: on SIGTERM the server cancels hands in progress and refunds every seat before exiting.
  - **Crashes**: anything left in `in_play` is returned when the server next starts. That's at most one hand's worth of difference.
- **Rate limits** (Redis, fixed windows):
  - connections: 30 per minute per IP
  - sign-in attempts: 20 per 10 minutes per IP
  - table creation: 10 per 10 minutes per player
  - joins: 30 per minute
  - chat: 8 messages per 15 seconds
  - plus an in-memory limit of 15 events per second per socket, and at most `MAX_ROOMS` tables in total

## Deploy (free)

```
Browser ─ HTTPS ─► Cloudflare Workers (static site from apps/web/out)
        └ WSS ───► Cloudflare Tunnel ─► VM running Docker: game server
                                          ├─ Neon Postgres  (accounts, chips)
                                          └─ Upstash Redis  (sessions, rate limits)
```

The game server keeps live tables in memory, so **run exactly one instance**.

### 1. Databases
- **Neon** (neon.tech): create a project and copy the connection string (with `?sslmode=require`). Tables are created automatically on first start.
- **Upstash** (upstash.com): create a Redis database and copy the `rediss://` URL. The free tier allows 500K commands a month. A session check costs 1 and each rate-limit check costs 2; game moves don't touch Redis.

### 2. Google sign-in
In Google Cloud Console → APIs & Services:
1. Configure the OAuth consent screen (External, scopes `openid email profile`).
2. Create an **OAuth client ID** of type *Web application*.
3. Add the authorized redirect URI `https://api.<your-domain>/auth/google/callback`.

### 3. Game server on a free VM
Use **Oracle Cloud Always Free** (an Ampere ARM VM works well), or any machine with Docker.
1. Add your domain to Cloudflare. In Zero Trust → Networks → Tunnels, create a tunnel and copy its token.
2. Add a public hostname `api.<your-domain>` with service `http://server:4000`. The tunnel handles HTTPS and WebSockets, and no ports are opened on the VM.
3. On the VM:

   ```bash
   git clone <repo> felt && cd felt
   cp deploy/.env.example deploy/.env   # fill in every value
   docker compose -f deploy/docker-compose.yml up -d --build
   ```

   To update: `git pull`, then the same `up -d --build`. Tables cash out before the old container stops.

### 4. Website on Cloudflare
In the Cloudflare dashboard → Workers & Pages → Create → import the Git repo:
- **Root directory**: `apps/web`
- **Build command**: `pnpm build`
- **Deploy command**: `npx wrangler deploy` (config in `apps/web/wrangler.jsonc`)
- **Build variable**: `NEXT_PUBLIC_SERVER_URL=https://api.<your-domain>`

Attach your domain (e.g. `<your-domain>`) and make sure it's listed in the server's `WEB_ORIGINS`.

Invite links look like `/room?code=ABC123`, because static hosting can't serve dynamic paths like `/room/ABC123`.
