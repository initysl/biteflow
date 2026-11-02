import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { MenuItemInput } from '../../shared/validation';
import type { DB } from './client';
import {
  assistanceRequests,
  billRequests,
  menuItems,
  orderItems,
  orders,
  promoCodes,
  restaurantTables,
  staffUsers,
} from './schema';
import { listMenu, replaceMenu } from '../services/menu';
import { getTable, newTableToken } from '../services/tables';
import { markOrderPaid, placeOrder, requestBill, transitionOrder } from '../services/orders';
import { requestAssistance } from '../services/assistance';

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=800`;

/**
 * Sample menu. Allergen data here is illustrative — a real restaurant must
 * enter and verify its own allergen information.
 */
export const SAMPLE_MENU: MenuItemInput[] = [
  {
    name: 'Truffle Garlic Bread',
    description: 'Sourdough baguette toasted with truffle-garlic butter, rosemary and aged parmesan.',
    priceCents: 850,
    category: 'starters',
    station: 'pantry',
    imageUrl: img('1619535860434-ba1d8fa12536'),
    dietary: ['vegetarian'],
    allergens: ['gluten', 'milk'],
    featured: true,
  },
  {
    name: 'Chargrilled Chicken Skewers',
    description: 'Harissa-yoghurt marinated thigh, blistered over coals, with lime and chilli salt.',
    priceCents: 1200,
    category: 'starters',
    station: 'grill',
    imageUrl: img('1555939594-58d7cb561ad1'),
    dietary: ['spicy', 'gluten-free'],
    allergens: ['milk'],
  },
  {
    name: 'Little Gem Caesar',
    description: 'Crisp gem lettuce, anchovy dressing, sourdough croutons and shaved parmesan.',
    priceCents: 1100,
    category: 'starters',
    station: 'pantry',
    imageUrl: img('1550304943-4f24f54ddde9'),
    dietary: [],
    allergens: ['gluten', 'eggs', 'fish', 'milk', 'mustard'],
  },
  {
    name: 'Harvest Garden Bowl',
    description: 'Roasted squash, chickpeas, avocado, pickled red cabbage and seeds with a mustard vinaigrette.',
    priceCents: 1050,
    category: 'starters',
    station: 'pantry',
    imageUrl: img('1540189549336-e6e99c3679fe'),
    dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    allergens: ['mustard', 'sesame'],
  },
  {
    name: 'Wagyu Beef Burger',
    description:
      '6oz wagyu patty, aged cheddar, caramelised onion, butter lettuce and truffle mayo on brioche. Served with hand-cut fries.',
    priceCents: 1800,
    category: 'mains',
    station: 'grill',
    imageUrl: img('1568901346375-23c9450c58cd'),
    dietary: [],
    allergens: ['gluten', 'milk', 'eggs', 'mustard', 'sesame'],
    featured: true,
  },
  {
    name: 'Wild Mushroom Risotto',
    description: 'Carnaroli rice slow-cooked with chanterelle and cremini mushrooms, finished with black truffle and parmesan.',
    priceCents: 1950,
    category: 'mains',
    station: 'grill',
    imageUrl: img('1476124369491-e7addf5db371'),
    dietary: ['vegetarian', 'gluten-free'],
    allergens: ['milk', 'celery', 'sulphites'],
  },
  {
    name: 'Pan-Seared Salmon',
    description: 'Crisp-skinned salmon on parsnip purée with buttered greens and a dill beurre blanc.',
    priceCents: 2200,
    category: 'mains',
    station: 'grill',
    imageUrl: img('1467003909585-2f8a72700288'),
    dietary: ['gluten-free'],
    allergens: ['fish', 'milk'],
    featured: true,
  },
  {
    name: 'Wood-Fired Pizza Bianca',
    description: 'Neapolitan base, fior di latte, roasted garlic, rosemary and extra virgin olive oil.',
    priceCents: 1400,
    category: 'mains',
    station: 'grill',
    imageUrl: img('1513104890138-7c749659a591'),
    dietary: ['vegetarian'],
    allergens: ['gluten', 'milk'],
  },
  {
    name: 'Dark Chocolate Fudge Cake',
    description: 'Dense, warm chocolate cake with a glossy ganache. Best with a coffee.',
    priceCents: 950,
    category: 'desserts',
    station: 'pastry',
    imageUrl: img('1606313564200-e75d5e30476c'),
    dietary: ['vegetarian'],
    allergens: ['gluten', 'eggs', 'milk', 'soy'],
  },
  {
    name: 'Classic Tiramisu',
    description: 'Espresso-soaked savoiardi, mascarpone cream and a heavy dusting of cocoa.',
    priceCents: 800,
    category: 'desserts',
    station: 'pastry',
    imageUrl: img('1571877227200-a0d98ea607e9'),
    dietary: ['vegetarian'],
    allergens: ['gluten', 'eggs', 'milk'],
    featured: true,
  },
  {
    name: 'Cookies & Cream Sundae',
    description: 'Vanilla gelato, chocolate sauce, crushed cookies and whipped cream.',
    priceCents: 750,
    category: 'desserts',
    station: 'pastry',
    imageUrl: img('1563805042-7684c019e1cb'),
    dietary: ['vegetarian'],
    allergens: ['gluten', 'milk', 'eggs', 'soy'],
  },
  {
    name: 'House Mint Lemonade',
    description: 'Fresh-squeezed lemons, muddled mint and cane sugar over crushed ice.',
    priceCents: 500,
    category: 'drinks',
    station: 'bar',
    imageUrl: img('1621263764928-df1444c5e859'),
    dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    allergens: [],
  },
  {
    name: 'Fresh Orange Juice',
    description: 'Pressed to order from Valencia oranges.',
    priceCents: 450,
    category: 'drinks',
    station: 'bar',
    imageUrl: img('1600271886742-f049cd451bba'),
    dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    allergens: [],
  },
  {
    name: 'Iced Vanilla Latte',
    description: 'Double espresso, cold whole milk and house vanilla syrup over ice.',
    priceCents: 450,
    category: 'drinks',
    station: 'bar',
    imageUrl: img('1517701604599-bb29b565090c'),
    dietary: ['vegetarian', 'gluten-free'],
    allergens: ['milk'],
  },
  {
    name: 'Blackberry Bramble',
    description: 'Gin, lemon, sugar and crème de mûre over crushed ice with fresh blackberries.',
    priceCents: 1100,
    category: 'drinks',
    station: 'bar',
    imageUrl: img('1536935338788-846bb9981813'),
    dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    allergens: [],
  },
  {
    name: 'Cabernet Sauvignon',
    description: '175ml glass. Full-bodied with blackberry, cherry and a hint of vanilla.',
    priceCents: 1000,
    category: 'drinks',
    station: 'bar',
    imageUrl: img('1510812431401-41d2bd2722f3'),
    dietary: ['gluten-free', 'dairy-free'],
    allergens: ['sulphites'],
  },
];

const SAMPLE_TABLES = [
  { id: '1', seats: 2 },
  { id: '2', seats: 2 },
  { id: '3', seats: 4 },
  { id: '4', seats: 4 },
  { id: '5', seats: 4 },
  { id: '6', seats: 6 },
  { id: '7', seats: 6 },
  { id: '8', seats: 8 },
];

export function seedEssentials(db: DB, opts: { staffPin: string }) {
  const hasMenu =
    db
      .select({ n: sql<number>`count(*)` })
      .from(menuItems)
      .get()!.n > 0;
  if (!hasMenu) replaceMenu(db, SAMPLE_MENU);

  const hasTables =
    db
      .select({ n: sql<number>`count(*)` })
      .from(restaurantTables)
      .get()!.n > 0;
  if (!hasTables) {
    SAMPLE_TABLES.forEach((t, i) =>
      db
        .insert(restaurantTables)
        .values({ id: t.id, label: `Table ${t.id}`, seats: t.seats, token: newTableToken(), sortOrder: i })
        .run(),
    );
  }

  db.insert(promoCodes)
    .values([
      { code: 'WELCOME10', label: '10% off your order', kind: 'percent', value: 10 },
      { code: 'BISTRO5', label: '$5 off orders over $30', kind: 'flat', value: 500, minSubtotalCents: 3000 },
    ])
    .onConflictDoNothing()
    .run();

  const hasStaff =
    db
      .select({ n: sql<number>`count(*)` })
      .from(staffUsers)
      .get()!.n > 0;
  if (!hasStaff) {
    db.insert(staffUsers)
      .values({ id: ulid(), name: 'Manager', pinHash: bcrypt.hashSync(opts.staffPin, 10) })
      .run();
  }
}

/** Puts a handful of orders across the pipeline so the staff console looks alive. */
export function seedDemoActivity(db: DB) {
  const menu = listMenu(db);
  const pick = (name: string) => menu.find((m) => m.name === name)?.id;
  const order = (tableId: string, items: [string, number][], notes?: string) => {
    const lines = items.map(([name, quantity]) => ({ menuItemId: pick(name)!, quantity })).filter((l) => l.menuItemId);
    if (!lines.length) return null;
    return placeOrder(db, {
      tableId,
      token: getTable(db, tableId).token,
      items: lines,
      notes,
      paymentMethod: 'counter',
    });
  };
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  /** Rewrites an order's timeline (minutes ago) so reports and timers look like a real service. */
  const backdate = (id: string, t: { created: number; preparing?: number; ready?: number; served?: number; paid?: number }) =>
    db
      .update(orders)
      .set({
        createdAt: ago(t.created),
        ...(t.preparing !== undefined && { preparingAt: ago(t.preparing) }),
        ...(t.ready !== undefined && { readyAt: ago(t.ready) }),
        ...(t.served !== undefined && { servedAt: ago(t.served) }),
        ...(t.paid !== undefined && { paidAt: ago(t.paid) }),
      })
      .where(sql`${orders.id} = ${id}`)
      .run();

  const a = order(
    '3',
    [
      ['Wagyu Beef Burger', 2],
      ['House Mint Lemonade', 2],
    ],
    'One burger medium-rare, no pickles.',
  );
  if (a) {
    transitionOrder(db, a.id, 'preparing');
    backdate(a.id, { created: 14, preparing: 11 });
  }
  const b = order(
    '5',
    [
      ['Truffle Garlic Bread', 1],
      ['Wild Mushroom Risotto', 1],
      ['Cabernet Sauvignon', 1],
    ],
    'Extra parmesan on the risotto.',
  );
  if (b) backdate(b.id, { created: 4 });
  const c = order('2', [
    ['Chargrilled Chicken Skewers', 1],
    ['Iced Vanilla Latte', 1],
  ]);
  if (c) {
    transitionOrder(db, c.id, 'preparing');
    transitionOrder(db, c.id, 'ready');
    backdate(c.id, { created: 16, preparing: 14, ready: 2 });
  }
  const d = order('4', [
    ['Pan-Seared Salmon', 2],
    ['Classic Tiramisu', 2],
  ]);
  if (d) {
    transitionOrder(db, d.id, 'preparing');
    transitionOrder(db, d.id, 'ready');
    transitionOrder(db, d.id, 'served');
    backdate(d.id, { created: 52, preparing: 49, ready: 33, served: 31 });
    requestBill(db, '4', 'even', 2);
  }
  const e = order('6', [
    ['Wood-Fired Pizza Bianca', 2],
    ['Harvest Garden Bowl', 1],
    ['Fresh Orange Juice', 3],
  ]);
  if (e) {
    transitionOrder(db, e.id, 'preparing');
    transitionOrder(db, e.id, 'ready');
    markOrderPaid(db, e.id, 'counter');
    transitionOrder(db, e.id, 'served');
    backdate(e.id, { created: 95, preparing: 92, ready: 78, served: 76, paid: 40 });
  }
  requestAssistance(db, '3', 'water');
}

/** Wipes orders and requests (tables, staff and sessions stay) and restores the sample menu. */
export function resetDemo(db: DB) {
  db.transaction((tx) => {
    tx.delete(orderItems).run();
    tx.delete(orders).run();
    tx.delete(billRequests).run();
    tx.delete(assistanceRequests).run();
  });
  replaceMenu(db, SAMPLE_MENU);
  seedDemoActivity(db);
}

export function isEmptyOfOrders(db: DB) {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(orders)
      .get()!.n === 0
  );
}
