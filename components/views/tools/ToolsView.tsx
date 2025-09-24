

import React, { useState, useEffect } from 'react';
import { BookOpen, Timer, ListTodo, BarChart3, FileText, ArrowLeft } from 'lucide-react';
import FlashcardsView from './FlashcardsView';
import StudyTimerView from './StudyTimerView';
import ToDoListView from './ToDoListView';
import ProgressView from '../ProgressView';
import NotesView from './NotesView';

import type { AppUser, ModalContent, ToDoTask, CalendarEvent, FileData, Note, FlashcardSet, StudySession } from '../../../types';

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

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const ToolsView: React.FC<ToolsViewProps> = (props) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (props.initialTool) {
      setActiveTool(props.initialTool);
    } else if (!isMobile) {
      setActiveTool('flashcards');
    } else {
      setActiveTool(null);
    }
  }, [props.initialTool, isMobile]);

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

  const handleToolSelect = (toolId: string) => {
    setActiveTool(toolId);
  }

  const handleBackToMenu = () => {
    setActiveTool(null);
    if (props.onToolSelected) {
      props.onToolSelected(null);
    }
  }
  
  if (isSessionActive && activeTool === 'flashcards') {
    // Render only the flashcards view in fullscreen during a session
    return <FlashcardsView {...props} setIsSessionActive={setIsSessionActive} />;
  }
  
  if (isMobile) {
    if (activeTool && toolComponents[activeTool]) {
      const selectedToolInfo = toolNavItems.find(item => item.id === activeTool);
      return (
          <div className="animate-fade-in">
              <div className="flex items-center mb-4">
                   <button onClick={handleBackToMenu} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                      <ArrowLeft />
                  </button>
                  <h2 className={`text-2xl font-bold text-center flex-grow ${props.getThemeClasses('text-strong')}`}>{selectedToolInfo?.label}</h2>
                   <div className="w-9 h-9"></div> {/* Placeholder to ensure title is centered */}
              </div>
              {toolComponents[activeTool]}
          </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className={`text-3xl font-bold text-center ${props.getThemeClasses('text-strong')}`}>{props.t('extra_tools')}</h2>
        <div className="grid grid-cols-2 gap-4">
          {toolNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleToolSelect(item.id)}
              className={`p-6 bg-white rounded-lg shadow-md font-semibold text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 ${props.getThemeClasses('ring')} ${props.getThemeClasses('text-strong')}`}
            >
              <div className={props.getThemeClasses('text')}>
                {React.cloneElement(item.icon, { className: "w-12 h-12 mx-auto mb-2" })}
              </div>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Desktop Layout
  const desktopActiveTool = activeTool || 'flashcards';
  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-shrink-0 md:w-56">
          <h2 className={`text-2xl font-bold mb-4 text-center md:text-left ${props.getThemeClasses('text-strong')}`}>{props.t('extra_tools')}</h2>
          <div className="flex flex-col gap-2">
              {toolNavItems.map(item => (
                  <button
                      key={item.id}
                      onClick={() => setActiveTool(item.id)}
                      className={`flex items-center w-full justify-start gap-3 py-2 px-4 font-semibold rounded-md transition-colors flex-shrink-0 ${desktopActiveTool === item.id ? `${props.getThemeClasses('bg')} text-white shadow` : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                      {item.icon}
                      <span className="whitespace-nowrap">{item.label}</span>
                  </button>
              ))}
          </div>
      </div>
      <div className="flex-grow min-w-0">
        {toolComponents[desktopActiveTool]}
      </div>
    </div>
  );
};

export default ToolsView;