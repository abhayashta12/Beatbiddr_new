import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import WalletManagement from '../components/wallet/WalletManagement';
import type { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Balance — written only by the server (Stripe webhook / request endpoint)
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setBalance(snap.data().walletBalance ?? 0);
    });
  }, [user]);

  // Immutable server-written ledger
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'ledger'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) })));
    });
  }, [user]);

  return (
    <AppShell>
      <WalletManagement balance={balance} transactions={transactions} />
    </AppShell>
  );
};

export default WalletPage;
