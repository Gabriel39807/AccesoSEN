"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { DoubleSide } from "three";
import type { Group } from "three";
import type { AuthRole } from "./RoleSwitch";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
};

function RobotModel({ role, tx, ty }: Props) {
  const groupRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const isAdmin = role === "admin";

  const target = useMemo(
    () => ({
      rx: Math.max(-0.2, Math.min(0.2, -ty * 0.008)),
      ry: Math.max(-0.36, Math.min(0.36, tx * 0.008)),
    }),
    [tx, ty],
  );
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.elapsedTime;
    g.position.y = Math.sin(t * 1.1) * 0.05;
    g.rotation.x += (target.rx - g.rotation.x) * Math.min(1, delta * 6);
    g.rotation.y += (target.ry - g.rotation.y) * Math.min(1, delta * 6);

    const body = bodyRef.current;
    if (body) {
      const by = Math.max(-0.18, Math.min(0.18, tx * 0.0038));
      const bx = Math.max(-0.08, Math.min(0.08, -ty * 0.0028));
      body.rotation.y += (by - body.rotation.y) * Math.min(1, delta * 7);
      body.rotation.x += (bx - body.rotation.x) * Math.min(1, delta * 7);
    }

    const head = headRef.current;
    if (head) {
      const hy = Math.max(-0.36, Math.min(0.36, tx * 0.0054));
      const hx = Math.max(-0.2, Math.min(0.2, -ty * 0.0046));
      head.rotation.y += (hy - head.rotation.y) * Math.min(1, delta * 9);
      head.rotation.x += (hx - head.rotation.x) * Math.min(1, delta * 9);
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.64, 0]} scale={1.24}>
      <RoundedBox args={[2.58, 0.56, 1.84]} radius={0.12} smoothness={7} position={[0, -1.3, 0]}>
        <meshStandardMaterial color="#111a2a" roughness={0.24} metalness={0.68} />
      </RoundedBox>
      <RoundedBox args={[1.94, 0.4, 1.34]} radius={0.1} smoothness={7} position={[0, -0.86, 0]}>
        <meshStandardMaterial color="#182437" roughness={0.26} metalness={0.6} />
      </RoundedBox>
      <RoundedBox args={[1.56, 0.34, 1.06]} radius={0.09} smoothness={7} position={[0, -0.52, 0]}>
        <meshStandardMaterial color="#1f3048" roughness={0.24} metalness={0.56} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.24, 0.74]} radius={0.08} smoothness={6} position={[0, -0.22, 0]}>
        <meshStandardMaterial color="#22344b" roughness={0.22} metalness={0.58} />
      </RoundedBox>

      <mesh position={[0.4, -0.5, 0.46]} scale={[0.22, 0.045, 0.05]} rotation={[0, 0.08, -0.12]}>
        <cylinderGeometry args={[1, 1, 1, 24]} />
        <meshStandardMaterial color="#9cfdf0" emissive="#2dd4bf" emissiveIntensity={1.35} roughness={0.12} metalness={0.1} />
      </mesh>

      <mesh position={[0, -0.1, 0]} scale={[0.21, 0.21, 0.21]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial color="#0e1523" roughness={0.14} metalness={0.82} />
      </mesh>
      <mesh position={[0, -0.01, 0]} scale={[0.17, 0.24, 0.17]}>
        <cylinderGeometry args={[1, 0.92, 1, 36]} />
        <meshStandardMaterial color="#111928" roughness={0.18} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.13, 0]} scale={[0.13, 0.2, 0.13]}>
        <cylinderGeometry args={[1, 0.86, 1, 36]} />
        <meshStandardMaterial color="#1a2433" roughness={0.2} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.26, 0]} scale={[0.16, 0.1, 0.16]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial color="#0f1624" roughness={0.14} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.33, 0]} scale={[0.12, 0.12, 0.12]}>
        <cylinderGeometry args={[1, 0.88, 1, 30]} />
        <meshStandardMaterial color="#1b2433" roughness={0.16} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.42, 0]} scale={[0.14, 0.09, 0.14]}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial color="#101828" roughness={0.14} metalness={0.82} />
      </mesh>

      <mesh position={[-0.04, 0.44, 0.04]} rotation={[0.44, 0.08, -0.5]} scale={[0.08, 0.25, 0.08]}>
        <cylinderGeometry args={[1, 0.9, 1, 24]} />
        <meshStandardMaterial color="#182231" roughness={0.18} metalness={0.78} />
      </mesh>
      <mesh position={[-0.074, 0.47, 0.07]} scale={[0.1, 0.08, 0.1]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#101726" roughness={0.15} metalness={0.82} />
      </mesh>

      <group ref={bodyRef} position={[-0.03, 0.06, 0.02]}>
        <RoundedBox args={[0.7, 0.34, 0.52]} radius={0.1} smoothness={7}>
          <meshStandardMaterial color="#d9e2ec" roughness={0.18} metalness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.6, 0.23, 0.42]} radius={0.08} smoothness={7} position={[0, 0.02, 0.06]}>
          <meshStandardMaterial color="#111827" roughness={0.08} metalness={0.04} />
        </RoundedBox>
        <mesh position={[0.34, -0.02, 0]} scale={[0.07, 0.13, 0.07]} rotation={[0, 0, -0.28]}>
          <cylinderGeometry args={[1, 0.9, 1, 20]} />
          <meshStandardMaterial color="#dce5ef" roughness={0.2} metalness={0.24} />
        </mesh>
      </group>

      <group ref={headRef} position={[-0.1, 0.44, 0.08]} rotation={[-0.06, 0.34, -0.05]}>
        <RoundedBox args={[1.1, 0.64, 0.64]} radius={0.14} smoothness={7}>
          <meshStandardMaterial color="#e4ebf3" roughness={0.14} metalness={0.3} />
        </RoundedBox>
        <RoundedBox args={[0.96, 0.52, 0.58]} radius={0.09} smoothness={7} position={[0, 0.01, 0.08]}>
          <meshStandardMaterial color="#050b12" roughness={0.06} metalness={0.02} />
        </RoundedBox>
        <mesh position={[0, 0.3, 0]} scale={[0.26, 0.03, 0.05]}>
          <cylinderGeometry args={[1, 1, 1, 24]} />
          <meshStandardMaterial color="#a5b2bf" roughness={0.16} metalness={0.62} />
        </mesh>
        <mesh position={[-0.17, 0.02, 0.39]} scale={[0.085, 0.085, 0.085]}>
          <sphereGeometry args={[1, 28, 28]} />
          <meshStandardMaterial color="#95fff0" emissive="#34d399" emissiveIntensity={3} roughness={0.04} metalness={0.02} />
        </mesh>
        <mesh position={[0.15, 0.02, 0.39]} scale={[0.085, 0.085, 0.085]}>
          <sphereGeometry args={[1, 28, 28]} />
          <meshStandardMaterial color="#95fff0" emissive="#34d399" emissiveIntensity={3} roughness={0.04} metalness={0.02} />
        </mesh>
        <mesh position={[0.45, -0.02, -0.02]} scale={[0.06, 0.14, 0.06]}>
          <cylinderGeometry args={[1, 1, 1, 20]} />
          <meshStandardMaterial color="#3a4654" roughness={0.2} metalness={0.74} />
        </mesh>
        <mesh position={[0.45, -0.02, -0.01]} scale={[0.04, 0.09, 0.04]}>
          <cylinderGeometry args={[1, 1, 1, 20]} />
          <meshStandardMaterial color="#9bf6e9" emissive="#34d399" emissiveIntensity={1.2} roughness={0.1} metalness={0.2} />
        </mesh>
      </group>

      <mesh position={[0.72, -0.5, 0.3]} scale={[0.11, 0.03, 0.11]}>
        <cylinderGeometry args={[1, 1, 1, 24]} />
        <meshStandardMaterial color="#273548" roughness={0.2} metalness={0.66} />
      </mesh>

      <mesh position={[0, -1.56, 0.04]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4, 1.4, 1]}>
        <ringGeometry args={[0.86, 1.02, 64]} />
        <meshBasicMaterial
          color={isAdmin ? "#34d399" : "#22d3ee"}
          transparent
          opacity={0.24}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, -1.57, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.7, 1.32, 1]}>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial color={isAdmin ? "#6ee7b7" : "#67e8f9"} transparent opacity={0.09} side={DoubleSide} />
      </mesh>
    </group>
  );
}

export default function ThreeRobotPlaceholder(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0.12, 4.5], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.72} />
      <directionalLight position={[2.8, 4.2, 3.2]} intensity={1.32} color="#ffffff" />
      <directionalLight position={[-2.6, 1.8, 1.2]} intensity={0.5} color="#dbeafe" />
      <pointLight position={[1.8, 1, 1.6]} intensity={0.9} color="#67e8f9" />
      <pointLight position={[0.2, -0.1, 1.8]} intensity={0.24} color="#bfdbfe" />
      <RobotModel {...props} />
    </Canvas>
  );
}
