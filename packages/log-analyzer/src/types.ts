export interface LogEntry {
  ip: string;
  timestamp: Date;
  method: string;
  url: string;
  protocol: string;
  statusCode: number;
  responseSize: number;
  referrer: string;
  userAgent: string;
  forwardedFor?: string;
}

export interface TimeRange {
  days: 1 | 7 | 30;
  label: string;
}

export interface UserAgentStats {
  userAgent: string;
  requests1d: number;
  requests7d: number;
  requests30d: number;
  isBot: boolean;
}

export interface PageStats {
  url: string;
  requests1d: number;
  requests7d: number;
  requests30d: number;
  uniqueIPs1d: number;
  uniqueIPs7d: number;
  uniqueIPs30d: number;
  botRequests1d: number;
  botRequests7d: number;
  botRequests30d: number;
  nonBotRequests1d: number;
  nonBotRequests7d: number;
  nonBotRequests30d: number;
}

export interface ReferrerStats {
  referrer: string;
  requests1d: number;
  requests7d: number;
  requests30d: number;
}

export interface ErrorStats {
  url: string;
  requests1d: number;
  requests7d: number;
  requests30d: number;
  statusCode: number;
}

export interface BandwidthStats {
  date: string;
  totalBytes: number;
  totalRequests: number;
  averageResponseSize: number;
}

export interface TopIPStats {
  ip: string;
  requests1d: number;
  requests7d: number;
  requests30d: number;
  isBot: boolean;
}