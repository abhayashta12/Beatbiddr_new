import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';

const AnimatedSphere = () => {
  const sphere = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (sphere.current) {
      sphere.current.rotation.x = clock.getElapsedTime() * 0.2;
      sphere.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <Sphere ref={sphere} args={[1, 100, 200]} scale={2.5}>
      <MeshDistortMaterial
        color="#8B5CF6"
        attach="material"
        distort={0.5}
        speed={2}
        roughness={0.1}
        metalness={0.9}
      />
    </Sphere>
  );
};

const VinylRecord = () => {
  const vinyl = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (vinyl.current) {
      vinyl.current.rotation.y = clock.getElapsedTime() * 0.8;
    }
  });

  return (
    <group ref={vinyl}>
      {/* Vinyl record base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[2, 2, 0.1, 64]} />
        <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Vinyl grooves */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.01, 64]} />
        <meshStandardMaterial color="#222222" roughness={0.6} />
      </mesh>
      
      {/* Center label */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.02, 32]} />
        <meshStandardMaterial color="#3B82F6" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Center hole */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 32]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  );
};

const ThreeAnimation: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 z-0"
    >
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#3B82F6" />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#8B5CF6" />
        <directionalLight position={[0, 0, 5]} intensity={1.5} color="#10B981" />
        <VinylRecord />
        <AnimatedSphere />
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={true} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </motion.div>
  );
};

export default ThreeAnimation;