export type TemplateKey = "tacticalCommander" | "fieldOperations" | "eliteAgent";

export interface TemplateMeta {
  id: TemplateKey;
  name: string;
  description: string;
  thumbnail: string;
  background: string;
  accent: string;
  border: string;
  font: string;
  uniqueElement: string;
  accentColor: string;
}

export interface MyCardFormData {
  full_name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  bio: string;
  tagline: string;
  license_number: string;
  profile_photo_url?: string;
}

export interface MetricsState {
  views: number;
  opens: number;
  sends: number;
  feedbackScore: number;
  feedbackCount: number;
}

export interface FeedbackPayload {
  rating: number;
  comment?: string;
}

export interface GoogleReview {
  reviewer_name: string;
  rating: number;
  review_text?: string;
  review_date?: string;
  time?: number;
  profile_photo_url?: string;
}

export interface GoogleReviewsResponse {
  configured: boolean;
  source: string;
  sort?: "recent" | "highest" | "lowest";
  business_name?: string;
  average_rating?: number;
  total_ratings?: number;
  reviews: GoogleReview[];
  message?: string;
}
