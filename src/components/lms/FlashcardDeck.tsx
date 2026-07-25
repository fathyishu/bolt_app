import { useState } from 'react';
import { RotateCw, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { LmsFlashcard } from '../../lib/supabase';

export default function FlashcardDeck({ cards }: { cards: LmsFlashcard[] }) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gold-500 text-xs font-semibold uppercase tracking-wider">
        <HelpCircle className="w-4 h-4" /> Objection Flashcards
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map(card => {
          const isFlipped = flipped[card.id];
          return (
            <button
              key={card.id}
              onClick={() => setFlipped(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
              className="relative min-h-[140px] rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.01]"
              style={{ perspective: '1000px' }}
            >
              <div
                className="absolute inset-0 rounded-2xl transition-transform duration-500"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front — objection */}
                <div
                  className="absolute inset-0 rounded-2xl p-5 flex flex-col justify-between border border-red-500/20 bg-red-500/5"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="text-red-400 text-xs font-semibold uppercase tracking-wider">Objection</div>
                  <div className="text-white/90 font-medium text-sm">{card.front_text}</div>
                  <div className="flex items-center gap-1 text-white/30 text-xs">
                    <RotateCw className="w-3 h-3" /> Tap to reveal response
                  </div>
                </div>
                {/* Back — approved response */}
                <div
                  className="absolute inset-0 rounded-2xl p-5 flex flex-col justify-between border border-emerald-500/20 bg-emerald-500/5"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Approved Response
                  </div>
                  <div className="text-white/90 text-sm">{card.back_text}</div>
                  <div className="flex items-center gap-1 text-white/30 text-xs">
                    <RotateCw className="w-3 h-3" /> Tap to flip back
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
