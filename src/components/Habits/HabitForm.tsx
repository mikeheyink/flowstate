import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Habit } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface HabitFormProps {
  habit?: Habit;
  onSubmit: (data: { title: string; type: 'do' | 'dont-do'; daysOfWeek: number[] }) => void;
  onClose: () => void;
}

export function HabitForm({ habit, onSubmit, onClose }: HabitFormProps) {
  const [title, setTitle] = useState(habit?.title || '');
  const [type, setType] = useState<'do' | 'dont-do'>(habit?.type || 'do');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(habit?.daysOfWeek || [0, 1, 2, 3, 4]); // Default Mon-Fri

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a habit name');
      return;
    }
    if (daysOfWeek.length === 0) {
      alert('Please select at least one day');
      return;
    }
    onSubmit({ title: title.trim(), type, daysOfWeek });
  };

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">{habit ? 'Edit Habit' : 'New Habit'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Habit Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Exercise, Meditate, Drink water"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="do"
                  checked={type === 'do'}
                  onChange={() => setType('do')}
                  className="cursor-pointer"
                />
                <span>✓ Do (Something positive)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="dont-do"
                  checked={type === 'dont-do'}
                  onChange={() => setType('dont-do')}
                  className="cursor-pointer"
                />
                <span>✗ Avoid (Something to stop)</span>
              </label>
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <label className="block text-sm font-medium mb-3">Days of Week</label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`py-2 rounded-lg font-medium transition-colors ${
                    daysOfWeek.includes(idx)
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Selected: {daysOfWeek.length > 0 ? daysOfWeek.length : 'None'} day{daysOfWeek.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {habit ? 'Update' : 'Create'} Habit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
