import type { CSSProperties } from "react";
import type { AuthRole } from "./RoleSwitch";

type Props = {
  role: AuthRole;
  tx: number;
  ty: number;
};

export default function RobotHeroArt({ role, tx, ty }: Props) {
  const admin = role === "admin";
  const eyeInner = admin ? "#b6fff2" : "#c8f4ff";
  const eyeOuter = admin ? "#2dd4bf" : "#22d3ee";
  const ry = Math.max(-7, Math.min(7, tx * 0.05));
  const rx = Math.max(-4, Math.min(4, -ty * 0.04));
  const bob = Math.sin((tx + ty) * 0.02) * 1.6;

  // Mouse-follow only for head: bounded rotation/translation to keep it natural.
  const headYaw = Math.max(-16, Math.min(16, tx * 1.05));
  const headPitch = Math.max(-10, Math.min(10, -ty * 0.62));
  const headShiftX = Math.max(-6, Math.min(6, tx * 0.45));
  const headShiftY = Math.max(-4, Math.min(4, ty * 0.2));
  const headFollowTransform = `translate(${headShiftX} ${headShiftY}) rotate(${headYaw} 408 324) rotate(${headPitch * 0.35} 408 360)`;

  const move: CSSProperties = {
    transform: `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${tx * 0.4}px, ${ty * 0.36 + bob}px, 0)`,
    transformStyle: "preserve-3d",
  };

  return (
    <div className="relative h-full w-full" style={move}>
      <svg viewBox="0 0 820 820" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="baseA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a111d" />
            <stop offset="100%" stopColor="#25324a" />
          </linearGradient>
          <linearGradient id="baseB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#111b2b" />
            <stop offset="100%" stopColor="#2f3e57" />
          </linearGradient>
          <linearGradient id="baseC" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#111c2d" />
            <stop offset="100%" stopColor="#27364f" />
          </linearGradient>
          <linearGradient id="headShell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8eef4" />
            <stop offset="100%" stopColor="#b7c2d0" />
          </linearGradient>
          <linearGradient id="headInner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#070d15" />
            <stop offset="100%" stopColor="#050b12" />
          </linearGradient>
          <linearGradient id="headRim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={eyeInner} />
            <stop offset="100%" stopColor={eyeOuter} />
          </radialGradient>
          <radialGradient id="floorGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(45,212,191,0.3)" />
            <stop offset="100%" stopColor="rgba(45,212,191,0)" />
          </radialGradient>
          <radialGradient id="metalBloom" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="metalSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="35%" stopColor="rgba(148,163,184,0.12)" />
            <stop offset="60%" stopColor="rgba(59,130,246,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <radialGradient id="screenBloom" cx="50%" cy="60%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id="eyeSpec" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="sideDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1220" />
            <stop offset="100%" stopColor="#050a12" />
          </linearGradient>
          <linearGradient id="headSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9d3df" />
            <stop offset="100%" stopColor="#9daaba" />
          </linearGradient>
          <linearGradient id="edgeGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(125,211,252,0.7)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.5)" />
          </linearGradient>
          <filter id="contactShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#020617" floodOpacity="0.45" />
          </filter>
          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.28" />
          </filter>
          <filter id="headShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.24" />
          </filter>
        </defs>

        <ellipse cx="410" cy="760" rx="260" ry="58" fill="url(#floorGlow)" />

        <g filter="url(#softShadow)">
          <rect x="110" y="560" width="600" height="170" rx="24" fill="url(#baseA)" />
          <rect x="110" y="560" width="600" height="170" rx="24" fill="url(#metalSheen)" opacity="0.55" />
          <path d="M706 572 706 725 735 706 735 590Z" fill="url(#sideDark)" opacity="0.85" />
          <rect x="110" y="560" width="600" height="170" rx="24" fill="url(#metalBloom)" />
          <rect x="110" y="560" width="600" height="170" rx="24" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="2" />
          <path d="M122 571h576" stroke="url(#edgeGlow)" strokeWidth="2" opacity="0.72" />
          <rect x="165" y="510" width="490" height="90" rx="20" fill="url(#baseB)" />
          <rect x="165" y="510" width="490" height="90" rx="20" fill="url(#metalSheen)" opacity="0.48" />
          <path d="M652 520 652 600 676 586 676 530Z" fill="url(#sideDark)" opacity="0.78" />
          <rect x="165" y="510" width="490" height="90" rx="20" fill="url(#metalBloom)" opacity="0.52" />
          <path d="M178 520h464" stroke="url(#edgeGlow)" strokeWidth="2" opacity="0.64" />
          <rect x="215" y="462" width="390" height="68" rx="18" fill="url(#baseC)" />
          <rect x="215" y="462" width="390" height="68" rx="18" fill="url(#metalSheen)" opacity="0.45" />
          <path d="M602 471 602 530 622 519 622 482Z" fill="url(#sideDark)" opacity="0.72" />
          <rect x="215" y="462" width="390" height="68" rx="18" fill="url(#metalBloom)" opacity="0.45" />
          <path d="M228 471h364" stroke="url(#edgeGlow)" strokeWidth="2" opacity="0.6" />
        </g>

        <rect x="355" y="406" width="110" height="70" rx="18" fill="#111a29" filter="url(#contactShadow)" />
        <rect x="355" y="406" width="110" height="70" rx="18" fill="url(#metalSheen)" opacity="0.35" />
        <rect x="338" y="358" width="144" height="60" rx="20" fill="url(#headShell)" stroke="rgba(226,232,240,0.7)" strokeWidth="1.5" />
        <g transform={headFollowTransform}>
          <g transform="translate(408 324) rotate(-8)" filter="url(#headShadow)">
            <rect x="-180" y="-72" width="360" height="165" rx="34" fill="url(#headShell)" />
            <path d="M178 -58 178 73 204 56 204 -38Z" fill="url(#headSide)" opacity="0.9" />
            <rect x="-160" y="-52" width="320" height="122" rx="24" fill="url(#headInner)" />
            <rect x="-160" y="-52" width="320" height="122" rx="24" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="1.5" />
            <rect x="-160" y="-52" width="320" height="122" rx="24" fill="url(#screenBloom)" opacity="0.65" />
            <path d="M-170 -44h340" stroke="url(#headRim)" strokeWidth="3" opacity="0.8" />
            <path d="M-146 -34h292" stroke="rgba(255,255,255,0.18)" strokeWidth="2" opacity="0.7" />
            <circle cx="-58" cy="10" r="30" fill="url(#eyeGlow)" />
            <circle cx="58" cy="10" r="30" fill="url(#eyeGlow)" />
            <circle cx="-64" cy="2" r="16" fill="url(#eyeSpec)" opacity="0.34" />
            <circle cx="52" cy="2" r="16" fill="url(#eyeSpec)" opacity="0.34" />
            <circle cx="-58" cy="10" r="16" fill="rgba(255,255,255,0.25)" />
            <circle cx="58" cy="10" r="16" fill="rgba(255,255,255,0.25)" />
            <rect x="166" y="-8" width="18" height="40" rx="9" fill="#2dc5ae" />
            <rect x="-150" y="-44" width="292" height="6" rx="3" fill="rgba(255,255,255,0.22)" />
          </g>
        </g>
      </svg>
    </div>
  );
}
