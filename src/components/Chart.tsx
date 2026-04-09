import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, LineSeries, HistogramSeries, LineStyle, MouseEventParams } from 'lightweight-charts';
import { CandlestickData, Signal, IndicatorSettings, Pattern } from '../types';
import { calculateEMA, detectPatterns, detectOrderBlocks, calculateVolumeProfile } from '../lib/indicators';
import { MousePointer2, TrendingUp, Minus, Square, Ruler, Trash2, AlignJustify } from 'lucide-react';

interface ChartProps {
  data: CandlestickData[];
  signals: Signal[];
  settings: IndicatorSettings;
}

type Tool = 'cursor' | 'trendline' | 'horizontal' | 'rectangle' | 'measure' | 'fibonacci';

interface Point {
  time: number;
  price: number;
}

interface Drawing {
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  isComplete: boolean;
}

export const Chart: React.FC<ChartProps> = ({ data, signals, settings }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const emaFastSeriesRef = useRef<any>(null);
  const emaSlowSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [activeTool, setActiveTool] = useState<Tool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);

  const drawingsRef = useRef<Drawing[]>([]);
  const currentDrawingRef = useRef<Drawing | null>(null);

  useEffect(() => {
    drawingsRef.current = drawings;
    currentDrawingRef.current = currentDrawing;
  }, [drawings, currentDrawing]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const emaFastSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const emaSlowSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
    });

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8, // highest point of the series will be at 80% of the chart height
        bottom: 0,
      },
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      emaFastSeriesRef.current = null;
      emaSlowSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Drawing Interaction Logic
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const handleClick = (param: MouseEventParams) => {
      if (activeTool === 'cursor') return;
      if (!param.point || !param.time) return;

      const price = seriesRef.current.coordinateToPrice(param.point.y);
      const time = param.time as number;

      if (activeTool === 'horizontal') {
        setDrawings(prev => [...prev, { id: Date.now().toString(), type: 'horizontal', points: [{ time, price }], color: '#3b82f6', isComplete: true }]);
        setActiveTool('cursor');
        return;
      }

      if (!currentDrawing) {
        setCurrentDrawing({
          id: Date.now().toString(),
          type: activeTool,
          points: [{ time, price }],
          color: '#3b82f6',
          isComplete: false
        });
      } else {
        setDrawings(prev => [...prev, { ...currentDrawing, points: [...currentDrawing.points, { time, price }], isComplete: true }]);
        setCurrentDrawing(null);
        setActiveTool('cursor');
      }
    };

    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!currentDrawing || !param.point || !param.time) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      const time = param.time as number;
      
      setCurrentDrawing(prev => prev ? { ...prev, points: [prev.points[0], { time, price }] } : null);
    };

    chartRef.current.subscribeClick(handleClick);
    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeClick(handleClick);
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [activeTool, currentDrawing]);

  // Drawing Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const renderDrawings = () => {
      if (!chartRef.current || !seriesRef.current || !svgRef.current) return;

      const chart = chartRef.current;
      const series = seriesRef.current;
      const timeScale = chart.timeScale();

      const allDrawings = [...drawingsRef.current];
      if (currentDrawingRef.current) {
        allDrawings.push(currentDrawingRef.current);
      }

      let svgContent = '';

      allDrawings.forEach(drawing => {
        if (drawing.points.length === 0) return;

        const p1 = drawing.points[0];
        const x1 = timeScale.timeToCoordinate(p1.time as any);
        const y1 = series.priceToCoordinate(p1.price);

        if (x1 === null || y1 === null) return;

        if (drawing.type === 'horizontal') {
          svgContent += `<line x1="0" y1="${y1}" x2="100%" y2="${y1}" stroke="${drawing.color}" stroke-width="2" />`;
        } else if (drawing.points.length > 1) {
          const p2 = drawing.points[1];
          const x2 = timeScale.timeToCoordinate(p2.time as any);
          const y2 = series.priceToCoordinate(p2.price);

          if (x2 === null || y2 === null) return;

          if (drawing.type === 'trendline') {
            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${drawing.color}" stroke-width="2" />`;
          } else if (drawing.type === 'rectangle') {
            const rx = Math.min(x1, x2);
            const ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1);
            const rh = Math.abs(y2 - y1);
            svgContent += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${drawing.color}33" stroke="${drawing.color}" stroke-width="2" />`;
          } else if (drawing.type === 'measure') {
            const rx = Math.min(x1, x2);
            const ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1);
            const rh = Math.abs(y2 - y1);
            svgContent += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#3b82f633" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4" />`;
            
            const priceDiff = p2.price - p1.price;
            const pips = (priceDiff * 10000).toFixed(1);
            const isPositive = priceDiff >= 0;
            const color = isPositive ? '#10b981' : '#ef5350';
            const textY = Math.max(15, ry - 10);
            
            svgContent += `<text x="${x2}" y="${textY}" fill="${color}" font-size="12" font-family="monospace" text-anchor="${x2 > x1 ? 'end' : 'start'}">${priceDiff > 0 ? '+' : ''}${pips} pips</text>`;
          } else if (drawing.type === 'fibonacci') {
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const diffY = y2 - y1;
            
            svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${drawing.color}" stroke-width="1" stroke-dasharray="4" />`;
            
            levels.forEach(level => {
              const ly = y1 + diffY * level;
              svgContent += `<line x1="${x1}" y1="${ly}" x2="${x1 + 200}" y2="${ly}" stroke="${drawing.color}" stroke-width="1" />`;
              svgContent += `<text x="${x1 + 205}" y="${ly + 4}" fill="${drawing.color}" font-size="10" font-family="monospace">${level}</text>`;
            });
          }
        }
      });

      svgRef.current.innerHTML = svgContent;
      animationFrameId = requestAnimationFrame(renderDrawings);
    };

    renderDrawings();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && seriesRef.current && data.length > 0) {
      try {
        // Ensure data is sorted by time and unique
        const seenTimes = new Set();
        const uniqueData = data
          .filter(d => {
            if (seenTimes.has(d.time)) return false;
            seenTimes.add(d.time);
            return true;
          })
          .sort((a, b) => (a.time as number) - (b.time as number));

        seriesRef.current.setData(uniqueData as any);

        // Volume Data
        const volumeData = uniqueData.map(d => ({
          time: d.time as any,
          value: d.volume || 0,
          color: d.close >= d.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
        }));
        volumeSeriesRef.current.setData(volumeData);

        // Handle Indicators
        if (settings.showEmaFast) {
          const closes = uniqueData.map(d => d.close);
          const emaFast = calculateEMA(closes, settings.emaFast);
          const emaFastData = uniqueData.map((d, i) => ({
            time: d.time as any,
            value: emaFast[i],
          })).filter(d => d.value !== undefined);
          emaFastSeriesRef.current.setData(emaFastData);
          emaFastSeriesRef.current.applyOptions({ visible: true });
        } else {
          emaFastSeriesRef.current.applyOptions({ visible: false });
        }

        if (settings.showEmaSlow) {
          const closes = uniqueData.map(d => d.close);
          const emaSlow = calculateEMA(closes, settings.emaSlow);
          const emaSlowData = uniqueData.map((d, i) => ({
            time: d.time as any,
            value: emaSlow[i],
          })).filter(d => d.value !== undefined);
          emaSlowSeriesRef.current.setData(emaSlowData);
          emaSlowSeriesRef.current.applyOptions({ visible: true });
        } else {
          emaSlowSeriesRef.current.applyOptions({ visible: false });
        }
        
        // Clear existing price lines
        priceLinesRef.current.forEach(line => {
          if (seriesRef.current) {
            try { seriesRef.current.removePriceLine(line); } catch (e) {}
          }
        });
        priceLinesRef.current = [];

        if (settings.showVolumeProfile) {
          const vp = calculateVolumeProfile(uniqueData);
          if (vp) {
            priceLinesRef.current.push(seriesRef.current.createPriceLine({
              price: vp.poc,
              color: '#eab308',
              lineWidth: 2,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: true,
              title: 'POC',
            }));
            priceLinesRef.current.push(seriesRef.current.createPriceLine({
              price: vp.vah,
              color: '#94a3b8',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'VAH',
            }));
            priceLinesRef.current.push(seriesRef.current.createPriceLine({
              price: vp.val,
              color: '#94a3b8',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'VAL',
            }));
          }
        }

        if (settings.showOrderBlocks) {
          const obs = detectOrderBlocks(uniqueData);
          obs.forEach(ob => {
            const color = ob.type === 'bullish' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
            priceLinesRef.current.push(seriesRef.current.createPriceLine({
              price: ob.top,
              color: color,
              lineWidth: 1,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: false,
              title: ob.type === 'bullish' ? '+OB' : '-OB',
            }));
            priceLinesRef.current.push(seriesRef.current.createPriceLine({
              price: ob.bottom,
              color: color,
              lineWidth: 1,
              lineStyle: LineStyle.Solid,
              axisLabelVisible: false,
            }));
          });
        }

        // Combine Markers (Signals + Patterns)
        let markers: any[] = [];

        if (settings.showSignals) {
          const signalMarkers = signals
            .filter(s => seenTimes.has(s.time))
            .map(signal => ({
              time: signal.time as any,
              position: signal.type === 'BUY' ? 'belowBar' : 'aboveBar' as any,
              color: signal.type === 'BUY' ? '#26a69a' : '#ef5350',
              shape: signal.type === 'BUY' ? 'arrowUp' : 'arrowDown' as any,
              text: signal.type,
            }));
          markers = [...markers, ...signalMarkers];
        }

        if (settings.showPatterns) {
          const patterns = detectPatterns(uniqueData);
          const patternMarkers = patterns.map(p => ({
            time: p.time as any,
            position: p.type === 'bullish' ? 'belowBar' : p.type === 'bearish' ? 'aboveBar' : 'inBar' as any,
            color: p.type === 'bullish' ? '#10b981' : p.type === 'bearish' ? '#f43f5e' : '#94a3b8',
            shape: 'circle' as any,
            text: p.name,
            size: 0.5,
          }));
          markers = [...markers, ...patternMarkers];
        }

        // Sort markers by time to prevent internal library issues
        markers.sort((a, b) => a.time - b.time);
        
        if (seriesRef.current.setMarkers) {
          seriesRef.current.setMarkers(markers);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Chart update failed:', errorMessage);
      }
    }
  }, [data, signals, settings]);

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-zinc-800">
      <div ref={chartContainerRef} className="w-full h-full" />
      <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />
      
      {/* Drawing Toolbar */}
      <div className="absolute left-2 top-2 flex flex-col gap-1 bg-[#0a0a0a]/90 p-1.5 rounded-lg border border-zinc-800 z-20 backdrop-blur-sm">
        <button 
          onClick={() => setActiveTool('cursor')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'cursor' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Cursor"
        >
          <MousePointer2 size={16} />
        </button>
        <button 
          onClick={() => setActiveTool('trendline')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'trendline' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Trend Line"
        >
          <TrendingUp size={16} />
        </button>
        <button 
          onClick={() => setActiveTool('horizontal')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'horizontal' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Horizontal Line"
        >
          <Minus size={16} />
        </button>
        <button 
          onClick={() => setActiveTool('rectangle')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'rectangle' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Rectangle"
        >
          <Square size={16} />
        </button>
        <button 
          onClick={() => setActiveTool('fibonacci')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'fibonacci' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Fibonacci Retracement"
        >
          <AlignJustify size={16} />
        </button>
        <button 
          onClick={() => setActiveTool('measure')} 
          className={`p-1.5 rounded transition-colors ${activeTool === 'measure' ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title="Measure Tool"
        >
          <Ruler size={16} />
        </button>
        <div className="w-full h-px bg-zinc-800 my-1" />
        <button 
          onClick={() => setDrawings([])} 
          className="p-1.5 rounded transition-colors text-zinc-400 hover:text-red-500 hover:bg-zinc-800"
          title="Clear All Drawings"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
