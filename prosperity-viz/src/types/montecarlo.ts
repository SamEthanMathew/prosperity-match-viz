export interface MCDistribution {
  count: number;
  mean: number;
  std: number;
  min: number;
  p01: number;
  p05: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  positiveRate: number;
  negativeRate: number;
  zeroRate: number;
  var95: number;
  cvar95: number;
  var99: number;
  cvar99: number;
  meanConfidenceLow95: number;
  meanConfidenceHigh95: number;
  sharpeLike: number;
  sortinoLike: number;
  skewness: number;
}

export interface MCHistogram {
  edges: number[];
  counts: number[];
}

export interface MCNormalFit {
  mu: number;
  sigma: number;
  r2: number;
}

export interface MCBandSeries {
  timestamps: number[];
  p05: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
  mean: number[];
}

export interface MCTrendFit {
  slope: number;
  intercept: number;
  r2: number;
}

export interface MCProductTrend {
  profitability: MCTrendFit;
  stability: MCTrendFit;
}

export interface MCSessionRow {
  session_id: number;
  total_pnl: number;
  emerald_pnl: number;
  tomato_pnl: number;
  emerald_position?: number;
  tomato_position?: number;
  total_slope_per_step: number;
  total_r2: number;
  emerald_slope_per_step?: number;
  emerald_r2?: number;
  tomato_slope_per_step?: number;
  tomato_r2?: number;
}

export interface MCScatterFit {
  slope: number;
  intercept: number;
  r2: number;
}

export interface MCDashboard {
  kind: 'monte_carlo_dashboard';
  meta: {
    algorithmPath: string;
    sessionCount: number;
    bandSessionCount: number;
    fvMode?: string;
    tradeMode?: string;
    tomatoSupport?: string;
    seed?: number;
    [key: string]: unknown;
  };
  overall: {
    totalPnl: MCDistribution;
    emeraldPnl: MCDistribution;
    tomatoPnl: MCDistribution;
    emeraldTomatoCorrelation: number;
  };
  products: {
    [product: string]: {
      pnl: MCDistribution;
      finalPosition?: MCDistribution;
      cash?: MCDistribution;
    };
  };
  histograms: {
    totalPnl: MCHistogram;
    emeraldPnl: MCHistogram;
    tomatoPnl: MCHistogram;
    [key: string]: MCHistogram;
  };
  bandSeries: {
    [product: string]: MCBandSeries;
  };
  normalFits: {
    totalPnl: MCNormalFit;
    emeraldPnl: MCNormalFit;
    tomatoPnl: MCNormalFit;
    [key: string]: MCNormalFit;
  };
  sessions: MCSessionRow[];
  topSessions: MCSessionRow[];
  bottomSessions: MCSessionRow[];
  trendFits: {
    [product: string]: MCProductTrend;
  };
  scatterFit: MCScatterFit;
  generatorModel?: string;
  samplePaths?: unknown[];
  samplePathRefs?: unknown[];
}
