import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { MENU_ITEMS } from './src/data';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Body parsing middleware
app.use(express.json());

// Dynamic Menu Items CRUD store
let currentMenuItems = [...MENU_ITEMS];

// Tables Registry (Phase 4)
let tables = [
  { id: '1', status: 'vacant' },
  { id: '2', status: 'occupied' },
  { id: '3', status: 'occupied' },
  { id: '4', status: 'vacant' },
  { id: '5', status: 'occupied' },
  { id: '6', status: 'vacant' },
  { id: '7', status: 'vacant' },
  { id: '8', status: 'vacant' }
];

interface AssistanceRequest {
  id: string;
  tableId: string;
  requestType: 'water' | 'napkins' | 'waiter' | 'general';
  createdAt: string;
  status: 'active' | 'resolved';
}

let assistanceRequests: AssistanceRequest[] = [];

// In-Memory Database Schema (Phases 1-4)
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  station: 'grill' | 'starters' | 'dessert' | 'bar';
}

interface BillRequest {
  requested: boolean;
  type?: 'single' | 'even' | 'itemized';
  numberOfPeople?: number;
  paidAmount?: number;
}

interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid';
  total: number;
  paymentMethod: 'stripe' | 'counter';
  paymentStatus: 'unpaid' | 'paid';
  createdAt: string;
  acknowledgedByStaff?: boolean;
  billRequest?: BillRequest;
}

// Prepopulate matching new schemas with prep stations
let orders: Order[] = [
  {
    id: 'ORD-8172',
    tableId: '3',
    items: [
      { id: 'main-1', name: 'Wagyu Beef Burger', price: 18.00, quantity: 2, station: 'grill' },
      { id: 'drink-1', name: 'Passionfruit Lemonade', price: 5.00, quantity: 2, station: 'bar' }
    ],
    notes: 'Burger medium rare, no pickles please.',
    status: 'preparing',
    total: 46.00,
    paymentMethod: 'stripe',
    paymentStatus: 'paid',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    acknowledgedByStaff: true,
    billRequest: { requested: false }
  },
  {
    id: 'ORD-2910',
    tableId: '5',
    items: [
      { id: 'starter-1', name: 'Truffle Garlic Bread', price: 8.50, quantity: 1, station: 'starters' },
      { id: 'main-2', name: 'Wild Mushroom Truffle Risotto', price: 19.50, quantity: 1, station: 'grill' },
      { id: 'drink-3', name: 'Craft Cabernet Sauvignon', price: 10.00, quantity: 1, station: 'bar' }
    ],
    notes: 'Extra parmesan on the risotto.',
    status: 'pending',
    total: 38.00,
    paymentMethod: 'counter',
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    acknowledgedByStaff: false,
    billRequest: { requested: false }
  },
  {
    id: 'ORD-4491',
    tableId: '2',
    items: [
      { id: 'starter-2', name: 'Spicy Crispy Calamari', price: 12.00, quantity: 1, station: 'starters' },
      { id: 'drink-2', name: 'Iced Vanilla Latte', price: 4.50, quantity: 1, station: 'bar' }
    ],
    status: 'ready',
    total: 16.50,
    paymentMethod: 'stripe',
    paymentStatus: 'paid',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    acknowledgedByStaff: true,
    billRequest: { requested: false }
  }
];

// WebSocket Clients Registry
interface ClientMeta {
  ws: WebSocket;
  role: 'staff' | 'table';
  tableId?: string;
}

const connectedClients = new Set<ClientMeta>();

// Broadcast updates helper
const broadcastToStaff = (data: any) => {
  const payload = JSON.stringify(data);
  for (const client of connectedClients) {
    if (client.role === 'staff' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
};

const broadcastToTable = (tableId: string, data: any) => {
  const payload = JSON.stringify(data);
  for (const client of connectedClients) {
    if (client.role === 'table' && (client.tableId === tableId || tableId === 'all') && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
};

// API Endpoints

// 1. Health & Status
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Menu Item CRUD (Phase 4 Admin)
app.get('/api/menu', (req, res) => {
  res.json(currentMenuItems);
});

app.post('/api/menu', (req, res) => {
  const { name, description, price, category, image, tags, inStock, station } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required menu item fields' });
  }

  const newItem = {
    id: `menu-${Date.now()}`,
    name,
    description: description || '',
    price: Number(price),
    category,
    image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
    tags: tags || [],
    inStock: inStock !== undefined ? inStock : true,
    station: station || 'starters'
  };

  currentMenuItems.push(newItem);

  // Broadcast updates to all clients so they fetch the latest menu
  broadcastToStaff({ type: 'menu:update', menu: currentMenuItems });
  broadcastToTable('all', { type: 'menu:update', menu: currentMenuItems });

  res.status(201).json(newItem);
});

app.patch('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const idx = currentMenuItems.findIndex(item => item.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Menu item not found' });
  }

  currentMenuItems[idx] = {
    ...currentMenuItems[idx],
    ...req.body
  };

  broadcastToStaff({ type: 'menu:update', menu: currentMenuItems });
  broadcastToTable('all', { type: 'menu:update', menu: currentMenuItems });

  res.json(currentMenuItems[idx]);
});

app.delete('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  currentMenuItems = currentMenuItems.filter(item => item.id !== id);

  broadcastToStaff({ type: 'menu:update', menu: currentMenuItems });
  broadcastToTable('all', { type: 'menu:update', menu: currentMenuItems });

  res.json({ success: true, deletedId: id });
});


// 3. Tables Management (Phase 4)
app.get('/api/tables', (req, res) => {
  res.json(tables);
});

app.post('/api/tables', (req, res) => {
  const { id, status } = req.body;
  if (!id) return res.status(400).json({ error: 'Table ID is required' });

  if (tables.some(t => t.id === id)) {
    return res.status(400).json({ error: 'Table already exists' });
  }

  const newTable = { id, status: status || 'vacant' };
  tables.push(newTable);

  broadcastToStaff({ type: 'tables:update', tables });
  res.status(201).json(newTable);
});

app.patch('/api/tables/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const idx = tables.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found' });

  tables[idx].status = status;
  broadcastToStaff({ type: 'tables:update', tables });
  res.json(tables[idx]);
});


// 4. Orders Core Ordering Loop (Phase 1)
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.get('/api/orders/table/:tableId', (req, res) => {
  const { tableId } = req.params;
  const tableOrders = orders.filter(o => o.tableId === tableId);
  res.json(tableOrders);
});

app.post('/api/orders', (req, res) => {
  const { tableId, items, notes, paymentMethod, paymentStatus } = req.body;

  if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order payload' });
  }

  const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  // Map elements with correct station
  const processedItems = items.map((item: any) => {
    const menuItem = currentMenuItems.find(m => m.id === item.id);
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      station: menuItem ? menuItem.station : 'starters'
    };
  });

  const newOrder: Order = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    tableId,
    items: processedItems,
    notes,
    status: 'pending',
    total,
    paymentMethod: paymentMethod || 'counter',
    paymentStatus: paymentStatus || 'unpaid',
    createdAt: new Date().toISOString(),
    acknowledgedByStaff: false,
    billRequest: { requested: false }
  };

  orders.unshift(newOrder);

  // Set table status to occupied
  const tableIndex = tables.findIndex(t => t.id === tableId);
  if (tableIndex !== -1) {
    tables[tableIndex].status = 'occupied';
  }

  // Broadcast to staff and table
  broadcastToStaff({ type: 'order:new', order: newOrder });
  broadcastToStaff({ type: 'tables:update', tables });
  broadcastToTable(tableId, { type: 'order:placed', order: newOrder });

  res.status(201).json(newOrder);
});


// 5. Order Management: Status/Acknowledgement/Bill (Phases 1, 2, 3)
app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, acknowledgedByStaff } = req.body;

  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[idx];

  if (status !== undefined) order.status = status;
  if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
  if (acknowledgedByStaff !== undefined) order.acknowledgedByStaff = acknowledgedByStaff;

  // Sync table status if order goes to paid
  if (order.status === 'paid' || order.paymentStatus === 'paid') {
    const activeTableOrders = orders.filter(o => o.tableId === order.tableId && o.status !== 'paid');
    if (activeTableOrders.length === 0) {
      const tIdx = tables.findIndex(t => t.id === order.tableId);
      if (tIdx !== -1) {
        tables[tIdx].status = 'vacant';
      }
    }
  }

  broadcastToStaff({ type: 'order:update', order });
  broadcastToStaff({ type: 'tables:update', tables });
  broadcastToTable(order.tableId, { type: 'order:update', order });

  res.json(order);
});

// Acknowledge order (Phase 2 Staff Acknowledgment)
app.patch('/api/orders/:id/acknowledge', (req, res) => {
  const { id } = req.params;
  const idx = orders.findIndex(o => o.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].acknowledgedByStaff = true;

  broadcastToStaff({ type: 'order:update', order: orders[idx] });
  res.json(orders[idx]);
});

// Bill splitting request endpoint (Phase 3)
app.post('/api/orders/:id/request-bill', (req, res) => {
  const { id } = req.params;
  const { type, numberOfPeople, paidAmount } = req.body;

  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].billRequest = {
    requested: true,
    type: type || 'single',
    numberOfPeople: numberOfPeople || 1,
    paidAmount: paidAmount || 0
  };

  // Change table state to billing
  const tIdx = tables.findIndex(t => t.id === orders[idx].tableId);
  if (tIdx !== -1) {
    tables[tIdx].status = 'billing';
  }

  broadcastToStaff({ type: 'order:update', order: orders[idx] });
  broadcastToStaff({ type: 'tables:update', tables });
  broadcastToTable(orders[idx].tableId, { type: 'order:update', order: orders[idx] });

  res.json(orders[idx]);
});

// Settle bill from waiter/admin desk (Phase 3)
app.post('/api/orders/:id/pay-bill', (req, res) => {
  const { id } = req.params;
  const idx = orders.findIndex(o => o.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].status = 'paid';
  orders[idx].paymentStatus = 'paid';
  if (orders[idx].billRequest) {
    orders[idx].billRequest.requested = false;
  }

  // Set table status back to vacant
  const tIdx = tables.findIndex(t => t.id === orders[idx].tableId);
  if (tIdx !== -1) {
    tables[tIdx].status = 'vacant';
  }

  broadcastToStaff({ type: 'order:update', order: orders[idx] });
  broadcastToStaff({ type: 'tables:update', tables });
  broadcastToTable(orders[idx].tableId, { type: 'order:update', order: orders[idx] });

  res.json(orders[idx]);
});

// Reset state
app.post('/api/orders/reset', (req, res) => {
  orders = orders.filter(o => o.status !== 'paid' && o.status !== 'served');
  tables = tables.map(t => {
    const hasActive = orders.some(o => o.tableId === t.id);
    return { ...t, status: hasActive ? 'occupied' : 'vacant' };
  });
  broadcastToStaff({ type: 'orders:reset', orders });
  broadcastToStaff({ type: 'tables:update', tables });
  res.json({ status: 'ok', activeOrdersCount: orders.length });
});

// Seed/Reset all demo simulation data
app.post('/api/seed', (req, res) => {
  // Reset menu back to initial setup
  currentMenuItems = [...MENU_ITEMS];

  // Seed standard rich orders at different stages of the kitchen prep pipeline
  orders = [
    {
      id: 'ORD-8172',
      tableId: '3',
      items: [
        { id: 'main-1', name: 'Wagyu Beef Burger', price: 18.00, quantity: 2, station: 'grill' },
        { id: 'drink-1', name: 'Passionfruit Lemonade', price: 5.00, quantity: 2, station: 'bar' }
      ],
      notes: 'Burger medium rare, no pickles please.',
      status: 'preparing',
      total: 46.00,
      paymentMethod: 'stripe',
      paymentStatus: 'paid',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      acknowledgedByStaff: true,
      billRequest: { requested: false }
    },
    {
      id: 'ORD-2910',
      tableId: '5',
      items: [
        { id: 'starter-1', name: 'Truffle Garlic Bread', price: 8.50, quantity: 1, station: 'starters' },
        { id: 'main-2', name: 'Wild Mushroom Truffle Risotto', price: 19.50, quantity: 1, station: 'grill' },
        { id: 'drink-3', name: 'Craft Cabernet Sauvignon', price: 10.00, quantity: 1, station: 'bar' }
      ],
      notes: 'Extra parmesan on the risotto.',
      status: 'pending',
      total: 38.00,
      paymentMethod: 'counter',
      paymentStatus: 'unpaid',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      acknowledgedByStaff: false,
      billRequest: { requested: false }
    },
    {
      id: 'ORD-4491',
      tableId: '2',
      items: [
        { id: 'starter-2', name: 'Spicy Crispy Calamari', price: 12.00, quantity: 1, station: 'starters' },
        { id: 'drink-2', name: 'Iced Vanilla Latte', price: 4.50, quantity: 1, station: 'bar' }
      ],
      status: 'ready',
      total: 16.50,
      paymentMethod: 'stripe',
      paymentStatus: 'paid',
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      acknowledgedByStaff: true,
      billRequest: { requested: false }
    },
    {
      id: 'ORD-1234',
      tableId: '1',
      items: [
        { id: 'starter-1', name: 'Truffle Garlic Bread', price: 8.50, quantity: 1, station: 'starters' },
        { id: 'main-1', name: 'Wagyu Beef Burger', price: 18.00, quantity: 1, station: 'grill' },
        { id: 'drink-3', name: 'Craft Cabernet Sauvignon', price: 10.00, quantity: 1, station: 'bar' }
      ],
      notes: 'Please bring sourdough bread first.',
      status: 'pending',
      total: 36.50,
      paymentMethod: 'counter',
      paymentStatus: 'unpaid',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      acknowledgedByStaff: false,
      billRequest: { requested: false }
    },
    {
      id: 'ORD-5678',
      tableId: '4',
      items: [
        { id: 'main-2', name: 'Wild Mushroom Truffle Risotto', price: 19.50, quantity: 2, station: 'grill' }
      ],
      status: 'served',
      total: 39.00,
      paymentMethod: 'counter',
      paymentStatus: 'unpaid',
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      acknowledgedByStaff: true,
      billRequest: { requested: true, type: 'even', numberOfPeople: 2, paidAmount: 0 }
    }
  ];

  // Set initial table statuses matching the seeded active orders
  tables = [
    { id: '1', status: 'occupied' },
    { id: '2', status: 'occupied' },
    { id: '3', status: 'occupied' },
    { id: '4', status: 'billing' },
    { id: '5', status: 'occupied' },
    { id: '6', status: 'vacant' },
    { id: '7', status: 'vacant' },
    { id: '8', status: 'vacant' }
  ];

  // Seed some active assistance calls
  assistanceRequests = [
    {
      id: 'ast-101',
      tableId: '3',
      requestType: 'water',
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      status: 'active'
    },
    {
      id: 'ast-102',
      tableId: '5',
      requestType: 'waiter',
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      status: 'active'
    }
  ];

  // Broadcast updates to all staff and active tables so interfaces dynamically sync
  broadcastToStaff({ type: 'orders:reset', orders });
  broadcastToStaff({ type: 'tables:update', tables });
  broadcastToStaff({ type: 'menu:update', menu: currentMenuItems });
  broadcastToStaff({ type: 'assistance:update', requests: assistanceRequests.filter(r => r.status === 'active') });
  broadcastToTable('all', { type: 'menu:update', menu: currentMenuItems });
  
  // Update connected table screen trackings
  orders.forEach(o => {
    broadcastToTable(o.tableId, { type: 'order:update', order: o });
  });

  res.json({ success: true, orders, tables, menu: currentMenuItems });
});

// Fetch and Seed Real Live Menu from Public Food & Drinks APIs (TheMealDB & TheCocktailDB)
app.post('/api/seed/external-api', async (req, res) => {
  try {
    const fetchedItems: any[] = [];

    const fetchJson = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    };

    // 1. Fetch real dishes from TheMealDB (pasta, burger, salad, cake)
    const searchTerms = ['burger', 'pasta', 'salad', 'cake'];
    for (const term of searchTerms) {
      try {
        const data = await fetchJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${term}`);
        if (data && data.meals) {
          // Slice top 3 meals to avoid cluttering but provide a diverse list
          const meals = data.meals.slice(0, 3);
          meals.forEach((meal: any) => {
            let category: 'starters' | 'mains' | 'dessert' | 'drinks' = 'mains';
            let station: 'grill' | 'starters' | 'dessert' | 'bar' = 'grill';
            
            const strCategory = (meal.strCategory || '').toLowerCase();
            if (strCategory.includes('starter') || term === 'salad') {
              category = 'starters';
              station = 'starters';
            } else if (strCategory.includes('dessert') || term === 'cake') {
              category = 'dessert';
              station = 'dessert';
            } else {
              category = 'mains';
              station = term === 'burger' ? 'grill' : 'starters';
            }

            // Create a realistic, consistent price from 1-indexed hash values of meal IDs
            const idNum = parseInt(meal.idMeal) || 50000;
            const price = 8.50 + (idNum % 17) + 0.50; // $9.00 to $25.50

            // Clean single-sentence description
            const description = meal.strInstructions 
              ? meal.strInstructions.replace(/\r?\n|\r/g, ' ').split('.')[0] + '.'
              : `${meal.strMeal} freshly prepared by our chefs.`;

            fetchedItems.push({
              id: `ext-meal-${meal.idMeal}`,
              name: meal.strMeal,
              description,
              price: Number(price.toFixed(2)),
              category,
              image: meal.strMealThumb,
              tags: ['Real Dish', meal.strArea || 'Specialty'].filter(Boolean),
              inStock: true,
              station
            });
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch meal term from TheMealDB: ${term}`, e);
      }
    }

    // 2. Fetch real craft beverages from TheCocktailDB (mojito, margarita, martini)
    const drinkTerms = ['mojito', 'margarita', 'martini'];
    for (const term of drinkTerms) {
      try {
        const data = await fetchJson(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${term}`);
        if (data && data.drinks) {
          // Slice top 2 drinks to have a perfect balance of beverages
          const drinks = data.drinks.slice(0, 2);
          drinks.forEach((drink: any) => {
            const idNum = parseInt(drink.idDrink) || 10000;
            const price = 6.00 + (idNum % 7) + 0.50; // $6.50 to $13.50

            const description = drink.strInstructions
              ? drink.strInstructions.replace(/\r?\n|\r/g, ' ').split('.')[0] + '.'
              : `Hand-crafted cocktail with fine spirits and garnishes.`;

            fetchedItems.push({
              id: `ext-drink-${drink.idDrink}`,
              name: drink.strDrink,
              description,
              price: Number(price.toFixed(2)),
              category: 'drinks',
              image: drink.strDrinkThumb,
              tags: ['Craft Drink', drink.strAlcoholic || 'Cocktail'].filter(Boolean),
              inStock: true,
              station: 'bar'
            });
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch drink term from TheCocktailDB: ${term}`, e);
      }
    }

    if (fetchedItems.length > 0) {
      currentMenuItems = fetchedItems;
      
      // Broadcast live menu updates to staff dashboard and client tables over WebSockets
      broadcastToStaff({ type: 'menu:update', menu: currentMenuItems });
      broadcastToTable('all', { type: 'menu:update', menu: currentMenuItems });
      
      res.json({ success: true, count: currentMenuItems.length, menu: currentMenuItems });
    } else {
      res.status(500).json({ error: 'Failed to fetch external menu items from APIs.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Fetch active assistance requests
app.get('/api/assistance', (req, res) => {
  res.json(assistanceRequests.filter(r => r.status === 'active'));
});

// Request assistance from a table
app.post('/api/assistance/request', (req, res) => {
  const { tableId, requestType } = req.body;
  if (!tableId || !requestType) {
    return res.status(400).json({ error: 'tableId and requestType are required' });
  }

  const newRequest: AssistanceRequest = {
    id: `ast-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tableId,
    requestType,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  assistanceRequests.push(newRequest);

  // Broadcast to all staff dashboards
  const active = assistanceRequests.filter(r => r.status === 'active');
  broadcastToStaff({ type: 'assistance:update', requests: active });
  
  // Broadcast acknowledgement back to the table
  broadcastToTable(tableId, { type: 'assistance:acknowledged', request: newRequest });

  res.status(201).json(newRequest);
});

// Resolve assistance request from staff console
app.post('/api/assistance/resolve', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  const idx = assistanceRequests.findIndex(r => r.id === id);
  if (idx !== -1) {
    assistanceRequests[idx].status = 'resolved';
    const reqObj = assistanceRequests[idx];
    
    // Broadcast updated active list to staff
    const active = assistanceRequests.filter(r => r.status === 'active');
    broadcastToStaff({ type: 'assistance:update', requests: active });
    
    // Notify the specific table that help is completed/resolved
    broadcastToTable(reqObj.tableId, { type: 'assistance:resolved', id });
    
    return res.json({ success: true, requests: active });
  }

  res.status(404).json({ error: 'Assistance request not found' });
});


// WebSocket Server Setup attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  let clientMeta: ClientMeta = { ws, role: 'staff' };

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      if (data.type === 'register') {
        clientMeta.role = data.role;
        if (data.role === 'table') {
          clientMeta.tableId = data.tableId;
        }
        connectedClients.add(clientMeta);
        
        ws.send(JSON.stringify({ 
          type: 'registered', 
          role: clientMeta.role, 
          tableId: clientMeta.tableId 
        }));

        // Send active assistance requests if staff registered
        if (data.role === 'staff') {
          ws.send(JSON.stringify({
            type: 'assistance:update',
            requests: assistanceRequests.filter(r => r.status === 'active')
          }));
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(clientMeta);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    connectedClients.delete(clientMeta);
  });
});


// Serve static frontend assets
const distPath = path.join(process.cwd(), 'dist');

const setupDevelopment = async () => {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
};

const startApp = async () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting server in DEVELOPMENT mode with Vite Middleware...');
    await setupDevelopment();
  } else {
    console.log('Starting server in PRODUCTION mode serving static dist files...');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BiteFlow server running on http://0.0.0.0:${PORT}`);
  });
};

startApp().catch((err) => {
  console.error('Failed to start Vite / Express server:', err);
});
