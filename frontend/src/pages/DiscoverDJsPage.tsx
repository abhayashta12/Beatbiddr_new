import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import type { DJ } from '../types';
import { MapPin, Music, Star } from 'lucide-react';

const mockDJs: DJ[] = [
  {
    id: '1',
    name: 'DJ Spinz',
    avatar: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'Neon Lounge',
    location: '0.5 miles away',
    genre: ['House', 'EDM'],
    rating: 4.8,
    isLive: true,
  },
  {
    id: '2',
    name: 'DJ Beatrix',
    avatar: 'https://images.pexels.com/photos/3484683/pexels-photo-3484683.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'The Vault',
    location: '1.2 miles away',
    genre: ['Hip-Hop', 'R&B'],
    rating: 4.6,
    isLive: false,
  },
  {
    id: '3',
    name: 'DJ Luna',
    avatar: 'https://images.pexels.com/photos/2264753/pexels-photo-2264753.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'Skyline Club',
    location: '2.0 miles away',
    genre: ['Techno', 'Progressive'],
    rating: 4.9,
    isLive: true,
  },
];

const DiscoverDJsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyDJs, setNearbyDJs] = useState<DJ[]>([]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setNearbyDJs(mockDJs);
          setLoading(false);
        },
        () => {
          // Location denied — still show DJs, just without sorting by distance
          setNearbyDJs(mockDJs);
          setError('Location unavailable — showing all nearby DJs.');
          setLoading(false);
        }
      );
    } else {
      setNearbyDJs(mockDJs);
      setLoading(false);
    }
  }, []);

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />

      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="py-6">
          <h1 className="text-3xl font-bold mb-2">Discover DJs Near You</h1>
          <p className="text-gray-400 mb-8">Find and connect with top DJs in your area</p>

          {error && (
            <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nearbyDJs.map((dj) => (
                <div
                  key={dj.id}
                  className="card p-6 hover:bg-white/5 transition-all duration-300 group cursor-pointer"
                >
                  <div className="relative mb-4">
                    <img
                      src={dj.avatar}
                      alt={dj.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {dj.isLive && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                        LIVE
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary-400 transition-colors duration-300">
                    {dj.name}
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center text-gray-400">
                      <MapPin size={16} className="mr-2" />
                      <span>{dj.club}</span>
                      <span className="mx-2">•</span>
                      <span className="text-sm">{dj.location}</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <Music size={16} className="mr-2" />
                      <span>{dj.genre.join(', ')}</span>
                    </div>
                    <div className="flex items-center text-yellow-400">
                      <Star size={16} className="mr-2" />
                      <span>{dj.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                    <button
                      className="btn-primary py-2 px-4 text-sm"
                      onClick={() => navigate('/customer')}
                    >
                      Request Song
                    </button>
                    <button
                      className="btn-ghost py-2 px-4 text-sm"
                      onClick={() => navigate('/customer')}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverDJsPage;
