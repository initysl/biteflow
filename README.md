# 🍽️ BiteFlow — Real-Time QR Bistro & Kitchen Automation Platform

> **Transforming every smartphone into a smart table kiosk via instant QR scans with real-time kitchen orchestration, live order tracking, bill splitting, and waiter assistance.**

---

## Overview

**BiteFlow** is a modern, full-stack digital dining and kitchen management platform designed for restaurants, bistros, bars, and cafes. By eliminating app downloads, physical menus, and ordering bottlenecks, BiteFlow allows seated diners to scan a table-specific QR code, explore a rich visual menu, customize orders, track food progress live from the kitchen stations, call for assistance, and split or settle bills directly on their phones.

Kitchen staff and floor managers get a synchronized, real-time Kitchen Display System (KDS) and floor console with station routing (Grill, Pantry, Pastry, Bar), table status monitoring, dynamic menu management, and instant waiter alerts.

---

## Features

**For guests** (`/t/:table`)

- Mobile-first menu with chef's picks, a sticky category bar with scroll-spy, and search
- Dish details with dietary tags and allergen information entered by the restaurant (or a clear "ask staff" notice when there isn't any)
- Cart with per-item notes, kitchen notes and server-validated promo codes
- Pay up front by card (Stripe Checkout), or run a tab and request the bill, split evenly if needed
- Live order tracker (received → preparing → ready → served) and printable receipts
- Call staff for water, cutlery or a server, with live confirmation when it's handled

**For staff** (`/staff`, PIN sign-in)

- **Kitchen display**: New / Preparing / Ready columns, station filters (grill, pantry, pastry, bar), ticket timers that turn amber and red, and an audible chime for new tickets
- **Floor**: one queue for help requests, bill requests and plates ready to run, plus a live table map with open tabs
- **Menu**: add and edit dishes, toggle sold-out instantly, manage dietary and allergen data
- **Tables & QR codes**: per-table codes generated locally, PNG download, printable table tents, and code rotation to revoke a leaked link
- **Reports**: today's revenue, orders, average order value, time to ready, best sellers and orders by hour

Light and dark themes, keyboard and screen-reader friendly, and respectful of `prefers-reduced-motion`.

### Design

- **Type:** [Changa](https://fonts.google.com/specimen/Changa) for headings, prices and table numbers; [Ubuntu](https://fonts.google.com/specimen/Ubuntu) for everything else. Both are self-hosted via Fontsource.
- **Colour:** a signal orange accent (`#D23F06`) with a yellow highlight, white cards on a warm-grey ground, and black price pills. Every token is defined once in `src/index.css`, with a separate dark-mode set, and text pairings are checked against WCAG AA.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose **Try a demo table**. Open http://localhost:3000/staff in another window (demo PIN `1234`) to watch orders arrive live.

Development runs with demo mode on: the database is seeded with a sample menu, eight tables and a few orders in progress. **Reset demo data** in the staff sidebar restores it at any time.

## How it works

```
shared/        Types, constants and zod validators used by both sides
server/
  index.ts     HTTP server, Vite middleware (dev) or static files (prod)
  app.ts       Express app: security headers, routes, error handling
  realtime.ts  WebSocket hub on /ws with "staff" and per-table rooms
  auth.ts      PIN login, hashed expiring sessions in an httpOnly cookie
  db/          Drizzle schema, generated migrations, seed data
  services/    Pricing, order lifecycle, tables, assistance, reports, payments
  routes/      Public (diner), auth and staff routers
src/
  app/         Router and providers
  lib/         API client, realtime client, React Query hooks
  ui/          Design-system primitives (buttons, sheets, forms…)
  features/    diner/ and staff/ screens (staff is a separate lazy-loaded chunk)
```

Key design decisions:

- **The server prices every order.** Clients send item IDs and quantities only; prices, discounts and totals come from the database.
- **Table QR codes carry a secret token.** Diners can browse without one, but ordering, calling staff and requesting the bill all require it. Staff can rotate a table's token from the Tables screen.
- **Order lifecycle** is enforced server-side: `awaiting_payment → pending → preparing → ready → served → completed` (or `cancelled`). Card orders only reach the kitchen once paid, and an order completes when it's both served and paid.
- **Table status is derived** from open orders and bill requests, never set by hand, so it can't drift.
- **Realtime updates feed React Query.** The server pushes small events; the client updates or refetches the affected queries, and refetches everything after a reconnect.
- **Money is integer cents** end to end.

## Configuration

Copy `.env.example` to `.env`. Everything is optional in development.

| Variable                                | Default                           | Purpose                                                                              |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `APP_URL`                               | `http://localhost:3000`           | Public URL, used in QR codes and Stripe redirects                                    |
| `DATABASE_URL`                          | `./data/biteflow.db`              | SQLite file, created and migrated on start                                           |
| `RESTAURANT_NAME`, `CURRENCY`, `LOCALE` | `BiteFlow Bistro`, `USD`, `en-US` | Branding and money formatting                                                        |
| `DEMO_MODE`                             | on in dev, off in prod            | Seeds sample activity and shows demo helpers                                         |
| `STAFF_DEMO_PIN`                        | `1234`                            | 4-digit PIN for the first staff account (applied when the database is first created) |
| `STRIPE_SECRET_KEY`                     | none                              | Enables real Stripe Checkout. Without it, card payments use a labelled demo flow     |
| `STRIPE_WEBHOOK_SECRET`                 | none                              | Verifies `POST /api/payments/stripe/webhook`                                         |

To test Stripe locally, use a test-mode key and `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`. Payments are also confirmed when the guest returns from Checkout, so the webhook is optional in development.

## Scripts

| Command                                                 | What it does                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                                           | Dev server with hot reload                                               |
| `npm run build`                                         | Build the client to `dist/client` and bundle the server to `dist/server` |
| `npm start`                                             | Run the production build                                                 |
| `npm test`                                              | API and unit tests (Vitest + Supertest, in-memory SQLite)                |
| `npm run test:e2e`                                      | Playwright: a diner and a staff browser through the full service loop    |
| `npm run typecheck` / `npm run lint` / `npm run format` | Static checks                                                            |
| `npm run db:generate`                                   | Generate a migration after changing `server/db/schema.ts`                |

## Deploying

```bash
docker build -t biteflow .
docker run -p 3000:3000 -v biteflow-data:/data \
  -e APP_URL=https://order.example.com -e STAFF_DEMO_PIN=4826 biteflow
```

The app is a single Node process with SQLite, so one small instance with a persistent volume is enough for a restaurant. Run it behind HTTPS: session cookies are `Secure` in production.

## Notes

- Sample allergen data is illustrative. A real restaurant must enter and verify its own.
- Sample dishes imported from TheMealDB and TheCocktailDB have no allergen data, and are flagged as such for staff and guests.
- Not yet built: multiple staff accounts and roles, customer accounts and loyalty, per-guest online bill splitting, and printer integration for kitchen tickets.

---

## 📄 License

This project is licensed under the **MIT License**.
