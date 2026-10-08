import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Check } from 'lucide-react';
import {
  loadStripe,
  type Stripe,
  type PaymentRequest,
  type StripeCardElement,
} from '@stripe/stripe-js';
import type { Transaction } from '../../types';
import { auth } from '../../lib/firebase';

interface WalletManagementProps {
  balance: number;
  transactions: Transaction[];
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

// Mirrors the server's own limits in /api/create-payment-intent, which rejects
// anything outside this range.
const MIN_TOPUP = 1;
const MAX_TOPUP = 1000;
const PRESETS = [20, 50, 100, 200];

const WalletManagement: React.FC<WalletManagementProps> = ({ balance, transactions }) => {
  // Held as text so a half-typed value like "2." survives keystrokes
  const [amountText, setAmountText] = useState('20');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canPayNative, setCanPayNative] = useState<boolean | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const prButtonRef = useRef<HTMLDivElement>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    stripePromise.then((s) => {
      if (!cancelled) setStripe(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { amount, cents, valid, problem } = useMemo(() => {
    const parsed = Number.parseFloat(amountText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { amount: 0, cents: 0, valid: false, problem: null as string | null };
    }
    // Stripe works in whole cents
    const c = Math.round(parsed * 100);
    if (parsed < MIN_TOPUP) {
      return { amount: parsed, cents: c, valid: false, problem: `Minimum is $${MIN_TOPUP}.` };
    }
    if (parsed > MAX_TOPUP) {
      return {
        amount: parsed,
        cents: c,
        valid: false,
        problem: `Maximum is $${MAX_TOPUP.toLocaleString()} per top-up.`,
      };
    }
    return { amount: parsed, cents: c, valid: true, problem: null };
  }, [amountText]);

  const handleAmountChange = (raw: string) => {
    // Digits and a single decimal point, max two decimal places
    const cleaned = raw.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const next =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join('')}`
        : parts[1] !== undefined
        ? `${parts[0]}.${parts[1].slice(0, 2)}`
        : parts[0];
    setAmountText(next.slice(0, 8));
  };

  // Rebuild the payment request whenever a valid amount changes
  useEffect(() => {
    if (!valid) {
      setPaymentRequest(null);
      return;
    }

    let cancelled = false;
    let pr: PaymentRequest | null = null;

    stripePromise.then((stripe: Stripe | null) => {
      if (!stripe || cancelled) return;

      pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: { label: 'Add to BeatBiddr Wallet', amount: cents },
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
            body: JSON.stringify({ amount: cents }),
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
  }, [cents, valid]);

  /**
   * Card entry, mounted once and always present.
   *
   * Apple Pay and Google Pay only exist on some devices, and canMakePayment()
   * returns null on a desktop browser, an Android without Google Pay set up,
   * or an iPhone with no card in Wallet. Gating top-ups behind them meant
   * those people could not add money at all, so card entry is the baseline
   * and the native button is the shortcut layered on top.
   *
   * The fields live in Stripe's own iframe — card numbers never touch this
   * page or our server.
   */
  useEffect(() => {
    if (!stripe || !cardMountRef.current) return;

    const elements = stripe.elements();
    const card = elements.create('card', {
      style: {
        base: {
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '16px',
          '::placeholder': { color: '#6b7280' },
          iconColor: '#9ca3af',
        },
        invalid: { color: '#f87171', iconColor: '#f87171' },
      },
    });
    card.mount(cardMountRef.current);
    card.on('change', (event) => {
      setCardError(event.error?.message ?? null);
      setCardComplete(event.complete);
    });
    cardElementRef.current = card;

    return () => {
      card.off('change');
      card.unmount();
      card.destroy();
      cardElementRef.current = null;
    };
  }, [stripe]);

  const handleCardPay = async () => {
    const card = cardElementRef.current;
    if (!stripe || !card || !valid || isProcessing) return;

    setError(null);
    setIsProcessing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in.');

      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ amount: cents }),
      });
      const { clientSecret, error: serverError } = await res.json();

      if (serverError || !clientSecret) {
        setError(serverError ?? 'Payment could not be started.');
        return;
      }

      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });

      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed.');
        return;
      }

      // The webhook credits the wallet; the balance listener picks it up.
      card.clear();
      setCardComplete(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 6000);
    } catch {
      setError('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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
          <Check size={16} className="text-brand-500" />
          <span>Payment received — your balance updates in a moment.</span>
        </div>
      )}

      {error && <p className="mt-6 text-[13.5px] text-red-400 leading-relaxed">{error}</p>}

      <div className="rule mt-7" />

      {/* amount — the figure itself is the input */}
      <section className="pt-6">
        <p className="label">Add funds</p>

        <label htmlFor="topup-amount" className="sr-only">
          Amount to add, in dollars
        </label>
        <div
          className={`flex items-center justify-center gap-0.5 pt-5 pb-2 border-b-2 transition-colors ${
            problem ? 'border-red-500/70' : 'border-white/15 focus-within:border-brand-500'
          }`}
        >
          <span className="text-[26px] font-bold text-neutral-400 self-start mt-1.5">$</span>
          <input
            id="topup-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(e) => handleAmountChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-invalid={Boolean(problem)}
            className="bg-transparent border-0 outline-none text-center text-[52px] font-extrabold
                       tracking-[-0.05em] leading-none tnum w-[4.6ch] p-0 text-white"
          />
        </div>

        <p
          className={`text-center text-[12px] mt-2.5 ${
            problem ? 'text-red-400' : 'text-neutral-500'
          }`}
        >
          {problem ?? `Tap to change · $${MIN_TOPUP} – $${MAX_TOPUP.toLocaleString()}`}
        </p>

        <div className="grid grid-cols-4 gap-2 mt-5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmountText(String(preset))}
              className={`py-3.5 rounded-xl text-[15px] font-bold tnum transition-colors ${
                valid && amount === preset
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

        {/* Apple Pay / Google Pay when the device offers it — one tap, no typing */}
        {valid && canPayNative && (
          <div className={isProcessing ? 'opacity-50 pointer-events-none' : ''}>
            <div ref={prButtonRef} />
            <div className="flex items-center gap-3 my-5">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[11.5px] text-neutral-500">or pay with card</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
        )}

        {/* Card entry — always available, so no device is a dead end */}
        <div
          className={`rounded-xl border px-4 py-4 transition-colors ${
            cardError ? 'border-red-500/60' : 'border-white/12 focus-within:border-brand-500'
          }`}
        >
          <div ref={cardMountRef} />
        </div>

        {cardError && <p className="text-[12.5px] text-red-400 mt-2">{cardError}</p>}

        <button
          onClick={handleCardPay}
          disabled={!valid || !cardComplete || isProcessing || !stripe}
          className="btn-primary w-full mt-3 flex items-center justify-center disabled:opacity-40"
        >
          {isProcessing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : !stripe ? (
            'Loading payment…'
          ) : !valid ? (
            problem ? 'Choose a valid amount' : 'Enter an amount'
          ) : !cardComplete ? (
            'Enter your card details'
          ) : (
            `Add $${amount.toFixed(2)}`
          )}
        </button>

        <p className="text-[11.5px] text-neutral-500 mt-3 text-center leading-relaxed">
          Card details go straight to Stripe. BeatBiddr never sees or stores them.
        </p>
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
                className="flex items-baseline justify-between gap-4 py-3.5 border-b border-white/[0.08] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold truncate">
                    {t.type === 'deposit'
                      ? 'Added funds'
                      : t.type === 'refund'
                      ? `Refund · ${t.song?.title ?? 'request'}`
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
                {/* A refund is money coming back, so it reads as a credit. */}
                <span
                  className={`text-[14px] font-bold tnum shrink-0 ${
                    t.type === 'deposit' || t.type === 'refund' ? 'text-brand-500' : ''
                  }`}
                >
                  {t.type === 'deposit' || t.type === 'refund' ? '+' : '−'}$
                  {t.amount.toFixed(2)}
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
