import React from 'react';
import { motion } from 'framer-motion';
import { Music, Clock, Users, DollarSign, Headphones } from 'lucide-react';
import IncomingRequests from './IncomingRequests';
import type { SongRequest } from '../../types';

interface DJDashboardProps {
  earnings: number;
  totalRequests: number;
  pendingRequests: SongRequest[];
  acceptedRequests: SongRequest[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const DJDashboard: React.FC<DJDashboardProps> = ({
  earnings,
  totalRequests,
  pendingRequests,
  acceptedRequests,
  onAccept,
  onReject,
}) => {
  // Stats
  const stats = [
    {
      icon: <DollarSign size={20} className="text-neon-400" />,
      label: 'Tonight\'s Earnings',
      value: `$${earnings.toFixed(2)}`,
      bgColor: 'bg-neon-500/10',
    },
    {
      icon: <Music size={20} className="text-primary-400" />,
      label: 'Total Requests',
      value: totalRequests,
      bgColor: 'bg-primary-500/10',
    },
    {
      icon: <Clock size={20} className="text-accent-400" />,
      label: 'Pending Requests',
      value: pendingRequests.length,
      bgColor: 'bg-accent-500/10',
    },
    {
      icon: <Users size={20} className="text-yellow-400" />,
      label: 'Active Listeners',
      value: 42,
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">DJ Dashboard</h1>
        <p className="text-gray-400">Manage song requests and interact with your audience.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="card p-4"
          >
            <div className="flex items-center">
              <div className={`rounded-full p-3 mr-3 ${stat.bgColor}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Incoming Requests */}
        <div className="lg:col-span-2">
          <IncomingRequests
            requests={pendingRequests}
            onAccept={onAccept}
            onReject={onReject}
          />
        </div>

        {/* Now Playing */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="card p-6 mb-6"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-500/20 rounded-full p-2 mr-3">
                <Headphones size={20} className="text-primary-400" />
              </div>
              <h2 className="text-xl font-semibold">Now Playing</h2>
            </div>

            <div className="text-center py-6">
              <div className="relative w-40 h-40 mx-auto mb-4">
                <img
                  src="https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
                  alt="Album Cover"
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent flex items-end p-3">
                  <div className="w-full">
                    <div className="h-1 w-3/4 bg-primary-500 rounded-full"></div>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg">Blinding Lights</h3>
              <p className="text-gray-400">The Weeknd</p>

              <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                <span>2:34</span>
                <div className="w-3/4 h-1 bg-dark-300 rounded-full mx-2">
                  <div className="w-3/4 h-1 bg-primary-500 rounded-full"></div>
                </div>
                <span>3:20</span>
              </div>

              <div className="flex justify-center mt-4 space-x-4">
                <button className="btn-ghost p-2 rounded-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"></polygon>
                    <line x1="5" y1="19" x2="5" y2="5"></line>
                  </svg>
                </button>
                <button className="btn-primary p-3 rounded-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="10" y1="15" x2="10" y2="9"></line>
                    <line x1="14" y1="15" x2="14" y2="9"></line>
                  </svg>
                </button>
                <button className="btn-ghost p-2 rounded-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"></polygon>
                    <line x1="19" y1="5" x2="19" y2="19"></line>
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Queue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-accent-500/20 rounded-full p-2 mr-3">
                  <Music size={20} className="text-accent-400" />
                </div>
                <h2 className="text-xl font-semibold">Up Next</h2>
              </div>
              <span className="text-xs bg-accent-500/20 text-accent-400 px-2 py-1 rounded-full">
                {acceptedRequests.length} songs
              </span>
            </div>

            <div className="space-y-3">
              {acceptedRequests.length > 0 ? (
                acceptedRequests.map((request, index) => (
                  <div
                    key={request.id}
                    className="flex items-center p-3 glass-card group hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="w-6 h-6 rounded-full bg-dark-300 flex items-center justify-center mr-3 text-xs text-gray-400">
                      {index + 1}
                    </div>
                    <img
                      src={request.song.albumCover}
                      alt={request.song.title}
                      className="w-10 h-10 object-cover rounded mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.song.title}</p>
                      <p className="text-sm text-gray-400 truncate">{request.song.artist}</p>
                    </div>
                    <div className="flex items-center ml-2">
                      <DollarSign size={14} className="text-primary-400 mr-1" />
                      <span className="text-sm">${request.tipAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 glass-card">
                  <p className="text-gray-400">No songs in queue</p>
                  <p className="text-sm text-gray-500 mt-1">Accepted requests will appear here</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DJDashboard;