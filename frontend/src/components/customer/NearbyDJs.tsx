import React from 'react';
// import { motion } from 'framer-motion';
// import { MapPin, Star, Disc, Music } from 'lucide-react';
import type { DJ } from '../../types';

interface NearbyDJsProps {
  djs: DJ[];
  onSelectDJ: (dj: DJ) => void;
  selectedDJ: DJ | null;
}

const NearbyDJs: React.FC<NearbyDJsProps> = ({ djs, onSelectDJ, selectedDJ }) => {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-4">Nearby DJs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {djs.map((dj) => (
          <div
            key={dj.id}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
              selectedDJ?.id === dj.id
                ? 'bg-accent-500 ring-2 ring-accent-400'
                : 'bg-dark-500 hover:bg-dark-400'
            }`}
            onClick={() => onSelectDJ(dj)}
          >
            <img src={dj.avatar} alt={dj.name} className="w-16 h-16 rounded-full mr-4" />
            <div>
              <p className="font-bold">{dj.name}</p>
              <p className="text-sm text-gray-400">{dj.club}</p>
              <div className="flex items-center mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  dj.isLive ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  {dj.isLive ? 'LIVE' : 'OFFLINE'}
                </span>
                <span className="ml-2 text-xs text-gray-400">{dj.genre.join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NearbyDJs;
