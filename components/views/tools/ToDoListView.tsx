import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, appId, Timestamp } from '../../../services/firebase';
import type { ToDoTask, AppUser, ModalContent } from '../../../types';
import { PlusCircle, Trash2, Bell, Loader2 } from 'lucide-react';

interface ToDoListViewProps {
  userId: string;
  user: AppUser;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
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


const ToDoListView: React.FC<ToDoListViewProps> = ({ userId, user, t, getThemeClasses, showAppModal }) => {
  const [tasks, setTasks] = useState<ToDoTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ToDoTask | null>(null);
  const reminderTimeoutsRef = useRef(new Map<string, number>());

  const scheduleNotification = useCallback((task: ToDoTask) => {
    // Clear any existing timeout for this task to prevent duplicates
    if (reminderTimeoutsRef.current.has(task.id)) {
        clearTimeout(reminderTimeoutsRef.current.get(task.id));
        reminderTimeoutsRef.current.delete(task.id);
    }

    if (task.reminderAt && task.reminderAt.toDate() > new Date()) {
        const delay = task.reminderAt.toDate().getTime() - Date.now();
        const timeoutId = window.setTimeout(() => {
            new Notification(t('task_reminder_title'), {
                body: task.text,
                icon: '/apple-touch-icon.png' // Using app icon for notification
            });
            reminderTimeoutsRef.current.delete(task.id);
        }, delay);
        reminderTimeoutsRef.current.set(task.id, timeoutId);
    }
  }, [t]);


  useEffect(() => {
    if (user.uid === 'guest-user') {
        setTasks([]);
        return;
    }
    const q = db.collection(`artifacts/${appId}/users/${userId}/tasks`).orderBy('createdAt', 'desc');
    const unsubscribe = q.onSnapshot(snapshot => {
      const fetchedTasks = snapshot.docs.map(d => ({id: d.id, ...d.data()} as ToDoTask));
      setTasks(fetchedTasks);
      // Schedule notifications for all tasks with future reminders
      fetchedTasks.forEach(scheduleNotification);
    }, (error) => {
        console.error("Error fetching to-do tasks:", error);
        showAppModal({text: t('error_failed_to_load_tasks')});
    });

    return () => {
      // Cleanup: clear all timeouts when the component unmounts
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
    if(!newTask.trim()) return showAppModal({text: t('error_empty_task')});
    await db.collection(`artifacts/${appId}/users/${userId}/tasks`).add({
        text: newTask,
        completed: false,
        ownerId: userId,
        createdAt: Timestamp.now()
    });
    setNewTask('');
    showAppModal({text: t('task_added_success')});
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    if (user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed') });
        return;
    }
    await db.doc(`artifacts/${appId}/users/${userId}/tasks/${id}`).update({ completed: !completed });
    showAppModal({text: t('task_updated_success')});
  };
  
  const handleDeleteTask = (id: string) => {
    if (user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed') });
        return;
    }
    showAppModal({
      text: t('confirm_delete_task'),
      confirmAction: async () => {
        await db.doc(`artifacts/${appId}/users/${userId}/tasks/${id}`).delete();
        // Clear any scheduled notification for the deleted task
        if (reminderTimeoutsRef.current.has(id)) {
            clearTimeout(reminderTimeoutsRef.current.get(id));
            reminderTimeoutsRef.current.delete(id);
        }
        showAppModal({text: t('task_deleted_success')});
      },
      cancelAction: () => {}
    });
  };

  const handleSaveReminder = async (task: ToDoTask, reminderDateTime: Date | null) => {
    if (user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed') });
        return;
    }
    if (reminderDateTime && Notification.permission === 'denied') {
        showAppModal({ text: t('notifications_denied_error') });
        return;
    }

    if (reminderDateTime && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showAppModal({ text: t('notifications_denied_prompt') });
            return;
        }
    }

    const reminderAt = reminderDateTime ? Timestamp.fromDate(reminderDateTime) : null;
    await db.doc(`artifacts/${appId}/users/${userId}/tasks/${task.id}`).update({ reminderAt });
    
    // The onSnapshot listener will automatically pick up the change and reschedule the notification.
    setIsReminderModalOpen(false);
  };

  return (
    <>
      <ReminderModal
          task={selectedTask!}
          isOpen={isReminderModalOpen}
          onClose={() => setIsReminderModalOpen(false)}
          onSave={handleSaveReminder}
          t={t}
          getThemeClasses={getThemeClasses}
      />
      <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
          <form onSubmit={handleAddTask} className="flex gap-2">
              <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)} placeholder={t('add_task_placeholder')} className="flex-grow p-2 border rounded-lg"/>
              <button type="submit" className={`flex items-center text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                  <PlusCircle className="w-5 h-5 mr-2"/> {t('add_task_button')}
              </button>
          </form>
          <div className="space-y-2">
              {tasks.length === 0 ? (
                  <p className="text-center italic text-gray-500 py-4">{t('no_tasks_found')}</p>
              ) : (
                  tasks.map(task => (
                      <div key={task.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between transition-shadow hover:shadow-md gap-2">
                          <label className="flex items-center gap-3 cursor-pointer w-full">
                              <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id, task.completed)} className={`form-checkbox h-5 w-5 rounded transition-colors ${getThemeClasses('text')} focus:ring-0`}/>
                              <div className="flex-1">
                                <span className={`${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.text}</span>
                                {task.reminderAt && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Bell size={12} className={getThemeClasses('text')} />
                                        {task.reminderAt.toDate().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                              </div>
                          </label>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => { setSelectedTask(task); setIsReminderModalOpen(true); }} className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors active:scale-90"><Bell className="w-4 h-4"/></button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </>
  );
};

export default ToDoListView;