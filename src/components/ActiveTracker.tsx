import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  CheckCircle2,
  CookingPot,
  BellRing,
  HandHelping,
  CreditCard,
  RefreshCw,
  Users,
  FileText,
  ChevronDown,
  Check,
  Printer,
  Receipt,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Coins,
  Award,
  TrendingUp,
  QrCode,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import FoldingTicket from './FoldingTicket';

interface ActiveTrackerProps {
  order: Order;
  onOrderPaid: () => void;
  onClose: () => void;
}

const PIPELINE_STEPS: {
  status: OrderStatus;
  label: string;
  icon: any;
  color: string;
  desc: string;
}[] = [
  {
    status: 'pending',
    label: 'Sent to Kitchen',
    icon: Clock,
    color: 'amber',
    desc: 'Waiting for the chef to accept your order.',
  },
  {
    status: 'preparing',
    label: 'Preparing Dishes',
    icon: CookingPot,
    color: 'orange',
    desc: 'Our chefs are crafting your fresh order now.',
  },
  {
    status: 'ready',
    label: 'Ready for Service',
    icon: BellRing,
    color: 'green',
    desc: 'Your food is hot and plated! Service staff are on their way.',
  },
  {
    status: 'served',
    label: 'Served to Table',
    icon: HandHelping,
    color: 'blue',
    desc: 'Enjoy your meal! Let staff know if you need anything else.',
  },
  {
    status: 'paid',
    label: 'Paid & Completed',
    icon: CreditCard,
    color: 'purple',
    desc: 'Thank you for dining with us! Have a wonderful day.',
  },
];

export default function ActiveTracker({
  order: initialOrder,
  onOrderPaid,
  onClose,
}: ActiveTrackerProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Layout tabs
  const [activeTab, setActiveTab] = useState<'status' | 'billing'>('status');

  // Bill Splitting states (Phase 3)
  const [splitType, setSplitType] = useState<'single' | 'even' | 'itemized'>(
    'single',
  );
  const [numPeople, setNumPeople] = useState(2);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [billRequestSent, setBillRequestSent] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Sync initial order
  useEffect(() => {
    setOrder(initialOrder);
    if (initialOrder.billRequest?.requested) {
      setBillRequestSent(true);
      if (initialOrder.billRequest.type) {
        setSplitType(initialOrder.billRequest.type);
      }
      if (initialOrder.billRequest.numberOfPeople) {
        setNumPeople(initialOrder.billRequest.numberOfPeople);
      }
    }
  }, [initialOrder]);

  // Transition to billing tab automatically when order status changes to paid
  useEffect(() => {
    if (order.status === 'paid') {
      setActiveTab('billing');
    }
  }, [order.status]);

  // Connect to live updates via WebSockets (Phase 2 Real-Time Layer)
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
        socket?.send(
          JSON.stringify({
            type: 'register',
            role: 'table',
            tableId: order.tableId,
          }),
        );

        // Keep connection active with regular heartbeat pings
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

          if (
            (msg.type === 'order:update' || msg.type === 'order:placed') &&
            msg.order &&
            msg.order.id === order.id
          ) {
            setOrder(msg.order);
            if (msg.order.status === 'paid') {
              onOrderPaid();
            }
            if (msg.order.billRequest?.requested) {
              setBillRequestSent(true);
            } else {
              setBillRequestSent(false);
            }
          }
        } catch (err) {
          console.warn('Error processing live order update:', err);
        }
      };

      socket.onclose = () => {
        setConnected(false);
        setReconnecting(true);
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        reconnectTimeout = setTimeout(() => {
          connectWS();
        }, 3000);
      };

      socket.onerror = (err) => {
        console.warn(
          'ActiveTracker WebSocket notice (auto-reconnecting):',
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
  }, [order.id, order.tableId]);

  const currentStepIndex = PIPELINE_STEPS.findIndex(
    (step) => step.status === order.status,
  );

  // Calculate live overall percentage
  const getProgressPercentage = () => {
    if (currentStepIndex < 0) return 10;
    return Math.round(((currentStepIndex + 1) / PIPELINE_STEPS.length) * 100);
  };

  // Calculate customized total for itemized split
  const getItemizedTotal = () => {
    return order.items
      .filter((item) => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Toggle itemized select
  const toggleItemizedSelect = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  };

  // Handle Bill Request Submission to server
  const handleRequestBill = async () => {
    let finalAmount = order.total;
    if (splitType === 'even') {
      finalAmount = order.total / numPeople;
    } else if (splitType === 'itemized') {
      finalAmount = getItemizedTotal();
    }

    try {
      const res = await fetch(`/api/orders/${order.id}/request-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: splitType,
          numberOfPeople: numPeople,
          paidAmount: finalAmount,
        }),
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrder(updatedOrder);
        setBillRequestSent(true);
      }
    } catch (err) {
      console.error('Failed to request bill:', err);
    }
  };

  // Print Receipt handler
  const handlePrint = () => {
    window.print();
  };

  const activeStep = PIPELINE_STEPS[currentStepIndex] || PIPELINE_STEPS[0];
  const ActiveStepIcon = activeStep.icon;

  return (
    <div
      id='active-tracker-view'
      className='bg-white rounded-3xl border border-gray-100 p-5 w-full space-y-6'
    >
      {/* Dynamic App-Like Header */}
      <div className='flex flex-col gap-4'>
        <div className='flex justify-between items-center'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <h3 className='text-sm font-black text-gray-900 font-sans tracking-tight uppercase'>
                Live Culinary Tracker
              </h3>
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='text-[10px] font-mono text-zinc-400'>
                REFERENCE: #{order.id}
              </span>
              <span className='text-[9px] font-black text-amber-800 bg-amber-50 border border-amber-100/60 px-2 py-0.5 rounded-sm font-mono'>
                TABLE {order.tableId}
              </span>
            </div>
          </div>

          {/* Connection badge */}
          <div className='shrink-0'>
            {connected ? (
              <div className='flex items-center gap-1.5 bg-green-50 border border-green-100/50 px-2.5 py-1 rounded-full'>
                <span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
                <span className='text-[9px] text-green-700 font-black tracking-wider uppercase font-mono'>
                  Synced
                </span>
              </div>
            ) : reconnecting ? (
              <div className='flex items-center gap-1.5 bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded-full'>
                <RefreshCw className='w-2.5 h-2.5 text-amber-500 animate-spin' />
                <span className='text-[9px] text-amber-600 font-black tracking-wider uppercase font-mono'>
                  Retrying
                </span>
              </div>
            ) : (
              <div className='flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 px-2.5 py-1 rounded-full'>
                <span className='w-1.5 h-1.5 rounded-full bg-zinc-300' />
                <span className='text-[9px] text-zinc-400 font-black tracking-wider uppercase font-mono'>
                  Offline
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Tab Controls */}
      <div className='flex bg-zinc-50 p-1.5 rounded-2xl border border-zinc-200/30 gap-1'>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'status'
              ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100'
              : 'text-zinc-400 hover:text-zinc-700 hover:bg-white/40'
          }`}
        >
          <Clock
            className={`w-4 h-4 ${activeTab === 'status' ? 'text-amber-600' : 'text-zinc-400'}`}
          />
          <span>Kitchen Live Progress</span>
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100'
              : 'text-zinc-400 hover:text-zinc-700 hover:bg-white/40'
          }`}
        >
          <Receipt
            className={`w-4 h-4 ${activeTab === 'billing' ? 'text-amber-600' : 'text-zinc-400'}`}
          />
          <span>Pay & Split Bill</span>
        </button>
      </div>

      {/* Main Tabbed Content Panel with Animations */}
      <AnimatePresence mode='wait'>
        {activeTab === 'status' ? (
          <motion.div
            key='status-tab'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className='space-y-6'
          >
            {/* Side-by-Side Responsive Grid Layout */}
            <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
              {/* Left Column: Live Tracker Pipeline (Takes up 7/12 columns on large screens) */}
              <div className='lg:col-span-7 bg-zinc-50/40 rounded-2xl border border-zinc-100/80 p-5 space-y-5'>
                <div className='flex items-center justify-between border-b border-zinc-200/50 pb-3'>
                  <h4 className='text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono'>
                    Preparation Progress
                  </h4>
                  <span className='text-[8.5px] font-mono font-black text-amber-700 bg-amber-50 border border-amber-100/60 px-2 py-0.5 rounded-sm uppercase tracking-wider'>
                    Kitchen Live
                  </span>
                </div>

                <div id='tracker-pipeline' className='space-y-4 relative'>
                  {PIPELINE_STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isCompleted = idx < currentStepIndex;
                    const isActive = idx === currentStepIndex;

                    return (
                      <div
                        key={step.status}
                        className='flex gap-4 relative items-start'
                      >
                        {/* Connector Line */}
                        {idx < PIPELINE_STEPS.length - 1 && (
                          <div
                            className={`absolute left-5 top-10 w-0.5 h-12 -ml-px z-0 transition-colors duration-500 ${
                              idx < currentStepIndex
                                ? 'bg-amber-600'
                                : 'bg-zinc-100'
                            }`}
                          />
                        )}

                        {/* Step Circle */}
                        <div className='relative z-10 shrink-0'>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500 ${
                              isActive
                                ? 'bg-amber-600 border-amber-600 text-white shadow-md scale-110 ring-4 ring-amber-100'
                                : isCompleted
                                  ? 'bg-amber-50 border-amber-500 text-amber-600'
                                  : 'bg-white border-zinc-100 text-zinc-300'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className='w-5 h-5 shrink-0' />
                            ) : (
                              <StepIcon className='w-4 h-4 shrink-0' />
                            )}
                          </div>
                        </div>

                        {/* Step Text Details */}
                        <div className='flex-1 min-w-0 pt-1 pb-4'>
                          <div className='flex justify-between items-center gap-2'>
                            <h4
                              className={`text-xs font-bold transition-colors duration-300 ${
                                isActive
                                  ? 'text-zinc-900 font-extrabold'
                                  : isCompleted
                                    ? 'text-zinc-700'
                                    : 'text-zinc-400'
                              }`}
                            >
                              {step.label}
                            </h4>
                            {isActive && (
                              <span className='text-[8px] text-amber-700 font-bold bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-sm animate-pulse font-mono uppercase shrink-0'>
                                Current
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className='text-[10px] text-zinc-500 mt-1 leading-relaxed font-medium'
                            >
                              {step.desc}
                            </motion.p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Folding Ticket (Takes up 5/12 columns on large screens) */}
              <div className='lg:col-span-5 space-y-4'>
                <div className='flex items-center justify-between border-b border-zinc-100 pb-3'>
                  <h4 className='text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono'>
                    Order Ticket
                  </h4>
                  <span className='text-[9px] font-mono font-bold text-zinc-400'>
                    Digital Copy
                  </span>
                </div>

                <FoldingTicket order={order} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key='billing-tab'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className='space-y-6'
          >
            {order.status !== 'paid' ? (
              <div className='bg-zinc-50/50 rounded-2xl p-5 border border-zinc-200/40 space-y-5'>
                {/* Header title */}
                <div className='flex items-center justify-between border-b border-zinc-200/40 pb-3'>
                  <div className='flex items-center gap-2'>
                    <div className='p-1.5 rounded-lg bg-zinc-900 text-white shrink-0'>
                      <Users className='w-4 h-4' />
                    </div>
                    <div>
                      <h4 className='text-xs font-black text-zinc-800 uppercase tracking-wider font-sans'>
                        Payment & Bill Splitter
                      </h4>
                      <p className='text-[9px] text-zinc-400 font-mono mt-0.5'>
                        Select your preferred check distribution
                      </p>
                    </div>
                  </div>
                  <span className='text-xs font-black text-amber-700 font-mono bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-sm'>
                    Total: ${order.total.toFixed(2)}
                  </span>
                </div>

                {/* Split Type Selector Segment */}
                <div className='grid grid-cols-3 gap-1 bg-zinc-200/40 p-1 rounded-xl border border-zinc-200/10'>
                  {(['single', 'even', 'itemized'] as const).map((type) => (
                    <button
                      key={type}
                      disabled={billRequestSent}
                      onClick={() => setSplitType(type)}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                        splitType === type
                          ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100 font-extrabold'
                          : 'text-zinc-400 hover:text-zinc-700 disabled:opacity-40 font-bold'
                      }`}
                    >
                      {type === 'single'
                        ? 'Single Check'
                        : type === 'even'
                          ? 'Split Evenly'
                          : 'By Dishes'}
                    </button>
                  ))}
                </div>

                {/* Split Context dynamic viewport */}
                <AnimatePresence mode='wait'>
                  {splitType === 'even' && (
                    <motion.div
                      key='even-config'
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className='space-y-4 pt-1 overflow-hidden'
                    >
                      <div className='flex justify-between items-center bg-white border border-zinc-100 p-3 rounded-xl shadow-xs'>
                        <span className='text-xs font-bold text-zinc-600 font-sans'>
                          Number of Diners:
                        </span>
                        <div className='flex items-center gap-2'>
                          <button
                            disabled={numPeople <= 2 || billRequestSent}
                            onClick={() => setNumPeople((p) => p - 1)}
                            className='w-8 h-8 bg-zinc-50 hover:bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center text-xs font-black font-mono text-zinc-600 disabled:opacity-50 cursor-pointer transition-all'
                          >
                            -
                          </button>
                          <span className='text-xs font-black font-mono text-zinc-800 w-8 text-center bg-zinc-100/50 py-1.5 rounded-md'>
                            {numPeople}
                          </span>
                          <button
                            disabled={numPeople >= 20 || billRequestSent}
                            onClick={() => setNumPeople((p) => p + 1)}
                            className='w-8 h-8 bg-zinc-50 hover:bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center text-xs font-black font-mono text-zinc-600 disabled:opacity-50 cursor-pointer transition-all'
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className='bg-amber-50/50 border border-amber-100 p-3 rounded-xl flex justify-between items-center shadow-xs'>
                        <div className='flex items-center gap-2'>
                          <TrendingUp className='w-4 h-4 text-amber-700' />
                          <span className='text-[10px] font-black text-amber-900 uppercase tracking-wider font-mono'>
                            Diner Share
                          </span>
                        </div>
                        <span className='text-md font-black font-mono text-amber-700'>
                          ${(order.total / numPeople).toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {splitType === 'itemized' && (
                    <motion.div
                      key='itemized-config'
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className='space-y-3 pt-1 overflow-hidden'
                    >
                      <div className='bg-white border border-zinc-100 p-2.5 rounded-xl'>
                        <p className='text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider text-center'>
                          Select the dishes you enjoyed
                        </p>
                      </div>

                      <div className='space-y-1.5 max-h-48 overflow-y-auto pr-1'>
                        {order.items.map((item) => {
                          const isSelected = selectedItemIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() =>
                                !billRequestSent &&
                                toggleItemizedSelect(item.id)
                              }
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-50/30 border-amber-400/60 shadow-xs'
                                  : 'bg-white border-zinc-100 hover:border-zinc-200 shadow-2xs'
                              }`}
                            >
                              <div className='flex items-center space-x-2.5 min-w-0'>
                                <div
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-amber-600 border-amber-600 text-white'
                                      : 'border-zinc-300 bg-zinc-50'
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className='w-3 h-3 stroke-3' />
                                  )}
                                </div>
                                <span className='text-xs text-zinc-700 font-extrabold truncate'>
                                  {item.name}{' '}
                                  <span className='text-zinc-400 font-mono font-medium text-[9px]'>
                                    x{item.quantity}
                                  </span>
                                </span>
                              </div>
                              <span className='text-xs font-mono font-bold text-zinc-600 shrink-0'>
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className='bg-amber-50/50 border border-amber-100 p-3 rounded-xl flex justify-between items-center shadow-xs'>
                        <div className='flex items-center gap-2'>
                          <TrendingUp className='w-4 h-4 text-amber-700' />
                          <span className='text-[10px] font-black text-amber-900 uppercase tracking-wider font-mono'>
                            My Computed Share
                          </span>
                        </div>
                        <span className='text-md font-black font-mono text-amber-700'>
                          ${getItemizedTotal().toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {splitType === 'single' && (
                    <motion.div
                      key='single-config'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className='bg-white border border-zinc-100 p-4 rounded-xl shadow-xs space-y-2 text-xs font-mono text-zinc-500'
                    >
                      <div className='flex justify-between'>
                        <span>Table Check Subtotal</span>
                        <span className='font-bold text-zinc-700'>
                          ${order.total.toFixed(2)}
                        </span>
                      </div>
                      <div className='flex justify-between border-t border-zinc-100 pt-2 font-sans font-bold text-zinc-800'>
                        <span>Grand Settle Amount</span>
                        <span className='font-mono text-amber-700 font-black'>
                          ${order.total.toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary billing actions */}
                {billRequestSent ? (
                  <div className='p-4 bg-amber-50/80 border border-amber-200/60 rounded-xl text-center space-y-1.5 shadow-xs animate-pulse'>
                    <p className='text-xs font-black text-amber-950 flex items-center justify-center gap-1.5'>
                      <RefreshCw className='w-3.5 h-3.5 text-amber-600 animate-spin' />
                      SERVICE STAFF DISPATCHED
                    </p>
                    <p className='text-[10px] text-amber-900/80 leading-relaxed font-medium'>
                      Host has received your request and is bringing the card
                      reader to table. Split method locked:{' '}
                      <span className='font-mono font-black uppercase text-amber-950'>
                        {splitType === 'single'
                          ? 'Single check'
                          : splitType === 'even'
                            ? `Evenly Split (x${numPeople})`
                            : 'Itemized dishes'}
                      </span>
                      .
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleRequestBill}
                    className='mx-auto w-80 bg-zinc-900 hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.99] text-white font-extrabold py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer'
                  >
                    <Receipt className='w-4 h-4' />
                    <span>Request Waiter & Settle Table</span>
                  </button>
                )}
              </div>
            ) : (
              // PAID CELEBRATION BLOCK
              <div className='space-y-6'>
                <div className='bg-emerald-50 rounded-2xl p-5 border border-emerald-100/60 space-y-3 text-center shadow-xs'>
                  <div className='inline-flex bg-emerald-100 p-2.5 rounded-full text-emerald-600 mb-1'>
                    <CheckCircle2 className='w-6 h-6 animate-bounce' />
                  </div>
                  <div>
                    <h4 className='text-sm font-black text-emerald-900 font-sans uppercase'>
                      Settle Transaction Successful
                    </h4>
                    <p className='text-[11px] text-emerald-800/80 mt-1 leading-relaxed max-w-sm mx-auto'>
                      Thank you for dining! Your check is settled. An official
                      digital receipt has been stamped for Table {order.tableId}
                      .
                    </p>
                  </div>

                  <div className='flex gap-2 justify-center pt-2'>
                    <button
                      onClick={() => setShowReceipt(true)}
                      className='bg-white border border-emerald-200/80 text-emerald-950 font-black px-4 py-2.5 rounded-xl text-[10px] tracking-wider uppercase flex items-center gap-1.5 hover:bg-emerald-100/50 transition-all cursor-pointer shadow-2xs'
                    >
                      <FileText className='w-3.5 h-3.5 text-emerald-600' />
                      <span>Display Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Inline Thermal Receipt */}
                <div className='relative bg-[#fafaf6] border border-zinc-200/80 rounded-2xl p-6 font-mono text-zinc-800 text-xs shadow-md mx-auto max-w-sm space-y-4'>
                  {/* Decorative Jagged Top line */}
                  <div className='absolute top-0 left-0 right-0 h-1 border-t border-dashed border-zinc-400' />

                  {/* Brand header */}
                  <div className='text-center space-y-1 pt-1'>
                    <div className='inline-flex bg-zinc-950 text-white p-1 rounded-md'>
                      <QrCode className='w-4 h-4' />
                    </div>
                    <h3 className='text-xs font-black tracking-tight text-zinc-950 uppercase font-sans'>
                      BiteFlow QR Bistro
                    </h3>
                    <p className='text-[9px] text-zinc-400 font-mono'>
                      128 Fine Sourdough Ave, London
                    </p>
                    <p className='text-[9px] text-zinc-400 font-mono'>
                      Tel: +44 20 7946 0912
                    </p>
                  </div>

                  {/* Divider line */}
                  <div className='border-t border-dashed border-zinc-200/80 my-3' />

                  {/* Meta Details */}
                  <div className='grid grid-cols-2 gap-y-1 text-[9px] text-zinc-500 uppercase font-mono'>
                    <div>
                      TABLE ID:{' '}
                      <span className='font-bold text-zinc-800'>
                        #{order.tableId}
                      </span>
                    </div>
                    <div className='text-right'>
                      DATE:{' '}
                      <span className='font-bold text-zinc-800'>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      REFERENCE:{' '}
                      <span className='font-bold text-zinc-800'>
                        {order.id}
                      </span>
                    </div>
                    <div className='text-right'>
                      TIME:{' '}
                      <span className='font-bold text-zinc-800'>
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className='border-t border-dashed border-zinc-200/80 my-3' />

                  {/* Item block */}
                  <div className='space-y-2'>
                    <span className='text-[8px] font-black text-zinc-400 uppercase tracking-widest block font-mono'>
                      Purchased Delicacies
                    </span>
                    <div className='space-y-1.5'>
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className='flex justify-between items-start text-[11px] font-mono'
                        >
                          <div className='text-zinc-700 max-w-[70%] truncate'>
                            <span>{item.name}</span>
                            <span className='text-zinc-400 ml-1.5 text-[9px]'>
                              x{item.quantity}
                            </span>
                          </div>
                          <span className='font-bold text-zinc-900'>
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className='border-t border-dashed border-zinc-200/80 my-3' />

                  {/* Total break */}
                  <div className='space-y-1 text-[11px] font-mono text-zinc-500'>
                    <div className='flex justify-between'>
                      <span>Subtotal</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>VAT Taxes (20%)</span>
                      <span>Included</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Table Service Fee</span>
                      <span className='text-emerald-600 font-bold'>
                        COMPLIMENTARY
                      </span>
                    </div>
                    <div className='flex justify-between text-xs font-black border-t border-dashed border-zinc-200 pt-2 text-zinc-950'>
                      <span>GRAND TOTAL PAID</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className='border-t border-dashed border-zinc-200/80 my-3' />

                  {/* Card authorization stamp */}
                  <div className='bg-zinc-100 p-2.5 rounded-lg text-center space-y-0.5 font-mono text-[8px] text-zinc-400'>
                    <p className='font-bold text-zinc-600'>
                      CARD TRANS AUTHORIZATION APPROVED
                    </p>
                    <p>
                      GATEWAY:{' '}
                      {order.paymentMethod === 'stripe'
                        ? 'ONLINE SECURE STRIPE'
                        : 'COUNTER MANUAL'}
                    </p>
                    <p>TRANS AUTH REF: BITE_TX_{order.id}</p>
                  </div>

                  <div className='text-center text-[9px] text-zinc-400 font-mono italic pt-1'>
                    Thank you! Visit biteflow.menu/review
                  </div>

                  {/* Jagged bottom border */}
                  <div className='absolute bottom-0 left-0 right-0 h-1 border-b border-dashed border-zinc-400' />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Settle Actions / Back Controls */}
      <div className='flex gap-3 pt-3 border-t border-zinc-100'>
        <button
          onClick={onClose}
          className='w-80 mx-auto border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-extrabold py-3 rounded-xl transition-all text-xs cursor-pointer font-sans'
        >
          {order.status === 'paid'
            ? 'Exit To Main Menu'
            : 'Keep Browsing Dishes'}
        </button>
      </div>

      {/* HIGH-FIDELITY PRINTABLE RECEIPT MODAL OVERLAY (FOR STANDARD PAPER PRINTOUT) */}
      <AnimatePresence>
        {showReceipt && (
          <div className='fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4'>
            <div
              className='absolute inset-0'
              onClick={() => setShowReceipt(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border border-zinc-100 z-10 text-zinc-800 flex flex-col max-h-[85vh] print:fixed print:inset-0 print:bg-white print:text-black print:z-50 print:p-8 print:shadow-none print:border-none print:overflow-visible'
            >
              {/* Receipt Body with print optimization identifier */}
              <div
                className='overflow-y-auto p-1 space-y-5'
                id='printable-receipt-element'
              >
                {/* Brand and Header */}
                <div className='text-center space-y-1'>
                  <div className='inline-flex bg-zinc-950 text-white p-1.5 rounded-lg mb-1'>
                    <Receipt className='w-5 h-5' />
                  </div>
                  <h3 className='text-md font-black tracking-tight text-zinc-900 uppercase'>
                    BiteFlow QR Bistro
                  </h3>
                  <p className='text-[10px] text-zinc-400 font-mono'>
                    128 Fine Sourdough Ave, London
                  </p>
                  <p className='text-[10px] text-zinc-400 font-mono'>
                    Tel: +44 20 7946 0912
                  </p>
                </div>

                {/* Meta details */}
                <div className='border-t border-b border-dashed border-zinc-200 py-3 text-[10px] font-mono grid grid-cols-2 gap-y-1.5 text-zinc-500'>
                  <div>
                    TABLE:{' '}
                    <span className='font-bold text-zinc-800'>
                      #{order.tableId}
                    </span>
                  </div>
                  <div className='text-right'>
                    DATE:{' '}
                    <span className='font-bold text-zinc-800'>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    ORDER REF:{' '}
                    <span className='font-bold text-zinc-800'>{order.id}</span>
                  </div>
                  <div className='text-right'>
                    TIME:{' '}
                    <span className='font-bold text-zinc-800'>
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className='space-y-2.5'>
                  <span className='text-[9px] font-bold text-zinc-400 uppercase tracking-wider block font-mono'>
                    Receipt Items
                  </span>
                  <div className='space-y-2'>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className='flex justify-between items-start text-xs font-mono'
                      >
                        <div className='text-zinc-700'>
                          <span>{item.name}</span>
                          <span className='text-zinc-400 ml-1.5'>
                            x{item.quantity}
                          </span>
                        </div>
                        <span className='font-bold text-zinc-800'>
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className='border-t border-zinc-100 pt-3 space-y-1.5 text-xs font-mono'>
                  <div className='flex justify-between text-zinc-500'>
                    <span>Subtotal</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                  <div className='flex justify-between text-zinc-500'>
                    <span>VAT (20%)</span>
                    <span>Included</span>
                  </div>
                  <div className='flex justify-between text-zinc-500'>
                    <span>Service Charge</span>
                    <span className='text-emerald-600 font-bold font-sans'>
                      FREE
                    </span>
                  </div>
                  <div className='flex justify-between text-sm font-black border-t border-dashed border-zinc-200 pt-2 text-zinc-900'>
                    <span>GRAND TOTAL</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Auth Info */}
                <div className='bg-zinc-50 p-2.5 rounded-lg text-center space-y-0.5 border border-zinc-100 font-mono text-[9px] text-zinc-400'>
                  <p className='font-bold text-zinc-600'>
                    CARD AUTHENTICATION SUCCESSFUL
                  </p>
                  <p>
                    METHOD:{' '}
                    {order.paymentMethod === 'stripe'
                      ? 'ONLINE SECURE STRIPE'
                      : 'COUNTER SETTLED'}
                  </p>
                  <p>TRANSACTION REF: STRIPE_TX_{order.id}</p>
                </div>

                <div className='text-center text-[10px] text-zinc-400 font-mono italic pt-2'>
                  Thank you for dining! Visit biteflow.menu/review
                </div>
              </div>

              {/* Print and Close controls */}
              <div className='mt-5 pt-4 border-t border-zinc-100 flex gap-2 print:hidden'>
                <button
                  onClick={handlePrint}
                  className='flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer'
                >
                  <Printer className='w-4 h-4' />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className='border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer'
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
