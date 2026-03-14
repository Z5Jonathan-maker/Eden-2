import React, { useState } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const Flashcard = ({ card, index, total }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="cursor-pointer select-none"
      onClick={() => setFlipped(!flipped)}
    >
      <div className={`relative rounded-xl border transition-all duration-500 min-h-[220px] ${
        flipped
          ? 'bg-gradient-to-br from-orange-950/30 to-zinc-900 border-orange-600/30'
          : 'bg-zinc-800/80 border-zinc-700/50 hover:border-zinc-600/50'
      }`}>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="text-zinc-500 font-mono text-[10px]">{index + 1}/{total}</span>
          <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-500 ${flipped ? 'text-orange-500 rotate-180' : 'text-zinc-500'}`} />
        </div>

        <div className="p-6 flex flex-col justify-center min-h-[220px]">
          {!flipped ? (
            <>
              <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase mb-3">
                {card.card_type || 'Definition'}
              </span>
              <p className="text-white text-base font-medium leading-relaxed">
                {card.front}
              </p>
              <p className="text-zinc-500 text-xs mt-4 font-mono">Tap to reveal</p>
            </>
          ) : (
            <>
              <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase mb-3">
                Answer
              </span>
              <p className="text-zinc-200 text-sm leading-relaxed">
                {card.back}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FlashcardSet = ({ data }) => {
  const { cards, set_title } = data.content_payload;
  const [currentIndex, setCurrentIndex] = useState(0);
  const isGrid = data.layout_style === 'card_grid';

  if (isGrid) {
    return (
      <div className="col-span-full">
        {set_title && (
          <p className="text-zinc-400 font-mono text-xs tracking-wider uppercase mb-4">{set_title}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <Flashcard key={i} card={card} index={i} total={cards.length} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full">
      {set_title && (
        <p className="text-zinc-400 font-mono text-xs tracking-wider uppercase mb-4">{set_title}</p>
      )}
      <Flashcard card={cards[currentIndex]} index={currentIndex} total={cards.length} />
      <div className="flex items-center justify-center gap-4 mt-4">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-orange-500' : 'bg-zinc-600'}`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentIndex(Math.min(cards.length - 1, currentIndex + 1))}
          disabled={currentIndex === cards.length - 1}
          className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardSet;
