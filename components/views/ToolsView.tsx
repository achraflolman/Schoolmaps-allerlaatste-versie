

import React, { useState } from 'react';
import { BookOpen, Timer, ListTodo, BarChart3, FileText } from 'lucide-react';
import FlashcardsView from './tools/FlashcardsView';
import StudyTimerView from './tools/StudyTimerView';
import ToDoListView from './tools/ToDoListView';
import ProgressView from './ProgressView';
import NotesView from './tools/NotesView';

import type { AppUser, ModalContent, ToDoTask, CalendarEvent, FileData, Note, FlashcardSet, StudySession } from '../../types';

interface ToolsViewProps {
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
  closeAppModal: () => void;
  userId: string;
  user: AppUser;
  tSubject: (key: string) => string;
  copyTextToClipboard: (text: string) => boolean;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
  focusMinutes: number;
  setFocusMinutes: (m: number) => void;
  breakMinutes: number;
  setBreakMinutes: (m: number) => void;
  timerMode: 'focus' | 'break';
  setTimerMode: (m: 'focus' | 'break') => void;
  timeLeft: number;
  setTimeLeft: (s: number) => void;
  isTimerActive: boolean;
  setIsTimerActive: (a: boolean) => void;
  selectedTaskForTimer: ToDoTask | null;
  setSelectedTaskForTimer: (t: ToDoTask | null) => void;
  userEvents: CalendarEvent[];
  allUserFiles: FileData[];
  allUserNotes: Note[];
  allUserFlashcardSets: FlashcardSet[];
  allStudySessions: StudySession[];
  allUserTasks: ToDoTask[];
}

const ToolsView: React.FC<ToolsViewProps> = (props) => {
  const [activeTool, setActiveTool] = useState('flashcards');
  const [isSessionActive, setIsSessionActive] = useState(false);

  const toolComponents: { [key: string]: React.ReactNode } = {
    timer: <StudyTimerView {...props} />,
    todo: <ToDoListView {...props} />,
    flashcards: <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} />,
    notes: <NotesView {...props} />,
    progress: <ProgressView {...props} />,
  };
  
  const toolNavItems = [
      { id: 'flashcards', label: props.t('flashcards'), icon: <BookOpen/> },
      { id: 'timer', label: props.t('pomodoros'), icon: <Timer/> },
      { id: 'todo', label: props.t('todo_list'), icon: <ListTodo/> },
      { id: 'notes', label: props.t('notes'), icon: <FileText/> },
      { id: 'progress', label: props.t('progress'), icon: <BarChart3/> },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {!isSessionActive && (
        <div className="flex-shrink-0 md:w-56">
            <h2 className={`text-2xl font-bold mb-4 ${props.getThemeClasses('text-strong')}`}>{props.t('extra_tools')}</h2>
            <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2">
                {toolNavItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTool(item.id)}
                        className={`flex items-center w-full justify-start gap-3 py-2 px-4 font-semibold rounded-md transition-colors flex-shrink-0 ${activeTool === item.id ? `${props.getThemeClasses('bg')} text-white shadow` : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {item.icon}
                        <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}
      <div className="flex-grow min-w-0">
        {toolComponents[activeTool]}
      </div>
    </div>
  );
};

export default ToolsView;