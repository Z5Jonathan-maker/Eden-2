import React, { useState } from "react";
import { Star } from "lucide-react";
import { FeedbackPayload } from "./types";

interface Props {
  disabled: boolean;
  onSubmit: (feedback: FeedbackPayload) => void;
}

const FeedbackModule: React.FC<Props> = ({ disabled, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="card-tactical p-4">
      <h3 className="font-tactical font-bold text-white uppercase tracking-wide mb-3">Recipient Feedback</h3>
      <div className="flex items-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" onClick={() => setRating(value)}>
            <Star className={`w-5 h-5 ${value <= rating ? "text-yellow-400 fill-yellow-400" : "text-zinc-600"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
        className="input-tactical resize-none"
        rows={3}
        placeholder="Optional mission feedback"
      />
      <button
        type="button"
        className="btn-tactical w-full mt-3"
        disabled={disabled || rating < 1}
        onClick={() => {
          onSubmit({ rating, comment: comment.trim() });
          setRating(0);
          setComment("");
        }}
      >
        Submit Feedback
      </button>
    </div>
  );
};

export default FeedbackModule;
