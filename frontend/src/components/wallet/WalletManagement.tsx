import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Smartphone, Check } from 'lucide-react';
import { loadStripe, Stripe, PaymentRequest } from '@stripe/stripe-js';
import type { Transaction } from '../../types';
import { auth } from '../../lib/firebase';

interface WalletManagementProps {
  balance: number;
  transactions: Transaction[];
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);
const PRESETS = [10, 20, 50, 100];

const WalletManagement: React.FC<WalletManagementProps> = ({ balance, transactions }) => {
  const [amount, setAmount] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canPayNative, setCanPayNative] = useState<boolean | null>(null);
  const prButtonRef = useRef<HTMLDivElement>(null);

  // Rebuild the payment request whenever the amount changes
  useEffect(() => {
    let cancelled = false;
    let pr: PaymentRequest | null = null;

    stripePromise.then((stripe: Stripe | null) => {
      if (!stripe || cancelled) return;

      pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: { label: 'Add to BeatBiddr Wallet', amount: amount * 100 },
        requestPayerName: false,
        requestPayerEmail: false,
      });

      pr.canMakePayment().then((result) => {
        if (cancelled) return;
        setCanPayNative(Boolean(result));
        setPaymentRequest(result ? pr : null);
      });

      pr.on('paymentmethod', async (event) => {
        setError(null);
        setIsProcessing(true);
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error('Not signed in.');

          const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ amount: amount * 100 }),
          });
          const { clientSecret, error: serverError } = await res.json();

          if (serverError || !clientSecret) {
            event.complete('fail');
            setError(serverError ?? 'Payment could not be started.');
            return;
          }

          const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: event.paymentMethod.id,
          });

          if (confirmError) {
            event.complete('fail');
            setError(confirmError.message ?? 'Payment failed.');
          } else {
            event.complete('success');
            // The Stripe webhook credits the wallet; the balance listener
            // reflects it within a few seconds.
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 6000);
          }
        } catch {
          event.complete('fail');
          setError('Payment failed. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      });
    });

    return () => {
      cancelled = true;
      pr?.off('paymentmethod');
    };
  }, [amount]);

  // Mount Stripe's own button
  useEffect(() => {
    if (!paymentRequest || !prButtonRef.current) return;
    stripePromise.then((stripe) => {
      if (!stripe || !prButtonRef.current) return;
      prButtonRef.current.innerHTML = '';
      const elements = stripe.elements();
      elements
        .create('paymentRequestButton', {
          paymentRequest,
          style: { paymentRequestButton: { theme: 'light', height: '54px' } },
        })
        .mount(prButtonRef.current);
    });
  }, [paymentRequest]);

  return (
    <div className="px-6 pt-6 pb-8 flex flex-col min-h-full">
      <header>
        <p className="label">Balance</p>
        <p className="text-[46px] font-extrabold tracking-[-0.045em] leading-none mt-2 tnum text-brand-500">
          ${balance.toFixed(2)}
        </p>
      </header>

      {showSuccess && (
        <div className="flex items-center gap-2.5 mt-6 text-[13.5px]">
          <Check size={16} />
          <span>Payment received — your balance updates in a moment.</span>
        </div>
      )}

      {error && (
        <p className="mt-6 text-[13.5px] text-red-400 leading-relaxed">{error}</p>
      )}

      <div className="rule mt-7" />

      {/* amount */}
      <section className="pt-6">
        <p className="label mb-3">Add funds</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-3.5 rounded-xl text-[15px] font-bold tnum transition-colors ${
                amount === preset
                  ? 'bg-brand-500 text-brand-ink'
                  : 'border border-white/12 text-neutral-400 hover:text-white'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </section>

      {/* pay */}
      <section className="mt-6">
        {isProcessing && (
          <p className="flex items-center justify-center gap-2 text-[13.5px] muted mb-3">
            <Loader2 size={15} className="animate-spin" />
            Processing…
          </p>
        )}

        {canPayNative && (
          <div className={isProcessing ? 'opacity-50 pointer-events-none' : ''}>
            <div ref={prButtonRef} />
          </div>
        )}

        {canPayNative === false && (
          <div className="py-8 text-center">
            <Smartphone size={26} className="mx-auto text-neutral-600 mb-3" />
            <p className="text-[14.5px] font-semibold">Apple Pay or Google Pay needed</p>
            <p className="text-[13px] muted mt-1.5 max-w-[34ch] mx-auto leading-relaxed">
              Open BeatBiddr in Safari on iPhone, or Chrome with a saved card, to add funds.
            </p>
          </div>
        )}
      </section>

      {/* history */}
      <section className="mt-10">
        <p className="label mb-3">Activity</p>
        {transactions.length === 0 ? (
          <p className="text-[13.5px] muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-baseline justify-between gap-4 py-3.5 border-b border-white/[0.06] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold truncate">
                    {t.type === 'deposit'
                      ? 'Added funds'
                      : t.song
                      ? t.song.title
                      : 'Tip'}
                  </p>
                  <p className="text-[12px] muted">
                    {new Date(t.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-[14px] font-bold tnum shrink-0">
                  {t.type === 'deposit' ? '+' : '−'}${t.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default WalletManagement;
