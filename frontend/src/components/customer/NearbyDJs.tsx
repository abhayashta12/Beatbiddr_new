import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, Disc, Music } from 'lucide-react';
import type { DJ } from '../../types';

interface NearbyDJsProps {
  djs: DJ[];
}

const NearbyDJs: React.FC<NearbyDJsProps> = ({ djs }) => {
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
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="card p-6 relative"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <div className="bg-neon-500/20 rounded-full p-2 mr-3">
            <Music size={20} className="text-neon-400" />
          </div>
          <h2 className="text-xl font-semibold">DJs Near You</h2>
        </div>
        <button className="btn-ghost py-2 px-4 text-sm">View All</button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {djs.map((dj) => (
          <motion.div
            key={dj.id}
            variants={itemVariants}
            className="glass-card p-4 group hover:bg-white/10 transition-all duration-300"
          >
            <div className="flex items-center">
              <div className="relative mr-4">
                <img
                  src={dj.avatar}
                  alt={dj.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                {dj.isLive && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-xs px-2 py-1 rounded-full text-white font-medium animate-pulse">
                    LIVE
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-lg group-hover:text-primary-300 transition-colors duration-300">
                  {dj.name}
                </h3>
                
                <div className="flex items-center text-gray-400 text-sm mb-1">
                  <MapPin size={14} className="mr-1" />
                  <span>{dj.club}</span>
                </div>
                
                <div className="flex items-center">
                  <div className="flex items-center mr-3">
                    <Star size={14} className="text-yellow-400 mr-1" />
                    <span className="text-sm">{dj.rating.toFixed(1)}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Disc size={14} className="text-accent-400 mr-1" />
                    <span className="text-sm">{dj.genre.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between">
              <button className="text-xs text-neon-400 font-medium hover:text-neon-300 transition-colors duration-300">
                Request Song
              </button>
              <button className="text-xs text-accent-400 font-medium hover:text-accent-300 transition-colors duration-300">
                View Profile
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default NearbyDJs;