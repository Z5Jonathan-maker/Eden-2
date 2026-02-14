import React, { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { API_URL, apiGet } from "../../lib/api";
import { GoogleReviewsResponse } from "./types";

const SORT_OPTIONS = [
  { value: "recent", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
] as const;

const ReviewsPanel: React.FC = () => {
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<GoogleReviewsResponse>({
    configured: false,
    source: "google_places",
    reviews: [],
    total_ratings: 0,
    average_rating: 0,
    business_name: "",
    message: "",
  });

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchReviews = async () => {
      setLoading(true);
      setError("");
      try {
        if (API_URL == null) {
          throw new Error("Missing backend URL. Configure REACT_APP_BACKEND_URL and redeploy.");
        }
        const res = await apiGet(`/api/mycard/google-reviews?sort=${sort}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(res.error || "Unable to load Google reviews");
        }
        if (mounted) setPayload(res.data as GoogleReviewsResponse);
      } catch (err: any) {
        if (mounted && err.name !== "AbortError") {
          setError(err.message || "Failed to load reviews");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReviews();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [sort]);

  const reviews = useMemo(() => payload?.reviews || [], [payload]);

  return (
    <div className="card-tactical p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-tactical font-bold text-white uppercase tracking-wide">Google Reviews</h3>
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-wider">{payload?.business_name || "Business Profile"}</p>
        </div>
        <select
          className="bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-mono"
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "highest" | "lowest")}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="py-8 flex items-center justify-center text-zinc-500 font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading reviews...
        </div>
      )}

      {!loading && error && <div className="py-4 text-red-400 text-sm font-mono">{error}</div>}

      {!loading && !error && !payload.configured && (
        <div className="py-4 text-zinc-500 text-sm font-mono">{payload.message || "Google reviews are not configured yet."}</div>
      )}

      {!loading && !error && payload.configured && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded border border-zinc-700/40 bg-zinc-900/60 p-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Average</p>
              <p className="text-lg text-yellow-400 font-bold">{payload.average_rating || 0}</p>
            </div>
            <div className="rounded border border-zinc-700/40 bg-zinc-900/60 p-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Total</p>
              <p className="text-lg text-blue-400 font-bold">{payload.total_ratings || 0}</p>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="text-zinc-500 text-sm font-mono py-4">No reviews returned.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-auto pr-1">
              {reviews.map((review, idx) => (
                <div key={`${review.reviewer_name}-${review.time || idx}`} className="rounded border border-zinc-700/40 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white font-medium truncate">{review.reviewer_name}</p>
                    <div className="flex items-center gap-1 text-yellow-400 text-xs">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      {review.rating || 0}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{review.review_date || "Date unavailable"}</p>
                  <p className="text-sm text-zinc-300 mt-2 flex gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    <span>{review.review_text || "No review text."}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsPanel;
