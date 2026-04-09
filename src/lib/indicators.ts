import { CandlestickData, IndicatorSettings, Signal, Pattern, OrderBlock, VolumeProfile } from '../types';

export function detectOrderBlocks(data: CandlestickData[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  const atr = calculateATR(data, 14);

  for (let i = 2; i < data.length - 1; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const currentAtr = atr[i] || (curr.high - curr.low);

    // Bullish Order Block: Last bearish candle before a strong bullish move
    if (prev.close < prev.open && curr.close > curr.open && (curr.close - curr.open) > currentAtr * 1.5) {
      orderBlocks.push({
        time: prev.time,
        top: prev.high,
        bottom: prev.low,
        type: 'bullish',
        active: true
      });
    }

    // Bearish Order Block: Last bullish candle before a strong bearish move
    if (prev.close > prev.open && curr.close < curr.open && (curr.open - curr.close) > currentAtr * 1.5) {
      orderBlocks.push({
        time: prev.time,
        top: prev.high,
        bottom: prev.low,
        type: 'bearish',
        active: true
      });
    }
  }

  // Filter out mitigated order blocks
  const unmitigated = orderBlocks.filter((ob) => {
    const startIndex = data.findIndex(d => d.time === ob.time) + 2;
    for (let j = startIndex; j < data.length; j++) {
      if (ob.type === 'bullish' && data[j].low < ob.bottom) return false;
      if (ob.type === 'bearish' && data[j].high > ob.top) return false;
    }
    return true;
  });

  return unmitigated.slice(-5); // Return only the 5 most recent active OBs
}

export function calculateVolumeProfile(data: CandlestickData[], binsCount: number = 50): VolumeProfile | null {
  if (data.length === 0) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  data.forEach(d => {
    if (d.low < minPrice) minPrice = d.low;
    if (d.high > maxPrice) maxPrice = d.high;
    totalVolume += d.volume || 0;
  });

  if (totalVolume === 0) return null;

  const binSize = (maxPrice - minPrice) / binsCount;
  const bins = Array.from({ length: binsCount }, (_, i) => ({
    price: minPrice + i * binSize + binSize / 2,
    volume: 0
  }));

  data.forEach(d => {
    const vol = d.volume || 0;
    if (vol === 0) return;
    
    const startBin = Math.max(0, Math.floor((d.low - minPrice) / binSize));
    const endBin = Math.min(binsCount - 1, Math.floor((d.high - minPrice) / binSize));
    
    const binsSpanned = endBin - startBin + 1;
    const volPerBin = vol / binsSpanned;
    
    for (let i = startBin; i <= endBin; i++) {
      if (bins[i]) bins[i].volume += volPerBin;
    }
  });

  let maxVol = 0;
  let poc = 0;
  bins.forEach(b => {
    if (b.volume > maxVol) {
      maxVol = b.volume;
      poc = b.price;
    }
  });

  let vaVolume = maxVol;
  let pocIndex = bins.findIndex(b => b.price === poc);
  let upperIndex = pocIndex + 1;
  let lowerIndex = pocIndex - 1;
  const targetVaVolume = totalVolume * 0.7;

  while (vaVolume < targetVaVolume && (upperIndex < binsCount || lowerIndex >= 0)) {
    const upperVol = upperIndex < binsCount ? bins[upperIndex].volume : -1;
    const lowerVol = lowerIndex >= 0 ? bins[lowerIndex].volume : -1;

    if (upperVol > lowerVol) {
      vaVolume += upperVol;
      upperIndex++;
    } else if (lowerVol >= upperVol && lowerVol !== -1) {
      vaVolume += lowerVol;
      lowerIndex--;
    } else {
      break;
    }
  }

  const vah = upperIndex < binsCount ? bins[upperIndex].price : maxPrice;
  const val = lowerIndex >= 0 ? bins[lowerIndex].price : minPrice;

  return { poc, vah, val, bins };
}

export function detectPatterns(data: CandlestickData[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  for (let i = 2; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const bodySize = Math.abs(curr.close - curr.open);
    const candleRange = curr.high - curr.low;
    
    // Doji
    if (bodySize < candleRange * 0.1) {
      patterns.push({ time: curr.time, name: 'Doji', type: 'neutral' });
      continue;
    }
    
    // Bullish Engulfing
    if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open) {
      patterns.push({ time: curr.time, name: 'Bullish Engulfing', type: 'bullish' });
      continue;
    }
    
    // Bearish Engulfing
    if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open) {
      patterns.push({ time: curr.time, name: 'Bearish Engulfing', type: 'bearish' });
      continue;
    }
    
    // Hammer
    const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
    if (lowerShadow > bodySize * 2 && (curr.high - Math.max(curr.open, curr.close)) < bodySize * 0.5) {
      patterns.push({ time: curr.time, name: 'Hammer', type: 'bullish' });
      continue;
    }
  }
  
  return patterns;
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  let prevEma = data[0];
  ema[0] = prevEma;

  for (let i = 1; i < data.length; i++) {
    const currentEma = (data[i] - prevEma) * k + prevEma;
    ema[i] = currentEma;
    prevEma = currentEma;
  }
  return ema;
}

export function calculateRSI(data: number[], period: number): number[] {
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }

    const rs = avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }

  return rsi;
}

export function calculateATR(data: CandlestickData[], period: number): number[] {
  const atr: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    const pc = data[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  let sumTr = 0;
  for (let i = 1; i <= period; i++) {
    sumTr += tr[i] || 0;
  }

  let avgTr = sumTr / period;
  atr[period] = avgTr;

  for (let i = period + 1; i < data.length; i++) {
    avgTr = (avgTr * (period - 1) + tr[i]) / period;
    atr[i] = avgTr;
  }

  return atr;
}

export function generateSignals(data: CandlestickData[], settings: IndicatorSettings): Signal[] {
  const closes = data.map(d => d.close);
  const emaFast = calculateEMA(closes, settings.emaFast);
  const emaSlow = calculateEMA(closes, settings.emaSlow);
  const rsi = calculateRSI(closes, settings.rsiPeriod);
  const atr = calculateATR(data, settings.atrPeriod);
  
  const signals: Signal[] = [];

  for (let i = Math.max(settings.emaSlow, settings.rsiPeriod, settings.atrPeriod) + 1; i < data.length; i++) {
    const prevEmaFast = emaFast[i - 1];
    const prevEmaSlow = emaSlow[i - 1];
    const currEmaFast = emaFast[i];
    const currEmaSlow = emaSlow[i];
    const currRsi = rsi[i];
    const currAtr = atr[i] || (data[i].high - data[i].low); // Fallback to current range if ATR not ready

    // Bullish Crossover + RSI Confirmation
    if (prevEmaFast <= prevEmaSlow && currEmaFast > currEmaSlow && currRsi > 50 && currRsi < settings.rsiOverbought) {
      signals.push({
        time: data[i].time,
        type: 'BUY',
        price: data[i].close,
        takeProfit: data[i].close + (currAtr * settings.takeProfitMultiplier),
        stopLoss: data[i].close - (currAtr * settings.stopLossMultiplier),
        reason: 'EMA Bullish Cross + RSI Support'
      });
    }

    // Bearish Crossover + RSI Confirmation
    if (prevEmaFast >= prevEmaSlow && currEmaFast < currEmaSlow && currRsi < 50 && currRsi > settings.rsiOversold) {
      signals.push({
        time: data[i].time,
        type: 'SELL',
        price: data[i].close,
        takeProfit: data[i].close - (currAtr * settings.takeProfitMultiplier),
        stopLoss: data[i].close + (currAtr * settings.stopLossMultiplier),
        reason: 'EMA Bearish Cross + RSI Resistance'
      });
    }
  }

  return signals;
}
