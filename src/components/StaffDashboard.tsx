import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  CookingPot,
  BellRing,
  HandHelping,
  CreditCard,
  Play,
  Check,
  CheckCircle2,
  QrCode,
  Trash2,
  Wifi,
  WifiOff,
  Users,
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  Plus,
  Edit,
  Trash,
  Eye,
  EyeOff,
  LayoutGrid,
  ClipboardList,
  BookOpen,
  BarChart3,
  TableProperties,
  AlertTriangle,
} from 'lucide-react';
import { Order, OrderStatus, MenuItem } from '../types';

const PIPELINE_COLUMNS: {
  status: OrderStatus;
  label: string;
  icon: any;
  color: string;
  btnLabel: string;
  btnIcon: any;
}[] = [
  {
    status: 'pending',
    label: 'Pending',
    icon: Clock,
    color: 'bg-amber-500',
    btnLabel: 'Prepare',
    btnIcon: CookingPot,
  },
  {
    status: 'preparing',
    label: 'Preparing',
    icon: CookingPot,
    color: 'bg-orange-500',
    btnLabel: 'Ready',
    btnIcon: BellRing,
  },
  {
    status: 'ready',
    label: 'Ready',
    icon: BellRing,
    color: 'bg-green-500',
    btnLabel: 'Serve',
    btnIcon: HandHelping,
  },
  {
    status: 'served',
    label: 'Served',
    icon: HandHelping,
    color: 'bg-blue-500',
    btnLabel: 'Settle',
    btnIcon: CreditCard,
  },
  {
    status: 'paid',
    label: 'Paid & Closed',
    icon: CheckCircle2,
    color: 'bg-purple-500',
    btnLabel: 'Archive',
    btnIcon: Check,
  },
];

export default function StaffDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tablesList, setTablesList] = useState<
    { id: string; status: string }[]
  >([]);

  // Option 4: Table assistance requests state
  const [assistanceRequests, setAssistanceRequests] = useState<any[]>([]);

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isImportingAPI, setIsImportingAPI] = useState(false);

  // Sound effects toggle
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Active Sub-Tab: 'operations' | 'menu_crud' | 'tables' | 'analytics'
  const [activeTab, setActiveTab] = useState<
    'operations' | 'menu_crud' | 'tables' | 'analytics'
  >('operations');

  // Kitchen Prep Station Filter (Phase 2)
  const [activeStation, setActiveStation] = useState<
    'all' | 'grill' | 'starters' | 'dessert' | 'bar'
  >('all');

  // Track the active Kanban column displayed on mobile screens
  const [mobileActiveColumn, setMobileActiveColumn] =
    useState<OrderStatus>('pending');

  // Selected Table for QR Code Utility
  const [selectedTable, setSelectedTable] = useState<string>('1');

  // Menu Builder form states (Phase 4 CRUD)
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [editMenuItemId, setEditMenuItemId] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    category: 'mains',
    station: 'grill',
    image: '',
    tags: [],
    inStock: true,
  });

  // Table creator state (Phase 4)
  const [newTableId, setNewTableId] = useState('');

  // Initialize Sound Notification
  useEffect(() => {
    audioRef.current = new Audio(
      'https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav',
    );
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationChime = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current
        .play()
        .catch((e) => console.log('Audio playback blocked:', e));
    }
  };

  // Fetch orders, menu, and tables
  const fetchAllData = async () => {
    try {
      // 1. Fetch Orders
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) setOrders(await ordersRes.json());

      // 2. Fetch Menu CRUD items
      const menuRes = await fetch('/api/menu');
      if (menuRes.ok) setMenuItems(await menuRes.json());

      // 3. Fetch Tables status
      const tablesRes = await fetch('/api/tables');
      if (tablesRes.ok) setTablesList(await tablesRes.json());

      // 4. Fetch Table Assistance active requests
      const assistanceRes = await fetch('/api/assistance');
      if (assistanceRes.ok) setAssistanceRequests(await assistanceRes.json());
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Option 4: Staff Assistance Request resolver
  const handleResolveAssistance = async (id: string) => {
    try {
      const res = await fetch('/api/assistance/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAssistanceRequests(updated);
      }
    } catch (e) {
      console.error('Resolve assistance failed:', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // WebSocket Stream Real-time Integrations (Phase 2)
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let heartbeatInterval: any = null;

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        setError(null);
        socket?.send(JSON.stringify({ type: 'register', role: 'staff' }));

        // Send a ping every 20 seconds to keep connection alive on cloud routing
        heartbeatInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ping' || msg.type === 'pong') {
            return;
          }

          if (msg.type === 'order:new' && msg.order) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === msg.order.id)) return prev;
              playNotificationChime();
              return [msg.order, ...prev];
            });
            // Auto update tables when an order comes
            fetchTablesOnly();
          } else if (msg.type === 'order:update' && msg.order) {
            setOrders((prev) =>
              prev.map((o) => (o.id === msg.order.id ? msg.order : o)),
            );
            fetchTablesOnly();
          } else if (msg.type === 'orders:reset') {
            setOrders(msg.orders);
            fetchTablesOnly();
          } else if (msg.type === 'menu:update' && msg.menu) {
            setMenuItems(msg.menu);
          } else if (msg.type === 'tables:update' && msg.tables) {
            setTablesList(msg.tables);
          } else if (msg.type === 'assistance:update' && msg.requests) {
            setAssistanceRequests(msg.requests);
            // Play sound chime if there are any active requests
            if (msg.requests.some((r: any) => r.status === 'active')) {
              playNotificationChime();
            }
          }
        } catch (err) {
          console.warn('Error parsing operational WS message:', err);
        }
      };

      socket.onclose = () => {
        setConnected(false);
        setReconnecting(true);
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        reconnectTimeout = setTimeout(() => connectWS(), 3000);
      };

      socket.onerror = (err) => {
        console.warn(
          'Operational Dashboard WS notice (auto-reconnecting):',
          err,
        );
      };
    };

    connectWS();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [soundEnabled]);

  const fetchTablesOnly = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) setTablesList(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Transition Order status pipeline (Phase 1/2)
  const handleTransitionOrder = async (
    orderId: string,
    currentStatus: OrderStatus,
  ) => {
    let nextStatus: OrderStatus | 'archived' = 'pending';

    if (currentStatus === 'pending') nextStatus = 'preparing';
    else if (currentStatus === 'preparing') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'served';
    else if (currentStatus === 'served') nextStatus = 'paid';
    else if (currentStatus === 'paid') nextStatus = 'archived';

    if (nextStatus === 'archived') {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      return;
    }

    try {
      const payload: any = { status: nextStatus };
      if (nextStatus === 'paid') payload.paymentStatus = 'paid';

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch (err) {
      alert('Operational error shifting pipeline state');
    }
  };

  // Acknowledge new order (Phase 2 Waiter Acknowledge)
  const handleAcknowledgeOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/acknowledge`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch (err) {
      console.error('Failed to acknowledge order:', err);
    }
  };

  // Settle bill from operations panel (Phase 3)
  const handleSettleOrderBill = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/pay-bill`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        fetchTablesOnly();
      }
    } catch (err) {
      console.error('Failed to settle bill:', err);
    }
  };

  // Clean Served/Paid orders
  const handleResetOrders = async () => {
    if (!window.confirm('Archive all settled table orders to clean the board?'))
      return;
    try {
      const res = await fetch('/api/orders/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOrders(orders.filter((o) => o.status !== 'paid'));
        fetchTablesOnly();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Seed / Reset all demo simulation data
  const handleSeedDemoData = async () => {
    if (
      !window.confirm(
        'This will seed the database with active dummy orders, reset table statuses, and restore default menu items. Continue?',
      )
    )
      return;
    setIsSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error('Failed to seed demo data:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Fetch / Seed real menu from Public MealDB / CocktailDB APIs
  const handleImportAPIMenu = async () => {
    if (
      !window.confirm(
        'This will fetch and import live dishes and drinks from public food (TheMealDB) & cocktail (TheCocktailDB) APIs. This will override existing menu items. Continue?',
      )
    )
      return;
    setIsImportingAPI(true);
    try {
      const res = await fetch('/api/seed/external-api', { method: 'POST' });
      if (res.ok) {
        await fetchAllData();
        alert('Successfully imported real culinary items from Public APIs!');
      } else {
        alert('Could not retrieve data from public APIs. Please try again.');
      }
    } catch (err) {
      console.error('Error importing public API items:', err);
    } finally {
      setIsImportingAPI(false);
    }
  };

  // CRUD Save Menu Item (Phase 4 Admin Menu Builder)
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editMenuItemId ? 'PATCH' : 'POST';
    const url = editMenuItemId ? `/api/menu/${editMenuItemId}` : '/api/menu';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...menuForm,
          price: Number(menuForm.price),
        }),
      });

      if (res.ok) {
        const savedItem = await res.json();
        if (editMenuItemId) {
          setMenuItems((prev) =>
            prev.map((item) => (item.id === editMenuItemId ? savedItem : item)),
          );
        } else {
          setMenuItems((prev) => [...prev, savedItem]);
        }
        setIsMenuFormOpen(false);
        setEditMenuItemId(null);
        setMenuForm({
          name: '',
          description: '',
          price: 0,
          category: 'mains',
          station: 'grill',
          image: '',
          tags: [],
          inStock: true,
        });
      }
    } catch (err) {
      alert('Error saving menu item to dynamic database');
    }
  };

  // Delete Menu Item (Phase 4 Admin Menu Builder)
  const handleDeleteMenuItem = async (id: string) => {
    if (!window.confirm('Delete this dish from the dynamic menu permanently?'))
      return;
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMenuItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Stock availability flag (Phase 4 Inventory)
  const handleToggleMenuItemStock = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: !item.inStock }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMenuItems((prev) =>
          prev.map((m) => (m.id === item.id ? updated : m)),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Table Management Add Table (Phase 4)
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableId.trim()) return;

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newTableId, status: 'vacant' }),
      });

      if (res.ok) {
        const added = await res.json();
        setTablesList((prev) => [...prev, added]);
        setNewTableId('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add table');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update table status manually (Phase 4)
  const handleUpdateTableStatus = async (tableId: string, status: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTablesList((prev) =>
          prev.map((t) => (t.id === tableId ? updated : t)),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Analytical Metrics Engine (Phase 4)
  const getAnalytics = () => {
    const paidOrders = orders.filter((o) => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const activeOrderCount = orders.filter((o) => o.status !== 'paid').length;

    // Occupancy Rate
    const totalTablesCount = tablesList.length || 8;
    const occupiedTablesCount = tablesList.filter(
      (t) => t.status === 'occupied' || t.status === 'billing',
    ).length;
    const occupancyPercent =
      totalTablesCount > 0 ? (occupiedTablesCount / totalTablesCount) * 100 : 0;

    // Outstanding bills
    const unpaidOrders = orders.filter(
      (o) => o.status !== 'paid' && o.paymentStatus !== 'paid',
    );
    const outstandingBillsValue = unpaidOrders.reduce(
      (sum, o) => sum + o.total,
      0,
    );

    // Most popular dishes mapper
    const dishCounts: Record<
      string,
      { name: string; count: number; revenue: number }
    > = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!dishCounts[item.id]) {
          dishCounts[item.id] = { name: item.name, count: 0, revenue: 0 };
        }
        dishCounts[item.id].count += item.quantity;
        dishCounts[item.id].revenue += item.price * item.quantity;
      });
    });

    const sortedPopularDishes = Object.values(dishCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRevenue,
      activeOrderCount,
      occupancyPercent,
      occupiedTablesCount,
      totalTablesCount,
      outstandingBillsValue,
      popularDishes: sortedPopularDishes,
    };
  };

  const analytics = getAnalytics();

  // QR Code generator URL
  const selectedTableUrl = `${window.location.origin}?table=${selectedTable}`;
  const qrCodeImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(selectedTableUrl)}&color=d97706&bgcolor=ffffff`;

  // Filter orders by chosen kitchen station (Phase 2 station display)
  const getFilteredOrdersByStation = () => {
    return orders.filter((order) => {
      if (activeStation === 'all') return true;
      // Keep order if at least one item belongs to selected station
      return order.items.some((item) => item.station === activeStation);
    });
  };

  const operationalFilteredOrders = getFilteredOrdersByStation();

  return (
    <div id='staff-dashboard-root' className='space-y-6'>
      {/* Dynamic Error box */}
      {error && (
        <div className='bg-red-50 text-red-800 p-4 rounded-xl border border-red-100 flex items-center space-x-2 text-xs'>
          <AlertCircle className='w-5 h-5 shrink-0' />
          <span>
            Operations alert: {error}. Falling back to dynamic live local store
            state.
          </span>
        </div>
      )}

      {/* Operations Panel Top Console Header */}
      <div className='bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between'>
        {/* Brand */}
        <div className='flex items-center space-x-3'>
          <span className='p-2.5 bg-zinc-900 text-white rounded-xl'>
            <TableProperties className='w-5 h-5' />
          </span>
          <div>
            <h2 className='text-sm font-black tracking-tight text-zinc-900 flex items-center gap-1'>
              BiteFlow{' '}
              <span className='bg-amber-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-sm'>
                HQ
              </span>
            </h2>
            <p className='text-[10px] text-zinc-400 font-mono uppercase tracking-wider'>
              Dynamic Bistro Management
            </p>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className='flex items-center space-x-1.5 bg-zinc-100 p-1 rounded-xl'>
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'operations'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <ClipboardList className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>Operations</span>
          </button>

          <button
            onClick={() => setActiveTab('menu_crud')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'menu_crud'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <BookOpen className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>Menu CRUD</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tables'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <QrCode className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>Tables Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <BarChart3 className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>Analytics</span>
          </button>
        </div>

        {/* Sync Controls */}
        <div className='flex items-center gap-2'>
          {/* Sounds switch */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100'
            }`}
            title={
              soundEnabled
                ? 'Mute audio notification chimes'
                : 'Enable audio notification chimes'
            }
          >
            {soundEnabled ? (
              <Volume2 className='w-4 h-4 animate-bounce' />
            ) : (
              <VolumeX className='w-4 h-4' />
            )}
          </button>

          {/* Sync indicator */}
          <div className='flex items-center space-x-1.5 bg-zinc-50 border border-zinc-200/60 px-3 py-2 rounded-lg font-mono text-[10px]'>
            {connected ? (
              <div className='flex items-center space-x-1'>
                <span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
                <span className='text-green-700 font-bold'>STREAM ONLINE</span>
              </div>
            ) : reconnecting ? (
              <div className='flex items-center space-x-1'>
                <RefreshCw className='w-3.5 h-3.5 text-amber-500 animate-spin' />
                <span className='text-amber-600 font-bold'>SYNCING...</span>
              </div>
            ) : (
              <div className='flex items-center space-x-1'>
                <span className='w-1.5 h-1.5 rounded-full bg-zinc-300' />
                <span className='text-zinc-400'>OFFLINE</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className='text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            title='Resets orders, tables, and menu to a standard active demo state'
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin text-amber-500' : 'text-amber-600'}`}
            />
            <span className='hidden sm:inline'>
              {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
            </span>
          </button>

          <button
            onClick={handleResetOrders}
            className='text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100/50 border border-red-100 px-3 py-2 rounded-lg cursor-pointer transition-colors'
          >
            <Trash2 className='w-3.5 h-3.5' />
            <span className='hidden sm:inline'>Cleanup Table</span>
          </button>
        </div>
      </div>

      {/* MAIN VIEW CONTROLLER */}
      <AnimatePresence mode='wait'>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className='w-full'
        >
          {/* TAB 1: OPERATIONS & KITCHEN PIPELINE */}
          {activeTab === 'operations' && (
            <div className='space-y-6'>
              {/* Prep Station Selector Bar (Phase 2 Kitchen Display View) */}
              <div className='bg-white rounded-xl p-3 border border-zinc-200/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs'>
                <div className='flex items-center space-x-2'>
                  <CookingPot className='w-4 h-4 text-amber-600' />
                  <span className='text-xs font-bold text-zinc-800 font-sans'>
                    Kitchen Prep Station Filters:
                  </span>
                </div>

                <div className='flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-lg'>
                  {(
                    [
                      { id: 'all', label: 'All Kitchen Items' },
                      { id: 'grill', label: '🥩 Hot Grill' },
                      { id: 'starters', label: '🥗 Starters' },
                      { id: 'dessert', label: '🍰 Desserts Station' },
                      { id: 'bar', label: '🍹 Drinks Bar' },
                    ] as const
                  ).map((station) => (
                    <button
                      key={station.id}
                      onClick={() => setActiveStation(station.id)}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        activeStation === station.id
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
                      }`}
                    >
                      {station.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 4: Active Table Assistance Alert & Dispatch Board */}
              {assistanceRequests.filter((r) => r.status === 'active').length >
                0 && (
                <div
                  id='staff-assistance-alerts'
                  className='bg-red-50 border border-red-100 rounded-xl p-4 space-y-3'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      <span className='relative flex h-2 w-2'>
                        <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75'></span>
                        <span className='relative inline-flex rounded-full h-2 w-2 bg-red-500'></span>
                      </span>
                      <h3 className='text-xs font-extrabold text-red-900 uppercase tracking-wider font-mono'>
                        {
                          assistanceRequests.filter(
                            (r) => r.status === 'active',
                          ).length
                        }{' '}
                        Active Table Assistance Alerts
                      </h3>
                    </div>
                    <span className='text-[10px] text-red-600 font-bold bg-white px-2 py-0.5 rounded-full border border-red-100 animate-pulse'>
                      Needs Dispatch
                    </span>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3'>
                    <AnimatePresence mode='popLayout'>
                      {assistanceRequests
                        .filter((r) => r.status === 'active')
                        .map((req) => (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className='bg-white border border-red-100 rounded-xl p-3 shadow-xs flex flex-col justify-between'
                          >
                            <div>
                              <div className='flex justify-between items-center mb-1'>
                                <span className='text-[10px] bg-red-100 text-red-800 font-extrabold font-mono px-2 py-0.5 rounded-full'>
                                  Table {req.tableId}
                                </span>
                                <span className='text-[9px] text-zinc-400 font-mono'>
                                  {new Date(req.createdAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    },
                                  )}
                                </span>
                              </div>
                              <h4 className='text-xs font-bold text-zinc-800 capitalize mt-1.5 flex items-center gap-1'>
                                {req.requestType === 'water'
                                  ? '💧 Water Refill'
                                  : req.requestType === 'napkins'
                                    ? '🍴 Tableware / Napkins'
                                    : req.requestType === 'waiter'
                                      ? '🙋‍♂️ Call Server'
                                      : '🛎️ Help Assistance'}
                              </h4>
                            </div>

                            <button
                              onClick={() => handleResolveAssistance(req.id)}
                              className='w-full mt-3 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-all'
                            >
                              <Check className='w-3.5 h-3.5' />
                              <span>Resolve Request</span>
                            </button>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Mobile Kanban Column Switcher (visible on mobile screens) */}
              <div className='flex md:hidden bg-zinc-100 p-1 rounded-xl overflow-x-auto gap-1 mb-2 scrollbar-hide border border-zinc-200/40'>
                {PIPELINE_COLUMNS.map((col) => {
                  const count = operationalFilteredOrders.filter(
                    (o) => o.status === col.status,
                  ).length;
                  const isSelected = mobileActiveColumn === col.status;
                  return (
                    <button
                      key={col.status}
                      onClick={() => setMobileActiveColumn(col.status)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-500'
                      }`}
                    >
                      <span>{col.label}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-200/70 text-zinc-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Kanban Pipeline Columns */}
              <div className='w-full md:overflow-x-auto md:pb-4 md:scrollbar-thin'>
                <div
                  id='kanban-pipeline'
                  className='grid grid-cols-1 md:flex xl:grid xl:grid-cols-5 gap-4 md:min-w-312.5 xl:min-w-full'
                >
                  {PIPELINE_COLUMNS.map((col) => {
                    const colOrders = operationalFilteredOrders.filter(
                      (o) => o.status === col.status,
                    );
                    const ColIcon = col.icon;

                    return (
                      <div
                        key={col.status}
                        className={`bg-zinc-50 rounded-2xl p-4 border border-zinc-200/60 flex flex-col h-150 transition-all duration-200 ${
                          mobileActiveColumn === col.status
                            ? 'flex'
                            : 'hidden md:flex'
                        } min-w-61.25`}
                      >
                        {/* Column Header */}
                        <div className='flex items-center justify-between pb-3 border-b border-zinc-200 mb-3 shrink-0'>
                          <div className='flex items-center space-x-2'>
                            <div
                              className={`w-2 h-2 rounded-full ${col.color}`}
                            />
                            <span className='text-xs font-black text-zinc-700 font-sans'>
                              {col.label}
                            </span>
                          </div>
                          <span className='text-xs font-bold text-zinc-400 font-mono bg-white px-2 py-0.5 rounded-md border border-zinc-200'>
                            {colOrders.length}
                          </span>
                        </div>

                        {/* Cards wrap */}
                        <div className='flex-1 overflow-y-auto space-y-3 pr-0.5 scrollbar-thin'>
                          <AnimatePresence mode='popLayout'>
                            {colOrders.map((order) => {
                              // Filter displayed items within card depending on activePrepStation
                              const displayedItems = order.items.filter(
                                (item) =>
                                  activeStation === 'all' ||
                                  item.station === activeStation,
                              );

                              return (
                                <motion.div
                                  key={order.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className={`bg-white rounded-xl p-3 border shadow-xs hover:shadow-md transition-all space-y-3 relative group ${
                                    order.billRequest?.requested
                                      ? 'border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/10'
                                      : !order.acknowledgedByStaff
                                        ? 'border-amber-300 ring-2 ring-amber-500/5'
                                        : 'border-zinc-200'
                                  }`}
                                >
                                  {/* Acknowledgment/Unseen indicator */}
                                  {!order.acknowledgedByStaff && (
                                    <div className='absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md tracking-wider shadow-sm animate-pulse font-mono uppercase'>
                                      NEW
                                    </div>
                                  )}

                                  {/* Bill request indicator */}
                                  {order.billRequest?.requested && (
                                    <div className='absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-md tracking-wider shadow-sm animate-pulse font-mono uppercase'>
                                      BILL
                                    </div>
                                  )}

                                  {/* Card Header */}
                                  <div className='flex justify-between items-start'>
                                    <div>
                                      <span className='text-xs font-black text-zinc-900 font-mono'>
                                        T-{order.tableId}
                                      </span>
                                      <p className='text-[9px] text-zinc-400 font-mono'>
                                        #{order.id}
                                      </p>
                                    </div>
                                    <span className='text-[9px] text-zinc-400 font-mono bg-zinc-100 px-1.5 py-0.5 rounded-xs'>
                                      {new Date(
                                        order.createdAt,
                                      ).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>

                                  {/* Items list (Station-filtered inside card!) */}
                                  <div className='space-y-1 border-t border-b border-dashed border-zinc-100 py-2'>
                                    {displayedItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className='flex justify-between text-[11px] text-zinc-700'
                                      >
                                        <span className='font-semibold'>
                                          {item.name}{' '}
                                          <span className='text-zinc-400 text-[9px] font-normal font-mono'>
                                            x{item.quantity}
                                          </span>
                                        </span>
                                        <span className='font-mono text-zinc-400 text-[10px]'>
                                          $
                                          {(item.price * item.quantity).toFixed(
                                            0,
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                    {displayedItems.length === 0 && (
                                      <p className='text-[10px] text-zinc-400 italic text-center font-mono py-1'>
                                        No items for this station
                                      </p>
                                    )}
                                  </div>

                                  {/* Notes if any */}
                                  {order.notes && (
                                    <div className='bg-amber-50/55 p-2 rounded-lg border border-amber-100 text-[10px] text-amber-900 leading-relaxed italic'>
                                      "{order.notes}"
                                    </div>
                                  )}

                                  {/* Bill Request Console (Phase 3 Split Billing alert) */}
                                  {order.billRequest?.requested && (
                                    <div className='bg-rose-50 border border-rose-200/80 p-2 rounded-lg text-[10px] text-rose-950 space-y-2'>
                                      <div className='flex justify-between items-center font-bold'>
                                        <span>Requesting split:</span>
                                        <span className='uppercase text-rose-700'>
                                          {order.billRequest.type}
                                        </span>
                                      </div>
                                      <div className='flex justify-between items-center'>
                                        <span>Amount calculated:</span>
                                        <span className='font-mono font-bold text-rose-700'>
                                          $
                                          {order.billRequest.paidAmount?.toFixed(
                                            2,
                                          )}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleSettleOrderBill(order.id)
                                        }
                                        className='w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-1 rounded-md text-[9px] uppercase tracking-wider transition-colors cursor-pointer'
                                      >
                                        Settle Split Bill
                                      </button>
                                    </div>
                                  )}

                                  {/* Order Bottom Metadata */}
                                  <div className='flex justify-between items-center text-[10px] font-mono'>
                                    <span
                                      className={`px-1.5 py-0.5 rounded-xs font-bold uppercase ${
                                        order.paymentStatus === 'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {order.paymentStatus === 'paid'
                                        ? 'Paid'
                                        : 'Unpaid'}
                                    </span>
                                    <span className='font-bold text-zinc-800'>
                                      ${order.total.toFixed(2)}
                                    </span>
                                  </div>

                                  {/* Dynamic staff actions buttons based on role state */}
                                  <div className='space-y-1'>
                                    {/* Step 1: Waiter Acknowledgment (Phase 2 Seen acknowledgment) */}
                                    {!order.acknowledgedByStaff && (
                                      <button
                                        onClick={() =>
                                          handleAcknowledgeOrder(order.id)
                                        }
                                        className='w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase flex items-center justify-center gap-1 animate-pulse transition-colors cursor-pointer'
                                      >
                                        <Eye className='w-3 h-3' />
                                        <span>Mark Seen</span>
                                      </button>
                                    )}

                                    {/* Step 2: Transition column state */}
                                    {(!order.billRequest?.requested ||
                                      order.paymentStatus === 'paid') && (
                                      <button
                                        onClick={() =>
                                          handleTransitionOrder(
                                            order.id,
                                            order.status,
                                          )
                                        }
                                        className='w-full bg-zinc-900 hover:bg-amber-600 hover:text-white text-white rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer'
                                      >
                                        <col.btnIcon className='w-3.5 h-3.5' />
                                        <span>{col.btnLabel}</span>
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>

                          {colOrders.length === 0 && (
                            <div className='h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl p-4 text-center'>
                              <span className='text-[10px] font-mono text-zinc-400'>
                                Clear column
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MENU CRUD MANAGER (Phase 4 CRUD Builder) */}
          {activeTab === 'menu_crud' && (
            <div className='bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 space-y-6'>
              {/* Toolbar */}
              <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-zinc-100 gap-3'>
                <div>
                  <h3 className='text-md font-bold text-zinc-800 font-sans'>
                    Dynamic Chef Menu Builder
                  </h3>
                  <p className='text-xs text-zinc-400 mt-0.5'>
                    CRUD dishes. Items marked out of stock are instantly
                    auto-hidden from customers.
                  </p>
                </div>

                <div className='flex flex-wrap gap-2 w-full sm:w-auto'>
                  <button
                    onClick={handleImportAPIMenu}
                    disabled={isImportingAPI}
                    className='flex-1 sm:flex-initial border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    title='Fetches and loads real meals and cocktails dynamically from TheMealDB and TheCocktailDB public APIs'
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 ${isImportingAPI ? 'animate-spin text-amber-500' : 'text-zinc-500'}`}
                    />
                    <span>
                      {isImportingAPI
                        ? 'Fetching Public APIs...'
                        : 'Import Live API Menu'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setEditMenuItemId(null);
                      setMenuForm({
                        name: '',
                        description: '',
                        price: 0,
                        category: 'mains',
                        station: 'grill',
                        image: '',
                        tags: [],
                        inStock: true,
                      });
                      setIsMenuFormOpen(true);
                    }}
                    className='flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span>Create Culinary Dish</span>
                  </button>
                </div>
              </div>

              {/* CRUD Form Dialog Overlay */}
              <AnimatePresence>
                {isMenuFormOpen && (
                  <div className='fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4'>
                    <div
                      className='absolute inset-0'
                      onClick={() => setIsMenuFormOpen(false)}
                    />

                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className='bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 relative z-10 space-y-4'
                    >
                      <h4 className='text-sm font-black text-zinc-900 uppercase tracking-tight'>
                        {editMenuItemId
                          ? 'Modify Dynamic Dish'
                          : 'Publish New Dish'}
                      </h4>

                      <form
                        onSubmit={handleSaveMenuItem}
                        className='space-y-3.5 text-xs'
                      >
                        <div>
                          <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                            Dish Name *
                          </label>
                          <input
                            type='text'
                            required
                            value={menuForm.name || ''}
                            onChange={(e) =>
                              setMenuForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder='e.g. Garlic Grilled Lamb Chop'
                            className='w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-hidden focus:border-amber-500'
                          />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                          <div>
                            <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                              Price ($) *
                            </label>
                            <input
                              type='number'
                              step='0.01'
                              required
                              value={menuForm.price || 0}
                              onChange={(e) =>
                                setMenuForm((prev) => ({
                                  ...prev,
                                  price: Number(e.target.value),
                                }))
                              }
                              placeholder='14.50'
                              className='w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-hidden focus:border-amber-500 font-mono'
                            />
                          </div>

                          <div>
                            <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                              Category
                            </label>
                            <select
                              value={menuForm.category || 'mains'}
                              onChange={(e) =>
                                setMenuForm((prev) => ({
                                  ...prev,
                                  category: e.target.value as any,
                                }))
                              }
                              className='w-full p-2.5 border border-zinc-200 bg-white rounded-lg focus:outline-hidden'
                            >
                              <option value='starters'>Starters</option>
                              <option value='mains'>Mains</option>
                              <option value='desserts'>Desserts</option>
                              <option value='drinks'>Drinks</option>
                            </select>
                          </div>
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                          <div>
                            <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                              Prep Station (Phase 2)
                            </label>
                            <select
                              value={menuForm.station || 'grill'}
                              onChange={(e) =>
                                setMenuForm((prev) => ({
                                  ...prev,
                                  station: e.target.value as any,
                                }))
                              }
                              className='w-full p-2.5 border border-zinc-200 bg-white rounded-lg focus:outline-hidden'
                            >
                              <option value='grill'>🥩 Hot Grill</option>
                              <option value='starters'>
                                🥗 Starters Station
                              </option>
                              <option value='dessert'>
                                🍰 Dessert Station
                              </option>
                              <option value='bar'>🍹 Drinks Bar</option>
                            </select>
                          </div>

                          <div>
                            <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                              Display Thumbnail URL
                            </label>
                            <input
                              type='text'
                              value={menuForm.image || ''}
                              onChange={(e) =>
                                setMenuForm((prev) => ({
                                  ...prev,
                                  image: e.target.value,
                                }))
                              }
                              placeholder='https://images.unsplash.com/...'
                              className='w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-hidden focus:border-amber-500 font-mono'
                            />
                          </div>
                        </div>

                        <div>
                          <label className='block font-bold text-zinc-600 mb-1 uppercase tracking-wider font-mono text-[9px]'>
                            Dish Description
                          </label>
                          <textarea
                            rows={3}
                            value={menuForm.description || ''}
                            onChange={(e) =>
                              setMenuForm((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder='Detail ingredients, cooking style, organic elements...'
                            className='w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-hidden focus:border-amber-500'
                          />
                        </div>

                        {/* Submit */}
                        <div className='flex gap-2 pt-3'>
                          <button
                            type='submit'
                            className='flex-1 bg-zinc-950 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase cursor-pointer hover:bg-amber-600 transition-colors'
                          >
                            Save Dish
                          </button>
                          <button
                            type='button'
                            onClick={() => setIsMenuFormOpen(false)}
                            className='border border-zinc-200 text-zinc-600 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer hover:bg-zinc-50'
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Menu Items Table List (Desktop & Tablet) */}
              <div className='hidden sm:block border border-zinc-100 rounded-xl overflow-hidden'>
                <div className='w-full overflow-x-auto'>
                  <table className='w-full text-left text-xs border-collapse min-w-187.5'>
                    <thead>
                      <tr className='bg-zinc-50 border-b border-zinc-100 text-zinc-400 font-mono uppercase text-[9px] tracking-wider'>
                        <th className='p-4 font-bold'>Dish Info</th>
                        <th className='p-4 font-bold'>Category</th>
                        <th className='p-4 font-bold'>Station</th>
                        <th className='p-4 font-bold font-mono'>Price</th>
                        <th className='p-4 font-bold'>Inventory Flag</th>
                        <th className='p-4 font-bold text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-zinc-100'>
                      {menuItems.map((item) => (
                        <tr
                          key={item.id}
                          className='hover:bg-zinc-50/50 transition-colors'
                        >
                          <td className='p-4 flex gap-3 items-center'>
                            <img
                              src={item.image}
                              alt={item.name}
                              referrerPolicy='no-referrer'
                              className='w-10 h-10 rounded-lg object-cover border border-zinc-100'
                            />
                            <div>
                              <span className='font-bold text-zinc-900 block'>
                                {item.name}
                              </span>
                              <span className='text-[10px] text-zinc-400 block line-clamp-1'>
                                {item.description}
                              </span>
                            </div>
                          </td>
                          <td className='p-4'>
                            <span className='bg-zinc-100 text-zinc-600 font-bold px-2 py-1 rounded-sm capitalize text-[10px]'>
                              {item.category}
                            </span>
                          </td>
                          <td className='p-4 capitalize text-zinc-500 font-medium font-sans'>
                            {item.station}
                          </td>
                          <td className='p-4 font-mono font-bold text-zinc-700'>
                            ${item.price.toFixed(2)}
                          </td>
                          <td className='p-4'>
                            <button
                              onClick={() => handleToggleMenuItemStock(item)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider transition-colors cursor-pointer flex items-center gap-1 border ${
                                item.inStock !== false
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${item.inStock !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              />
                              {item.inStock !== false
                                ? 'IN STOCK'
                                : 'OUT OF STOCK'}
                            </button>
                          </td>
                          <td className='p-4 text-right space-x-1'>
                            <button
                              onClick={() => {
                                setEditMenuItemId(item.id);
                                setMenuForm(item);
                                setIsMenuFormOpen(true);
                              }}
                              className='p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer inline-flex'
                            >
                              <Edit className='w-3.5 h-3.5' />
                            </button>
                            <button
                              onClick={() => handleDeleteMenuItem(item.id)}
                              className='p-2 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors cursor-pointer inline-flex'
                            >
                              <Trash className='w-3.5 h-3.5' />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Menu Items Mobile Grid List (Visible only on mobile devices) */}
              <div className='block sm:hidden space-y-3'>
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className='bg-white p-4 rounded-xl border border-zinc-150 flex flex-col space-y-3 shadow-xs'
                  >
                    <div className='flex gap-3 items-start'>
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy='no-referrer'
                        className='w-12 h-12 rounded-lg object-cover border border-zinc-100 shrink-0'
                      />
                      <div className='flex-1 min-w-0'>
                        <span className='font-bold text-zinc-900 block text-xs truncate'>
                          {item.name}
                        </span>
                        <span className='text-[10px] text-zinc-400 block line-clamp-2 mt-0.5 leading-relaxed'>
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <div className='flex justify-between items-center text-[10px] pt-1 border-t border-zinc-100'>
                      <div className='flex flex-wrap gap-1'>
                        <span className='bg-zinc-100 text-zinc-600 font-bold px-1.5 py-0.5 rounded-sm capitalize text-[9px]'>
                          {item.category}
                        </span>
                        <span className='bg-zinc-50 text-zinc-500 font-medium px-1.5 py-0.5 rounded-sm capitalize text-[9px]'>
                          {item.station}
                        </span>
                      </div>
                      <span className='font-mono font-bold text-zinc-700 text-xs'>
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <div className='flex justify-between items-center pt-2 border-t border-zinc-100'>
                      <button
                        onClick={() => handleToggleMenuItemStock(item)}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider transition-colors cursor-pointer flex items-center gap-1 border ${
                          item.inStock !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.2 h-1.2 rounded-full ${item.inStock !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        />
                        {item.inStock !== false ? 'IN STOCK' : 'OUT STOCK'}
                      </button>
                      <div className='space-x-1'>
                        <button
                          onClick={() => {
                            setEditMenuItemId(item.id);
                            setMenuForm(item);
                            setIsMenuFormOpen(true);
                          }}
                          className='p-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer inline-flex border border-zinc-200/50'
                        >
                          <Edit className='w-3 h-3' />
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          className='p-1.5 bg-red-50 hover:bg-red-100/50 rounded-lg text-red-500 hover:text-red-700 transition-colors cursor-pointer inline-flex border border-red-100'
                        >
                          <Trash className='w-3 h-3' />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TABLES & QR CODE HUB (Phase 4 Management) */}
          {activeTab === 'tables' && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {/* Tables configuration panel */}
              <div className='bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 md:col-span-2 space-y-6'>
                <div className='flex justify-between items-center pb-4 border-b border-zinc-100'>
                  <div>
                    <h3 className='text-md font-bold text-zinc-800 font-sans'>
                      Diner Tables Registry
                    </h3>
                    <p className='text-xs text-zinc-400 mt-0.5'>
                      Add tables dynamically and change live occupancy states
                      instantly.
                    </p>
                  </div>
                </div>

                {/* Create table inline form */}
                <form
                  onSubmit={handleAddTable}
                  className='flex gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200/50'
                >
                  <input
                    type='text'
                    required
                    value={newTableId}
                    onChange={(e) => setNewTableId(e.target.value)}
                    placeholder='e.g. 9'
                    className='flex-1 bg-white border border-zinc-200 text-xs rounded-lg px-3 py-2.5 focus:outline-hidden'
                  />
                  <button
                    type='submit'
                    className='bg-zinc-900 hover:bg-amber-600 text-white font-extrabold px-5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1'
                  >
                    <Plus className='w-4 h-4' />
                    <span>Register Table</span>
                  </button>
                </form>

                {/* Tables cards grid */}
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                  {tablesList.map((table) => {
                    const isSelected = selectedTable === table.id;
                    const activeOrder = orders.find(
                      (o) => o.tableId === table.id && o.status !== 'paid',
                    );

                    return (
                      <div
                        key={table.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between h-32 transition-all relative ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/15 ring-2 ring-amber-500/10'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50/30'
                        }`}
                      >
                        <div>
                          <div className='flex justify-between items-start'>
                            <span className='text-xs font-black text-zinc-900'>
                              Table {table.id}
                            </span>
                            <button
                              onClick={() => setSelectedTable(table.id)}
                              className='text-[9px] font-bold text-amber-700 font-mono bg-amber-50 px-1.5 py-0.5 rounded-sm hover:bg-amber-100 transition-colors cursor-pointer'
                            >
                              Show QR
                            </button>
                          </div>

                          <span className='text-[9px] font-mono text-zinc-400 block mt-1'>
                            {activeOrder
                              ? `Active Ref: ${activeOrder.id}`
                              : 'No active orders'}
                          </span>
                        </div>

                        {/* Dropdown status selector */}
                        <div className='pt-2'>
                          <select
                            value={table.status}
                            onChange={(e) =>
                              handleUpdateTableStatus(table.id, e.target.value)
                            }
                            className={`w-full p-1 text-[10px] font-bold border rounded-md capitalize bg-white ${
                              table.status === 'occupied'
                                ? 'text-orange-700 border-orange-200'
                                : table.status === 'billing'
                                  ? 'text-rose-700 border-rose-200 font-black animate-pulse'
                                  : 'text-zinc-500 border-zinc-200'
                            }`}
                          >
                            <option value='vacant'>Vacant</option>
                            <option value='occupied'>Occupied</option>
                            <option value='billing'>Billing Requested</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code and Simulator Utility Box */}
              <div className='bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 flex flex-col items-center justify-between text-center relative overflow-hidden h-110'>
                <div className='absolute top-0 left-0 right-0 h-1 bg-amber-600' />

                <div className='space-y-1'>
                  <h4 className='text-xs font-bold text-zinc-900 font-sans flex items-center justify-center gap-1.5'>
                    <QrCode className='w-4 h-4 text-amber-600' />
                    Table {selectedTable} Direct Link QR
                  </h4>
                  <p className='text-[10px] text-zinc-400'>
                    Scan to launch the table-scoped diner session directly
                  </p>
                </div>

                <div className='my-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-100 shrink-0'>
                  <img
                    src={qrCodeImgSrc}
                    alt={`Table ${selectedTable} QR`}
                    referrerPolicy='no-referrer'
                    className='w-36 h-36 mx-auto object-cover border-4 border-white shadow-xs rounded-lg'
                  />
                </div>

                <div className='w-full space-y-2'>
                  <div className='bg-zinc-50 rounded-lg p-2 border border-zinc-200/60 flex items-center justify-between text-left'>
                    <span className='text-[9px] text-zinc-500 font-mono truncate max-w-42.5'>
                      {selectedTableUrl}
                    </span>
                    <a
                      href={selectedTableUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='text-[10px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 shrink-0'
                    >
                      <span>Simulate</span>
                      <ExternalLink className='w-3 h-3' />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPERATIONS LIVE ANALYTICS (Phase 4 Reports) */}
          {activeTab === 'analytics' && (
            <div className='space-y-6'>
              {/* Analytics metrics row */}
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='bg-white rounded-2xl border border-zinc-100 p-4 shadow-xs space-y-1'>
                  <span className='text-[10px] font-bold text-zinc-400 font-mono uppercase block'>
                    Total Sales (Today)
                  </span>
                  <div className='flex items-baseline space-x-1.5'>
                    <span className='text-xl font-black text-zinc-900 font-mono'>
                      ${analytics.totalRevenue.toFixed(2)}
                    </span>
                    <span className='text-[9px] text-emerald-600 font-extrabold font-sans'>
                      Paid
                    </span>
                  </div>
                  <p className='text-[9px] text-zinc-400 font-mono'>
                    {orders.filter((o) => o.status === 'paid').length}{' '}
                    transactions settled
                  </p>
                </div>

                <div className='bg-white rounded-2xl border border-zinc-100 p-4 shadow-xs space-y-1'>
                  <span className='text-[10px] font-bold text-zinc-400 font-mono uppercase block'>
                    Live Pipeline Volume
                  </span>
                  <div className='flex items-baseline space-x-1.5'>
                    <span className='text-xl font-black text-zinc-900 font-mono'>
                      {analytics.activeOrderCount}
                    </span>
                    <span className='text-[9px] text-amber-600 font-bold uppercase font-mono'>
                      In-Prep
                    </span>
                  </div>
                  <p className='text-[9px] text-zinc-400'>
                    Pending & active cooks
                  </p>
                </div>

                <div className='bg-white rounded-2xl border border-zinc-100 p-4 shadow-xs space-y-1'>
                  <span className='text-[10px] font-bold text-zinc-400 font-mono uppercase block'>
                    Table Occupancy Rate
                  </span>
                  <div className='flex items-baseline space-x-1.5'>
                    <span className='text-xl font-black text-zinc-900 font-mono'>
                      {analytics.occupancyPercent.toFixed(0)}%
                    </span>
                    <span className='text-[9px] text-blue-600 font-bold font-mono'>
                      ({analytics.occupiedTablesCount}/
                      {analytics.totalTablesCount})
                    </span>
                  </div>
                  <p className='text-[9px] text-zinc-400'>
                    Occupied or billing tables
                  </p>
                </div>

                <div className='bg-white rounded-2xl border border-zinc-100 p-4 shadow-xs space-y-1'>
                  <span className='text-[10px] font-bold text-zinc-400 font-mono uppercase block'>
                    Unpaid Bills Outstanding
                  </span>
                  <div className='flex items-baseline space-x-1.5'>
                    <span className='text-xl font-black text-rose-700 font-mono'>
                      ${analytics.outstandingBillsValue.toFixed(2)}
                    </span>
                    <span className='text-[9px] text-rose-600 font-bold font-mono'>
                      Unpaid
                    </span>
                  </div>
                  <p className='text-[9px] text-zinc-400'>
                    Served orders pending settle
                  </p>
                </div>
              </div>

              {/* Charts and Statistics breakdown */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* Popular Dishes bar indicators */}
                <div className='bg-white rounded-2xl border border-zinc-100 p-5 shadow-xs space-y-4'>
                  <h4 className='text-xs font-black text-zinc-800 uppercase tracking-wider font-sans'>
                    Most Popular Culinary Dishes
                  </h4>

                  <div className='space-y-3.5'>
                    {analytics.popularDishes.map((dish, index) => {
                      // Normalize percentage against high score
                      const maxCount = analytics.popularDishes[0]?.count || 1;
                      const percentWidth = (dish.count / maxCount) * 100;

                      return (
                        <div key={dish.name} className='space-y-1 text-xs'>
                          <div className='flex justify-between items-center text-zinc-700'>
                            <span className='font-bold flex items-center gap-1.5'>
                              <span className='text-[10px] font-mono text-zinc-400'>
                                0{index + 1}
                              </span>
                              {dish.name}
                            </span>
                            <span className='font-mono text-[11px] text-zinc-500'>
                              {dish.count} orders (${dish.revenue.toFixed(0)})
                            </span>
                          </div>

                          {/* Visual progress bar bar */}
                          <div className='h-2 w-full bg-zinc-100 rounded-full overflow-hidden'>
                            <div
                              className='h-full bg-amber-600 rounded-full transition-all duration-500'
                              style={{ width: `${percentWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {analytics.popularDishes.length === 0 && (
                      <p className='text-xs text-zinc-400 italic text-center py-6'>
                        No orders recorded to calculate popular dishes yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Operations Health Checklist */}
                <div className='bg-white rounded-2xl border border-zinc-100 p-5 shadow-xs space-y-4'>
                  <h4 className='text-xs font-black text-zinc-800 uppercase tracking-wider font-sans'>
                    BiteFlow Operations Audit
                  </h4>

                  <div className='space-y-2.5 text-xs'>
                    <div className='flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50'>
                      <span className='text-zinc-600 font-sans'>
                        Server WebSockets Sync State:
                      </span>
                      <span className='text-[10px] font-mono font-bold text-emerald-600'>
                        CONNECTED & PUSH ACTIVE
                      </span>
                    </div>

                    <div className='flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50'>
                      <span className='text-zinc-600 font-sans'>
                        Total Dishes in Directory:
                      </span>
                      <span className='text-[10px] font-mono font-bold text-zinc-800'>
                        {menuItems.length} listed
                      </span>
                    </div>

                    <div className='flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50'>
                      <span className='text-zinc-600 font-sans'>
                        Out-Of-Stock Items:
                      </span>
                      <span className='text-[10px] font-mono font-bold text-amber-700'>
                        {menuItems.filter((m) => m.inStock === false).length}{' '}
                        inactive
                      </span>
                    </div>

                    <div className='flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50'>
                      <span className='text-zinc-600 font-sans'>
                        Floor Service Load:
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${analytics.activeOrderCount > 4 ? 'text-amber-700' : 'text-zinc-800'}`}
                      >
                        {analytics.activeOrderCount > 4
                          ? 'HIGH VOLUME'
                          : 'OPTIMAL CAP'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
