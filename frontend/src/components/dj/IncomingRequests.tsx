import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Music, DollarSign, Clock } from 'lucide-react';
import type { SongRequest } from '../../types';

interface IncomingRequestsProps {
  requests: SongRequest[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const IncomingRequests: React.FC<IncomingRequestsProps> = ({ 
  requests, 
  onAccept, 
  onReject 
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4 },
    },
  };

  // Filter only pending requests
  const pendingRequests = requests.filter(request => request.status === 'pending');

  // Sort by tip amount (highest first)
  const sortedRequests = [...pendingRequests].sort((a, b) => b.tipAmount - a.tipAmount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <div className="bg-accent-500/20 rounded-full p-2 mr-3">
            <Music size={20} className="text-accent-400" />
          </div>
          <h2 className="text-xl font-semibold">Incoming Requests</h2>
        </div>
        <div className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-sm font-medium">
          {sortedRequests.length} Pending
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="text-center py-10 glass-card">
          <Music size={40} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400">No song requests yet</p>
          <p className="text-sm text-gray-500 mt-1">Requests will appear here</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {sortedRequests.map((request) => (
            <motion.div
              key={request.id}
              variants={itemVariants}
              className="glass-card p-4 border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              <div className="flex">
                <img
                  src={request.song.albumCover}
                  alt={request.song.title}
                  className="w-16 h-16 object-cover rounded-md mr-4"
                />
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">{request.song.title}</h3>
                      <p className="text-sm text-gray-400">{request.song.artist}</p>
                      
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <Clock size={12} className="mr-1" />
                        <span>{new Date(request.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="mx-2">•</span>
                        <span>From: {request.requester.name}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center bg-primary-500/10 px-3 py-1 rounded-full">
                      <DollarSign size={14} className="text-primary-400 mr-1" />
                      <span className="text-sm font-medium">${request.tipAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => onAccept(request.id)}
                      className="flex items-center btn-neon py-1 px-3 text-sm"
                    >
                      <Check size={16} className="mr-1" />
                      Accept
                    </button>
                    
                    <button
                      onClick={() => onReject(request.id)}
                      className="flex items-center btn-ghost py-1 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <X size={16} className="mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Auto-accept requests above $20</span>
          <button className="text-primary-400 hover:text-primary-300 transition-colors duration-200">
            Change Settings
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default IncomingRequests;