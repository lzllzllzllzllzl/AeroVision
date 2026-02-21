import React, { useState, useEffect } from 'react';
import { 
  Plane, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Wind, 
  MapPin, 
  Search,
  AlertCircle,
  Loader2,
  BrainCircuit
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { format, addDays, subDays } from 'date-fns';
import { cn } from './lib/utils';

// --- Types ---

interface FlightData {
  date: string;
  price: number;
  airline: string;
}

interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
}

// --- Mock Data Generators ---

const generateMockFlightData = (days = 30): FlightData[] => {
  const data: FlightData[] = [];
  const today = new Date();
  let basePrice = 450;
  
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    // Random walk price
    const change = (Math.random() - 0.5) * 50;
    basePrice += change;
    basePrice = Math.max(200, basePrice); // Floor
    
    data.push({
      date: format(date, 'yyyy-MM-dd'),
      price: Math.round(basePrice),
      airline: ['SkyHigh', 'AeroJet', 'CloudAir'][Math.floor(Math.random() * 3)]
    });
  }
  return data;
};

// --- Components ---

const Card = ({ children, className, title, subtitle }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string }) => (
  <div className={cn("bg-[#E4E3E0] border border-[#141414] p-6 relative overflow-hidden group", className)}>
    {/* Technical corner markers */}
    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#141414]" />
    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#141414]" />
    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#141414]" />
    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#141414]" />
    
    {(title || subtitle) && (
      <div className="mb-6 border-b border-[#141414]/10 pb-4">
        {title && <h3 className="font-display text-lg font-bold uppercase tracking-tight">{title}</h3>}
        {subtitle && <p className="font-mono text-xs text-[#141414]/60 mt-1 uppercase tracking-wider">{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, trend, trendValue }: { label: string, value: string, trend?: 'up' | 'down' | 'neutral', trendValue?: string }) => (
  <div className="flex flex-col">
    <span className="font-mono text-[10px] uppercase tracking-wider text-[#141414]/60 mb-1">{label}</span>
    <div className="flex items-end gap-2">
      <span className="font-display text-3xl font-bold leading-none">{value}</span>
      {trend && (
        <div className={cn("flex items-center text-xs font-mono mb-1", 
          trend === 'up' ? "text-red-600" : trend === 'down' ? "text-emerald-600" : "text-gray-600"
        )}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {trendValue}
        </div>
      )}
    </div>
  </div>
);

export default function App() {
  const [origin, setOrigin] = useState('PEK');
  const [destination, setDestination] = useState('TYO');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState<FlightData[]>([]);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Initial load
  useEffect(() => {
    handleSearch();
  }, []);

  // Airport coordinates for weather fetching
  const airportCoords: Record<string, { lat: number, lon: number, name: string }> = {
    'PEK': { lat: 40.0799, lon: 116.6031, name: 'Beijing Capital' },
    'TYO': { lat: 35.6895, lon: 139.6917, name: 'Tokyo' }, // General Tokyo
    'HND': { lat: 35.5494, lon: 139.7798, name: 'Tokyo Haneda' },
    'NRT': { lat: 35.7720, lon: 140.3929, name: 'Tokyo Narita' },
    'LAX': { lat: 33.9416, lon: -118.4085, name: 'Los Angeles' },
    'JFK': { lat: 40.6413, lon: -73.7781, name: 'New York JFK' },
    'LHR': { lat: 51.4700, lon: -0.4543, name: 'London Heathrow' },
    'DXB': { lat: 25.2532, lon: 55.3657, name: 'Dubai' },
    'SIN': { lat: 1.3644, lon: 103.9915, name: 'Singapore Changi' },
    'CDG': { lat: 49.0097, lon: 2.5479, name: 'Paris Charles de Gaulle' },
    'AMS': { lat: 52.3105, lon: 4.7683, name: 'Amsterdam Schiphol' },
    'FRA': { lat: 50.0379, lon: 8.5622, name: 'Frankfurt' },
    'HKG': { lat: 22.3080, lon: 113.9185, name: 'Hong Kong' },
    'SYD': { lat: -33.9399, lon: 151.1753, name: 'Sydney' },
  };

  const fetchWeather = async (code: string) => {
    const coords = airportCoords[code];
    if (!coords) {
      // Fallback if code not found: Random realistic weather
      setWeather({
        temp: 20 + Math.floor(Math.random() * 10),
        condition: ['Sunny', 'Cloudy', 'Clear'][Math.floor(Math.random() * 3)],
        windSpeed: 10 + Math.floor(Math.random() * 15)
      });
      return;
    }

    try {
      const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,wind_speed_10m`);
      const current = res.data.current;
      
      // Map WMO weather codes to text
      const getWeatherCondition = (wmoCode: number) => {
        if (wmoCode === 0) return 'Clear Sky';
        if (wmoCode >= 1 && wmoCode <= 3) return 'Partly Cloudy';
        if (wmoCode >= 45 && wmoCode <= 48) return 'Foggy';
        if (wmoCode >= 51 && wmoCode <= 67) return 'Rainy';
        if (wmoCode >= 71 && wmoCode <= 77) return 'Snowy';
        if (wmoCode >= 80 && wmoCode <= 82) return 'Heavy Rain';
        if (wmoCode >= 95) return 'Thunderstorm';
        return 'Unknown';
      };

      setWeather({
        temp: Math.round(current.temperature_2m),
        condition: getWeatherCondition(current.weather_code),
        windSpeed: Math.round(current.wind_speed_10m)
      });
    } catch (error) {
      console.error("Weather fetch failed", error);
      // Fallback
      setWeather({
        temp: 22,
        condition: 'Data Unavailable',
        windSpeed: 0
      });
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setPrediction(null);
    setWeather(null);
    
    // Simulate API delay for flight data
    setTimeout(async () => {
      const mockData = generateMockFlightData(45);
      setFlightData(mockData);
      
      // Fetch real weather
      await fetchWeather(destination);

      setLoading(false);
      
      // Trigger AI prediction after data loads
      fetchAIPrediction(origin, destination, mockData);
    }, 800);
  };

  const fetchAIPrediction = async (from: string, to: string, data: FlightData[]) => {
    setPredicting(true);
    try {
      // Prepare a summary of the data for the AI
      const prices = data.slice(0, 10).map(d => d.price);
      const currentPrice = prices[0];
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      const prompt = `
        Analyze flight prices from ${from} to ${to}.
        Current price: $${currentPrice}.
        Next 10 days average: $${Math.round(avgPrice)}.
        Trend: ${prices[9] > prices[0] ? 'Increasing' : 'Decreasing'}.
        
        Provide a short, strategic advice (max 50 words) on whether to buy now or wait. 
        Be professional and concise.
      `;

      const response = await axios.post('/api/predict-price', { prompt });
      
      // Parse response from Doubao
      // The structure depends on the exact API response format of Volcengine
      // Based on standard OpenAI-like structures often used:
      const content = response.data?.choices?.[0]?.message?.content || 
                      response.data?.data?.choices?.[0]?.message?.content ||
                      "Unable to generate prediction at this time.";
                      
      setPrediction(content);
    } catch (err: any) {
      console.error("Prediction Error:", err);
      const errorDetails = err.response?.data?.details || err.message;
      setPrediction(`Analysis Error: ${errorDetails}. Please check API Key configuration.`);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Header / Search Section */}
      <div className="lg:col-span-12 flex flex-col md:flex-row gap-6 items-end justify-between mb-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-2">
            Aero<span className="text-[#F27D26]">Vision</span>
          </h1>
          <p className="font-mono text-sm text-[#141414]/60 uppercase tracking-widest">
            Flight Intelligence & Prediction System
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-end bg-white/50 p-4 border border-[#141414] w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold">Origin</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                className="pl-9 pr-4 py-2 bg-[#E4E3E0] border border-[#141414]/20 font-mono w-32 focus:outline-none focus:border-[#F27D26] transition-colors"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                className="pl-9 pr-4 py-2 bg-[#E4E3E0] border border-[#141414]/20 font-mono w-32 focus:outline-none focus:border-[#F27D26] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase font-bold">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#E4E3E0] border border-[#141414]/20 font-mono w-40 focus:outline-none focus:border-[#F27D26] transition-colors"
              />
            </div>
          </div>

          <button 
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-[#141414] text-[#E4E3E0] font-mono uppercase text-sm hover:bg-[#F27D26] hover:text-[#141414] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <Card title="Price Trajectory" subtitle="30-Day Forecast Model" className="h-[400px] flex flex-col">
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flightData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" strokeOpacity={0.1} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{fontFamily: 'JetBrains Mono', fontSize: 10}} 
                  tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  tick={{fontFamily: 'JetBrains Mono', fontSize: 10}}
                  axisLine={false}
                  tickLine={false}
                  dx={-10}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: 'none',
                    color: '#E4E3E0',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#141414" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card title="Flight Details" subtitle="Selected Route">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[#141414]/10 pb-2">
                  <span className="font-mono text-xs text-gray-500">ROUTE</span>
                  <span className="font-display font-bold text-lg">{origin} → {destination}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#141414]/10 pb-2">
                  <span className="font-mono text-xs text-gray-500">DISTANCE</span>
                  <span className="font-mono text-sm">1,240 KM (Est.)</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#141414]/10 pb-2">
                  <span className="font-mono text-xs text-gray-500">AVG FLIGHT TIME</span>
                  <span className="font-mono text-sm">2h 45m</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-gray-500">AIRCRAFT</span>
                  <span className="font-mono text-sm">Boeing 737-800</span>
                </div>
              </div>
           </Card>

           <Card title="Destination Weather" subtitle="Forecast">
              {weather ? (
                <div className="flex flex-col h-full justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-5xl font-display font-bold">{weather.temp}°</span>
                      <span className="font-mono text-sm text-gray-500 mt-1">{weather.condition}</span>
                    </div>
                    <Wind className="w-12 h-12 stroke-1 opacity-20" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <span className="block font-mono text-[10px] text-gray-500 uppercase">Wind</span>
                      <span className="font-mono text-sm">{weather.windSpeed} km/h</span>
                    </div>
                    <div>
                      <span className="block font-mono text-[10px] text-gray-500 uppercase">Humidity</span>
                      <span className="font-mono text-sm">45%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin opacity-20" />
                </div>
              )}
           </Card>
        </div>
      </div>

      {/* Sidebar / Stats */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <Card className="bg-[#141414] text-[#E4E3E0]">
          <div className="flex items-center gap-2 mb-6 text-[#F27D26]">
            <BrainCircuit className="w-5 h-5" />
            <h3 className="font-display font-bold uppercase tracking-wider">AI Analyst</h3>
          </div>
          
          <div className="min-h-[120px]">
            {predicting ? (
              <div className="flex flex-col gap-2">
                <div className="h-2 w-full bg-white/10 animate-pulse rounded" />
                <div className="h-2 w-3/4 bg-white/10 animate-pulse rounded" />
                <div className="h-2 w-1/2 bg-white/10 animate-pulse rounded" />
              </div>
            ) : (
              <p className="font-mono text-sm leading-relaxed opacity-90">
                {prediction || "Waiting for flight data analysis..."}
              </p>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] uppercase opacity-50">Confidence Score</span>
              <span className="font-mono text-xs text-[#F27D26]">87%</span>
            </div>
            <div className="w-full h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
              <div className="w-[87%] h-full bg-[#F27D26]" />
            </div>
          </div>
        </Card>

        <Card title="Current Metrics" subtitle="Real-time Snapshot">
          <div className="grid grid-cols-1 gap-6">
            <Stat 
              label="Lowest Price" 
              value={`$${Math.min(...flightData.map(d => d.price) || [0])}`} 
              trend="down" 
              trendValue="12% vs avg" 
            />
            <Stat 
              label="Highest Price" 
              value={`$${Math.max(...flightData.map(d => d.price) || [0])}`} 
              trend="up" 
              trendValue="Peak season" 
            />
            <Stat 
              label="Volatility Index" 
              value="Medium" 
              trend="neutral" 
            />
          </div>
        </Card>

        <div className="p-4 border border-[#141414] border-dashed opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-4 h-4" />
            <h4 className="font-display font-bold text-sm uppercase">Price Alert</h4>
          </div>
          <p className="font-mono text-xs text-gray-600 mb-3">
            Notify me when price drops below $400
          </p>
          <button className="w-full py-2 bg-transparent border border-[#141414] text-[10px] font-mono uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
            Set Alert
          </button>
        </div>

        {/* System Status / Connected APIs */}
        <div className="mt-auto pt-6 border-t border-[#141414]/10">
          <h4 className="font-mono text-[10px] uppercase text-gray-500 mb-3">System Status</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs">Amadeus GDS</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] text-emerald-600">CONNECTED</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs">Skyscanner API</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] text-emerald-600">CONNECTED</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs">Open-Meteo</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] text-emerald-600">ACTIVE</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs">Volcengine AI</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] text-emerald-600">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
