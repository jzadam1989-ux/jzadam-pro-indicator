export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface CandlestickData {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Signal {
  time: number;
  type: 'BUY' | 'SELL';
  price: number;
  takeProfit: number;
  stopLoss: number;
  reason: string;
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  maxDrawdown: number;
  trades: Trade[];
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pips: number;
  result: 'WIN' | 'LOSS';
}

export interface Pattern {
  time: number;
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
}

export interface OrderBlock {
  time: number;
  top: number;
  bottom: number;
  type: 'bullish' | 'bearish';
  active: boolean;
}

export interface VolumeProfile {
  poc: number; // Point of Control
  vah: number; // Value Area High
  val: number; // Value Area Low
  bins: { price: number; volume: number }[];
}

export interface IndicatorSettings {
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  emaFast: number;
  emaSlow: number;
  atrPeriod: number;
  stopLossMultiplier: number;
  takeProfitMultiplier: number;
  // Visibility toggles
  showEmaFast: boolean;
  showEmaSlow: boolean;
  showSignals: boolean;
  showPatterns: boolean;
  showVolumeProfile: boolean;
  showOrderBlocks: boolean;
}

