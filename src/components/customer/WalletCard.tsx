import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Plus, CreditCard, Clock } from 'lucide-react';
import type { Transaction } from '../../types';

interface WalletCardProps {
  balance: number;
  recentTransactions: Transaction[];
}

const WalletCard: React.FC<WalletCardProps> = ({ balance, recentTransactions }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card p-6 relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-neon-500/5"></div>
      
      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="bg-primary-500/20 rounded-full p-2 mr-3">
              <Wallet size={20} className="text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold">Your Wallet</h2>
          </div>
          <button className="btn-ghost py-2 px-4 flex items-center text-sm">
            <Plus size={16} className="mr-1" />
            Add Funds
          </button>
        </div>
        
        {/* Balance */}
        <div className="mb-6 p-4 glass-card">
          <p className="text-gray-400 mb-1 text-sm">Current Balance</p>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold mr-2">${balance.toFixed(2)}</span>
            <span className="text-neon-400 text-sm">+ $0.00 pending</span>
          </div>
        </div>
        
        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Recent Transactions</h3>
            <button className="text-xs text-primary-400 hover:text-primary-300 flex items-center">
              View All <Clock size={12} className="ml-1" />
            </button>
          </div>
          
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 glass-card">
                <div className="flex items-center">
                  <div className={`rounded-full p-2 mr-3 ${
                    transaction.type === 'deposit' 
                      ? 'bg-neon-500/20 text-neon-400' 
                      : transaction.type === 'withdrawal'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-primary-500/20 text-primary-400'
                  }`}>
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {transaction.type === 'deposit'
                        ? 'Deposit'
                        : transaction.type === 'withdrawal'
                        ? 'Withdrawal'
                        : `Tip to ${transaction.recipient}`}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(transaction.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-medium ${
                  transaction.type === 'deposit' 
                    ? 'text-neon-400' 
                    : 'text-red-400'
                }`}>
                  {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WalletCard;