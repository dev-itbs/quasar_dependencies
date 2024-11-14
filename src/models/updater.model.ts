export interface ApiResponse {
  response: boolean;
  message: string;
}

export interface UpdateInfo {
  version: string;
  notes?: string;
  url: string;
  sessionKey: string;
  updateType: string;
  web_assets_url: string;
}
