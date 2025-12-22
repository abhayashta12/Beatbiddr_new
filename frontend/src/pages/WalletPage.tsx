import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import WalletManagement from '../components/wallet/WalletManagement';
import type { Transaction } from '../types';

interface WalletPageProps {
  onNavigate: (path: string) => void;
}

const WalletPage: React.FC<WalletPageProps> = ({ onNavigate }) => {
  const [balance, setBalance] = useState(35);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 't1',
      type: 'deposit',
      amount: 50,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: 't2',
      type: 'tip',
      amount: 15,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
      recipient: 'DJ Spinz',
    },
  ]);

  const handleDeposit = (amount: number) => {
    // Add to balance
    setBalance(prev => prev + amount);
    
    // Add transaction record
    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'deposit',
      amount,
      timestamp: new Date().toISOString(),
    };
    
    setTransactions(prev => [newTransaction, ...prev]);
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar onNavigate={onNavigate} />
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