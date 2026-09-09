export interface CreateSubscriptionRequest {
  artistName: string;
  captureEnabled: boolean;
}

export interface ArtistSubscriptionSummary {
  id: string;
  artistName: string;
  createdAt: string;
  captureEnabled: boolean;
}

export interface UserAlertSummary {
  id: string;
  artistName: string;
  stationName: string;
  trackTitle: string | null;
  observedAt: string;
}