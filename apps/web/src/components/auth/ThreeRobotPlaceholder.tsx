"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  DoubleSide,
  Euler,
  Group,
  LoopOnce,
  MathUtils,
  Matrix4,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type { AuthRole } from "./RoleSwitch";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
  gestureTick?: number;
  animations?: AnimationClip[];
};

type GestureName = "none" | "login_error";

function RobotModel({ role, tx, ty, gestureTick = 0, animations = [] }: Props) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const neckRef = useRef<Group>(null);
  const headBoneRef = useRef<Group | null>(null);
  const isAdmin = role === "admin";

  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, AnimationAction>>({});
  const gestureRef = useRef<{ name: GestureName; time: number; duration: number }>({
    name: "none",
    time: 0,
    duration: 0,
  });

  const headBaseQuatRef = useRef(new Quaternion());
  const headBaseCapturedRef = useRef(false);
  const headBasePosRef = useRef(new Vector3());
  const neckBaseRotRef = useRef(new Euler());
  const neckBaseCapturedRef = useRef(false);

  const ndcRef = useRef(new Vector2());
  const raycasterRef = useRef(new Raycaster());
  const lookPlaneRef = useRef(new Plane());
  const lookTargetRef = useRef(new Vector3());
  const cameraDirRef = useRef(new Vector3());
  const cameraPlanePointRef = useRef(new Vector3());
  const headWorldPosRef = useRef(new Vector3());
  const parentWorldQuatRef = useRef(new Quaternion());
  const invParentWorldQuatRef = useRef(new Quaternion());
  const desiredWorldQuatRef = useRef(new Quaternion());
  const desiredLocalQuatRef = useRef(new Quaternion());
  const deltaQuatRef = useRef(new Quaternion());
  const invBaseQuatRef = useRef(new Quaternion());
  const localEulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const lookMatrixRef = useRef(new Matrix4());

  const baseTarget = useMemo(
    () => ({
      rx: Math.max(-0.24, Math.min(0.24, -ty * 0.01)),
      ry: Math.max(-0.42, Math.min(0.42, tx * 0.012)),
    }),
    [tx, ty]
  );

  const playGesture = useCallback((gestureName: GestureName) => {
    const g = gestureRef.current;
    if (gestureName === "login_error") {
      g.name = "login_error";
      g.time = 0;
      g.duration = 0.58;
    } else {
      g.name = "none";
      g.time = 0;
      g.duration = 0;
    }

    const action = actionsRef.current[gestureName];
    if (action) {
      action.reset();
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.fadeIn(0.08).play();
    }
  }, []);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;

    // Explicit head-bone lookup; if your GLTF has a specific head bone name, replace "RobotHead".
    const foundHead = root.getObjectByName("RobotHead");
    if (foundHead && foundHead instanceof Group) {
      headBoneRef.current = foundHead;
    }

    if (!mixerRef.current) mixerRef.current = new AnimationMixer(root);
    const mixer = mixerRef.current;
    const nextActions: Record<string, AnimationAction> = {};
    for (const clip of animations) {
      nextActions[clip.name] = mixer.clipAction(clip, root);
    }
    actionsRef.current = nextActions;

    return () => {
      mixer.stopAllAction();
      actionsRef.current = {};
    };
  }, [animations]);

  useEffect(() => {
    if (gestureTick > 0) playGesture("login_error");
  }, [gestureTick, playGesture]);

  useFrame((state, delta) => {
    const root = groupRef.current;
    if (!root) return;

    mixerRef.current?.update(delta);

    const t = state.clock.elapsedTime;
    root.position.y = Math.sin(t * 1.1) * 0.05;
    root.rotation.x += (baseTarget.rx - root.rotation.x) * Math.min(1, delta * 6);
    root.rotation.y += (baseTarget.ry - root.rotation.y) * Math.min(1, delta * 6);

    const body = bodyRef.current;
    if (body) {
      const by = Math.max(-0.2, Math.min(0.2, tx * 0.0044));
      const bx = Math.max(-0.1, Math.min(0.1, -ty * 0.0034));
      body.rotation.y += (by - body.rotation.y) * Math.min(1, delta * 7);
      body.rotation.x += (bx - body.rotation.x) * Math.min(1, delta * 7);
    }

    const head = headBoneRef.current;
    if (!head) return;
    const neck = neckRef.current;

    if (!headBaseCapturedRef.current) {
      headBaseQuatRef.current.copy(head.quaternion);
      headBasePosRef.current.copy(head.position);
      headBaseCapturedRef.current = true;
    }
    if (neck && !neckBaseCapturedRef.current) {
      neckBaseRotRef.current.copy(neck.rotation);
      neckBaseCapturedRef.current = true;
    }

    // 1) Convert 2D cursor to NDC.
    ndcRef.current.set(MathUtils.clamp(tx / 14, -1, 1), MathUtils.clamp(-ty / 14, -1, 1));

    // 2) Build a plane in front of camera and raycast to get robust 3D look target.
    state.camera.getWorldDirection(cameraDirRef.current);
    cameraPlanePointRef.current.copy(state.camera.position).add(cameraDirRef.current.multiplyScalar(3.4));
    lookPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDirRef.current, cameraPlanePointRef.current);
    raycasterRef.current.setFromCamera(ndcRef.current, state.camera);

    const hit = raycasterRef.current.ray.intersectPlane(lookPlaneRef.current, lookTargetRef.current);
    if (!hit) {
      lookTargetRef.current.copy(cameraPlanePointRef.current);
    }

    // 3) Desired world orientation for head (look-at target).
    head.getWorldPosition(headWorldPosRef.current);
    // For regular objects/groups, three.js look-at math is the inverse of camera look-at.
    // Using target -> eye keeps the robot facing the cursor direction (non-inverted axes).
    lookMatrixRef.current.lookAt(lookTargetRef.current, headWorldPosRef.current, head.up);
    desiredWorldQuatRef.current.setFromRotationMatrix(lookMatrixRef.current);

    if (head.parent) {
      head.parent.getWorldQuaternion(parentWorldQuatRef.current);
      invParentWorldQuatRef.current.copy(parentWorldQuatRef.current).invert();
      desiredLocalQuatRef.current.copy(invParentWorldQuatRef.current).multiply(desiredWorldQuatRef.current);
    } else {
      desiredLocalQuatRef.current.copy(desiredWorldQuatRef.current);
    }

    // 4) Convert to local delta from base pose, then apply soft dynamic limits.
    invBaseQuatRef.current.copy(headBaseQuatRef.current).invert();
    deltaQuatRef.current.copy(invBaseQuatRef.current).multiply(desiredLocalQuatRef.current);
    localEulerRef.current.setFromQuaternion(deltaQuatRef.current, "YXZ");

    const lookDy = lookTargetRef.current.y - headWorldPosRef.current.y;
    const downFactor = MathUtils.clamp(-lookDy / 1.15, 0, 1);
    const dynamicYawLimit = MathUtils.lerp(0.54, 0.46, downFactor);
    const dynamicPitchLimit = MathUtils.lerp(0.26, 0.16, downFactor);
    const softLimit = (value: number, max: number) => max * Math.tanh(value / Math.max(max, 0.0001));

    localEulerRef.current.y = softLimit(localEulerRef.current.y, dynamicYawLimit);
    localEulerRef.current.x = softLimit(localEulerRef.current.x, dynamicPitchLimit);
    localEulerRef.current.z = softLimit(localEulerRef.current.z, 0.18);

    // 5) Gesture overlay (login fail -> short head shake).
    const gesture = gestureRef.current;
    if (gesture.name === "login_error") {
      gesture.time += delta;
      const p = Math.min(1, gesture.time / gesture.duration);
      const damp = 1 - p;
      localEulerRef.current.y += Math.sin(p * Math.PI * 10) * 0.24 * damp;
      localEulerRef.current.x += Math.sin(p * Math.PI * 6 + 0.5) * 0.08 * damp;
      if (p >= 1) {
        gesture.name = "none";
        gesture.time = 0;
        gesture.duration = 0;
      }
    }

    // Final hard stops after gesture.
    localEulerRef.current.y = MathUtils.clamp(localEulerRef.current.y, -dynamicYawLimit - 0.06, dynamicYawLimit + 0.06);
    localEulerRef.current.x = MathUtils.clamp(localEulerRef.current.x, -dynamicPitchLimit - 0.05, dynamicPitchLimit + 0.05);
    localEulerRef.current.z = MathUtils.clamp(localEulerRef.current.z, -0.22, 0.22);

    // Neck and head compensations to avoid visual overlap when aiming down.
    if (neck && neckBaseCapturedRef.current) {
      const neckBase = neckBaseRotRef.current;
      const neckYaw = MathUtils.clamp(localEulerRef.current.y * 0.34, -0.16, 0.16);
      const neckPitch = MathUtils.clamp(localEulerRef.current.x * 0.24, -0.09, 0.09) - downFactor * 0.03;
      neck.rotation.y += (neckBase.y + neckYaw - neck.rotation.y) * Math.min(1, delta * 7);
      neck.rotation.x += (neckBase.x + neckPitch - neck.rotation.x) * Math.min(1, delta * 7);
      neck.rotation.z += (neckBase.z - neck.rotation.z) * Math.min(1, delta * 7);
    }
    if (headBaseCapturedRef.current) {
      const targetHeadY = headBasePosRef.current.y + downFactor * 0.032;
      const targetHeadZ = headBasePosRef.current.z + downFactor * 0.02;
      head.position.y += (targetHeadY - head.position.y) * Math.min(1, delta * 9);
      head.position.z += (targetHeadZ - head.position.z) * Math.min(1, delta * 9);
    }

    deltaQuatRef.current.setFromEuler(localEulerRef.current);
    desiredLocalQuatRef.current.copy(headBaseQuatRef.current).multiply(deltaQuatRef.current);

    // 6) Smooth natural motion.
    head.quaternion.slerp(desiredLocalQuatRef.current, Math.min(1, delta * 10));
  });

  return (
    <group ref={groupRef} position={[0, -0.72, 0]} scale={1.06}>
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

      <group ref={neckRef} position={[-0.072, 0.43, 0.06]}>
        <mesh position={[0.032, 0.01, -0.02]} rotation={[0.44, 0.08, -0.5]} scale={[0.08, 0.25, 0.08]}>
          <cylinderGeometry args={[1, 0.9, 1, 24]} />
          <meshStandardMaterial color="#182231" roughness={0.18} metalness={0.78} />
        </mesh>
        <mesh position={[-0.002, 0.04, 0.01]} scale={[0.1, 0.08, 0.1]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color="#101726" roughness={0.15} metalness={0.82} />
        </mesh>
        <RoundedBox args={[0.26, 0.08, 0.22]} radius={0.03} smoothness={6} position={[0, -0.04, 0.002]}>
          <meshStandardMaterial color="#1a2434" roughness={0.2} metalness={0.72} />
        </RoundedBox>
        <group ref={headBoneRef as any} name="RobotHead" position={[-0.028, 0.01, 0.02]} rotation={[-0.06, 0.34, -0.05]}>
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
      </group>

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

      <mesh position={[0.72, -0.5, 0.3]} scale={[0.11, 0.03, 0.11]}>
        <cylinderGeometry args={[1, 1, 1, 24]} />
        <meshStandardMaterial color="#273548" roughness={0.2} metalness={0.66} />
      </mesh>

      <mesh position={[0, -1.56, 0.04]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4, 1.4, 1]}>
        <ringGeometry args={[0.86, 1.02, 64]} />
        <meshBasicMaterial color={isAdmin ? "#34d399" : "#22d3ee"} transparent opacity={0.24} side={DoubleSide} />
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
    <Canvas camera={{ position: [0, 0.18, 4.9], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.72} />
      <directionalLight position={[2.8, 4.2, 3.2]} intensity={1.32} color="#ffffff" />
      <directionalLight position={[-2.6, 1.8, 1.2]} intensity={0.5} color="#dbeafe" />
      <pointLight position={[1.8, 1, 1.6]} intensity={0.9} color="#67e8f9" />
      <pointLight position={[0.2, -0.1, 1.8]} intensity={0.24} color="#bfdbfe" />
      <RobotModel {...props} />
    </Canvas>
  );
}
