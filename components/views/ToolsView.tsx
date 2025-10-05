import React, { useState, useEffect } from 'react';
import { BookOpen, Timer, ListTodo, BarChart3, FileText, ArrowLeft } from 'lucide-react';
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
  const [selectedTool, setSelectedTool] = useState<string | null>(props.initialTool || null);
  const [isSessionActive, setIsSessionActive] = useState(false); // Special case for flashcard sessions

  useEffect(() => {
    if (props.initialTool) {
      setSelectedTool(props.initialTool);
    }
  }, [props.initialTool]);
  
  // Flashcard sessions need to take over the whole screen
  if (isSessionActive && selectedTool === 'flashcards') {
    return <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} onBack={() => setSelectedTool(null)} />;
  }
  
  const toolNavItems = [
      { id: 'flashcards', label: props.t('flashcards'), icon: <BookOpen/> },
      { id: 'timer', label: props.t('pomodoros'), icon: <Timer/> },
      { id: 'todo', label: props.t('todo_list'), icon: <ListTodo/> },
      { id: 'notes', label: props.t('notes'), icon: <FileText/> },
      { id: 'progress', label: props.t('progress'), icon: <BarChart3/> },
  ];

  if (!selectedTool) {
      return (
          <div className="space-y-4 animate-fade-in">
              <h2 className={`text-2xl font-bold ${props.getThemeClasses('text-strong')}`}>{props.t('extra_tools')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {toolNavItems.map(item => (
                      <button
                          key={item.id}
                          onClick={() => setSelectedTool(item.id)}
                          className={`p-4 flex flex-col items-center justify-center gap-2 rounded-lg font-semibold text-center bg-white shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 ${props.getThemeClasses('ring')}`}
                      >
                          {React.cloneElement(item.icon, { className: `w-10 h-10 mx-auto mb-2 ${props.getThemeClasses('text')}`})}
                          {item.label}
                      </button>
                  ))}
              </div>
          </div>
      );
  }

  const toolComponents: { [key: string]: React.ReactNode } = {
    flashcards: <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} onBack={() => setSelectedTool(null)} />,
    timer: <StudyTimerView {...props} onBack={() => setSelectedTool(null)} />,
    todo: <ToDoListView {...props} onBack={() => setSelectedTool(null)} />,
    notes: <NotesView {...props} onBack={() => setSelectedTool(null)} />,
    progress: <ProgressView {...props} onBack={() => setSelectedTool(null)} />,
  };
  
  return (
      <div className="animate-fade-in">
          {toolComponents[selectedTool]}
      </div>
  );
};

export default ToolsView;
