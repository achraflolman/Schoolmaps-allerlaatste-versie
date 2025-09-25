


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Menu, LogOut, Camera, Bell, Flame, Loader2, Bot, X } from 'lucide-react';

import { auth, db, appId, storage, EmailAuthProvider, Timestamp, arrayUnion, increment } from '../../services/firebase';
import { translations, subjectDisplayTranslations, defaultHomeLayout } from '../../constants';
import type { AppUser, FileData, CalendarEvent, ModalContent, Notification, BroadcastData, ToDoTask, AdminSettings, Note, FlashcardSet, StudyPlan, StudySession, SyncedCalendar, ChatMessage, ChatHistory } from '../../types';

import CustomModal from '../ui/Modal';
import BroadcastModal from '../new/BroadcastModal';
import HomeView from './HomeView';
import SubjectView from './SubjectView';
import CalendarView from './CalendarView';
import SettingsView from './SettingsView';
import InfoView from './InfoView';
import FaqView from './FaqView';
import ToolsView from './ToolsView';
import Sidebar from '../ui/Sidebar';
import NotificationsView from './NotificationsView';
import FeedbackView from '../new/FeedbackView';
import AvatarSelectionModal from '../ui/AvatarSelectionModal';
import StudyPlannerView from './StudyPlannerView';
import AIChatView from './AIChatView';
import AISetupView from './AISetupView';
import SubjectSelectionView from './SubjectSelectionView';
import { Chat } from '@google/genai';

const MainAppLayout: React.FC<{
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    closeAppModal: () => void;
    copyTextToClipboard: (text: string, title?: string) => boolean;
    setIsAvatarModalOpen: (isOpen: boolean) => void;
    handleLogout: () => void;
    // Navigation state and handlers
    currentView: string;
    setCurrentView: (view: string) => void;
    currentSubject: string | null;
    setCurrentSubject: (subject: string | null) => void;
    handleGoHome: () => void;
    // Data for views
    subjectFiles: FileData[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    allEvents: CalendarEvent[];
    userStudyPlans: StudyPlan[];
    recentFiles: FileData[];
    allUserFiles: FileData[];
    allUserNotes: Note[];
    allUserFlashcardSets: FlashcardSet[];
    allUserTasks: ToDoTask[];
    allStudySessions: StudySession[];
    // Props for SettingsView
    language: 'nl' | 'en';
    setLanguage: (lang: 'nl' | 'en') => void;
    themeColor: string;
    setThemeColor: (color: string) => void;
    fontFamily: string;
    setFontFamily: (font: string) => void;
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
    onDeleteAccountRequest: () => void;
    onCleanupAccountRequest: () => void;
    onClearCalendarRequest: () => void;
    // Notifications
    notifications: Notification[];
    unreadCount: number;
    showBroadcast: (broadcastId: string) => void;
    // Persistent Timer Props
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
    addCalendarEvent: (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => Promise<string>;
    removeCalendarEvent: (title: string, date: string) => Promise<string>;
    currentTime: Date;
    // AI Chat Props
    aiChat: Chat | null;
    aiChatMessages: ChatMessage[];
    setAiChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    resetAIChat: () => void;
    chatHistories: ChatHistory[];
    currentChatSessionId: string | null;
    setCurrentChatSessionId: (id: string | null) => void;
}> = (props) => {
    const { 
        user, t, tSubject, getThemeClasses, showAppModal, copyTextToClipboard, setIsAvatarModalOpen,
        handleLogout, currentView, setCurrentView, currentSubject, setCurrentSubject, handleGoHome,
        subjectFiles, searchQuery, setSearchQuery, allEvents, userStudyPlans, recentFiles, allUserFiles, allUserNotes, allUserFlashcardSets, allUserTasks, allStudySessions,
        language, setLanguage, themeColor, setThemeColor, fontFamily, setFontFamily, onProfileUpdate, onDeleteAccountRequest, onCleanupAccountRequest, onClearCalendarRequest, closeAppModal, notifications, unreadCount, showBroadcast,
        focusMinutes, setFocusMinutes, breakMinutes, setBreakMinutes, timerMode, setTimerMode, timeLeft, setTimeLeft, isTimerActive, setIsTimerActive, selectedTaskForTimer, setSelectedTaskForTimer, addCalendarEvent, removeCalendarEvent,
        currentTime, aiChat, aiChatMessages, setAiChatMessages, resetAIChat, chatHistories, currentChatSessionId, setCurrentChatSessionId
    } = props;
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [initialTool, setInitialTool] = useState<string | null>(null);
    const [initialToolContext, setInitialToolContext] = useState<any>(null);

    const handleActivityClick = (type: string, context: any) => {
        if (type === 'plan') {
            setCurrentView('planner');
        } else if (type === 'note') {
            setInitialTool('notes');
            setInitialToolContext(context);
            setCurrentView('tools');
        } else if (type === 'set') {
            setInitialTool('flashcards');
            setInitialToolContext(context);
            setCurrentView('tools');
        }
    };
    
    const handleChatClose = () => {
        setIsChatOpen(false);
        // Reset to a new chat session state
        setCurrentChatSessionId(null);
        setAiChatMessages([{ role: 'model', text: t('ai_chat_welcome', { userName: user.userName.split(' ')[0], botName: user.aiBotName || 'AI Assistant' }) }]);
    };

    // Sidebar Click-outside Handler remains here as it's UI-specific to the layout
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isSidebarOpen) {
                 const hamburgerButton = document.getElementById('hamburger-menu');
                 if(hamburgerButton && !hamburgerButton.contains(event.target as Node)) {
                    setIsSidebarOpen(false);
                 }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const toolsViewProps = { t, getThemeClasses, showAppModal, closeAppModal, userId: user.uid, user, tSubject, copyTextToClipboard, focusMinutes, setFocusMinutes, breakMinutes, setBreakMinutes, timerMode, setTimerMode, timeLeft, setTimeLeft, isTimerActive, setIsTimerActive, selectedTaskForTimer, setSelectedTaskForTimer, userEvents: allEvents, allUserFiles, allUserNotes, allUserFlashcardSets, onProfileUpdate, allUserTasks, allStudySessions, initialTool, initialContext: initialToolContext, onToolSelected: () => { setInitialTool(null); setInitialToolContext(null); } };

    const mainContent = (
        <div>
            {currentView === 'home' && !currentSubject && <HomeView {...{ user, t, getThemeClasses, allEvents, language, allUserTasks, allStudySessions, recentFiles, setCurrentView, currentTime, onActivityClick: handleActivityClick, allUserNotes, allUserFlashcardSets, userStudyPlans }} />}
            {currentView === 'home' && currentSubject && <SubjectView {...{ user, currentSubject, subjectFiles, setCurrentSubject, t, tSubject, getThemeClasses, showAppModal, userId: user.uid, searchQuery, setSearchQuery, copyTextToClipboard }} />}
            
            {currentView === 'files' && !currentSubject && <SubjectSelectionView {...{ user, t, tSubject, getThemeClasses, setCurrentSubject }} />}
            {currentView === 'files' && currentSubject && <SubjectView {...{ user, currentSubject, subjectFiles, setCurrentSubject, t, tSubject, getThemeClasses, showAppModal, userId: user.uid, searchQuery, setSearchQuery, copyTextToClipboard }} />}

            {currentView === 'calendar' && <CalendarView {...{ allEvents, t, getThemeClasses, tSubject, language, showAppModal, userId: user.uid, user, onProfileUpdate, currentTime }} />}
            {currentView === 'planner' && <StudyPlannerView {...{ userStudyPlans, t, getThemeClasses, tSubject, language, showAppModal, userId: user.uid, user, allEvents }} />}
            {currentView === 'tools' && <ToolsView {...toolsViewProps} />}
            {currentView === 'settings' && <SettingsView {...{ user, t, getThemeClasses, language, setLanguage, themeColor, setThemeColor, showAppModal, tSubject, setCurrentView, onProfileUpdate, fontFamily, setFontFamily, onDeleteAccountRequest, onCleanupAccountRequest, onClearCalendarRequest, setIsAvatarModalOpen }} />}
            {currentView === 'notifications' && <NotificationsView {...{ user, t, getThemeClasses, notifications, setCurrentView, onProfileUpdate, showBroadcast, showAppModal }} />}
            {currentView === 'feedback' && <FeedbackView {...{ user, t, getThemeClasses, setCurrentView }} />}
            {currentView === 'appInfo' && <InfoView {...{ t, getThemeClasses, setCurrentView }} />}
            {currentView === 'faq' && <FaqView {...{ t, getThemeClasses, setCurrentView }} />}
        </div>
    );
    
    return (
        <div className={`flex h-screen w-full`}>
             <Sidebar {...{ user, isSidebarOpen, setIsSidebarOpen, sidebarRef, t, getThemeClasses, setCurrentView, currentView, currentSubject, setIsAvatarModalOpen }} />
            <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
               <header className="p-4 sticky top-0 bg-white/80 backdrop-blur-lg z-30 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <button type="button" id="hamburger-menu" onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-transform duration-200 active:scale-90`}>
                            <Menu className="w-6 h-6" />
                        </button>
                         <h1 onClick={handleGoHome} className={`text-xl sm:text-2xl font-bold ${getThemeClasses('text-logo')} cursor-pointer transition-transform hover:scale-105 active:scale-100`}>
                            StudyBox
                         </h1>
                        <div className="flex items-center gap-2">
                           {isTimerActive && (
                                <button type="button" onClick={() => setCurrentView('tools')} className={`p-2 rounded-lg font-mono text-sm font-bold ${getThemeClasses('text')} bg-gray-100 hover:bg-gray-200`}>
                                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </button>
                           )}
                           <button type="button" onClick={() => setCurrentView('notifications')} title={t('notifications_title')} className="relative p-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 active:scale-90">
                                <Bell className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className={`absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${getThemeClasses('bg')} transform translate-x-1/4 -translate-y-1/4`}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                           </button>
                           <button type="button" onClick={handleLogout} title={t('logout_button')} className="p-2 rounded-lg text-red-500 bg-red-100 hover:bg-red-200 transition-colors duration-200 active:scale-90">
                                <LogOut className="w-6 h-6" />
                           </button>
                        </div>
                    </div>
               </header>
                <div className="flex-1 p-[clamp(1rem,2vw+0.5rem,2rem)] relative">
                    <div className="max-w-7xl mx-auto">
                        {mainContent}
                    </div>
                </div>
            </main>
            
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className={`fixed bottom-6 right-6 z-40 p-4 rounded-full text-white shadow-lg transform transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce-in ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}
                    title={t('ai_chat')}
                >
                    <Bot className="w-6 h-6" />
                </button>
            )}

            {isChatOpen && (
                 <AIChatView
                    user={user}
                    userId={user.uid}
                    t={t}
                    getThemeClasses={getThemeClasses}
                    showAppModal={showAppModal}
                    onClose={handleChatClose}
                    addCalendarEvent={addCalendarEvent}
                    removeCalendarEvent={removeCalendarEvent}
                    tSubject={tSubject}
                    userEvents={allEvents}
                    onProfileUpdate={onProfileUpdate}
                    userStudyPlans={userStudyPlans}
                    chat={aiChat}
                    messages={aiChatMessages}
                    setMessages={setAiChatMessages}
                    chatHistories={chatHistories}
                    currentChatSessionId={currentChatSessionId}
                    setCurrentChatSessionId={setCurrentChatSessionId}
                />
            )}
        </div>
    );
};
export default MainAppLayout;
