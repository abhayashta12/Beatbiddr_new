import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Music } from 'lucide-react';
import ThreeAnimation from './ThreeAnimation';
import { useNavigate } from 'react-router-dom';

interface HeroProps {
  onNavigate: (page: string) => void;
}

const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  
  const navigate = useNavigate ();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-900 via-dark-800 to-dark-600 z-0"></div>
      <div className="absolute inset-0 z-0 opacity-50">
        <ThreeAnimation />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 z-10 text-center relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={itemVariants} className="mb-6 flex justify-center">
            <div className="size-20 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Music size={40} className="text-primary-400" />
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-accent-400 to-neon-400"
          >
            Tip DJs. Request Songs. Elevate Your Night.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-gray-300 mb-8"
          >
            Connect instantly with DJs, bid for your favorite tracks, and own the club's playlist.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              className="btn-primary group"
              onClick={() => navigate('customer')}
            >
              Get Started
              <ArrowRight className="inline-block ml-2 transition-transform group-hover:translate-x-1" size={18} />
            </button>
            <button 
              className="btn-ghost"
              onClick={() => navigate('discover')}
            >
              Discover DJs
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative glow effects */}
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full filter blur-[100px] z-0"></div>
      <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-neon-500/20 rounded-full filter blur-[80px] z-0"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-accent-500/20 rounded-full filter blur-[90px] z-0"></div>
    </div>
  );
};

export default Hero;