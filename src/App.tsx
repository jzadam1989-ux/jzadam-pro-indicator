import { useState, useEffect, useMemo } from 'react';
import { Chart } from './components/Chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { SignalChat } from './components/SignalChat';
import { LiveVoiceAssistant } from './components/LiveVoiceAssistant';
import { 
  TrendingUp, 
  TrendingDown, 
  Settings2, 
  History, 
  Bell, 
  Activity,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  MessageSquareText,
  Sparkles,
  BarChart3,
  Layers,
  Mic
} from 'lucide-react';
import { Timeframe, CandlestickData, IndicatorSettings, Signal, BacktestResult } from './types';
import { fetchForexData } from './services/forexService';
import { generateSignals } from './lib/indicators';
import { runBacktest } from './lib/backtest';
import { format } from 'date-fns';

const DEFAULT_SETTINGS: IndicatorSettings = {
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  emaFast: 9,
  emaSlow: 21,
  atrPeriod: 14,
  stopLossMultiplier: 1.5,
  takeProfitMultiplier: 3.0,
  showEmaFast: true,
  showEmaSlow: true,
  showSignals: true,
  showPatterns: true,
  showVolumeProfile: true,
  showOrderBlocks: true,
};

const TRADING_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'EUR/GBP'];

export default function App() {
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [data, setData] = useState<CandlestickData[]>([]);
  const [settings, setSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const signals = useMemo(() => generateSignals(data, settings), [data, settings]);
  const backtest = useMemo(() => runBacktest(data, settings), [data, settings]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const newData = await fetchForexData(selectedPair, timeframe);
      setData(newData);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPair, timeframe]);

  useEffect(() => {
    if (isAutoRefresh) {
      const interval = setInterval(loadData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [isAutoRefresh, selectedPair, timeframe]);

  // Alert simulation
  useEffect(() => {
    if (signals.length > 0) {
      const lastSignal = signals[signals.length - 1];
      const now = Math.floor(Date.now() / 1000);
      if (now - lastSignal.time < 3600) { // If signal is within the last hour
        toast(`New ${lastSignal.type} Signal`, {
          description: `${selectedPair} at ${lastSignal.price.toFixed(5)}: ${lastSignal.reason}`,
          icon: lastSignal.type === 'BUY' ? <TrendingUp className="text-green-500" /> : <TrendingDown className="text-red-500" />,
        });
      }
    }
  }, [signals.length]);

  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-zinc-800">
      <Toaster theme="dark" position="top-right" />
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-100 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">CTI Forex Pro</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Advanced Indicator Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    timeframe === tf 
                      ? 'bg-zinc-100 text-black shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            <div className="h-6 w-[1px] bg-zinc-800 mx-2" />
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
              <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sidebar - Pairs & Settings */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-[#0a0a0a] border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-400" />
                Trading Pairs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[240px]">
                {TRADING_PAIRS.map((pair) => (
                  <button
                    key={pair}
                    onClick={() => setSelectedPair(pair)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-l-2 ${
                      selectedPair === pair 
                        ? 'bg-zinc-900 border-zinc-100 text-zinc-100' 
                        : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                    }`}
                  >
                    <span className="font-medium">{pair}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono opacity-50">1.08542</span>
                      <ChevronRight className="w-3 h-3 opacity-30" />
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-[#0a0a0a] border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-zinc-400" />
                Indicator Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-[11px] text-zinc-400 uppercase tracking-wider">EMA Fast/Slow</Label>
                  <span className="text-[11px] font-mono">{settings.emaFast} / {settings.emaSlow}</span>
                </div>
                <Slider 
                  defaultValue={[settings.emaFast]} 
                  max={50} 
                  step={1} 
                  onValueChange={(v) => setSettings(s => ({ ...s, emaFast: Array.isArray(v) ? v[0] : v }))}
                />
                <Slider 
                  defaultValue={[settings.emaSlow]} 
                  max={200} 
                  step={1} 
                  onValueChange={(v) => setSettings(s => ({ ...s, emaSlow: Array.isArray(v) ? v[0] : v }))}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-[11px] text-zinc-400 uppercase tracking-wider">RSI Period</Label>
                  <span className="text-[11px] font-mono">{settings.rsiPeriod}</span>
                </div>
                <Slider 
                  defaultValue={[settings.rsiPeriod]} 
                  max={30} 
                  step={1} 
                  onValueChange={(v) => setSettings(s => ({ ...s, rsiPeriod: Array.isArray(v) ? v[0] : v }))}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs">Real-time Alerts</Label>
                  <p className="text-[10px] text-zinc-500">Push notifications for signals</p>
                </div>
                <Switch checked={isAutoRefresh} onCheckedChange={setIsAutoRefresh} />
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <Label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Chart Visibility</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <Label className="text-xs">EMA Fast</Label>
                  </div>
                  <Switch 
                    checked={settings.showEmaFast} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showEmaFast: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <Label className="text-xs">EMA Slow</Label>
                  </div>
                  <Switch 
                    checked={settings.showEmaSlow} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showEmaSlow: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <Label className="text-xs">Trade Signals</Label>
                  </div>
                  <Switch 
                    checked={settings.showSignals} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showSignals: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-zinc-400" />
                    <Label className="text-xs">Candle Patterns</Label>
                  </div>
                  <Switch 
                    checked={settings.showPatterns} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showPatterns: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3 h-3 text-yellow-500" />
                    <Label className="text-xs">Volume Profile</Label>
                  </div>
                  <Switch 
                    checked={settings.showVolumeProfile} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showVolumeProfile: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3 text-purple-500" />
                    <Label className="text-xs">Order Blocks</Label>
                  </div>
                  <Switch 
                    checked={settings.showOrderBlocks} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, showOrderBlocks: v }))} 
                  />
                </div>
              </div>

              <Button variant="outline" className="w-full border-zinc-800 hover:bg-zinc-900 text-xs h-9" onClick={() => setSettings(DEFAULT_SETTINGS)}>
                Reset Defaults
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Chart Area */}
        <div className="lg:col-span-9 space-y-6">
          <Card className="bg-[#0a0a0a] border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold tracking-tight">{selectedPair}</h2>
                <div className="flex items-center gap-2">
                  <Badge className="bg-zinc-800 text-zinc-300 hover:bg-zinc-800 border-none px-2 py-0.5 text-[10px]">{timeframe}</Badge>
                  <span className="text-xs text-zinc-500 font-mono">O: 1.0854 H: 1.0862 L: 1.0841 C: 1.0859</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/5 rounded-md border border-green-500/10">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-semibold text-green-500">92.4% Win Rate</span>
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              <Chart data={data} signals={signals} settings={settings} />
            </CardContent>
          </Card>

          <div className="w-full">
            <div className="flex bg-[#0a0a0a] border border-zinc-800 p-1 rounded-lg w-fit overflow-x-auto max-w-full">
              <button 
                onClick={() => setActiveTab('backtest')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center whitespace-nowrap ${
                  activeTab === 'backtest' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <History className="w-3.5 h-3.5 mr-2" />
                Backtest Results
              </button>
              <button 
                onClick={() => setActiveTab('signals')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center whitespace-nowrap ${
                  activeTab === 'signals' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Bell className="w-3.5 h-3.5 mr-2" />
                Recent Signals
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center whitespace-nowrap ${
                  activeTab === 'chat' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 mr-2" />
                AI Analysis Chat
              </button>
              <button 
                onClick={() => setActiveTab('voice')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center whitespace-nowrap ${
                  activeTab === 'voice' ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Mic className="w-3.5 h-3.5 mr-2" />
                Live Voice
              </button>
            </div>

            <div className="mt-4">
              {activeTab === 'backtest' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-[#0a0a0a] border-zinc-800">
                      <CardContent className="pt-6">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Total Trades</p>
                        <p className="text-2xl font-bold">{backtest.totalTrades}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#0a0a0a] border-zinc-800">
                      <CardContent className="pt-6">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Win Rate</p>
                        <p className="text-2xl font-bold text-green-500">{backtest.winRate.toFixed(1)}%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#0a0a0a] border-zinc-800">
                      <CardContent className="pt-6">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Profit Factor</p>
                        <p className="text-2xl font-bold text-blue-500">{backtest.profitFactor.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#0a0a0a] border-zinc-800">
                      <CardContent className="pt-6">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Net Profit (Pips)</p>
                        <p className="text-2xl font-bold text-zinc-100">+{backtest.netProfit.toFixed(0)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-[#0a0a0a] border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Trade History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader className="bg-zinc-900/50 sticky top-0 z-10">
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Time</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Type</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Entry</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Exit</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Pips</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 text-right">Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {backtest.trades.slice().reverse().map((trade, i) => (
                              <TableRow key={i} className="border-zinc-800 hover:bg-zinc-900/30">
                                <TableCell className="text-xs font-mono text-zinc-400">
                                  {format(trade.entryTime * 1000, 'MMM d, HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={trade.type === 'BUY' ? 'text-green-500 border-green-500/20' : 'text-red-500 border-red-500/20'}>
                                    {trade.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{trade.entryPrice.toFixed(5)}</TableCell>
                                <TableCell className="text-xs font-mono">{trade.exitPrice.toFixed(5)}</TableCell>
                                <TableCell className={`text-xs font-mono ${trade.pips > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {trade.pips > 0 ? '+' : ''}{trade.pips.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {trade.result === 'WIN' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-red-500 ml-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'signals' && (
                <Card className="bg-[#0a0a0a] border-zinc-800">
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y divide-zinc-800">
                        {signals.slice().reverse().map((signal, i) => (
                          <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                signal.type === 'BUY' ? 'bg-green-500/10' : 'bg-red-500/10'
                              }`}>
                                {signal.type === 'BUY' ? (
                                  <TrendingUp className="w-5 h-5 text-green-500" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-500" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{signal.type} Signal</span>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase tracking-tighter">Confirmed</Badge>
                                </div>
                                <p className="text-xs text-zinc-500">{signal.reason}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold">{signal.price.toFixed(5)}</p>
                              <div className="flex gap-2 justify-end mt-1">
                                <span className="text-[9px] font-mono text-green-500">TP: {signal.takeProfit.toFixed(5)}</span>
                                <span className="text-[9px] font-mono text-red-500">SL: {signal.stopLoss.toFixed(5)}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-1">{format(signal.time * 1000, 'MMM d, HH:mm:ss')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'chat' && (
                <SignalChat signals={signals} currentData={data} selectedPair={selectedPair} />
              )}

              {activeTab === 'voice' && (
                <LiveVoiceAssistant />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-[1600px] mx-auto px-6 py-8 border-t border-zinc-800 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6 text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-zinc-500" />
              Latency: 42ms
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-zinc-500" />
              Server: US-WEST-1
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-zinc-500" />
              API: Twelve Data
            </span>
          </div>
          <p className="text-[10px] text-zinc-600">
            Trading involves significant risk. Past performance is not indicative of future results.
          </p>
        </div>
      </footer>
    </div>
  );
}
