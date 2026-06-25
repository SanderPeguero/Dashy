import React, { useState } from 'react';
import { Check, Plus, Trash2, ListTodo, CheckSquare } from 'lucide-react';

export default function QuickTasks() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Actualizar dependencias de producción', completed: true },
    { id: 2, text: 'Revisar logs de base de datos PostgreSQL', completed: false },
    { id: 3, text: 'Diseñar mockup de panel de analíticas v2', completed: false },
    { id: 4, text: 'Aprobar Pull Requests del equipo', completed: true },
    { id: 5, text: 'Preparar reporte para la reunión mensual', completed: false }
  ]);
  const [newTaskText, setNewTaskText] = useState('');

  const handleToggle = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks([
      ...tasks,
      { id: Date.now(), text: newTaskText.trim(), completed: false }
    ]);
    setNewTaskText('');
  };

  const handleDeleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between h-[360px] overflow-hidden">
      
      {/* Header & Progress */}
      <div className="border-b border-[#222226] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15">
              Tareas
            </span>
            <span className="text-xs text-zinc-500 font-medium font-sans">Pendientes</span>
          </div>
          <h3 className="text-lg font-bold text-white font-sans mt-0.5 flex items-center gap-1.5">
            <ListTodo className="w-4 h-4 text-indigo-400" />
            <span>Objetivos Diarios</span>
          </h3>
        </div>

        {/* Progress bar */}
        <div className="mt-3.5">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 font-sans mb-1.5 uppercase tracking-wide">
            <span>Progreso</span>
            <span>{completedCount} de {tasks.length} ({progressPercent}%)</span>
          </div>
          <div className="w-full h-1.5 bg-[#18181b] border border-[#222226] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task list container */}
      <div className="flex-1 my-3 overflow-y-auto space-y-2 pr-1.5">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div 
              key={task.id} 
              className="flex items-center justify-between p-2.5 rounded-xl border border-[#222226]/40 bg-[#18181b]/20 hover:bg-[#18181b]/50 hover:border-[#222226] group transition-all duration-150"
            >
              <div 
                onClick={() => handleToggle(task.id)}
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div 
                  className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all shrink-0
                    ${task.completed 
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                      : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'}`}
                >
                  {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                
                <span className={`text-xs font-medium font-sans transition-all truncate select-none
                  ${task.completed 
                    ? 'text-zinc-500 line-through' 
                    : 'text-zinc-300 group-hover:text-white'}`}
                >
                  {task.text}
                </span>
              </div>

              {/* Trash/delete action */}
              <button 
                onClick={() => handleDeleteTask(task.id)}
                className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <CheckSquare className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-zinc-500 font-sans">¡Buen trabajo! Todo está completo</p>
          </div>
        )}
      </div>

      {/* Add Task input form */}
      <form onSubmit={handleAddTask} className="pt-2 border-t border-[#222226] flex gap-2">
        <input
          type="text"
          placeholder="Nueva tarea..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#18181b] border border-[#222226] hover:border-zinc-700 focus:border-indigo-500 text-zinc-300 text-xs rounded-xl focus:outline-none transition-all placeholder:text-zinc-600 font-medium"
        />
        <button 
          type="submit"
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10 cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
