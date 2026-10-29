export type UserRole = "user" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
};

export type LinkRecord = {
  code: string;
  url: string;
  shortUrl: string;
  createdAt: string;
  expiresAt: string | null;
  totalClicks: number;
  uniqueClicks: number;
};

export type Summary = {
  linkCount: number;
  totalClicks: number;
  uniqueVisitors: number;
  last24h: number;
};

export type StatsRange = "24h" | "7d" | "30d";

export type Stats = {
  link: {
    code: string;
    url: string;
    shortUrl: string;
    createdAt: string;
    expiresAt: string | null;
  };
  total: number;
  unique: number;
  last24h: number;
  range: StatsRange;
  rangeTotal: number;
  series: Array<{ bucket: string; clicks: number }>;
  referrers: Array<{ name: string; clicks: number }>;
  devices: Array<{ name: string; clicks: number }>;
  recent: Array<{
    clickedAt: string;
    device: string;
    browser: string;
    referrer: string;
  }>;
};
