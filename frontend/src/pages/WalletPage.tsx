import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import WalletManagement from '../components/wallet/WalletManagement';
import type { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setBalance(snap.data().walletBalance ?? 0);
        setTransactions(snap.data().transactions ?? []);
      }
    });
    return unsub;
  }, [user]);

  const handleDeposit = async (amount: number) => {
    if (!user) return;
    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'deposit',
      amount,
      timestamp: new Date().toISOString(),
    };
    const ref = doc(db, 'users', user.uid);
    await updateDoc(ref, {
      walletBalance: balance + amount,
      transactions: arrayUnion(newTransaction),
    });
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-12">
        <WalletManagement
          balance={balance}
          transactions={transactions}
          onDeposit={handleDeposit}
        />
      </div>
    </div>
  );
};

export default WalletPage;
