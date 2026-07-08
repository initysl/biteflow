import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Order } from '../types';

interface FoldingTicketProps {
  order: Order;
}

export default function FoldingTicket({ order }: FoldingTicketProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Simple mock barcode pattern
  const barcodeBars = Array.from({ length: 48 }, (_, i) => {
    const widths = [1, 2, 3, 4, 1.5, 2.5];
    const w = widths[i % widths.length];
    return (
      <div
        key={i}
        className='bg-zinc-800'
        style={{
          width: `${w}px`,
          height: '100%',
          opacity: i % 7 === 0 ? 0 : 0.95,
        }}
      />
    );
  });

  return (
    <div
      id='folding-ticket-container'
      className='py-6 flex flex-col items-center'
    >
      {/* Ticket Wrapper with 3D perspective */}
      <div
        id='folding-ticket-trigger'
        onClick={() => setIsOpen(!isOpen)}
        className='relative w-full max-w-sm cursor-pointer select-none group focus:outline-hidden'
        style={{ perspective: '1200px' }}
      >
        {/* PANEL 1: Top Stub (Anchor Panel) */}
        <div
          className='bg-white rounded-t-2xl border-t border-l border-r border-zinc-200/90 shadow-xs p-5 relative z-30 overflow-hidden'
          style={{
            backgroundImage:
              'radial-gradient(circle at 100% 100%, transparent 10px, white 10px), radial-gradient(circle at 0% 100%, transparent 10px, white 10px)',
            backgroundPosition: 'bottom left, bottom right',
            backgroundSize: '100% 20px',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Subtle paper grain texture overlay */}
          <div className='absolute inset-0 bg-linear-to-b from-zinc-50/20 to-transparent pointer-events-none' />

          {/* Table Badge & Order ID */}
          <div className='flex justify-between items-center mb-3'>
            <div className='flex items-center space-x-1.5'>
              <span className='bg-amber-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-sm tracking-wide font-mono'>
                TABLE {order.tableId}
              </span>
              <span className='text-[9px] text-zinc-400 font-bold font-mono'>
                #{order.id}
              </span>
            </div>

            <div className='flex items-center space-x-1'>
              <span
                className={`w-1.5 h-1.5 rounded-full ${order.status === 'paid' ? 'bg-purple-500' : 'bg-green-500'} animate-pulse`}
              />
              <span className='text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono'>
                {order.status}
              </span>
            </div>
          </div>

          <div className='flex justify-between items-end'>
            <div>
              <h3 className='text-sm font-black text-zinc-800 font-sans tracking-tight'>
                BiteFlow Fine Grills
              </h3>
              <p className='text-[10px] text-zinc-400 font-mono mt-0.5'>
                {new Date(order.createdAt).toLocaleDateString()} •{' '}
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div className='text-right'>
              <span className='text-[9px] text-zinc-400 font-mono block'>
                CLICK TO UNOLD
              </span>
              <motion.div
                animate={{ y: isOpen ? 0 : [0, 4, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: 'easeInOut',
                }}
                className='inline-block'
              >
                <ChevronDown
                  className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </motion.div>
            </div>
          </div>

          {/* Ticket jagged/cut separator guide */}
          <div className='absolute bottom-0 left-4 right-4 h-px border-b border-dashed border-zinc-300/80' />
        </div>

        {/* 3D COLLAPSIBLE ACCORDION FOLDS CONTAINER */}
        <div
          className='relative z-20'
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* PANEL 2: Middle Fold (Itemized culinary list) */}
          <motion.div
            initial={false}
            animate={{
              rotateX: isOpen ? 0 : -90,
              y: isOpen ? 0 : -10,
              z: isOpen ? 0 : -20,
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 140,
              damping: 18,
              mass: 1.1,
            }}
            className='bg-white border-l border-r border-zinc-200/90 p-5 relative overflow-hidden origin-top'
            style={{
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
              backgroundImage:
                'radial-gradient(circle at 100% 0%, transparent 10px, white 10px), radial-gradient(circle at 0% 0%, transparent 10px, white 10px), radial-gradient(circle at 100% 100%, transparent 10px, white 10px), radial-gradient(circle at 0% 100%, transparent 10px, white 10px)',
              backgroundPosition:
                'top left, top right, bottom left, bottom right',
              backgroundSize: '100% 20px',
              backgroundRepeat: 'no-repeat',
              boxShadow: isOpen ? '0 10px 25px -10px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {/* Soft Shading Layer to simulate paper shadow when folding */}
            <motion.div
              className='absolute inset-0 bg-black pointer-events-none z-10'
              animate={{ opacity: isOpen ? 0 : 0.45 }}
              transition={{ duration: 0.2 }}
            />

            {/* Ticket jagged separator guide (top) */}
            <div className='absolute top-0 left-4 right-4 h-px border-b border-dashed border-zinc-300/80' />

            <div className='space-y-4'>
              <span className='text-[9px] font-bold tracking-wider text-zinc-400 uppercase font-mono block'>
                ORDERED DELICACIES
              </span>

              <div className='space-y-2.5'>
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className='flex justify-between items-start text-xs'
                  >
                    <div className='text-zinc-700'>
                      <span className='font-bold'>{item.name}</span>
                      <span className='text-zinc-400 font-mono text-[10px] ml-1.5'>
                        x{item.quantity}
                      </span>
                    </div>
                    <span className='font-mono font-semibold text-zinc-600'>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {order.notes && (
                <div className='bg-amber-50/50 rounded-lg p-2.5 border border-amber-100/60 text-[10px] text-amber-950 leading-relaxed italic'>
                  "{order.notes}"
                </div>
              )}
            </div>

            {/* Ticket jagged separator guide (bottom) */}
            <div className='absolute bottom-0 left-4 right-4 h-px border-b border-dashed border-zinc-300/80' />
          </motion.div>

          {/* PANEL 3: Bottom Fold (Barcode & Receipt footer summary) */}
          <motion.div
            initial={false}
            animate={{
              rotateX: isOpen ? 0 : 90,
              y: isOpen ? 0 : -20,
              z: isOpen ? 0 : -40,
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 140,
              damping: 18,
              mass: 1.1,
              delay: isOpen ? 0.05 : 0,
            }}
            className='bg-white rounded-b-2xl border-b border-l border-r border-zinc-200/90 p-5 relative overflow-hidden origin-top'
            style={{
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
              backgroundImage:
                'radial-gradient(circle at 100% 0%, transparent 10px, white 10px), radial-gradient(circle at 0% 0%, transparent 10px, white 10px)',
              backgroundPosition: 'top left, top right',
              backgroundSize: '100% 20px',
              backgroundRepeat: 'no-repeat',
              boxShadow: isOpen ? '0 15px 30px -5px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {/* Shading Layer for Bottom panel crease */}
            <motion.div
              className='absolute inset-0 bg-black pointer-events-none z-10'
              animate={{ opacity: isOpen ? 0 : 0.6 }}
              transition={{ duration: 0.2 }}
            />

            {/* Ticket jagged separator guide (top) */}
            <div className='absolute top-0 left-4 right-4 h-px border-b border-dashed border-zinc-300/80' />

            <div className='space-y-4'>
              {/* Grand Total */}
              <div className='border-t border-zinc-100 pt-3 flex justify-between items-end'>
                <div>
                  <span className='text-[9px] font-bold text-zinc-400 font-mono block uppercase'>
                    PAYMENT (
                    {order.paymentMethod === 'stripe'
                      ? 'STRIPE CARD'
                      : 'COUNTER'}
                    )
                  </span>
                  <span
                    className={`text-[10px] font-bold ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'} font-mono uppercase`}
                  >
                    {order.paymentStatus === 'paid'
                      ? 'Paid & Settled'
                      : 'Pay at table/counter'}
                  </span>
                </div>

                <div className='text-right'>
                  <span className='text-[9px] text-zinc-400 font-mono block uppercase'>
                    GRAND TOTAL
                  </span>
                  <span className='text-xl font-black text-amber-700 font-mono'>
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Realistic Simulated Barcode */}
              <div className='pt-2 flex flex-col items-center space-y-1.5'>
                <div className='h-9 w-full flex items-stretch justify-center bg-zinc-50 border border-zinc-100/50 p-1 rounded-sm'>
                  {barcodeBars}
                </div>
                <span className='text-[8px] font-mono text-zinc-400 tracking-[0.25em] uppercase'>
                  *BITE-{order.id}-{order.tableId}*
                </span>
              </div>

              <div className='text-[9px] text-center text-zinc-400 font-mono'>
                Thank you for your delicious visit!
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
