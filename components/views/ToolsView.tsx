
import React, { useState, useEffect } from 'react';
import { BookOpen, Timer, ListTodo, BarChart3, FileText, X, Layers } from 'lucide-react';
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
  initialTool?: string | null;
  initialContext?: any;
  onToolSelected?: (tool: string | null) => void;
}

const ToolsView: React.FC<ToolsViewProps> = (props) => {
  const [activeTool, setActiveTool] = useState(props.initialTool || 'flashcards');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  useEffect(() => {
    if (props.initialTool) {
      setActiveTool(props.initialTool);
    }
  }, [props.initialTool]);

  const toolComponents: { [key: string]: React.ReactNode } = {
    flashcards: <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} />,
    timer: <StudyTimerView {...props} />,
    todo: <ToDoListView {...props} />,
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

  if (isSessionActive && activeTool === 'flashcards') {
    return <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${props.getThemeClasses('text-strong')}`}>{props.t('extra_tools')}</h2>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
        >
          {isMenuOpen ? <X size={20} /> : <Layers size={20} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          {toolNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTool(item.id)}
              className={`p-4 flex flex-col items-center justify-center gap-2 rounded-lg font-semibold text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 ${props.getThemeClasses('ring')}
                ${activeTool === item.id 
                  ? `${props.getThemeClasses('bg-light')} border-2 ${props.getThemeClasses('border')}` 
                  : 'bg-white'
                }`}
            >
              {React.cloneElement(item.icon, { className: `w-10 h-10 mx-auto mb-2 ${props.getThemeClasses('text')}`})}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        {toolComponents[activeTool]}
      </div>
    </div>
  );
};

export default ToolsView;