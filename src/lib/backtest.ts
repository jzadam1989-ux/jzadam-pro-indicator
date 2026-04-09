import { CandlestickData, IndicatorSettings, Signal, BacktestResult, Trade } from '../types';
import { generateSignals, calculateATR } from './indicators';

export function runBacktest(data: CandlestickData[], settings: IndicatorSettings): BacktestResult {
  const signals = generateSignals(data, settings);
  const atr = calculateATR(data, settings.atrPeriod);
  const trades: Trade[] = [];
  
  let activeTrade: { 
    entryPrice: number; 
    entryTime: number; 
    type: 'BUY' | 'SELL'; 
    stopLoss: number; 
    takeProfit: number; 
  } | null = null;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const currentSignal = signals.find(s => s.time === candle.time);

    // Check if we need to close active trade
    if (activeTrade) {
      if (activeTrade.type === 'BUY') {
        if (candle.low <= activeTrade.stopLoss) {
          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: candle.time,
            type: 'BUY',
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.stopLoss,
            pips: (activeTrade.stopLoss - activeTrade.entryPrice) * 10000,
            result: 'LOSS'
          });
          activeTrade = null;
        } else if (candle.high >= activeTrade.takeProfit) {
          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: candle.time,
            type: 'BUY',
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.takeProfit,
            pips: (activeTrade.takeProfit - activeTrade.entryPrice) * 10000,
            result: 'WIN'
          });
          activeTrade = null;
        }
      } else {
        if (candle.high >= activeTrade.stopLoss) {
          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: candle.time,
            type: 'SELL',
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.stopLoss,
            pips: (activeTrade.entryPrice - activeTrade.stopLoss) * 10000,
            result: 'LOSS'
          });
          activeTrade = null;
        } else if (candle.low <= activeTrade.takeProfit) {
          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: candle.time,
            type: 'SELL',
            entryPrice: activeTrade.entryPrice,
            exitPrice: activeTrade.takeProfit,
            pips: (activeTrade.entryPrice - activeTrade.takeProfit) * 10000,
            result: 'WIN'
          });
          activeTrade = null;
        }
      }
    }

    // Open new trade if signal exists and no active trade
    if (!activeTrade && currentSignal) {
      const currentAtr = atr[i] || 0.0001; // Fallback
      if (currentSignal.type === 'BUY') {
        activeTrade = {
          entryPrice: candle.close,
          entryTime: candle.time,
          type: 'BUY',
          stopLoss: candle.close - (currentAtr * settings.stopLossMultiplier),
          takeProfit: candle.close + (currentAtr * settings.takeProfitMultiplier)
        };
      } else {
        activeTrade = {
          entryPrice: candle.close,
          entryTime: candle.time,
          type: 'SELL',
          stopLoss: candle.close + (currentAtr * settings.stopLossMultiplier),
          takeProfit: candle.close - (currentAtr * settings.takeProfitMultiplier)
        };
      }
    }
  }

  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  
  const totalProfit = trades.filter(t => t.pips > 0).reduce((acc, t) => acc + t.pips, 0);
  const totalLoss = Math.abs(trades.filter(t => t.pips < 0).reduce((acc, t) => acc + t.pips, 0));
  const profitFactor = totalLoss === 0 ? totalProfit : totalProfit / totalLoss;

  return {
    totalTrades: trades.length,
    winRate,
    profitFactor,
    netProfit: totalProfit - totalLoss,
    maxDrawdown: 0, // Simplified for now
    trades
  };
}
