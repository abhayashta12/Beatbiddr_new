import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import WalletManagement from '../components/wallet/WalletManagement';
import type { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Balance — written only by the server (Stripe webhook / request endpoint)
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setBalance(snap.data().walletBalance ?? 0);
      }
    });
    return unsub;
  }, [user]);

  // Immutable server-written ledger
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'ledger'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }))
      );
    });
    return unsub;
  }, [user]);

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-12">
        <WalletManagement balance={balance} transactions={transactions} />
      </div>
    </div>
  );
};

export default WalletPage;
