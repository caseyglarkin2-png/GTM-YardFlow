/**
 * SuccessCelebration Component - Sprint V34 P1.3
 * 
 * Shows a celebratory confetti animation when bulk operations succeed.
 * Uses CSS animations for performance - no external dependencies.
 */

import { useEffect, useState, memo } from 'react';

interface SuccessCelebrationProps {
  /** Whether to show the celebration */
  show: boolean;
  /** Duration in milliseconds before auto-hiding */
  duration?: number;
  /** Number of confetti pieces */
  count?: number;
}

// Confetti colors
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  color: string;
  duration: number;
  rotation: number;
}

/**
 * Generates an array of confetti pieces with random properties.
 */
function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: randomInt(0, 100),
    delay: randomInt(0, 500),
    color: COLORS[randomInt(0, COLORS.length - 1)],
    duration: randomInt(2000, 3500),
    rotation: randomInt(0, 360),
  }));
}

/**
 * A single confetti piece that falls and spins.
 */
const ConfettiPieceEl = memo(function ConfettiPieceEl({ piece }: { piece: ConfettiPiece }) {
  return (
    <div
      className="absolute top-0 w-3 h-3 animate-confetti-fall"
      style={{
        left: `${piece.left}%`,
        animationDelay: `${piece.delay}ms`,
        animationDuration: `${piece.duration}ms`,
        backgroundColor: piece.color,
        transform: `rotate(${piece.rotation}deg)`,
      }}
      data-testid="confetti-piece"
    />
  );
});

/**
 * Success celebration overlay with confetti animation.
 */
export function SuccessCelebration({
  show,
  duration = 3000,
  count = 50,
}: SuccessCelebrationProps): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setPieces(generateConfetti(count));

      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, count]);

  if (!visible) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      data-testid="success-celebration"
      aria-hidden="true"
    >
      {/* Confetti container */}
      <div className="relative w-full h-full">
        {pieces.map((piece) => (
          <ConfettiPieceEl key={piece.id} piece={piece} />
        ))}
      </div>

      {/* Global styles for animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

export default SuccessCelebration;
