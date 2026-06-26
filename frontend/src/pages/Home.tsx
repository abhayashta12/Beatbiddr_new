import React from 'react';
import Navbar from '../components/layout/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';

const Home: React.FC = () => {
  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <Hero />
      <Features />
    </div>
  );
};

export default Home;
