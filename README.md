<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 🍽️ BiteFlow — Real-Time QR Bistro & Kitchen Automation Platform

> **Transforming every smartphone into a smart table kiosk via instant QR scans with real-time kitchen orchestration, live order tracking, bill splitting, and waiter assistance.**

---

## Overview

**BiteFlow** is a modern, full-stack digital dining and kitchen management platform designed for restaurants, bistros, bars, and cafes. By eliminating app downloads, physical menus, and ordering bottlenecks, BiteFlow allows seated diners to scan a table-specific QR code, explore a rich visual menu, customize orders, track food progress live from the kitchen stations, call for assistance, and split or settle bills directly on their phones.

Kitchen staff and floor managers get a synchronized, real-time Kitchen Display System (KDS) & Floor Console equipped with station routing (Grill, Starters, Desserts, Bar), Kanban order pipelines, table status monitoring, dynamic menu management, and instant waiter dispatch alerts.

---

## Key Features

### Customer Experience (Table Kiosk)
- **Instant Table QR Onboarding**: Table context is automatically extracted from URL query parameters (`?table=3`), binding diners directly to their table.
- **Interactive Gourmet Menu**: Filter by categories (*Starters*, *Mains*, *Desserts*, *Craft Drinks*), search keywords, and dietary tags (*Vegetarian*, *Vegan*, *Gluten-Free*, *Chef's Special*).
- **Customizable Orders & Add-ons**: Add dietary notes, cooking preferences (e.g. steak temperature), and allergies.
- **Live Kitchen Progress Tracker**: Real-time 5-stage visual progress pipeline (*Pending* ➔ *Acknowledged* ➔ *Preparing* ➔ *Ready to Serve* ➔ *Served/Paid*) powered by WebSockets.
- **Station-by-Station Visibility**: Diners see exactly which station is preparing their meal (*Grill*, *Starters*, *Dessert*, *Bar*).
- **Instant Digital Waiter Calling**: Dedicated button to request Water, Napkins, Cutlery, or a Server with live request confirmation.
- **Flexible Bill Splitting**: Split bills evenly across diners, calculate per-person shares, or view itemized breakdowns.
- **Payment Options**: Integrated Stripe Checkout Simulation (Cards, Apple Pay, Google Pay) and "Pay at Counter" options.
- **Digital Folding Ticket**: Origami-inspired animated digital receipt with downloadable order summaries.

### Staff & Kitchen Management Console
- **Real-Time Kanban Pipeline**: Orders dynamically arrive and progress across stages (*Pending*, *Preparing*, *Ready*, *Served*, *Paid*) with zero page refreshes.
- **Multi-Station Kitchen Routing**: Filter kitchen tickets by prep stations (*All*, *Grill Station*, *Starters & Salads*, *Dessert & Pastry*, *Bar & Cocktails*).
- **Table & Floor Management**: Visual floor grid tracking status for all tables (*Vacant*, *Occupied*, *Billing*, *Assistance Needed*).
- **Assistance Dispatch Queue**: Real-time notification badge alerting staff to pending guest requests with 1-click resolution.
- **Dynamic Menu Manager (CRUD)**: Create new dishes, update pricing, toggle 86'd / in-stock status, and reassign prep stations on the fly.
- **Live External API Seeding**: 1-click integration to fetch live dishes and craft cocktails from public culinary databases (*TheMealDB* & *TheCocktailDB*).
- **Sales & Operations Analytics**: Live operational metrics including revenue, average preparation time, station velocity, and top-selling items.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn** / **pnpm**

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/biteflow.git
cd biteflow
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Default configuration in `.env`:
```env
# Server Port (Defaults to 3000)
PORT=3000

```

### 3. Running in Development
Start the full-stack development server (Express + Vite Middleware with TypeScript execution via `tsx`):
```bash
npm run dev
```
Open your browser and visit: **`http://localhost:3000`**

To simulate a seated guest at a specific table, add the query parameter:
- **Table 1**: `http://localhost:3000/?table=1`
- **Table 3**: `http://localhost:3000/?table=3`

---

## WebSocket Event Protocol

BiteFlow communicates in real time over WebSockets on `ws://<host>:<port>`:

| Event Type | Direction | Payload Description |
|---|---|---|
| `register` | Client ➔ Server | Registers connection role (`{ role: 'staff' }` or `{ role: 'table', tableId: '3' }`) |
| `order:new` | Server ➔ Staff | Dispatched when a diner places a new order |
| `order:placed` | Server ➔ Table | Order confirmation sent to the specific table client |
| `order:update` | Server ➔ Both | Order status change (*pending*, *preparing*, *ready*, *served*, *paid*) |
| `assistance:update` | Server ➔ Staff | Updates active waiter assistance requests queue |
| `assistance:resolved`| Server ➔ Table | Notifies the table that their assistance request was handled |
| `menu:update` | Server ➔ Both | Real-time broadcast when menu items or stock levels change |
| `tables:update` | Server ➔ Staff | Real-time floor plan updates (*vacant*, *occupied*, *billing*) |

---

## Testing the Live Flow

1. Open two browser windows side-by-side (or one regular window and one incognito window).
2. **Window 1 (Customer)**: Visit `http://localhost:3000/?table=2`. Add items to your bag, add order notes, and click **Place Order**.
3. **Window 2 (Staff Console)**: Switch role to **Staff Console**. Observe the new ticket arrive instantaneously in the **Pending** column with station routing tags.
4. Advance the ticket to **Preparing** and **Ready**.
5. Watch **Window 1** instantly animate the progress meter to reflect the kitchen state in real time.
6. Click **Call Waiter** or **Request Water** in the customer window and observe the alert badge flash on the staff console.

---

## 📄 License

This project is licensed under the **MIT License** 

---
