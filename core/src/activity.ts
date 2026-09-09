export interface UpdatePlaybackActivityRequest {
  playbackDescription: string;
  isLiveStation: boolean;
}

export interface UserPlaybackActivitySummary {
  userId: string;
  userDisplayName: string;
  playbackDescription: string;
  isLiveStation: boolean;
  startedAt: string;
}