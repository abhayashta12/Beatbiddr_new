import React from 'react';
import { motion } from 'framer-motion';
import { Heart, DollarSign, Clock } from 'lucide-react';
import type { SongRequest } from '../../types';

interface SongCardProps {
  request: SongRequest;
}

const SongCard: React.FC<SongCardProps> = ({ request }) => {
  const { song, tipAmount, status, timestamp } = request;

  const getStatusClass = () => {
    switch (status) {
      case 'accepted':
        return 'bg-neon-500/20 text-neon-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      case 'played':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'played':
        return 'Played';
      default:
        return 'Pending';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-4 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex">
        <img 
          src={song.albumCover} 
          alt={`${song.title} album cover`} 
          className="w-16 h-16 object-cover rounded-md mr-4"
        />
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-white">{song.title}</h3>
              <p className="text-sm text-gray-400">{song.artist}</p>
              <p className="text-xs text-gray-500">{song.album}</p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass()}`}>
                {getStatusText()}
              </div>
              
              <div className="flex items-center mt-2 bg-primary-500/10 px-3 py-1 rounded-full">
                <DollarSign size={14} className="text-primary-400 mr-1" />
                <span className="text-sm font-medium">{tipAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center text-xs text-gray-400">
              <Clock size={12} className="mr-1" />
              <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <button className="text-gray-400 hover:text-red-400 transition-colors duration-300">
              <Heart size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SongCard;