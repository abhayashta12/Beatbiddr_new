import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import DJDashboard from '../components/dj/Dashboard';
import type { SongRequest } from '../types';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DJDashboardPage: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<SongRequest[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<SongRequest[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'songRequests'), orderBy('tipAmount', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const all: SongRequest[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SongRequest, 'id'>),
      }));

      setPendingRequests(all.filter((r) => r.status === 'pending'));
      setAcceptedRequests(all.filter((r) => r.status === 'accepted'));
      setTotalRequests(all.length);
      setEarnings(
        all.filter((r) => r.status === 'accepted').reduce((sum, r) => sum + r.tipAmount, 0)
      );
    });
    return unsub;
  }, []);

  const handleAccept = async (id: string) => {
    await updateDoc(doc(db, 'songRequests', id), { status: 'accepted' });
  };

  const handleReject = async (id: string) => {
    await updateDoc(doc(db, 'songRequests', id), { status: 'rejected' });
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
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
