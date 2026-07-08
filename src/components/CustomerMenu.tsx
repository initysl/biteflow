import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  FileText,
  ChevronRight,
  Check,
  Sparkles,
  X,
  Info,
  CreditCard,
  HandHelping,
  Landmark,
  RefreshCw,
  Coins,
  Award,
  History,
  Heart,
  MessageSquare,
  CheckCircle2,
  Clock,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { MenuItem, Order, OrderItem } from '../types';
import StripeModal from './StripeModal';
import ActiveTracker from './ActiveTracker';

interface CustomerMenuProps {
  tableId: string;
}

export default function CustomerMenu({ tableId }: CustomerMenuProps) {
  // Dynamic Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Navigation / Filter State
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'starters' | 'mains' | 'desserts' | 'drinks'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart / Order State
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [specialNotes, setSpecialNotes] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkouts / Active orders
  const [isStripeOpen, setIsStripeOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [checkedOut, setCheckedOut] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  // Option 1: Table Assistance real-time states
  const [assistanceStatus, setAssistanceStatus] = useState<
    'none' | 'pending' | 'active'
  >('none');
  const [currentRequestType, setCurrentRequestType] = useState<string | null>(
    null,
  );
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);

  // Option 2: Customer Loyalty & History states
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discount: number;
    type: 'percent' | 'flat';
  } | null>(null);

  // Option 3: Culinary Details Modal state
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);

  // Fetch dynamic menu from backend & active table assistance status
  useEffect(() => {
    const fetchMenuAndAssistance = async () => {
      try {
        const resMenu = await fetch('/api/menu');
        if (resMenu.ok) {
          const data = await resMenu.json();
          setMenuItems(data);
        }

        const resAst = await fetch('/api/assistance');
        if (resAst.ok) {
          const activeRequests: any[] = await resAst.json();
          const ours = activeRequests.find(
            (r) => r.tableId === tableId && r.status === 'active',
          );
          if (ours) {
            setAssistanceStatus('active');
            setCurrentRequestType(ours.requestType);
          } else {
            setAssistanceStatus('none');
            setCurrentRequestType(null);
          }
        }
      } catch (err) {
        console.error('Failed to initial fetch:', err);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenuAndAssistance();
  }, [tableId]);

  // Option 1 & 2: Setup real-time WebSocket connection to sync table help resolutions and dynamic stock updates
  useEffect(() => {
    let socket: WebSocket | null = null;
    let heartbeatInterval: any = null;

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            type: 'register',
            role: 'table',
            tableId,
          }),
        );

        heartbeatInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'menu:update' && msg.menu) {
            setMenuItems(msg.menu);
          }
          if (
            msg.type === 'assistance:acknowledged' &&
            msg.request &&
            msg.request.tableId === tableId
          ) {
            setAssistanceStatus('active');
            setCurrentRequestType(msg.request.requestType);
          }
          if (msg.type === 'assistance:resolved' && msg.tableId === tableId) {
            setAssistanceStatus('none');
            setCurrentRequestType(null);
          }
        } catch (err) {
          console.warn('WS Customer dynamic listener exception:', err);
        }
      };

      socket.onclose = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        setTimeout(connectWS, 4000); // Backoff retry
      };
    };

    connectWS();

    return () => {
      if (socket) socket.close();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [tableId]);

  // Load local customer loyalty info from localStorage
  useEffect(() => {
    const savedPoints = localStorage.getItem(
      `biteflow_loyalty_points_${tableId}`,
    );
    if (savedPoints) {
      setLoyaltyPoints(parseInt(savedPoints));
    } else {
      // Seed initial points so the system is immediately rewarding to test!
      localStorage.setItem(`biteflow_loyalty_points_${tableId}`, '120');
      setLoyaltyPoints(120);
    }

    const savedHistory = localStorage.getItem(
      `biteflow_order_history_${tableId}`,
    );
    if (savedHistory) {
      setOrderHistory(JSON.parse(savedHistory));
    }
  }, [tableId]);

  // Submit Assistance Call
  const handleCallWaiter = async (
    type: 'water' | 'napkins' | 'waiter' | 'general',
  ) => {
    setAssistanceStatus('pending');
    setCurrentRequestType(type);
    setIsAssistanceModalOpen(false);
    try {
      const res = await fetch('/api/assistance/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, requestType: type }),
      });
      if (res.ok) {
        setAssistanceStatus('active');
      } else {
        setAssistanceStatus('none');
        setCurrentRequestType(null);
      }
    } catch (e) {
      console.error('Call waiter error:', e);
      setAssistanceStatus('none');
      setCurrentRequestType(null);
    }
  };

  // Local storage backup/initial check for existing active order on this table
  useEffect(() => {
    const fetchExistingTableOrders = async () => {
      try {
        const res = await fetch(`/api/orders/table/${tableId}`);
        if (res.ok) {
          const tableOrders: Order[] = await res.json();
          // Find if there is any active order (not paid/served or recently completed)
          const active = tableOrders.find((o) => o.status !== 'paid');
          if (active) {
            setActiveOrder(active);
          }
        }
      } catch (err) {
        console.error('Failed to query existing table orders:', err);
      }
    };
    fetchExistingTableOrders();
  }, [tableId]);

  // Cart logic
  const handleAddToBag = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as { item: MenuItem; quantity: number }[];
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, c) => total + c.item.price * c.quantity, 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((count, c) => count + c.quantity, 0);
  };

  const getCartTotalWithDiscount = () => {
    const subtotal = getCartTotal();
    if (!appliedVoucher) return subtotal;
    if (appliedVoucher.type === 'percent') {
      return Math.max(0, subtotal * (1 - appliedVoucher.discount / 100));
    } else {
      return Math.max(0, subtotal - appliedVoucher.discount);
    }
  };

  // Submit Order Helper (Counter / Counter Checkout)
  const submitOrder = async (method: 'stripe' | 'counter') => {
    setLoadingCheckout(true);
    const orderItems: any[] = cart.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      price: c.item.price,
      quantity: c.quantity,
      station: c.item.station || 'starters',
    }));

    if (appliedVoucher) {
      orderItems.push({
        id: 'discount-voucher',
        name: `Voucher Applied: ${appliedVoucher.code}`,
        price: -appliedVoucher.discount,
        quantity: 1,
        station: 'starters',
      });
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          items: orderItems,
          notes: specialNotes,
          paymentMethod: method,
          paymentStatus: method === 'stripe' ? 'paid' : 'unpaid',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit order');
      const orderData: Order = await res.json();

      // Calculate & update loyalty points: $1 spent = 1 point
      const earned = Math.max(0, Math.floor(getCartTotalWithDiscount()));
      const nextPoints = loyaltyPoints + earned;
      setLoyaltyPoints(nextPoints);
      localStorage.setItem(
        `biteflow_loyalty_points_${tableId}`,
        nextPoints.toString(),
      );

      // Save order to local order history
      const newHistoryItem = {
        id: orderData.id,
        date:
          new Date().toLocaleDateString() +
          ' ' +
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        items: cart.map((c) => `${c.item.name} (x${c.quantity})`),
        total: getCartTotalWithDiscount(),
        pointsEarned: earned,
      };
      const nextHistory = [newHistoryItem, ...orderHistory];
      setOrderHistory(nextHistory);
      localStorage.setItem(
        `biteflow_order_history_${tableId}`,
        JSON.stringify(nextHistory),
      );

      setActiveOrder(orderData);
      setCart([]);
      setSpecialNotes('');
      setAppliedVoucher(null);
      setIsCartOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error placing order. Please try again.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handlePaymentSuccess = () => {
    submitOrder('stripe');
  };

  const handlePayAtCounter = () => {
    submitOrder('counter');
  };

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStock = item.inStock !== false; // Auto-hide out of stock items
    return matchesCategory && matchesSearch && matchesStock;
  });

  return (
    <div id='customer-view' className='w-full pb-24 relative'>
      {/* If customer has an active order tracking, show active tracker view prominently */}
      {activeOrder ? (
        <div id='live-tracking-panel' className='py-6'>
          <ActiveTracker
            order={activeOrder}
            onOrderPaid={() => {
              // Trigger when order is paid
            }}
            onClose={() => setActiveOrder(null)}
          />
        </div>
      ) : (
        <>
          {/* Hero Banner with beautiful title */}
          <div className='pt-6 pb-4'>
            <div className='flex justify-between items-center mb-2'>
              <span className='text-[10px] font-bold uppercase tracking-wider text-amber-800 font-mono bg-amber-50 px-3 py-1 rounded-full border border-amber-100'>
                Table {tableId} • Direct QR Session
              </span>
              <div className='flex items-center space-x-1.5 text-xs text-gray-500 font-mono'>
                <span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
                <span>Menu Synced</span>
              </div>
            </div>
            <h2 className='text-2xl font-black text-gray-900 tracking-tight font-sans'>
              Culinary Sourdough & Grills
            </h2>
            <p className='text-xs text-gray-500 mt-1'>
              Browse our local hand-crafted gourmet specials. No signups, no
              logins. Place order to table directly.
            </p>
          </div>

          {/* Option 1 & 2: Dynamic Action Center Panel */}
          <div className='grid grid-cols-3 gap-3 mb-6'>
            {/* Table Assistance Action Widget */}
            <div className='bg-white rounded-xl border border-gray-100 p-3 shadow-xs flex flex-col justify-between'>
              <div className='flex items-start gap-2'>
                <div
                  className={`p-1.5 rounded-lg ${
                    assistanceStatus === 'active'
                      ? 'bg-green-50 text-green-600 animate-pulse'
                      : assistanceStatus === 'pending'
                        ? 'bg-amber-50 text-amber-600 animate-pulse'
                        : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  <HelpCircle className='w-4 h-4' />
                </div>
                <div>
                  <h4 className='text-xs font-bold text-gray-900 leading-tight'>
                    Table Assistance
                  </h4>
                  <p className='text-[10px] text-gray-400 mt-0.5'>
                    {assistanceStatus === 'active'
                      ? `Assisting: ${currentRequestType}`
                      : assistanceStatus === 'pending'
                        ? 'Sending request...'
                        : 'Request water/staff'}
                  </p>
                </div>
              </div>

              <div className='mt-2.5'>
                {assistanceStatus === 'active' ? (
                  <div className='bg-green-50/80 border border-green-100 text-green-800 text-[10px] font-bold p-1.5 rounded-lg text-center flex items-center justify-center gap-1'>
                    <span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-ping' />
                    <span>Staff is on the way!</span>
                  </div>
                ) : assistanceStatus === 'pending' ? (
                  <div className='bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold p-1.5 rounded-lg text-center flex items-center justify-center gap-1'>
                    <RefreshCw className='w-3 h-3 animate-spin text-amber-600' />
                    <span>Pinging Host...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAssistanceModalOpen(true)}
                    className='w-full bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-700 hover:text-gray-900 font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-all'
                  >
                    <span>🛎️ Call Staff / Request</span>
                  </button>
                )}
              </div>
            </div>

            {/* Loyalty and Order History Entry Panel */}
            <div className='bg-white rounded-xl border border-gray-100 p-3 shadow-xs flex flex-col justify-between'>
              <div className='flex items-start gap-2'>
                <div className='p-1.5 rounded-lg bg-amber-50 text-amber-700'>
                  <Coins className='w-4 h-4' />
                </div>
                <div>
                  <h4 className='text-xs font-bold text-gray-900 leading-tight'>
                    BiteRewards
                  </h4>
                  <div className='flex items-center gap-1 mt-0.5'>
                    <span className='text-xs font-black text-amber-700 font-mono'>
                      {loyaltyPoints}
                    </span>
                    <span className='text-[9px] font-bold text-gray-400'>
                      pts available
                    </span>
                  </div>
                </div>
              </div>

              <div className='mt-2.5'>
                <button
                  onClick={() => setIsLoyaltyModalOpen(true)}
                  className='w-full bg-amber-50 hover:bg-amber-100 border border-amber-100/50 text-amber-800 font-bold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-all'
                >
                  <Award className='w-3 h-3 text-amber-600' />
                  <span>Claim Rewards / History</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className='relative mb-6'>
            <input
              type='text'
              placeholder='Search dishes, ingredients, starters...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-xs'
            />
            <Search className='w-4 h-4 text-gray-400 absolute left-3.5 top-4' />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-3.5 text-xs font-semibold text-gray-400 hover:text-gray-600'
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Category slider */}
          <div className='flex space-x-2 overflow-x-auto pb-3 mb-6 scrollbar-hide -mx-4 px-4'>
            {(
              [
                { id: 'all', label: 'All Specials' },
                { id: 'starters', label: 'Starters' },
                { id: 'mains', label: 'Mains' },
                { id: 'desserts', label: 'Desserts' },
                { id: 'drinks', label: 'Drinks' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all shrink-0 cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Menu Items List */}
          <div className='space-y-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-24'>
            {filteredItems.length === 0 ? (
              <div className='text-center py-12 bg-white rounded-xl border border-dashed border-gray-200'>
                <p className='text-sm text-gray-500'>
                  No gourmet dishes found matching your criteria.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className='bg-white border border-gray-100 rounded-xl p-4 flex gap-4 hover:shadow-md transition-all relative group'
                >
                  {/* Clickable Card Body (Thumbnail + Content) */}
                  <div
                    onClick={() => setSelectedDish(item)}
                    className='flex-1 flex gap-4 cursor-pointer'
                  >
                    {/* Dish Thumbnail */}
                    <div className='w-24 h-24 rounded-lg overflow-hidden shrink-0 relative border border-gray-100 bg-gray-50'>
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy='no-referrer'
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                      />
                    </div>

                    {/* Dish Content */}
                    <div className='flex-1 flex flex-col justify-between'>
                      <div>
                        <div className='flex justify-between items-start'>
                          <h3 className='text-sm font-bold text-gray-900 group-hover:text-amber-700 transition-colors'>
                            {item.name}
                          </h3>
                          <span className='text-sm font-bold text-amber-700 font-mono'>
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                        <p className='text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed'>
                          {item.description}
                        </p>
                      </div>

                      <div className='flex justify-between items-center mt-3'>
                        {/* Dietary / Feature Tags */}
                        <div className='flex flex-wrap gap-1'>
                          {item.tags?.map((tag) => (
                            <span
                              key={tag}
                              className='text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded-sm bg-gray-50 text-gray-500 border border-gray-100'
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <span className='text-[10px] text-amber-600 flex items-center gap-0.5 font-bold hover:underline'>
                          <Info className='w-3 h-3' />
                          <span>Details</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Independent Add Button */}
                  <div className='absolute bottom-4 right-4 z-10'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToBag(item);
                      }}
                      className='bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 shadow-xs hover:shadow-sm transition-all cursor-pointer'
                    >
                      <Plus className='w-3.5 h-3.5' />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Floating Cart Sticky Bar */}
          {cart.length > 0 && (
            <div className='fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-40'>
              <button
                onClick={() => setIsCartOpen(true)}
                className='w-full bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-xl flex items-center justify-between shadow-xl ring-4 ring-amber-500/15 hover:scale-102 transition-transform cursor-pointer'
              >
                <div className='flex items-center space-x-3'>
                  <div className='bg-white/15 p-2 rounded-lg relative'>
                    <ShoppingBag className='w-5 h-5 text-white' />
                    <span className='absolute -top-1 -right-1 bg-white text-amber-800 text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-amber-600 font-mono'>
                      {getCartItemsCount()}
                    </span>
                  </div>
                  <div className='text-left'>
                    <span className='text-xs text-white/80 block uppercase tracking-wider font-semibold font-mono'>
                      My Dining Bag
                    </span>
                    <span className='text-xs text-white/60'>
                      Tap to review culinary selections
                    </span>
                  </div>
                </div>

                <div className='flex items-center space-x-1 font-bold'>
                  <span className='text-sm font-mono'>
                    ${getCartTotal().toFixed(2)}
                  </span>
                  <ChevronRight className='w-5 h-5' />
                </div>
              </button>
            </div>
          )}
        </>
      )}

      {/* Cart Sliding Drawer overlay */}
      <AnimatePresence>
        {isCartOpen && (
          <div
            id='cart-drawer-overlay'
            className='fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end'
          >
            {/* Click outside to close */}
            <div
              className='absolute inset-0'
              onClick={() => setIsCartOpen(false)}
            />

            {/* Drawer Container */}
            <motion.div
              id='cart-drawer'
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              className='bg-white w-full max-w-md h-full shadow-2xl relative flex flex-col z-10'
            >
              {/* Drawer Header */}
              <div className='p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
                <div className='flex items-center space-x-2'>
                  <ShoppingBag className='w-5 h-5 text-amber-600' />
                  <h3 className='text-md font-bold text-gray-900 font-sans'>
                    Dining Cart (Table {tableId})
                  </h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className='p-1.5 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer'
                >
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>

              {/* Drawer Content */}
              <div className='flex-1 overflow-y-auto p-4 space-y-6'>
                {/* Cart list */}
                <div className='space-y-3'>
                  {cart.map((c) => (
                    <div
                      key={c.item.id}
                      className='flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100'
                    >
                      <img
                        src={c.item.image}
                        alt={c.item.name}
                        referrerPolicy='no-referrer'
                        className='w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0'
                      />
                      <div className='flex-1'>
                        <div className='flex justify-between items-start'>
                          <h4 className='text-xs font-bold text-gray-900'>
                            {c.item.name}
                          </h4>
                          <span className='text-xs font-bold text-amber-700 font-mono'>
                            ${(c.item.price * c.quantity).toFixed(2)}
                          </span>
                        </div>
                        <div className='flex justify-between items-center mt-2'>
                          <span className='text-[10px] text-gray-400 font-mono'>
                            ${c.item.price.toFixed(2)} each
                          </span>

                          {/* Quantity selector */}
                          <div className='flex items-center space-x-2 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs'>
                            <button
                              onClick={() =>
                                handleUpdateQuantity(c.item.id, -1)
                              }
                              className='p-1 hover:bg-gray-100 rounded-sm text-gray-500 cursor-pointer'
                            >
                              <Minus className='w-3 h-3' />
                            </button>
                            <span className='text-xs font-bold w-4 text-center font-mono text-gray-800'>
                              {c.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(c.item.id, 1)}
                              className='p-1 hover:bg-gray-100 rounded-sm text-gray-500 cursor-pointer'
                            >
                              <Plus className='w-3 h-3' />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Special Instructions */}
                <div className='space-y-2'>
                  <label className='text-xs font-bold text-gray-700 block uppercase tracking-wider font-mono'>
                    Special Chef Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder='e.g. Medium-rare grill, allergy to dairy, extra dressing on side, no ice in drink.'
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    className='w-full text-xs p-3 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                  />
                </div>
              </div>

              {/* Drawer Footer with summary & checkout options */}
              <div className='p-4 border-t border-gray-100 bg-gray-50 space-y-4'>
                <div className='space-y-1.5'>
                  <div className='flex justify-between text-xs text-gray-500 font-mono'>
                    <span>Subtotal</span>
                    <span>${getCartTotal().toFixed(2)}</span>
                  </div>
                  {appliedVoucher && (
                    <div className='flex justify-between text-xs text-amber-700 font-mono font-bold'>
                      <span>Reward Applied ({appliedVoucher.code})</span>
                      <span>-${appliedVoucher.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className='flex justify-between text-xs text-gray-500 font-mono'>
                    <span>VAT & Table Service</span>
                    <span className='text-green-600 font-bold'>
                      FREE (QR Native)
                    </span>
                  </div>
                  <div className='flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200/50 pt-2 font-sans'>
                    <span>Grand Total</span>
                    <span className='font-mono text-amber-700 text-md'>
                      ${getCartTotalWithDiscount().toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-2 pt-1'>
                  <button
                    disabled={loadingCheckout}
                    onClick={() => setIsStripeOpen(true)}
                    className='bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer'
                  >
                    <CreditCard className='w-4 h-4' />
                    <span>Pay with Card</span>
                  </button>

                  <button
                    disabled={loadingCheckout}
                    onClick={handlePayAtCounter}
                    className='border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer'
                  >
                    <HandHelping className='w-4 h-4' />
                    <span>Pay at Counter</span>
                  </button>
                </div>

                <p className='text-[10px] text-center text-gray-400'>
                  By clicking, your table order is instantly pushed to our
                  kitchen via WebSockets.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stripe Payment Modal */}
      <StripeModal
        isOpen={isStripeOpen}
        onClose={() => setIsStripeOpen(false)}
        onSuccess={handlePaymentSuccess}
        amount={getCartTotalWithDiscount()}
      />

      {/* Option 1: Table Assistance Selector Modal */}
      <AnimatePresence>
        {isAssistanceModalOpen && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4'>
            <div
              className='absolute inset-0'
              onClick={() => setIsAssistanceModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm relative z-10 border border-gray-100'
            >
              <button
                onClick={() => setIsAssistanceModalOpen(false)}
                className='absolute right-4 top-4 p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer'
              >
                <X className='w-5 h-5 text-gray-400' />
              </button>

              <div className='text-center mb-6'>
                <span className='text-2xl'>🛎️</span>
                <h3 className='text-md font-bold text-gray-900 mt-2'>
                  Request Table Assistance
                </h3>
                <p className='text-xs text-gray-400 mt-1'>
                  Select what you need; our hosts will receive an instant push
                  notification.
                </p>
              </div>

              <div className='space-y-3'>
                {[
                  {
                    type: 'water',
                    label: 'Request Fresh Water 💧',
                    desc: 'Sourdough-infused or ice water',
                  },
                  {
                    type: 'napkins',
                    label: 'Request Tableware & Napkins 🍴',
                    desc: 'Extra plates, forks, or napkins',
                  },
                  {
                    type: 'waiter',
                    label: 'Call Server to Table 🙋‍♂️',
                    desc: 'Order queries or manual questions',
                  },
                  {
                    type: 'general',
                    label: 'General Help Assistance ❔',
                    desc: 'Technical issues or custom needs',
                  },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handleCallWaiter(opt.type as any)}
                    className='w-full text-left p-3 rounded-xl border border-gray-100 hover:border-amber-500 hover:bg-amber-50/30 transition-all cursor-pointer flex justify-between items-center group'
                  >
                    <div>
                      <h4 className='text-xs font-bold text-gray-800 group-hover:text-amber-800 transition-colors'>
                        {opt.label}
                      </h4>
                      <p className='text-[10px] text-gray-400 mt-0.5'>
                        {opt.desc}
                      </p>
                    </div>
                    <ChevronRight className='w-4 h-4 text-gray-300 group-hover:text-amber-600 transition-colors' />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Option 2: Loyalty Rewards Hub & Order History Modal */}
      <AnimatePresence>
        {isLoyaltyModalOpen && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4'>
            <div
              className='absolute inset-0'
              onClick={() => setIsLoyaltyModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]'
            >
              {/* Header */}
              <div className='bg-linear-to-r from-amber-600 to-amber-700 p-5 text-white relative'>
                <button
                  onClick={() => setIsLoyaltyModalOpen(false)}
                  className='absolute right-4 top-4 p-1 bg-black/10 hover:bg-black/20 rounded-full transition-colors cursor-pointer text-white'
                >
                  <X className='w-4 h-4' />
                </button>

                <div className='flex items-center gap-2'>
                  <Award className='w-5 h-5 text-amber-200' />
                  <span className='text-xs uppercase font-mono tracking-wider text-amber-200 font-bold'>
                    BiteFlow Member Hub
                  </span>
                </div>
                <h3 className='text-lg font-black tracking-tight mt-1'>
                  Gourmet Loyalty Portal
                </h3>

                <div className='mt-4 bg-white/10 p-3 rounded-xl flex justify-between items-center'>
                  <div>
                    <span className='text-[10px] text-white/70 block uppercase font-mono tracking-wide font-bold'>
                      Current Loyalty Balance
                    </span>
                    <span className='text-2xl font-black font-mono'>
                      {loyaltyPoints}{' '}
                      <span className='text-xs font-medium text-amber-200'>
                        Points
                      </span>
                    </span>
                  </div>
                  <div className='text-right'>
                    <span className='text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold'>
                      Gold Tier
                    </span>
                    <p className='text-[9px] text-white/60 mt-1'>
                      Earning $1 = 1 point
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable Hub Content */}
              <div className='flex-1 overflow-y-auto p-5 space-y-6'>
                {/* Rewards Store */}
                <div>
                  <h4 className='text-xs font-extrabold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-3'>
                    <Coins className='w-3.5 h-3.5 text-amber-600' />
                    <span>Redeemable Culinary Perks</span>
                  </h4>

                  <div className='grid grid-cols-1 gap-2.5'>
                    {[
                      {
                        code: 'BITE10PCT',
                        discount: 10,
                        cost: 50,
                        type: 'percent',
                        label: '10% Discount Coupon',
                        desc: 'Take 10% off your entire dining check.',
                      },
                      {
                        code: 'BITESAVE5',
                        discount: 5.0,
                        cost: 80,
                        type: 'flat',
                        label: '$5.00 Cash Coupon',
                        desc: 'Flat discount off any artisan main.',
                      },
                      {
                        code: 'FREELEMON',
                        discount: 5.0,
                        cost: 100,
                        type: 'flat',
                        label: 'Free Passionfruit Lemonade',
                        desc: 'Deduct the cost of our house special brew.',
                      },
                      {
                        code: 'BITESAVE15',
                        discount: 15.0,
                        cost: 180,
                        type: 'flat',
                        label: '$15.00 Executive Discount',
                        desc: 'Exclusive reward for dedicated foodies.',
                      },
                    ].map((perk) => {
                      const canAfford = loyaltyPoints >= perk.cost;
                      const isCurrentlyApplied =
                        appliedVoucher?.code === perk.code;

                      return (
                        <div
                          key={perk.code}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isCurrentlyApplied
                              ? 'border-amber-600 bg-amber-50/20 shadow-xs'
                              : canAfford
                                ? 'border-zinc-100 bg-white hover:border-amber-200'
                                : 'border-zinc-100 bg-zinc-50 opacity-60'
                          }`}
                        >
                          <div>
                            <div className='flex items-center gap-1.5'>
                              <h5 className='text-xs font-bold text-gray-900'>
                                {perk.label}
                              </h5>
                              {isCurrentlyApplied && (
                                <span className='text-[8px] bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded-sm'>
                                  APPLIED
                                </span>
                              )}
                            </div>
                            <p className='text-[10px] text-gray-500 mt-0.5'>
                              {perk.desc}
                            </p>
                            <span className='text-[9px] text-amber-700 font-bold font-mono mt-1 block'>
                              Cost: {perk.cost} Points
                            </span>
                          </div>

                          <button
                            disabled={!canAfford || isCurrentlyApplied}
                            onClick={() => {
                              // Deduct points
                              const nextPts = loyaltyPoints - perk.cost;
                              setLoyaltyPoints(nextPts);
                              localStorage.setItem(
                                `biteflow_loyalty_points_${tableId}`,
                                nextPts.toString(),
                              );

                              // Apply coupon
                              setAppliedVoucher({
                                code: perk.code,
                                discount: perk.discount,
                                type: perk.type as any,
                              });
                              alert(
                                `Successfully claimed! Voucher [${perk.code}] has been loaded to your cart!`,
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                              isCurrentlyApplied
                                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                : canAfford
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            <span>
                              {isCurrentlyApplied ? 'Applied' : 'Redeem'}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* History */}
                <div>
                  <h4 className='text-xs font-extrabold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-3'>
                    <History className='w-3.5 h-3.5 text-amber-600' />
                    <span>My Dining History (This Table)</span>
                  </h4>

                  {orderHistory.length === 0 ? (
                    <div className='text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200'>
                      <p className='text-[11px] text-zinc-500'>
                        No past orders in this session yet.
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      {orderHistory.map((hist, i) => (
                        <div
                          key={i}
                          className='bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-xs flex justify-between gap-3'
                        >
                          <div className='space-y-1'>
                            <div className='flex items-center gap-1.5'>
                              <span className='font-extrabold text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-sm font-mono'>
                                {hist.id}
                              </span>
                              <span className='text-[10px] text-zinc-400 font-mono'>
                                {hist.date}
                              </span>
                            </div>
                            <p className='text-[10px] text-zinc-600 font-sans line-clamp-1'>
                              {hist.items.join(', ')}
                            </p>
                          </div>
                          <div className='text-right shrink-0'>
                            <span className='font-bold text-amber-800 font-mono block'>
                              ${hist.total.toFixed(2)}
                            </span>
                            <span className='text-[9px] text-green-600 font-semibold font-mono'>
                              +{hist.pointsEarned} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Option 3: Culinary Details Modal */}
      <AnimatePresence>
        {selectedDish && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4'>
            <div
              className='absolute inset-0'
              onClick={() => setSelectedDish(null)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className='bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]'
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedDish(null)}
                className='absolute right-4 top-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white z-20 transition-all cursor-pointer shadow-xs'
              >
                <X className='w-4 h-4' />
              </button>

              {/* Photo Area */}
              <div className='h-48 w-full overflow-hidden relative bg-zinc-100 shrink-0'>
                <img
                  src={selectedDish.image}
                  alt={selectedDish.name}
                  referrerPolicy='no-referrer'
                  className='w-full h-full object-cover'
                />
                <div className='absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex items-end p-5'>
                  <div>
                    <span className='text-[9px] font-black uppercase tracking-wider text-amber-400 font-mono bg-black/40 px-2 py-0.5 rounded-sm'>
                      {selectedDish.category} station: {selectedDish.station}
                    </span>
                    <h3 className='text-lg font-black text-white mt-1'>
                      {selectedDish.name}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className='flex-1 overflow-y-auto p-5 space-y-5'>
                {/* Price and Base Desc */}
                <div className='flex justify-between items-start gap-4'>
                  <p className='text-xs text-gray-500 leading-relaxed font-sans flex-1'>
                    {selectedDish.description}
                  </p>
                  <span className='text-xl font-black text-amber-700 font-mono shrink-0'>
                    ${selectedDish.price.toFixed(2)}
                  </span>
                </div>

                {/* Nutrition Specs Card */}
                <div className='bg-zinc-50 border border-zinc-100 rounded-xl p-4'>
                  <h4 className='text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1'>
                    <TrendingUp className='w-3.5 h-3.5 text-amber-600' />
                    <span>Estimated Nutritional Specs</span>
                  </h4>
                  <div className='grid grid-cols-4 gap-2 mt-3 text-center'>
                    {[
                      {
                        label: 'Calories',
                        val: `${300 + ((parseInt(selectedDish.id.replace(/\D/g, '')) || 102) % 400)} kcal`,
                        pct: '30%',
                        color: 'bg-amber-600',
                      },
                      {
                        label: 'Protein',
                        val: `${10 + ((parseInt(selectedDish.id.replace(/\D/g, '')) || 15) % 30)}g`,
                        pct: '45%',
                        color: 'bg-indigo-600',
                      },
                      {
                        label: 'Carbs',
                        val: `${20 + ((parseInt(selectedDish.id.replace(/\D/g, '')) || 25) % 60)}g`,
                        pct: '25%',
                        color: 'bg-emerald-600',
                      },
                      {
                        label: 'Fats',
                        val: `${5 + ((parseInt(selectedDish.id.replace(/\D/g, '')) || 8) % 25)}g`,
                        pct: '15%',
                        color: 'bg-rose-600',
                      },
                    ].map((nut, idx) => (
                      <div
                        key={idx}
                        className='bg-white rounded-lg p-2 border border-zinc-100 shadow-xs'
                      >
                        <span className='text-[9px] text-zinc-400 block font-semibold'>
                          {nut.label}
                        </span>
                        <span className='text-xs font-bold text-zinc-800 font-mono mt-0.5 block'>
                          {nut.val}
                        </span>
                        <div className='w-full bg-zinc-100 h-1 rounded-full mt-1.5 overflow-hidden'>
                          <div
                            className={`h-full ${nut.color}`}
                            style={{ width: nut.pct }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allergen checklist */}
                <div>
                  <h4 className='text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1 mb-2'>
                    <Heart className='w-3.5 h-3.5 text-amber-600' />
                    <span>Culinary Allergen Indicators</span>
                  </h4>
                  <div className='flex flex-wrap gap-1.5'>
                    {[
                      {
                        check: selectedDish.tags?.some(
                          (t) =>
                            t.toLowerCase().includes('vegan') ||
                            t.toLowerCase().includes('veg'),
                        ),
                        yes: 'Vegetarian Friendly 🌱',
                      },
                      {
                        check:
                          !selectedDish.id.includes('dessert') &&
                          !selectedDish.id.includes('garlic'),
                        yes: 'Gluten-Free Available 🌾',
                      },
                      {
                        check:
                          !selectedDish.id.includes('risotto') &&
                          !selectedDish.id.includes('cheese'),
                        yes: 'Dairy-Free Option 🥛',
                      },
                      {
                        check: !selectedDish.id.includes('dessert'),
                        yes: 'Nut-Free Prepared 🥜',
                      },
                    ].map((allergen, idx) => {
                      if (!allergen.check) return null;
                      return (
                        <span
                          key={idx}
                          className='text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100'
                        >
                          {allergen.yes}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Chef preparation Insights */}
                <div>
                  <h4 className='text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-2'>
                    <Sparkles className='w-3.5 h-3.5 text-amber-600' />
                    <span>Chef's Artisanal Story & Prep Insights</span>
                  </h4>
                  <p className='text-[11px] text-zinc-500 leading-relaxed bg-zinc-50 border border-zinc-100 p-3 rounded-xl italic'>
                    {selectedDish.id.startsWith('ext-')
                      ? 'Imported dynamically from public culinary databases. Hand-finished with house oils and premium table seasoning.'
                      : 'Hand-kneaded, stone-baked, or slow-cooked in our custom-built wood-fired oven. Each ingredient is sourced locally from ecological organic farms within 25 miles.'}
                  </p>
                </div>
              </div>

              {/* Add to Bag action */}
              <div className='p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4 shrink-0'>
                <div>
                  <span className='text-[9px] text-zinc-400 block uppercase font-mono tracking-wider font-bold'>
                    Checkout Price
                  </span>
                  <span className='text-md font-black text-amber-700 font-mono'>
                    ${selectedDish.price.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleAddToBag(selectedDish);
                    setSelectedDish(null);
                  }}
                  className='bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span>Add To My Bag</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
