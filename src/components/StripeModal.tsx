import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, CheckCircle2, ShieldCheck, Loader2, X } from 'lucide-react';

interface StripeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (method: 'stripe' | 'counter') => void;
  amount: number;
}

export default function StripeModal({ isOpen, onClose, onSuccess, amount }: StripeModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('processing');
    
    // Simulate payment gateway delay
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => {
        onSuccess('stripe');
        onClose();
        setStatus('idle');
        setCardNumber('');
        setExpiry('');
        setCvv('');
        setName('');
      }, 1500);
    }, 2000);
  };

  const fillMockCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setExpiry('12/28');
    setCvv('421');
    setName('Alex Morgan');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="stripe-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            id="stripe-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
          >
            {/* Header */}
            <div className="bg-amber-600 text-white p-6 relative">
              <button 
                id="close-stripe-modal"
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                disabled={status === 'processing'}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-white/10 p-2 rounded-lg">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold font-sans">Secure Checkout</h3>
                  <p className="text-white/80 text-xs">Simulated Stripe Payment Gateway</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between items-end">
                <span className="text-xs text-white/70">AMOUNT TO PAY</span>
                <span className="text-2xl font-bold font-mono">${amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {status === 'processing' && (
                <div id="payment-processing" className="py-12 flex flex-col items-center justify-center space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Loader2 className="w-12 h-12 text-amber-600" />
                  </motion.div>
                  <p className="text-sm font-medium text-gray-700 animate-pulse">Contacting payment processors...</p>
                  <p className="text-xs text-gray-400">Securing your direct table transaction</p>
                </div>
              )}

              {status === 'success' && (
                <div id="payment-success" className="py-12 flex flex-col items-center justify-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.4 }}
                    className="bg-green-100 p-3 rounded-full"
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </motion.div>
                  <p className="text-lg font-bold text-gray-900 font-sans">Payment Authorized!</p>
                  <p className="text-xs text-gray-500">Receipt sent to table system</p>
                </div>
              )}

              {status === 'idle' && (
                <form id="payment-form" onSubmit={handlePay} className="space-y-4">
                  <div className="flex justify-between items-center bg-amber-50 rounded-lg p-3 text-xs text-amber-800 border border-amber-100">
                    <span className="font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Test credentials enabled
                    </span>
                    <button
                      type="button"
                      onClick={fillMockCard}
                      className="text-amber-700 underline font-bold hover:text-amber-800"
                    >
                      Autofill Demo Card
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CARDHOLDER NAME</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CARD NUMBER</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg pl-10 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                      <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">EXPIRY DATE</label>
                      <input
                        type="text"
                        required
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full text-sm text-center px-3 py-2 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">CVC / CVV</label>
                      <input
                        type="password"
                        required
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                        placeholder="•••"
                        maxLength={3}
                        className="w-full text-sm text-center px-3 py-2 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl hover:bg-amber-700 shadow-sm transition-colors text-sm mt-2"
                  >
                    Simulate Payment of ${amount.toFixed(2)}
                  </button>

                  <p className="text-[10px] text-center text-gray-400">
                    Your payments are securely processed in demo environment. No real funds will be charged.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
