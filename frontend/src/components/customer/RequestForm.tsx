import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, DollarSign, Music, Send } from 'lucide-react';
import { searchSpotify } from '../../utils/spotifyApi'; 
import { SpotifyPlaylist } from '../../types';

interface Song {
  id: string;
  title: string;
  artist: string;
  albumCover: string;
}

interface RequestFormProps {
  onSubmit: (song: Song, tipAmount: number, message: string) => void;
  spotifyToken: string | null;
  userPlaylists: SpotifyPlaylist[];  // ✅ CORRECTED (this was your crash cause)
}

const mockSongs: Song[] = [
  { id: '1', title: 'Blinding Lights', artist: 'The Weeknd', albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg' },
  { id: '2', title: "Don't Start Now", artist: 'Dua Lipa', albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg' },
  { id: '3', title: 'Levitating', artist: 'Dua Lipa ft. DaBaby', albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg' }
];

const RequestForm: React.FC<RequestFormProps> = ({ onSubmit, spotifyToken, userPlaylists }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [tipAmount, setTipAmount] = useState(5);
  const [message, setMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      if (spotifyToken) {
        const spotifyResults = await searchSpotify(spotifyToken, searchQuery);
        setSearchResults(spotifyResults);
      } else {
        setSearchResults(mockSongs.filter(song =>
          song.title.toLowerCase().includes(searchQuery.toLowerCase())
        ));
      }
    } catch (error) {
      console.error('Search error:', error);
    }

    setIsSearching(false);
  };

  const handleSongSelect = (song: Song) => {
    setSelectedSong(song);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSong && tipAmount > 0) {
      onSubmit(selectedSong, tipAmount, message);
      setSelectedSong(null);
      setTipAmount(5);
      setMessage('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="card p-6"
    >
      <div className="flex items-center mb-6">
        <div className="bg-accent-500/20 rounded-full p-2 mr-3">
          <Music size={20} className="text-accent-400" />
        </div>
        <h2 className="text-xl font-semibold">Request a Song</h2>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ✅ SAFETY PATCH - prevent crashing on undefined */}
        {Array.isArray(userPlaylists) && userPlaylists.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 text-white">Your Spotify Playlists:</h3>
            <div className="flex overflow-x-auto space-x-3">
              {userPlaylists.map(pl => (
                <div key={pl.id} className="flex-shrink-0">
                  <img src={pl.image} alt={pl.name} className="w-24 h-24 rounded-lg object-cover" />
                  <p className="text-xs text-center mt-1 text-gray-300">{pl.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Field */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder="Search for a song..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 px-3 flex items-center bg-primary-600 hover:bg-primary-700 rounded-r-lg transition-colors duration-300"
            onClick={handleSearch}
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>Search</span>
            )}
          </button>
        </div>

        {/* Search Results */}
        {searchQuery && !isSearching && searchResults.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 max-h-64 overflow-y-auto glass-card">
            {searchResults.map((song) => (
              <div key={song.id} className="flex items-center p-3 hover:bg-white/10 cursor-pointer transition-colors duration-200" onClick={() => handleSongSelect(song)}>
                <img src={song.albumCover} alt={song.title} className="w-10 h-10 object-cover rounded mr-3" />
                <div>
                  <p className="font-medium">{song.title}</p>
                  <p className="text-sm text-gray-400">{song.artist}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Selected Song */}
        {selectedSong && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 glass-card flex items-center">
            <img src={selectedSong.albumCover} alt={selectedSong.title} className="w-12 h-12 object-cover rounded mr-4" />
            <div>
              <p className="font-medium">{selectedSong.title}</p>
              <p className="text-sm text-gray-400">{selectedSong.artist}</p>
            </div>
            <button type="button" className="ml-auto text-xs text-red-400 hover:text-red-300" onClick={() => setSelectedSong(null)}>
              Remove
            </button>
          </motion.div>
        )}

        {/* Tip Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Tip Amount (higher tips get played sooner)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign size={18} className="text-gray-400" />
            </div>
            <input type="number" min="1" step="1" className="input pl-10 w-full" value={tipAmount} onChange={(e) => setTipAmount(Number(e.target.value))} />
          </div>
        </div>

        {/* Tip Presets */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[5, 10, 20, 50].map((amount) => (
            <button key={amount} type="button" onClick={() => setTipAmount(amount)} className={`py-2 rounded-md transition-all duration-200 ${tipAmount === amount ? 'bg-primary-500 text-white' : 'bg-dark-300 text-gray-300 hover:bg-dark-200'}`}>
              ${amount}
            </button>
          ))}
        </div>

        {/* Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Message to DJ (optional)</label>
          <textarea className="input w-full resize-none" rows={2} placeholder="Add a special request or message..." value={message} onChange={(e) => setMessage(e.target.value)}></textarea>
        </div>

        {/* Submit */}
        <button type="submit" disabled={!selectedSong || tipAmount <= 0} className={`w-full btn-accent flex items-center justify-center ${!selectedSong || tipAmount <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Send size={18} className="mr-2" />
          Send Request
        </button>
      </form>
    </motion.div>
  );
};

export default RequestForm;
