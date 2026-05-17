/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Text, PointerLockControls, Sky, Grid } from '@react-three/drei';
import * as THREE from 'three';

let audioCtx: AudioContext | null = null;
const initAudio = () => { if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); };

export const playJumpSound = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

export const playShootSound = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

export const playHitSound = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
};

const GAME_TIME = 30;

// Simple Gun Attached to Camera
const Weapon = ({ recoilRef }: { recoilRef: React.MutableRefObject<number> }) => {
    const gunRef = useRef<THREE.Group>(null);
    const { camera } = useThree();
    
    useEffect(() => {
        if (gunRef.current) camera.add(gunRef.current);
        return () => { if (gunRef.current) camera.remove(gunRef.current); }
    }, [camera]);

    useFrame((state, delta) => {
       if (gunRef.current) {
          // recoil shifts gun back and rotates up slightly
          const r = Math.max(0, recoilRef.current);
          gunRef.current.position.z = -0.5 + r * 0.15;
          gunRef.current.position.y = -0.3 + r * 0.08;
          gunRef.current.rotation.x = 0.05 + r * 0.4;
       }
    });

    return (
      <group ref={gunRef} position={[0.3, -0.3, -0.5]} rotation={[0.05, -0.05, 0]}>
            {/* Player Arm/Hand */}
            <mesh position={[-0.1, -0.2, 0.4]} rotation={[-Math.PI / 4, 0, 0]}>
                <capsuleGeometry args={[0.06, 0.4, 4, 8]} />
                <meshStandardMaterial color="#FFE0BD" roughness={0.4} /> 
            </mesh>
            
            {/* Main Body */}
            <mesh position={[0, 0, -0.1]}>
                <boxGeometry args={[0.1, 0.15, 0.5]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Body Accent */}
            <mesh position={[0, 0.05, -0.1]}>
                <boxGeometry args={[0.11, 0.05, 0.4]} />
                <meshStandardMaterial color="#00aaff" />
            </mesh>
            {/* Barrel */}
            <mesh position={[0, 0.02, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.4]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            {/* Energy Ring on Barrel */}
            <mesh position={[0, 0.02, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.05]} />
                <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
            </mesh>
            {/* Grip */}
            <mesh position={[0, -0.15, 0.1]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.06, 0.22, 0.12]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            {/* Sight */}
            <mesh position={[0, 0.1, 0.05]}>
                <boxGeometry args={[0.03, 0.04, 0.04]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff0000" />
            </mesh>
      </group>
    );
};

const Player = ({ gameState, onShoot, recoilRef }: { gameState: string, onShoot: () => void, recoilRef: React.MutableRefObject<number> }) => {
    const { camera } = useThree();
    const speed = 12;
    const jumpForce = 12;
    const gravity = 25;
    const velocityY = useRef(0);
    const keys = useRef<{ [key: string]: boolean }>({});
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => keys.current[e.code] = true;
        const handleKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        }
    }, []);

    useFrame((state, delta) => {
        if (gameState !== 'playing') return;
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        const moveV = new THREE.Vector3(0, 0, 0);
        if (keys.current['KeyW']) moveV.add(forward);
        if (keys.current['KeyS']) moveV.sub(forward);
        if (keys.current['KeyA']) moveV.sub(right);
        if (keys.current['KeyD']) moveV.add(right);

        if (moveV.lengthSq() > 0) {
            moveV.normalize().multiplyScalar(speed * delta);
            camera.position.add(moveV);
        }

        // Jump logic
        if (keys.current['Space'] && camera.position.y <= 1.6) {
           velocityY.current = jumpForce;
           playJumpSound();
        }

        velocityY.current -= gravity * delta;
        camera.position.y += velocityY.current * delta;

        if (camera.position.y < 1.6) {
            camera.position.y = 1.6;
            velocityY.current = 0;
        }
    });

    useEffect(() => {
        if (gameState !== 'playing') return;
        
        const handleShootClick = (e: MouseEvent) => {
            if (document.pointerLockElement || ('ontouchstart' in window)) {
               onShoot();
            }
        };
        const handleTouch = () => { onShoot(); };
        
        window.addEventListener('mousedown', handleShootClick);
        // window.addEventListener('touchstart', handleTouch); // disabled global touch shoot to let mobile controls work
        return () => {
           window.removeEventListener('mousedown', handleShootClick);
           // window.removeEventListener('touchstart', handleTouch);
        }
    }, [gameState, onShoot]);

    return (
       <>
          {gameState === 'playing' && <PointerLockControls />}
          <Weapon recoilRef={recoilRef} />
       </>
    );
}

const deathMessages = [
    "I deserved it",
    "I didn't deserve living anymore",
    "Why Am I Dumb?",
    "Please Forgive Me",
    "I still love you", 
    "I beg you for mercy",
    "I am dumb af",
    "You are the best and the most beautiful girl i have ever seen",
    "Woohoo, you finally defeated the one and only problem of your life"
];

const Target = ({ basePosition, active, id, hasBouquet }: { basePosition: [number, number, number], active: boolean, id: number, hasBouquet: boolean }) => {
  const meshRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const timeRef = useRef(Math.random() * 100);
  const [deathState, setDeathState] = useState(0);

  useFrame((state, delta) => {
    if (!active) {
       setDeathState(s => Math.min(s + delta * 3, 1));
    }
    
    if (meshRef.current) {
        if (active) {
           // Movement: wander
           timeRef.current += delta;
           const speed = 4; // radius
           const x = basePosition[0] + Math.sin(timeRef.current * 1.5) * speed;
           const z = basePosition[2] + Math.cos(timeRef.current * 1.1) * speed;
           
           const bobY = Math.abs(Math.sin(timeRef.current * 8)) * 0.1;
           meshRef.current.position.set(x, 1.2 + bobY, z);
           
           // Make them face player
           const targetPos = new THREE.Vector3(state.camera.position.x, meshRef.current.position.y, state.camera.position.z);
           meshRef.current.lookAt(targetPos);
           
           // Walk animation
           const walkCycle = Math.sin(timeRef.current * 8);
           // Arms pleading shake
           if(leftArmRef.current) leftArmRef.current.rotation.z = Math.sin(timeRef.current * 15) * 0.05;
           if(rightArmRef.current) rightArmRef.current.rotation.z = Math.sin(timeRef.current * 15) * 0.05;
           
           if(leftLegRef.current) leftLegRef.current.rotation.x = -walkCycle * 0.6;
           if(rightLegRef.current) rightLegRef.current.rotation.x = walkCycle * 0.6;
        } else {
           // falling back animation
           meshRef.current.rotation.x = - (Math.PI / 2) * deathState;
           meshRef.current.position.y = 1.2 - (0.8 * deathState);
        }
    }
  });

  const userData = useMemo(() => active ? { isTarget: true, targetId: id } : {}, [id, active]);

  return (
    <group ref={meshRef} position={[basePosition[0], 1.2, basePosition[2]]}>
        {/* Body */}
        <mesh userData={userData} position={[0, -0.2, 0]}>
          <boxGeometry args={[0.7, 0.8, 0.4]} />
          <meshStandardMaterial 
            color={active ? "#3b82f6" : "#1e293b"} 
            roughness={0.5} 
          />
        </mesh>
        
         {/* Head */}
        <mesh position={[0, 0.6, 0]} userData={userData}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial color={active ? "#FFE0BD" : "#8c735e"} roughness={0.3} />
          {active && (
             <group position={[0, 0, 0.36]}>
                 {/* Big Pleading Eyes */}
                 <mesh position={[-0.15, 0.05, -0.02]}>
                    <boxGeometry args={[0.2, 0.22, 0.01]} />
                    <meshBasicMaterial color="white" />
                 </mesh>
                 <mesh position={[-0.15, 0.05, 0.01]}>
                    <boxGeometry args={[0.16, 0.18, 0.02]} />
                    <meshBasicMaterial color="black" />
                 </mesh>
                 <mesh position={[-0.1, 0.1, 0.03]}>
                    <boxGeometry args={[0.07, 0.07, 0.02]} />
                    <meshBasicMaterial color="white" />
                 </mesh>

                 <mesh position={[0.15, 0.05, -0.02]}>
                    <boxGeometry args={[0.2, 0.22, 0.01]} />
                    <meshBasicMaterial color="white" />
                 </mesh>
                 <mesh position={[0.15, 0.05, 0.01]}>
                    <boxGeometry args={[0.16, 0.18, 0.02]} />
                    <meshBasicMaterial color="black" />
                 </mesh>
                 <mesh position={[0.2, 0.1, 0.03]}>
                    <boxGeometry args={[0.07, 0.07, 0.02]} />
                    <meshBasicMaterial color="white" />
                 </mesh>

                 {/* Glasses */}
                 <mesh position={[-0.15, 0.05, 0.02]}>
                    <torusGeometry args={[0.12, 0.02, 8, 24]} />
                    <meshBasicMaterial color="#333" />
                 </mesh>
                 <mesh position={[0.15, 0.05, 0.02]}>
                    <torusGeometry args={[0.12, 0.02, 8, 24]} />
                    <meshBasicMaterial color="#333" />
                 </mesh>
                 {/* Glasses bridge */}
                 <mesh position={[0, 0.05, 0.01]}>
                    <boxGeometry args={[0.1, 0.02, 0.02]} />
                    <meshBasicMaterial color="#333" />
                 </mesh>

                 {/* Sad Eyebrows (turned inwards/upwards = pleading) */}
                 <mesh position={[-0.15, 0.22, 0.02]} rotation={[0, 0, 0.3]}>
                    <boxGeometry args={[0.18, 0.04, 0.02]} />
                    <meshBasicMaterial color="black" />
                 </mesh>
                 <mesh position={[0.15, 0.22, 0.02]} rotation={[0, 0, -0.3]}>
                    <boxGeometry args={[0.18, 0.04, 0.02]} />
                    <meshBasicMaterial color="black" />
                 </mesh>

                 {/* Pleading Mouth */}
                 <mesh position={[0, -0.15, 0.01]}>
                    <boxGeometry args={[0.08, 0.04, 0.02]} />
                    <meshBasicMaterial color="black" />
                 </mesh>
             </group>
          )}
        </mesh>

        {/* Arms Pivot */}
        <group ref={leftArmRef} position={[-0.35, 0.2, 0.2]} rotation={[-0.3, 0.2, -0.4]}>
            <mesh position={[0, -0.2, 0]} userData={userData}>
               <boxGeometry args={[0.18, 0.5, 0.18]} />
               <meshStandardMaterial color={active ? "#3b82f6" : "#1e293b"} roughness={0.3} />
            </mesh>
            {hasBouquet && active && (
                <group position={[0, -0.4, 0.2]}>
                    {/* Stems */}
                    <mesh position={[0, 0, 0]} rotation={[0.2, 0, 0]}>
                        <cylinderGeometry args={[0.02, 0.01, 0.4]} />
                        <meshStandardMaterial color="#22c55e" />
                    </mesh>
                    {/* Flowers */}
                    <mesh position={[-0.1, 0.2, 0.05]}>
                        <sphereGeometry args={[0.08]} />
                        <meshStandardMaterial color="#ec4899" />
                    </mesh>
                    <mesh position={[0.1, 0.2, 0.05]}>
                        <sphereGeometry args={[0.08]} />
                        <meshStandardMaterial color="#eab308" />
                    </mesh>
                    <mesh position={[0, 0.25, -0.05]}>
                        <sphereGeometry args={[0.08]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                </group>
            )}
        </group>
        <group ref={rightArmRef} position={[0.35, 0.2, 0.2]} rotation={[-0.3, -0.2, 0.4]}>
            <mesh position={[0, -0.2, 0]} userData={userData}>
               <boxGeometry args={[0.18, 0.5, 0.18]} />
               <meshStandardMaterial color={active ? "#3b82f6" : "#1e293b"} roughness={0.3} />
            </mesh>
        </group>

        {/* Legs Pivot */}
        <group ref={leftLegRef} position={[-0.2, -0.6, 0]}>
            <mesh position={[0, -0.3, 0]} userData={userData}>
               <boxGeometry args={[0.25, 0.6, 0.25]} />
               <meshStandardMaterial color={active ? "#1e40af" : "#0f172a"} roughness={0.3} />
            </mesh>
        </group>
        <group ref={rightLegRef} position={[0.2, -0.6, 0]}>
            <mesh position={[0, -0.3, 0]} userData={userData}>
               <boxGeometry args={[0.25, 0.6, 0.25]} />
               <meshStandardMaterial color={active ? "#1e40af" : "#0f172a"} roughness={0.3} />
            </mesh>
        </group>

        {active && (
            <Text 
              position={[0, 1.3, 0]} 
              fontSize={0.25} 
              color="#ffffff" 
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#000000"
            >
              Shashwat
            </Text>
        )}
    </group>
  );
};


const GameScene = ({ gameState, targets, setTargets, setScore, setAnnouncement }: any) => {
    const { camera, scene, gl } = useThree();
    const recoilRef = useRef(0);

    const handleShoot = () => {
       if (!document.pointerLockElement && !('ontouchstart' in window)) {
           return; 
       }
       recoilRef.current = 1;
       playShootSound();
       
       const raycaster = new THREE.Raycaster();
       raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
       const intersects = raycaster.intersectObjects(scene.children, true);
       for (const hit of intersects) {
           if (hit.object.userData?.isTarget) {
               playHitSound();
               const id = hit.object.userData.targetId;
               setScore((s: number) => s + 100);
               const msg = deathMessages[Math.floor(Math.random() * deathMessages.length)];
               setAnnouncement({ id: Date.now(), text: msg });
               setTargets((prev: any[]) => prev.map((t: any) => t.id === id ? { ...t, active: false } : t));
               break;
           }
       }
    };

    useFrame((state, delta) => {
        if (recoilRef.current > 0) {
           recoilRef.current -= delta * 5;
           if (recoilRef.current < 0) recoilRef.current = 0;
        }
    });

    return (
        <>
           <Player gameState={gameState} onShoot={handleShoot} recoilRef={recoilRef} />
           
           {targets.map((t: any) => (
               <Target key={t.id} basePosition={t.basePosition} active={t.active} id={t.id} hasBouquet={t.hasBouquet} />
           ))}
        </>
    )
}

// UI controls for Mobile
const MobileControls = ({ onShoot }: { onShoot: () => void }) => {
    const triggerKey = (code: string, isDown: boolean) => {
        window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code }));
    }

    return (
        <div className="absolute inset-x-0 bottom-10 px-8 flex justify-between z-40 md:hidden pointer-events-none">
            {/* Left D-PAD */}
            <div className="relative w-32 h-32 opacity-70 pointer-events-auto">
                <button 
                  onPointerDown={(e) => { e.preventDefault(); triggerKey('KeyW', true) }}
                  onPointerUp={(e) => { e.preventDefault(); triggerKey('KeyW', false) }}
                  onPointerLeave={(e) => { triggerKey('KeyW', false) }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white"
                >W</button>
                <button 
                  onPointerDown={(e) => { e.preventDefault(); triggerKey('KeyS', true) }}
                  onPointerUp={(e) => { e.preventDefault(); triggerKey('KeyS', false) }}
                  onPointerLeave={(e) => { triggerKey('KeyS', false) }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white"
                >S</button>
                <button 
                  onPointerDown={(e) => { e.preventDefault(); triggerKey('KeyA', true) }}
                  onPointerUp={(e) => { e.preventDefault(); triggerKey('KeyA', false) }}
                  onPointerLeave={(e) => { triggerKey('KeyA', false) }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white"
                >A</button>
                <button 
                  onPointerDown={(e) => { e.preventDefault(); triggerKey('KeyD', true) }}
                  onPointerUp={(e) => { e.preventDefault(); triggerKey('KeyD', false) }}
                  onPointerLeave={(e) => { triggerKey('KeyD', false) }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-white"
                >D</button>
            </div>
            
            {/* Right Action buttons */}
            <div className="flex gap-4 items-end opacity-70 pointer-events-auto">
                <button 
                  onPointerDown={(e) => { e.preventDefault(); triggerKey('Space', true) }}
                  onPointerUp={(e) => { e.preventDefault(); triggerKey('Space', false) }}
                  onPointerLeave={(e) => { triggerKey('Space', false) }}
                  className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center text-white active:bg-white/50 border border-white/50 font-bold"
                >
                    JMP
                </button>
                {onShoot && (
                    <button 
                    onPointerDown={(e) => { 
                        e.preventDefault(); 
                        onShoot();
                    }}
                    className="w-20 h-20 bg-red-500/50 rounded-full flex items-center justify-center text-white active:bg-red-500/80 border border-red-500/80 font-bold"
                    >
                        FIRE
                    </button>
                )}
            </div>
        </div>
    )
}

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [targets, setTargets] = useState<Array<{ id: number, basePosition: [number, number, number], active: boolean, spawnedAt: number, hasBouquet: boolean }>>([]);
  const targetIdCounter = useRef(0);
  const [isLocked, setIsLocked] = useState(false);
  const [announcement, setAnnouncement] = useState<{ id: number, text: string } | null>(null);

  useEffect(() => {
      const handleLockChange = () => {
          setIsLocked(!!document.pointerLockElement);
      };
      document.addEventListener('pointerlockchange', handleLockChange);
      return () => document.removeEventListener('pointerlockchange', handleLockChange);
  }, []);

  useEffect(() => {
      if (announcement) {
          const timeout = setTimeout(() => setAnnouncement(null), 3000);
          return () => clearTimeout(timeout);
      }
  }, [announcement]);

  // Timer logic
  useEffect(() => {
    if (gameState === 'playing' && isLocked) {
      const interval = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
             document.exitPointerLock?.();
             setGameState('gameover');
             return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, isLocked]);

  // Target spawning logic
  useEffect(() => {
    if (gameState === 'playing' && isLocked) {
      const spawnInterval = setInterval(() => {
        setTargets(prev => {
          const now = Date.now();
          
          let updated = prev.map(t => {
            if (t.active && now - t.spawnedAt > 5000) {
              return { ...t, active: false };
            }
            return t;
          });

          updated = updated.filter(t => t.active || (now - t.spawnedAt < 6000));

          if (updated.filter(t => t.active).length < 5) {
            const id = targetIdCounter.current++;
            const angle = Math.random() * Math.PI * 2;
            const dist = 5 + Math.random() * 15;
            updated.push({
              id,
              basePosition: [
                Math.cos(angle) * dist,
                0,
                Math.sin(angle) * dist,
              ],
              active: true,
              spawnedAt: now,
              hasBouquet: Math.random() > 0.5,
            });
          }
          return updated;
        });
      }, 800);

      return () => clearInterval(spawnInterval);
    } else if (gameState !== 'playing') {
      setTargets([]);
    }
  }, [gameState, isLocked]);

  const startGame = () => {
    initAudio();
    setScore(0);
    setTimeLeft(GAME_TIME);
    setGameState('playing');
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0 cursor-crosshair">
        <Canvas>
          <Environment preset="sunset" background />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffe8d6" />
          
          <Grid infiniteGrid fadeDistance={80} sectionColor="#999999" cellColor="#cccccc" position={[0, 0, 0]} sectionSize={3} cellSize={1} />
          <mesh position={[0, -0.1, 0]} receiveShadow>
             <cylinderGeometry args={[50, 50, 0.2, 64]} />
             <meshStandardMaterial color="#f8f9fa" roughness={0.2} metalness={0.1} />
          </mesh>
          
          <GameScene 
              gameState={gameState} 
              targets={targets} 
              setTargets={setTargets} 
              setScore={setScore}
              setAnnouncement={setAnnouncement} 
          />
        </Canvas>
      </div>

      {/* Crosshair */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-2 h-2 rounded-full border border-white bg-red-500 shadow-[0_0_10px_red]" />
        </div>
      )}

      {/* Pointer Lock Overlay */}
      {gameState === 'playing' && !isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30 pointer-events-none">
            <h2 className="text-white text-3xl font-bold uppercase tracking-widest font-mono mb-4 text-center">
                Click anywhere<br/>to aim & shoot
            </h2>
            <p className="text-zinc-400 font-mono tracking-widest text-sm">USE WASD TO MOVE</p>
        </div>
      )}

      {/* UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {gameState === 'playing' && (
            <MobileControls onShoot={() => {
                // simulate shoot on mobile
                window.dispatchEvent(new MouseEvent('mousedown'));
            }} />
        )}

        {/* Announcements */}
        <AnimatePresence>
            {announcement && (
                <motion.div
                    key={announcement.id}
                    initial={{ y: -50, opacity: 0, scale: 0.8 }}
                    animate={{ y: 50, opacity: 1, scale: 1 }}
                    exit={{ y: -50, opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                    className="absolute top-20 pt-10 left-1/2 -translate-x-1/2 pointer-events-none z-50 text-center w-full max-w-4xl px-4"
                >
                    <div className="bg-black/95 inline-block px-12 py-6 rounded-2xl border border-red-600/50 shadow-[0_0_50px_rgba(220,38,38,0.4)] backdrop-blur-md">
                        <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5), 0 0 20px red, 0 0 30px red' }}>
                           "{announcement.text}"
                        </h3>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
            >
              <div className="text-center">
                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-black text-6xl md:text-9xl text-red-600 tracking-tighter uppercase mb-4"
                  style={{ textShadow: '0 0 40px rgba(220, 38, 38, 0.5)' }}
                >
                  REVENGE
                </motion.h1>
                <motion.div
                   initial={{ y: 20, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ delay: 0.4 }}
                   className="flex justify-center items-center gap-4 mb-4 text-zinc-400 font-mono text-sm tracking-widest uppercase"
                >
                   <span>Player: <span className="text-white font-bold">Apoorva</span></span>
                   <span>VS</span>
                   <span>Target: <span className="text-red-500 font-bold">Shashwat</span></span>
                </motion.div>
                
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="max-w-2xl mx-auto text-zinc-300 font-medium text-lg leading-relaxed mb-12 shadow-black drop-shadow-md"
                >
                    Now you can finally complete your <strong className="text-white">REVENGE</strong> on the worst person in your life, and eliminate him! At least in this virtual world, try to make the highest scores possible.
                </motion.p>
                
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-12 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xl tracking-widest uppercase rounded-sm border-2 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all pointer-events-auto"
                >
                  Initiate Attack
                </motion.button>
              </div>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 p-6 flex flex-col justify-between"
            >
              {/* HUD Top */}
              <div className="flex justify-between items-start font-mono uppercase tracking-widest pointer-events-none">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 text-xs">Operative</span>
                  <span className="text-white font-bold text-xl">Apoorva</span>
                </div>
                <div className="flex flex-col items-end gap-1 pointer-events-none">
                  <span className="text-zinc-400 text-xs">Time Left</span>
                  <span className={`font-bold text-3xl ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                    00:{timeLeft.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              
               {/* HUD Bottom */}
              <div className="flex justify-center items-end pb-4 font-mono pointer-events-none">
                 <div className="flex flex-col items-center gap-1">
                    <span className="text-zinc-400 text-xs tracking-widest uppercase">Score</span>
                    <span className="text-5xl text-white font-black">{score.toString().padStart(5, '0')}</span>
                 </div>
              </div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 pointer-events-auto"
            >
              <div className="text-center">
                <motion.h2 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="font-black text-5xl md:text-7xl text-white mb-2 uppercase tracking-tight"
                >
                  Mission Over
                </motion.h2>
                <div className="text-zinc-400 font-mono tracking-widest mb-8">
                  TARGET <span className="text-red-500">SHASHWAT</span> ELIMINATED
                </div>
                
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg mb-8 inline-block shadow-2xl">
                  <div className="text-zinc-500 font-mono text-sm uppercase mb-2">Final Score</div>
                  <div className="text-6xl text-red-500 font-black font-mono">
                    {score.toString().padStart(5, '0')}
                  </div>
                </div>

                <div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    className="px-10 py-4 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-widest rounded-sm pointer-events-auto"
                  >
                    Deploy Again
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
