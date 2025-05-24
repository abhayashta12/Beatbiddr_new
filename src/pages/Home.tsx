import React from 'react';
import Navbar from '../components/layout/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';

interface HomeProps {
  onNavigate: (page: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar onNavigate={onNavigate} />
      <Hero onNavigate={onNavigate} />
      <Features />
    </div>
  );
};

export default Home;