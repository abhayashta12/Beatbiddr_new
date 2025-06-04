import React from 'react';
import { motion } from 'framer-motion';
import { Music, Wallet, Award, Users } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Music size={24} />,
      title: 'Request Your Favorite Songs',
      description: 'Search from millions of tracks and request the DJ to play your favorites. Higher tips increase your chances.'
    },
    {
      icon: <Wallet size={24} />,
      title: 'Simple Tipping System',
      description: 'Load your digital wallet and tip DJs in real-time as they play your requested tracks.'
    },
    {
      icon: <Users size={24} />,
      title: 'Connect with Top DJs',
      description: 'Discover the best DJs in your area and follow their events, seeing what they\'re playing right now.'
    },
    {
      icon: <Award size={24} />,
      title: 'Elevate Your Experience',
      description: 'Turn any night out into an unforgettable experience by creating your personalized soundtrack.'
    }
  ];

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
    <section className="py-20 bg-dark-500 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-dark-600 to-transparent"></div>
      <div className="absolute -left-64 top-20 w-[500px] h-[500px] rounded-full bg-primary-900/20 filter blur-[120px]"></div>
      <div className="absolute -right-64 bottom-20 w-[500px] h-[500px] rounded-full bg-neon-900/20 filter blur-[120px]"></div>
      
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How BeatBiddr Works</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Transform your nightlife experience with just a few taps on your smartphone.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="glass-card p-6 hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="bg-primary-500/10 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-primary-400 group-hover:text-primary-300 group-hover:bg-primary-500/20 transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;