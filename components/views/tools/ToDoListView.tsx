import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, appId, Timestamp } from '../../../services/firebase';
import type { ToDoTask, AppUser, ModalContent } from '../../../types';
import { PlusCircle, Trash2, Bell, Loader2, Calendar, Repeat, ArrowLeft } from 'lucide-react';

interface ToDoListViewProps {
  userId: string;
  user: AppUser;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
  onBack?: () => void;
}

// Helper to get a YYYY-MM-DD string from a Date object
const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const ReminderModal: React.FC<{
    task: ToDoTask;
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: ToDoTask, reminder: Date | null) => void;
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
}> = ({ task, isOpen, onClose, onSave, t, getThemeClasses }) => {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    useEffect(() => {
        if (task?.reminderAt) {
            const reminderDate = task.reminderAt.toDate();
            setDate(toLocalDateString(reminderDate));
            setTime(reminderDate.toTimeString().substring(0, 5));
        } else {
            const defaultDate = new Date();
            defaultDate.setHours(9,0,0,0);
            setDate(toLocalDateString(defaultDate));
            setTime('09:00');
        }
    }, [task]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!date || !time) return;
        const reminderDateTime = new Date(`${date}T${time}`);
        if (isNaN(reminderDateTime.getTime())) return;
        onSave(task, reminderDateTime);
    };

    const handleRemove = () => {
        onSave(task, null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{t('set_reminder_title', { task: task.text })}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('reminder_date')}</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('reminder_time')}</label>
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                </div>
                <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
                    <button onClick={handleSave} className={`w-full py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95`}>
                        {t('save_reminder_button')}
                    </button>
                    {task.reminderAt && (
                        <button onClick={handleRemove} className="w-full py-2 px-4 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold transition-colors active:scale-95">
                            {t('remove_reminder_button')}
                        </button>
                    )}
                    <button onClick={onClose} className="w-full sm:w-auto py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">
                        {t('cancel_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};


const ToDoListView: React.FC<ToDoListViewProps> = ({ userId, user, t, getThemeClasses, showAppModal, onBack }) => {
  const [allTasks, setAllTasks] = useState<ToDoTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ToDoTask | null>(null);
  const reminderTimeoutsRef = useRef(new Map<string, number>());

  const scheduleNotification = useCallback((task: ToDoTask) => {
    if (reminderTimeoutsRef.current.has(task.id)) {
        clearTimeout(reminderTimeoutsRef.current.get(task.id));
        reminderTimeoutsRef.current.delete(task.id);
    }

    if (task.reminderAt && task.reminderAt.toDate() > new Date() && !task.completed) {
        const delay = task.reminderAt.toDate().getTime() - Date.now();
        const timeoutId = window.setTimeout(() => {
            new Notification(t('task_reminder_title'), {
                body: task.text,
                icon: '/apple-touch-icon.png'
            });
            reminderTimeoutsRef.current.delete(task.id);
        }, delay);
        reminderTimeoutsRef.current.set(task.id, timeoutId);
    }
  }, [t]);

  useEffect(() => {
    if (user.uid === 'guest-user') return;
    const q = db.collection(`users/${userId}/tasks`).orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      const fetchedTasks = snapshot.docs.map(d => ({id: d.id, ...d.data()} as ToDoTask));
      setAllTasks(fetchedTasks);
      fetchedTasks.forEach(scheduleNotification);
    }, (error) => {
        showAppModal({text: t('error_failed_to_load_tasks')});
    });

    return () => {
      for (const timeoutId of reminderTimeoutsRef.current.values()) {
          clearTimeout(timeoutId);
      }
      reminderTimeoutsRef.current.clear();
      unsubscribe();
    };
  }, [userId, user.uid, showAppModal, t, scheduleNotification]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed') });
        return;
    }
    if(!newTaskText.trim()) return showAppModal({text: t('error_empty_task')});
    
    const taskData: any = {
        text: newTaskText,
        completed: false,
        ownerId: userId,
        createdAt: Timestamp.now(),
        recurring: isRecurring ? 'daily' : null,
    };

    if (!isRecurring) {
        // Only add dueDate if the task is not recurring
        taskData.dueDate = Timestamp.fromDate(new Date((newDueDate || toLocalDateString(new Date())) + 'T00:00:00'));
    }

    await db.collection(`users/${userId}/tasks`).add(taskData);
    setNewTaskText('');
    setNewDueDate('');
    setIsRecurring(false);
  };

  const handleToggleTask = async (task: ToDoTask) => {
    if (user.uid === 'guest-user') return;
    const isCompleted = !task.completed;
    const updateData: Partial<ToDoTask> = { 
        completed: isCompleted,
        completedAt: isCompleted ? Timestamp.now() : undefined,
    };
    await db.doc(`users/${userId}/tasks/${task.id}`).update(updateData);
  };
  
  const handleDeleteTask = (id: string) => {
    showAppModal({
      text: t('confirm_delete_task'),
      confirmAction: async () => {
        await db.doc(`users/${userId}/tasks/${id}`).delete();
        if (reminderTimeoutsRef.current.has(id)) {
            clearTimeout(reminderTimeoutsRef.current.get(id));
            reminderTimeoutsRef.current.delete(id);
        }
      },
      cancelAction: () => {}
    });
  };

  const handleSaveReminder = async (task: ToDoTask, reminderDateTime: Date | null) => {
    if (reminderDateTime && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showAppModal({ text: t('notifications_denied_prompt') });
            return;
        }
    }
    const reminderAt = reminderDateTime ? Timestamp.fromDate(reminderDateTime) : null;
    await db.doc(`users/${userId}/tasks/${task.id}`).update({ reminderAt });
    setIsReminderModalOpen(false);
  };
  
  const tasksForToday = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
  
    return allTasks
      .map(task => {
        const isCompletedToday = task.completed && task.completedAt && task.completedAt.toDate() >= todayStart;
  
        // Daily recurring tasks are always relevant for today
        if (task.recurring === 'daily') {
          return { ...task, completed: isCompletedToday };
        }
        // Non-recurring tasks are only relevant if due today
        else if (task.dueDate && toLocalDateString(task.dueDate.toDate()) === todayStr) {
          return task;
        }
        // Completed non-recurring tasks from today should also be shown
        else if (isCompletedToday && !task.recurring) {
            return task;
        }
        
        return null; // This task is not for today
      })
      .filter((task): task is ToDoTask => task !== null) // Remove nulls
      .sort((a, b) => (a.completed ? 1 : -1) - (b.completed ? 1 : -1) || a.createdAt.toMillis() - b.createdAt.toMillis());
  }, [allTasks]);


  const TaskItem: React.FC<{ task: ToDoTask }> = ({ task }) => (
    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between transition-shadow hover:shadow-md gap-2">
        <label className="flex items-center gap-3 cursor-pointer w-full">
            <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} className={`form-checkbox h-5 w-5 rounded transition-colors ${getThemeClasses('text')} focus:ring-0`}/>
            <div className="flex-1">
              <span className={`${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.text}</span>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {task.dueDate && <span><Calendar size={12} className="inline mr-1"/>{task.dueDate.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                {task.recurring && <span><Repeat size={12} className="inline mr-1"/>{t('recurring_daily')}</span>}
                {task.reminderAt && <span><Bell size={12} className={`inline mr-1 ${getThemeClasses('text')}`} />{task.reminderAt.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
        </label>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => { setSelectedTask(task); setIsReminderModalOpen(true); }} className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors active:scale-90"><Bell className="w-4 h-4"/></button>
          <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button>
        </div>
    </div>
  );

  return (
    <>
      {selectedTask && <ReminderModal task={selectedTask} isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)} onSave={handleSaveReminder} t={t} getThemeClasses={getThemeClasses} />}
      <div className="flex items-center mb-4">
        {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>}
        <h3 className={`font-bold text-xl flex-grow text-center ${getThemeClasses('text-strong')}`}>{t('todo_list')}</h3>
        <div className="w-9 h-9"></div> {/* Placeholder for centering */}
      </div>
      <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
          <form onSubmit={handleAddTask} className="p-3 bg-white rounded-lg shadow-sm space-y-2">
              <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder={t('add_task_placeholder')} className="w-full p-2 border rounded-lg"/>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} id="due-date-picker" className="p-2 border rounded-lg w-36" disabled={isRecurring}/>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className={`h-4 w-4 rounded ${getThemeClasses('text')} focus:ring-0`} />
                        <span className="text-sm font-semibold">{t('recurring_daily')}</span>
                    </label>
                </div>
                <button type="submit" className={`flex items-center text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                    <PlusCircle className="w-5 h-5 mr-2"/> {t('add_task_button')}
                </button>
              </div>
          </form>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-lg mb-2">{t('tasks_for_today')}</h3>
              <div className="space-y-2">
                {tasksForToday.length > 0 ? tasksForToday.map(task => <TaskItem key={task.id} task={task} />) : <p className="text-center italic text-gray-500 py-4">{t('no_tasks_for_today')}</p>}
              </div>
               <p className="text-center text-xs text-gray-500 mt-4">{t('todo_daily_refresh_note')}</p>
            </div>
          </div>
      </div>
    </>
  );
};

export default ToDoListView;