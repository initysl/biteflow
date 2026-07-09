import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Utensils,
  ChefHat,
  ToggleLeft,
  ArrowRight,
  TableProperties,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import CustomerMenu from './components/CustomerMenu';
import StaffDashboard from './components/StaffDashboard';
import Splashscreen from './components/Splashscreen';

export default function App() {
  // Splash Screen completed flag
  const [splashComplete, setSplashComplete] = useState(false);

  // Read table number from URL query parameter e.g. ?table=3
  const [tableId, setTableId] = useState('1');
  const [role, setRole] = useState<'customer' | 'staff'>('customer');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      setTableId(tableParam);
    }
  }, []);

  // Sync manual table changes to URL for realistic simulation
  const handleTableChange = (newTableId: string) => {
    setTableId(newTableId);
    const newUrl = `${window.location.pathname}?table=${newTableId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  return (
    <>
      <AnimatePresence mode='wait'>
        {!splashComplete && (
          <Splashscreen onComplete={() => setSplashComplete(true)} />
        )}
      </AnimatePresence>

      {splashComplete && (
        <motion.div
          id='app-root'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className='min-h-screen bg-neutral-50/50 text-neutral-800 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900'
        >
          {/* Top Navigation & Role Switcher */}
          <header
            id='app-header'
            className='sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 shadow-xs'
          >
            <div className='max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center'>
              {/* Logo Brand */}
              <div className='flex items-center space-x-2'>
                <div className='bg-amber-600 text-white p-1.5 rounded-lg'>
                  <Utensils className='w-5 h-5' />
                </div>
                <div>
                  <h1 className='hidden sm:flex items-center gap-1 text-sm font-black tracking-tight text-gray-900 font-changa'>
                    BiteFlow
                  </h1>
                </div>
              </div>

              {/* Demonstration Mode switcher */}
              <div className='flex items-center space-x-2 bg-gray-100/80 p-1 rounded-xl border border-gray-200/50'>
                <button
                  onClick={() => setRole('customer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    role === 'customer'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Utensils className='w-3.5 h-3.5' />
                  <span className='hidden sm:flex'>Customer View</span>
                </button>
                <button
                  onClick={() => setRole('staff')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    role === 'staff'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ChefHat className='w-3.5 h-3.5' />
                  <span className='hidden sm:flex'>Staff Console</span>
                </button>
              </div>

              {/* Active Customer Table Info (If in customer mode) */}
              <div className='sm:flex items-center space-x-2 text-xs font-mono'>
                {role === 'customer' && (
                  <div className='flex items-center space-x-2'>
                    <select
                      value={tableId}
                      onChange={(e) => handleTableChange(e.target.value)}
                      className='bg-white border border-gray-200 rounded-lg px-2.5 py-1 font-bold text-amber-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20'
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8'].map((num) => (
                        <option key={num} value={num}>
                          Table {num}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main
            id='app-main-content'
            className='flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8'
          >
            {/* Helper Instructions Bar for simulation review */}
            {/* <div id="demo-guide" className="mb-6 bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-xs text-amber-950 flex items-start space-x-3 shadow-xs">
              <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 font-sans">
                <p className="font-bold">How to test this real-time system:</p>
                <ul className="list-disc pl-4 space-y-1 text-amber-900/80 leading-relaxed">
                  <li>
                    <strong>Step 1</strong>: Open <strong>Customer View</strong> (simulate seated customer on Table {tableId}). Add gourmet dishes to your bag and submit with "Pay with Card" or "Pay at Counter".
                  </li>
                  <li>
                    <strong>Step 2</strong>: Toggle to <strong>Staff Console</strong> to see your order arrive in real-time via WebSockets under "Pending". Click "Prepare", "Ready", etc., to transition it through the pipeline.
                  </li>
                  <li>
                    <strong>Step 3</strong>: Toggle back to <strong>Customer View</strong> (or open a split-screen/new tab) and notice the customer's Live Tracker automatically reflects the status changes instantly!
                  </li>
                </ul>
              </div>
            </div> */}

            <AnimatePresence mode='wait'>
              <motion.div
                key={role + (role === 'customer' ? `-${tableId}` : '')}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className='w-full'
              >
                {role === 'customer' ? (
                  <CustomerMenu tableId={tableId} />
                ) : (
                  <StaffDashboard />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Clean Human-Centered Footer */}
          <footer
            id='app-footer'
            className='space-y-2 bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 shrink-0 mt-12 font-sans'
          >
            <p>Fresh gourmet dining experiences</p>
            <p>© 2026 BiteFlow. All rights reserved.</p>
          </footer>
        </motion.div>
      )}
    </>
  );
}
