import { CandlestickData, Timeframe } from '../types';

export function generateMockData(count: number, timeframe: Timeframe): CandlestickData[] {
  const data: CandlestickData[] = [];
  let currentPrice = 1.0850; // Starting EUR/USD price
  let currentTime = Math.floor(Date.now() / 1000);
  
  const intervalMap: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
  };

  const interval = intervalMap[timeframe];
  currentTime -= interval * count;

  for (let i = 0; i < count; i++) {
    const volatility = 0.0005;
    const open = currentPrice;
    const change = (Math.random() - 0.5) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (volatility / 2);
    const low = Math.min(open, close) - Math.random() * (volatility / 2);
    const volume = Math.floor(Math.random() * 1000) + Math.abs(change) * 1000000;

    data.push({
      time: currentTime,
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
    currentTime += interval;
  }

  return data;
}

export async function fetchForexData(symbol: string, timeframe: Timeframe): Promise<CandlestickData[]> {
  // In a real app, you'd call an API like Twelve Data or Polygon here.
  // For this demo, we'll use mock data to ensure it works immediately.
  return generateMockData(500, timeframe);
}
