import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Repeat, 
  Maximize2, 
  Sparkles, 
  Activity, 
  Layers, 
  Eye, 
  Volume2 
} from 'lucide-react';

// Predefined Sign Pose Coordinate Keyframes (Normalized canvas coords, center=(0.5, 0.5))
// Each pose defines head (x,y), leftHand (x,y,shape), rightHand (x,y,shape), faceExpression
const SIGN_POSES = {
  REST: {
    head: { x: 0.5, y: 0.22, tilt: 0 },
    leftArm: { elbow: { x: 0.32, y: 0.55 }, wrist: { x: 0.38, y: 0.8 }, shape: 'rest' },
    rightArm: { elbow: { x: 0.68, y: 0.55 }, wrist: { x: 0.62, y: 0.8 }, shape: 'rest' },
    expression: 'neutral'
  },
  HELLO: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0.04 },
      leftArm: { elbow: { x: 0.32, y: 0.56 }, wrist: { x: 0.36, y: 0.78 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.72, y: 0.35 }, wrist: { x: 0.66, y: 0.23 }, shape: 'open' },
      expression: 'smile'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: -0.02 },
      leftArm: { elbow: { x: 0.32, y: 0.56 }, wrist: { x: 0.36, y: 0.78 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.82, y: 0.32 }, wrist: { x: 0.84, y: 0.18 }, shape: 'wave' },
      expression: 'smile'
    }
  ],
  'THANK YOU': [
    {
      head: { x: 0.5, y: 0.22, tilt: 0.05 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.64, y: 0.42 }, wrist: { x: 0.54, y: 0.3 }, shape: 'flat_chin' },
      expression: 'smile'
    },
    {
      head: { x: 0.5, y: 0.24, tilt: 0.08 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.72, y: 0.48 }, wrist: { x: 0.64, y: 0.46 }, shape: 'flat_forward' },
      expression: 'smile'
    }
  ],
  PLEASE: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0.03 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.66, y: 0.52 }, wrist: { x: 0.48, y: 0.48 }, shape: 'flat_chest' },
      expression: 'polite'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: 0.03 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.62, y: 0.46 }, wrist: { x: 0.54, y: 0.42 }, shape: 'flat_chest' },
      expression: 'polite'
    }
  ],
  HELP: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.36, y: 0.56 }, wrist: { x: 0.48, y: 0.6 }, shape: 'palm_up' },
      rightArm: { elbow: { x: 0.64, y: 0.56 }, wrist: { x: 0.49, y: 0.54 }, shape: 'fist_thumb_up' },
      expression: 'focused'
    },
    {
      head: { x: 0.5, y: 0.21, tilt: -0.02 },
      leftArm: { elbow: { x: 0.36, y: 0.48 }, wrist: { x: 0.48, y: 0.46 }, shape: 'palm_up' },
      rightArm: { elbow: { x: 0.64, y: 0.48 }, wrist: { x: 0.49, y: 0.4 }, shape: 'fist_thumb_up' },
      expression: 'focused'
    }
  ],
  WATER: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.42 }, wrist: { x: 0.52, y: 0.32 }, shape: 'w_shape' },
      expression: 'neutral'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.44 }, wrist: { x: 0.54, y: 0.35 }, shape: 'w_shape' },
      expression: 'neutral'
    }
  ],
  FOOD: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0.04 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.66, y: 0.42 }, wrist: { x: 0.51, y: 0.29 }, shape: 'eat_taper' },
      expression: 'smile'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: 0.02 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.46 }, wrist: { x: 0.55, y: 0.34 }, shape: 'eat_taper' },
      expression: 'smile'
    }
  ],
  YES: [
    {
      head: { x: 0.5, y: 0.23, tilt: 0.06 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.46 }, wrist: { x: 0.6, y: 0.38 }, shape: 'fist_down' },
      expression: 'smile'
    },
    {
      head: { x: 0.5, y: 0.21, tilt: -0.04 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.44 }, wrist: { x: 0.6, y: 0.32 }, shape: 'fist_up' },
      expression: 'smile'
    }
  ],
  NO: [
    {
      head: { x: 0.5, y: 0.22, tilt: -0.06 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.44 }, wrist: { x: 0.62, y: 0.34 }, shape: 'snap_open' },
      expression: 'neutral'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: 0.06 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.44 }, wrist: { x: 0.58, y: 0.36 }, shape: 'snap_closed' },
      expression: 'neutral'
    }
  ],
  I: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.5 }, wrist: { x: 0.5, y: 0.45 }, shape: 'point_self' },
      expression: 'focused'
    }
  ],
  YOU: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.32, y: 0.58 }, wrist: { x: 0.36, y: 0.8 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.68, y: 0.46 }, wrist: { x: 0.56, y: 0.4 }, shape: 'point_forward' },
      expression: 'smile'
    }
  ],
  EMERGENCY: [
    {
      head: { x: 0.5, y: 0.21, tilt: -0.06 },
      leftArm: { elbow: { x: 0.34, y: 0.5 }, wrist: { x: 0.42, y: 0.44 }, shape: 'shake_left' },
      rightArm: { elbow: { x: 0.66, y: 0.48 }, wrist: { x: 0.62, y: 0.36 }, shape: 'e_shake' },
      expression: 'urgent'
    },
    {
      head: { x: 0.5, y: 0.21, tilt: 0.06 },
      leftArm: { elbow: { x: 0.34, y: 0.5 }, wrist: { x: 0.38, y: 0.44 }, shape: 'shake_right' },
      rightArm: { elbow: { x: 0.66, y: 0.48 }, wrist: { x: 0.68, y: 0.36 }, shape: 'e_shake' },
      expression: 'urgent'
    }
  ],
  MEDICINE: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.34, y: 0.56 }, wrist: { x: 0.46, y: 0.58 }, shape: 'palm_up' },
      rightArm: { elbow: { x: 0.64, y: 0.52 }, wrist: { x: 0.48, y: 0.55 }, shape: 'grind_pill' },
      expression: 'focused'
    },
    {
      head: { x: 0.5, y: 0.22, tilt: 0 },
      leftArm: { elbow: { x: 0.34, y: 0.56 }, wrist: { x: 0.46, y: 0.58 }, shape: 'palm_up' },
      rightArm: { elbow: { x: 0.64, y: 0.52 }, wrist: { x: 0.44, y: 0.55 }, shape: 'grind_pill' },
      expression: 'focused'
    }
  ],
  LOVE: [
    {
      head: { x: 0.5, y: 0.22, tilt: 0.05 },
      leftArm: { elbow: { x: 0.32, y: 0.56 }, wrist: { x: 0.38, y: 0.76 }, shape: 'rest' },
      rightArm: { elbow: { x: 0.72, y: 0.4 }, wrist: { x: 0.68, y: 0.26 }, shape: 'ily_hand' },
      expression: 'smile'
    }
  ]
};

export default function SignLanguageAvatar({
  tokens = [],
  signLanguage = 'ASL',
  onFinish = () => {}
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [viewMode, setViewMode] = useState('avatar'); // 'avatar' | 'skeleton'
  const [speed, setSpeed] = useState(1.0); // 0.5, 0.75, 1.0, 1.25, 1.5
  const [isLooping, setIsLooping] = useState(false);
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef({
    startTime: 0,
    currentPose: SIGN_POSES.REST,
    targetPose: SIGN_POSES.REST,
    transitionFactor: 1.0,
    activeToken: ''
  });

  // Clean and prepare words list
  const wordTokens = React.useMemo(() => {
    if (!tokens || tokens.length === 0) return ['HELLO', 'THANK YOU', 'HELP'];
    return tokens.map(t => {
      const str = (typeof t === 'string' ? t : t.word || t.gloss || '').toUpperCase().trim();
      return str.replace(/^FS:/, '');
    }).filter(Boolean);
  }, [tokens]);

  useEffect(() => {
    setCurrentWordIndex(0);
    setProgress(0);
    if (wordTokens.length > 0) {
      setIsPlaying(true);
    }
  }, [wordTokens]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let lastTimestamp = performance.now();
    let tokenElapsed = 0;
    const TOKEN_DURATION = 1400 / speed; // ms per token

    const render = (now) => {
      const dt = now - lastTimestamp;
      lastTimestamp = now;

      // Handle word progression if playing
      if (isPlaying && wordTokens.length > 0) {
        tokenElapsed += dt;
        const currentProgress = Math.min(tokenElapsed / TOKEN_DURATION, 1.0);
        setProgress(((currentWordIndex + currentProgress) / wordTokens.length) * 100);

        if (tokenElapsed >= TOKEN_DURATION) {
          tokenElapsed = 0;
          if (currentWordIndex < wordTokens.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
          } else {
            if (isLooping) {
              setCurrentWordIndex(0);
            } else {
              setIsPlaying(false);
              onFinish();
            }
          }
        }
      }

      // Determine active pose keyframe
      const activeWord = wordTokens[currentWordIndex] || 'REST';
      stateRef.current.activeToken = activeWord;

      let keyframes = SIGN_POSES[activeWord] || SIGN_POSES.REST;
      if (!Array.isArray(keyframes)) keyframes = [keyframes];

      // Oscillate or cycle within word keyframes
      const subIndex = Math.floor((tokenElapsed / (TOKEN_DURATION / keyframes.length))) % keyframes.length;
      const targetPose = keyframes[subIndex] || SIGN_POSES.REST;

      // Smooth Lerp towards target pose
      const lerpSpeed = 0.15 * speed;
      const cur = stateRef.current.currentPose;
      
      const lerpedPose = {
        head: {
          x: cur.head.x + (targetPose.head.x - cur.head.x) * lerpSpeed,
          y: cur.head.y + (targetPose.head.y - cur.head.y) * lerpSpeed,
          tilt: cur.head.tilt + (targetPose.head.tilt - cur.head.tilt) * lerpSpeed
        },
        leftArm: {
          elbow: {
            x: cur.leftArm.elbow.x + (targetPose.leftArm.elbow.x - cur.leftArm.elbow.x) * lerpSpeed,
            y: cur.leftArm.elbow.y + (targetPose.leftArm.elbow.y - cur.leftArm.elbow.y) * lerpSpeed
          },
          wrist: {
            x: cur.leftArm.wrist.x + (targetPose.leftArm.wrist.x - cur.leftArm.wrist.x) * lerpSpeed,
            y: cur.leftArm.wrist.y + (targetPose.leftArm.wrist.y - cur.leftArm.wrist.y) * lerpSpeed
          },
          shape: targetPose.leftArm.shape
        },
        rightArm: {
          elbow: {
            x: cur.rightArm.elbow.x + (targetPose.rightArm.elbow.x - cur.rightArm.elbow.x) * lerpSpeed,
            y: cur.rightArm.elbow.y + (targetPose.rightArm.elbow.y - cur.rightArm.elbow.y) * lerpSpeed
          },
          wrist: {
            x: cur.rightArm.wrist.x + (targetPose.rightArm.wrist.x - cur.rightArm.wrist.x) * lerpSpeed,
            y: cur.rightArm.wrist.y + (targetPose.rightArm.wrist.y - cur.rightArm.wrist.y) * lerpSpeed
          },
          shape: targetPose.rightArm.shape
        },
        expression: targetPose.expression
      };
      stateRef.current.currentPose = lerpedPose;

      // Draw frame
      drawFrame(ctx, canvas.width, canvas.height, lerpedPose, viewMode, activeWord, now);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, currentWordIndex, wordTokens, speed, isLooping, viewMode]);

  // Main Canvas Painter (Avatar & Skeleton)
  const drawFrame = (ctx, w, h, pose, mode, activeWord, timestamp) => {
    ctx.clearRect(0, 0, w, h);

    // Subtle background gradient grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (mode === 'skeleton') {
      bgGrad.addColorStop(0, '#0B0F19');
      bgGrad.addColorStop(1, '#111827');
    } else {
      bgGrad.addColorStop(0, '#1E293B');
      bgGrad.addColorStop(1, '#0F172A');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid accent lines
    ctx.strokeStyle = mode === 'skeleton' ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Coordinates mapping
    const cx = (nx) => nx * w;
    const cy = (ny) => ny * h;

    const shoulderL = { x: cx(0.38), y: cy(0.36) };
    const shoulderR = { x: cx(0.62), y: cy(0.36) };
    const neck = { x: cx(0.5), y: cy(0.32) };
    const spine = { x: cx(0.5), y: cy(0.62) };
    const head = { x: cx(pose.head.x), y: cy(pose.head.y) };

    const elbowL = { x: cx(pose.leftArm.elbow.x), y: cy(pose.leftArm.elbow.y) };
    const wristL = { x: cx(pose.leftArm.wrist.x), y: cy(pose.leftArm.wrist.y) };

    const elbowR = { x: cx(pose.rightArm.elbow.x), y: cy(pose.rightArm.elbow.y) };
    const wristR = { x: cx(pose.rightArm.wrist.x), y: cy(pose.rightArm.wrist.y) };

    if (mode === 'skeleton') {
      // SKELETON POSE VIEWER (Rylo / sign.mt wireframe style)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Spine & Torso (Blue wireframe)
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(shoulderL.x, shoulderL.y);
      ctx.lineTo(shoulderR.x, shoulderR.y);
      ctx.lineTo(spine.x, spine.y);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(neck.x, neck.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      // Left Arm (Amber/Yellow wireframe)
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(shoulderL.x, shoulderL.y);
      ctx.lineTo(elbowL.x, elbowL.y);
      ctx.lineTo(wristL.x, wristL.y);
      ctx.stroke();

      // Right Arm (Violet/Pink wireframe)
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(shoulderR.x, shoulderR.y);
      ctx.lineTo(elbowR.x, elbowR.y);
      ctx.lineTo(wristR.x, wristR.y);
      ctx.stroke();

      // Hand Fingers Wireframes (21 joints simulation)
      drawSkeletonHand(ctx, wristL, elbowL, '#34D399');
      drawSkeletonHand(ctx, wristR, elbowR, '#F43F5E');

      // Head / Face Mesh (Cyan wireframe oval & eyes)
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, 36, 44, pose.head.tilt, 0, Math.PI * 2);
      ctx.stroke();

      // Face landmarks
      const eyeOffsetX = 14;
      const eyeOffsetY = -4;
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(head.x - eyeOffsetX, head.y + eyeOffsetY, 4, 0, Math.PI * 2);
      ctx.arc(head.x + eyeOffsetX, head.y + eyeOffsetY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Nose & Mouth line
      ctx.beginPath();
      ctx.moveTo(head.x, head.y - 2);
      ctx.lineTo(head.x, head.y + 12);
      ctx.lineTo(head.x - 6, head.y + 20);
      ctx.lineTo(head.x + 6, head.y + 20);
      ctx.stroke();

      // Keypoint Joint Dots
      const joints = [head, neck, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, spine];
      joints.forEach(j => {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(j.x, j.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

    } else {
      // AVATAR MODE (Smooth Shaded Humanoid Avatar)
      // Torso / Jersey
      ctx.fillStyle = '#1E3A8A'; // Deep accessibility blue
      ctx.beginPath();
      ctx.moveTo(shoulderL.x, shoulderL.y);
      ctx.lineTo(shoulderR.x, shoulderR.y);
      ctx.lineTo(shoulderR.x + 20, cy(0.85));
      ctx.lineTo(shoulderL.x - 20, cy(0.85));
      ctx.closePath();
      ctx.fill();

      // Collar
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.ellipse(cx(0.5), cy(0.38), 24, 12, 0, 0, Math.PI);
      ctx.fill();

      // Neck
      ctx.fillStyle = '#FBBF24'; // Warm skin tone
      ctx.fillRect(cx(0.46), cy(0.28), cx(0.08), cy(0.1));

      // Head
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(pose.head.tilt);

      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 50, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, -18, 44, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes (Blink naturally)
      const blink = Math.sin(timestamp / 700) > 0.96;
      ctx.fillStyle = '#1E293B';
      if (blink) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1E293B';
        ctx.beginPath();
        ctx.moveTo(-22, -4); ctx.lineTo(-8, -4);
        ctx.moveTo(8, -4); ctx.lineTo(22, -4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-15, -4, 5, 0, Math.PI * 2);
        ctx.arc(15, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        // Eye whites/reflection
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-13, -6, 2, 0, Math.PI * 2);
        ctx.arc(17, -6, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      if (pose.expression === 'smile') {
        ctx.arc(0, 16, 14, 0.2, Math.PI - 0.2);
      } else if (pose.expression === 'urgent') {
        ctx.ellipse(0, 20, 8, 10, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 18, 10, 0.1, Math.PI - 0.1);
      }
      ctx.stroke();

      ctx.restore();

      // Arms (Skin & Sleeves)
      drawShadedArm(ctx, shoulderL, elbowL, wristL, '#FBBF24', '#1E3A8A');
      drawShadedArm(ctx, shoulderR, elbowR, wristR, '#FBBF24', '#1E3A8A');

      // Detailed Hands
      drawShadedHand(ctx, wristL, elbowL, '#FDE68A', pose.leftArm.shape);
      drawShadedHand(ctx, wristR, elbowR, '#FDE68A', pose.rightArm.shape);
    }

    // Active Sign Token Overlay Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(16, h - 54, w - 32, 42);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, h - 54, w - 32, 42);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 12px Inter, system-ui';
    ctx.fillText(`${signLanguage} SIGN TRANSLATION`, 30, h - 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 16px Inter, system-ui';
    ctx.fillText(`[ ${activeWord} ]`, 30, h - 18);
  };

  // Helper: Draw realistic shaded arm with sleeve
  const drawShadedArm = (ctx, shoulder, elbow, wrist, skinColor, sleeveColor) => {
    // Upper Arm Sleeve
    ctx.strokeStyle = sleeveColor;
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.stroke();

    // Forearm Skin
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();
  };

  // Helper: Draw articulated hand
  const drawShadedHand = (ctx, wrist, elbow, skinColor, shape) => {
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    ctx.save();
    ctx.translate(wrist.x, wrist.y);
    ctx.rotate(angle);

    // Palm
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(12, 0, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5 Individual Fingers
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = skinColor;

    if (shape === 'fist_thumb_up' || shape === 'fist_up') {
      // Closed fist with thumb up
      ctx.beginPath();
      ctx.moveTo(8, -12); ctx.lineTo(16, -26); // Thumb up
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(14, 2, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'w_shape') {
      // 3 Fingers extended (W)
      [-6, 0, 6].forEach(offset => {
        ctx.beginPath();
        ctx.moveTo(14, offset);
        ctx.lineTo(34, offset * 1.5);
        ctx.stroke();
      });
    } else {
      // Open hand fingers
      [-10, -5, 0, 5, 10].forEach((offset, idx) => {
        const len = idx === 2 ? 34 : (idx === 0 ? 20 : 30);
        ctx.beginPath();
        ctx.moveTo(14, offset);
        ctx.lineTo(14 + len, offset * 1.3);
        ctx.stroke();
      });
    }

    ctx.restore();
  };

  // Helper: Draw skeleton hand joints
  const drawSkeletonHand = (ctx, wrist, elbow, color) => {
    const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    ctx.save();
    ctx.translate(wrist.x, wrist.y);
    ctx.rotate(angle);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#FFFFFF';

    // 5 Finger Rays
    [-9, -4, 0, 4, 9].forEach((offset, i) => {
      const len = i === 2 ? 30 : 25;
      ctx.beginPath();
      ctx.moveTo(6, offset);
      ctx.lineTo(6 + len * 0.5, offset * 1.2);
      ctx.lineTo(6 + len, offset * 1.5);
      ctx.stroke();

      // Finger tip joint
      ctx.beginPath();
      ctx.arc(6 + len, offset * 1.5, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  return (
    <div className="sign-language-avatar-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Visual Canvas Display */}
      <div 
        style={{ 
          position: 'relative', 
          width: '100%', 
          aspectRatio: '4/3', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          border: '2px solid var(--border-color)',
          backgroundColor: '#0F172A'
        }}
      >
        <canvas 
          ref={canvasRef} 
          width={480} 
          height={360} 
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Top-Right Badges: Mode & Dialect */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '0.4rem', zIndex: 10 }}>
          <button 
            className="btn btn-outline"
            onClick={() => setViewMode(m => m === 'avatar' ? 'skeleton' : 'avatar')}
            style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.8)', 
              color: '#38BDF8', 
              borderColor: '#38BDF8', 
              padding: '0.25rem 0.65rem', 
              fontSize: '0.75rem', 
              backdropFilter: 'blur(8px)',
              fontWeight: 700 
            }}
            title="Toggle between 3D Humanoid Avatar and Skeleton Pose Wireframe"
          >
            {viewMode === 'avatar' ? <Layers size={13} style={{ marginRight: '4px' }} /> : <Activity size={13} style={{ marginRight: '4px' }} />}
            {viewMode === 'avatar' ? 'Skeleton Mode' : 'Avatar Mode'}
          </button>

          <span 
            style={{ 
              backgroundColor: 'rgba(56, 189, 248, 0.15)', 
              color: '#38BDF8', 
              border: '1px solid rgba(56, 189, 248, 0.4)', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '9999px', 
              fontSize: '0.75rem', 
              fontWeight: 800 
            }}
          >
            {signLanguage}
          </span>
        </div>

        {/* Floating Play/Pause Center Overlay on Hover */}
        <div 
          onClick={() => setIsPlaying(p => !p)}
          style={{ 
            position: 'absolute', 
            inset: 0, 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: !isPlaying ? 'rgba(0,0,0,0.35)' : 'transparent',
            transition: 'background-color 0.2s'
          }}
        >
          {!isPlaying && (
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--primary)', 
              color: '#FFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(79, 70, 229, 0.6)'
            }}>
              <Play size={30} style={{ marginLeft: '4px' }} />
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Timeline */}
      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${progress}%`, 
            backgroundColor: '#16A34A', 
            transition: 'width 0.1s linear' 
          }} 
        />
      </div>

      {/* Playback Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        {/* Play / Pause / Replay */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setIsPlaying(p => !p)}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            aria-label={isPlaying ? 'Pause sign animation' : 'Play sign animation'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span style={{ marginLeft: '0.35rem' }}>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => {
              setCurrentWordIndex(0);
              setProgress(0);
              setIsPlaying(true);
            }}
            style={{ padding: '0.45rem 0.65rem' }}
            title="Restart from beginning"
          >
            <RotateCcw size={15} />
          </button>

          <button 
            className={`btn ${isLooping ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setIsLooping(l => !l)}
            style={{ padding: '0.45rem 0.65rem' }}
            title={isLooping ? 'Looping enabled' : 'Click to loop'}
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Speed:</span>
          {[0.5, 0.75, 1.0, 1.25].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '0.2rem 0.45rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: speed === s ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: speed === s ? 'var(--primary)' : 'transparent',
                color: speed === s ? '#FFF' : 'var(--text-color)',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Karaoke Sync Tokens Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
        {wordTokens.map((w, idx) => {
          const isActive = idx === currentWordIndex;
          return (
            <button
              key={`${w}-${idx}`}
              onClick={() => {
                setCurrentWordIndex(idx);
                setIsPlaying(true);
              }}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: isActive ? 800 : 600,
                borderRadius: '8px',
                border: isActive ? '2px solid #16A34A' : '1px solid var(--border-color)',
                backgroundColor: isActive ? 'rgba(22, 163, 74, 0.2)' : 'var(--bg-surface)',
                color: isActive ? '#16A34A' : 'var(--text-color)',
                boxShadow: isActive ? '0 0 10px rgba(22, 163, 74, 0.35)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
