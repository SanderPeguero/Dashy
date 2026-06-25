import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Wifi, Server } from 'lucide-react';

function CircularGauge({ value, label, icon: Icon, color }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const colorMap = {
    indigo: {
      text: 'text-indigo-400',
      stroke: 'stroke-indigo-500',
      track: 'stroke-indigo-950/20',
      bg: 'bg-indigo-500/10'
    },
    emerald: {
      text: 'text-emerald-400',
      stroke: 'stroke-emerald-500',
      track: 'stroke-emerald-950/20',
      bg: 'bg-emerald-500/10'
    },
    purple: {
      text: 'text-violet-400',
      stroke: 'stroke-violet-500',
      track: 'stroke-violet-950/20',
      bg: 'bg-violet-500/10'
    }
  };

  const activeColor = colorMap[color] || colorMap.indigo;

  return (
    <div className="flex flex-col items-center p-4 bg-[#18181b]/40 border border-[#222226] rounded-xl hover:border-zinc-700/60 transition-all duration-300 relative group">
      
      {/* Circle Gauge SVG */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90 overflow-visible">
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`${activeColor.track}`}
            strokeWidth="6"
            fill="transparent"
          />
          {/* Animated Gauge line */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`${activeColor.stroke} transition-all duration-1000 ease-out`}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        {/* Absolute Centered Icon & Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={`w-4 h-4 ${activeColor.text} group-hover:scale-110 transition-transform duration-200`} />
          <span className="text-xs font-bold text-white font-sans mt-0.5">{value}%</span>
        </div>
      </div>
      
      <span className="text-[11px] font-bold text-zinc-400 font-sans mt-3">{label}</span>
    </div>
  );
}

export default function SystemMonitor() {
  const [cpu, setCpu] = useState(38);
  const [ram, setRam] = useState(64);
  const [network, setNetwork] = useState(23);
  const [uptime, setUptime] = useState('14d 6h 32m');

  // Simulate server updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCpu((prev) => {
        const delta = Math.floor(Math.random() * 15) - 7;
        const next = prev + delta;
        return Math.max(10, Math.min(95, next));
      });

      setRam((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const next = prev + delta;
        return Math.max(50, Math.min(85, next));
      });

      setNetwork((prev) => {
        const delta = Math.floor(Math.random() * 9) - 4;
        const next = prev + delta;
        return Math.max(5, Math.min(99, next));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-purple hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between h-[360px] overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222226] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-violet-400 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/15">
              Estado
            </span>
            <span className="text-[10px] text-zinc-500 font-medium font-sans">
              Servidor Principal (AWS-NY-1)
            </span>
          </div>
          <h3 className="text-lg font-bold text-white font-sans mt-1">Recursos del Sistema</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold font-sans">
          <Server className="w-3.5 h-3.5 animate-pulse" />
          <span>Online</span>
        </div>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-3 gap-3 my-4">
        <CircularGauge value={cpu} label="CPU" icon={Cpu} color="indigo" />
        <CircularGauge value={ram} label="Memoria RAM" icon={HardDrive} color="purple" />
        <CircularGauge value={network} label="Red / Ancho" icon={Wifi} color="emerald" />
      </div>

      {/* Live status footer stats */}
      <div className="pt-3 border-t border-[#222226] flex items-center justify-between text-xs font-sans">
        <div className="flex flex-col">
          <span className="text-zinc-500 text-[10px]">Tiempo Activo</span>
          <span className="font-bold text-zinc-300">{uptime}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-zinc-500 text-[10px]">Latencia de Red</span>
          <span className="font-bold text-emerald-400">12ms</span>
        </div>
      </div>
    </div>
  );
}
