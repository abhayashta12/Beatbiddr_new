import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import DJDashboard from '../components/dj/Dashboard';
import type { SongRequest } from '../types';

const initialPendingRequests: SongRequest[] = [
  {
    id: '1',
    song: {
      id: '101',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://example.com/avatar1.jpg',
    },
    tipAmount: 25,
    timestamp: new Date().toISOString(),
    status: 'pending',
  },
  {
    id: '2',
    song: {
      id: '102',
      title: 'Don\'t Start Now',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user2',
      name: 'Morgan Smith',
      avatar: 'https://example.com/avatar2.jpg',
    },
    tipAmount: 15,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    status: 'pending',
  },
  {
    id: '3',
    song: {
      id: '103',
      title: 'Levitating',
      artist: 'Dua Lipa ft. DaBaby',
      album: 'Future Nostalgia',
      albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user3',
      name: 'Sam Wilson',
      avatar: 'https://example.com/avatar3.jpg',
    },
    tipAmount: 20,
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(), // 7 minutes ago
    status: 'pending',
  },
];

const initialAcceptedRequests: SongRequest[] = [
  {
    id: '4',
    song: {
      id: '104',
      title: 'Save Your Tears',
      artist: 'The Weeknd',
      album: 'After Hours',
      albumCover: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user4',
      name: 'Taylor Reed',
      avatar: 'https://example.com/avatar4.jpg',
    },
    tipAmount: 30,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
    status: 'accepted',
  },
];

interface DJDashboardPageProps {
  onNavigate: (path: string) => void;
}

const DJDashboardPage: React.FC<DJDashboardPageProps> = ({ onNavigate }) => {
  const [pendingRequests, setPendingRequests] = useState<SongRequest[]>(initialPendingRequests);
  const [acceptedRequests, setAcceptedRequests] = useState<SongRequest[]>(initialAcceptedRequests);
  const [earnings, setEarnings] = useState(95);
  const [totalRequests, setTotalRequests] = useState(12);

  const handleAccept = (id: string) => {
    const request = pendingRequests.find(req => req.id === id);
    if (!request) return;

    // Update request status
    const updatedRequest = { ...request, status: 'accepted' as const };
    
    // Remove from pending and add to accepted
    setPendingRequests(prev => prev.filter(req => req.id !== id));
    setAcceptedRequests(prev => [updatedRequest, ...prev]);
    
    // Update earnings
    setEarnings(prev => prev + updatedRequest.tipAmount);
  };

  const handleReject = (id: string) => {
    const request = pendingRequests.find(req => req.id === id);
    if (!request) return;

    // Update request status
    const updatedRequest = { ...request, status: 'rejected' as const };
    
    // Remove from pending
    setPendingRequests(prev => prev.filter(req => req.id !== id));
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar onNavigate={onNavigate} />
      <div className="pt-16">
        <DJDashboard
          earnings={earnings}
          totalRequests={totalRequests}
          pendingRequests={pendingRequests}
          acceptedRequests={acceptedRequests}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </div>
    </div>
  );
};

export default DJDashboardPage;