import React, { useState } from 'react';
import { Search, ChevronDown, CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function RecentActivity() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | Completed | Pending | Failed

  const activities = [
    {
      id: 'TX-9041',
      name: 'Olivia Martinez',
      email: 'olivia.m@dashy.io',
      amount: '$1,299.00',
      status: 'Completed',
      date: 'Hace 5 minutos',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80'
    },
    {
      id: 'TX-9040',
      name: 'Alex Rivera',
      email: 'alex.r@dashy.io',
      amount: '$450.00',
      status: 'Pending',
      date: 'Hace 1 hora',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80'
    },
    {
      id: 'TX-9039',
      name: 'Elena Rostova',
      email: 'elena.r@dashy.io',
      amount: '$2,800.00',
      status: 'Completed',
      date: 'Hace 3 horas',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&h=80&q=80'
    },
    {
      id: 'TX-9038',
      name: 'Marcus Vance',
      email: 'marcus.v@dashy.io',
      amount: '$89.00',
      status: 'Failed',
      date: 'Hace 1 día',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&h=80&q=80'
    },
    {
      id: 'TX-9037',
      name: 'Sarah Chen',
      email: 'sarah.c@dashy.io',
      amount: '$620.00',
      status: 'Completed',
      date: 'Hace 1 día',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&h=80&q=80'
    }
  ];

  const statusIcons = {
    Completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />,
    Pending: <Clock className="w-3.5 h-3.5 text-amber-400 mr-1" />,
    Failed: <AlertTriangle className="w-3.5 h-3.5 text-red-400 mr-1" />
  };

  const statusStyles = {
    Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/15',
    Failed: 'bg-red-500/10 text-red-400 border-red-500/15'
  };

  const statusLabels = {
    Completed: 'Completado',
    Pending: 'Pendiente',
    Failed: 'Fallido'
  };

  // Filter logic
  const filteredActivities = activities.filter((act) => {
    const matchesSearch = act.name.toLowerCase().includes(search.toLowerCase()) || 
                          act.email.toLowerCase().includes(search.toLowerCase()) ||
                          act.id.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || act.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-emerald hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between overflow-hidden">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#222226] pb-4">
        <div>
          <h3 className="text-lg font-bold text-white font-sans">Actividad Reciente</h3>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">Lista de últimas transacciones y clientes</p>
        </div>
        
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full sm:w-56 bg-[#18181b] border border-[#222226] hover:border-zinc-700 focus:border-indigo-500 text-zinc-300 text-xs rounded-xl focus:outline-none transition-all placeholder:text-zinc-600 font-medium"
            />
          </div>

          {/* Filter Dropdown buttons */}
          <div className="flex items-center gap-1 bg-[#18181b] border border-[#222226] p-1 rounded-xl">
            {['All', 'Completed', 'Pending'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-sans transition-all cursor-pointer
                  ${statusFilter === filter
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {filter === 'All' ? 'Todos' : filter === 'Completed' ? 'Éxito' : 'Pend.'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#222226]/50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider font-sans">
              <th className="pb-3 pt-1">Usuario</th>
              <th className="pb-3 pt-1">ID Transacción</th>
              <th className="pb-3 pt-1">Fecha / Hora</th>
              <th className="pb-3 pt-1">Monto</th>
              <th className="pb-3 pt-1 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222226]/30">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((act) => (
                <tr key={act.id} className="hover:bg-[#18181b]/30 group transition-colors duration-150">
                  <td className="py-3.5 flex items-center gap-3">
                    <img
                      src={act.avatar}
                      alt={act.name}
                      className="w-8.5 h-8.5 rounded-xl object-cover ring-2 ring-zinc-800 group-hover:ring-indigo-500/20 transition-all"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white font-sans group-hover:text-indigo-400 transition-colors">
                        {act.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {act.email}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-xs font-bold text-zinc-400 font-mono">
                    {act.id}
                  </td>
                  <td className="py-3.5 text-xs text-zinc-500 font-sans">
                    {act.date}
                  </td>
                  <td className="py-3.5 text-xs font-black text-white font-sans">
                    {act.amount}
                  </td>
                  <td className="py-3.5 text-right">
                    <span className={`inline-flex items-center text-[10px] font-bold font-sans px-2.5 py-1 rounded-lg border ${statusStyles[act.status]}`}>
                      {statusIcons[act.status]}
                      {statusLabels[act.status]}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-8 text-center text-xs font-semibold text-zinc-600 font-sans">
                  No se encontraron transacciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
