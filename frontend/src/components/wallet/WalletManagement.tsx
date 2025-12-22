import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, CreditCard, History, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import type { Transaction } from '../../types';

interface WalletManagementProps {
  balance: number;
  transactions: Transaction[];
  onDeposit: (amount: number) => void;
}

const WalletManagement: React.FC<WalletManagementProps> = ({
  balance,
  transactions,
  onDeposit,
}) => {
  const [amount, setAmount] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'history'>('deposit');

  const handleDeposit = () => {
    if (amount <= 0) return;
    
    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      onDeposit(amount);
      setIsProcessing(false);
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    }, 1500);
  };

  const presetAmounts = [10, 20, 50, 100];

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-6 mb-8"
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <div className="bg-primary-500/20 rounded-full p-3 mr-4">
              <Wallet size={24} className="text-primary-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Your Wallet</h2>
              <p className="text-gray-400">Manage your funds</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Current Balance</p>
            <p className="text-3xl font-bold">${balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            className={`flex items-center px-4 py-3 font-medium text-sm ${
              activeTab === 'deposit'
                ? 'text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('deposit')}
          >
            <CreditCard size={16} className="mr-2" />
            Add Funds
          </button>
          <button
            className={`flex items-center px-4 py-3 font-medium text-sm ${
              activeTab === 'history'
                ? 'text-primary-400 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} className="mr-2" />
            Transaction History
          </button>
        </div>

        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {showSuccess ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-6 glass-card mb-6"
              >
                <CheckCircle size={40} className="text-neon-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Deposit Successful!</h3>
                <p className="text-gray-400">
                  ${amount.toFixed(2)} has been added to your wallet.
                </p>
              </motion.div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400">$</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input pl-8 w-full"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-8">
                  {presetAmounts.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`py-2 rounded-md transition-all duration-200 ${
                        amount === preset
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-300 text-gray-300 hover:bg-dark-200'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>

                <div className="glass-card p-4 mb-6">
                  <div className="flex justify-between mb-3">
                    <span className="text-gray-400">Amount</span>
                    <span>${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-3">
                    <span className="text-gray-400">Service Fee</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-white/10">
                    <span className="font-medium">Total</span>
                    <span className="font-medium">${amount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={amount <= 0 || isProcessing}
                  className={`w-full btn-primary flex items-center justify-center ${
                    amount <= 0 || isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="mr-2" />
                      Add ${amount.toFixed(2)} to Wallet
                    </>
                  )}
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {transactions.length === 0 ? (
              <div className="text-center p-8 glass-card">
                <History size={40} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">No transaction history yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your transactions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 glass-card"
                  >
                    <div className="flex items-center">
                      <div
                        className={`rounded-full p-2 mr-3 ${
                          transaction.type === 'deposit'
                            ? 'bg-neon-500/20 text-neon-400'
                            : transaction.type === 'withdrawal'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-primary-500/20 text-primary-400'
                        }`}
                      >
                        <CreditCard size={16} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {transaction.type === 'deposit'
                            ? 'Deposit'
                            : transaction.type === 'withdrawal'
                            ? 'Withdrawal'
                            : `Tip to ${transaction.recipient}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(transaction.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-medium ${
                        transaction.type === 'deposit'
                          ? 'text-neon-400'
                          : 'text-red-400'
                      }`}
                    >
                      {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default WalletManagement;