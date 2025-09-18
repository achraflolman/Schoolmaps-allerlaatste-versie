import React, { useMemo } from 'react';
import type { AppUser, CalendarEvent, ToDoTask, StudySession, FlashcardSet, FileData } from '../../types';
import { ArrowUp, ArrowDown, CheckCircle, Clock, Layers, Calendar, FileText, ChevronRight, Link } from 'lucide-react';
import { defaultHomeLayout } from '../../constants';

// --- HELPER FUNCTIONS ---
const getWeekBounds = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { start: monday, end: sunday };
};

// --- SUB COMPONENTS ---
const StatCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string | number;
    comparison: number | null;
    bgClass: string;
    textClass: string;
    iconBgClass: string;
}> = ({ icon, title, value, comparison, bgClass, textClass, iconBgClass }) => {
    const isPositive = comparison !== null && comparison >= 0;
    const hasComparison = comparison !== null && isFinite(comparison) && comparison !== 0;

    return (
        <div className={`p-5 rounded-2xl shadow-lg ${bgClass} ${textClass}`}>
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-full ${iconBgClass}`}>
                    {icon}
                </div>
                {hasComparison && (
                    <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-green-500/20 text-green-800' : 'bg-red-500/20 text-red-800'}`}>
                        {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        {Math.abs(comparison).toFixed(0)}%
                    </div>
                )}
            </div>
            <p className="mt-4 text-4xl font-bold">{value}</p>
            <p className="text-sm font-medium opacity-80">{title}</p>
        </div>
    );
};

const TodaysAgenda: React.FC<{
    events: CalendarEvent[];
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    onNavigate: () => void;
    currentTime: Date;
}> = ({ events, t, getThemeClasses, onNavigate, currentTime }) => {
    const isEventInProgress = (event: CalendarEvent): boolean => {
        const start = (event.start as any).toDate();
        const end = (event.end as any).toDate();
        return currentTime >= start && currentTime < end;
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold mb-4">{t('todays_agenda_title')}</h3>
            {events.length === 0 ? (
                <p className="text-center text-gray-500 italic py-4">{t('no_events_today')}</p>
            ) : (
                <ul className="space-y-3 max-h-60 overflow-y-auto">
                    {events.map(event => (
                        <li key={event.id} className="flex items-center gap-3">
                            <div className={`w-1.5 h-10 rounded-full ${event.isSynced ? 'bg-yellow-400' : getThemeClasses('bg')}`}></div>
                            <div className="flex-grow">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {event.isSynced && <Link size={12} className="text-gray-400"/>}
                                    <p className="font-semibold">{event.title}</p>
                                    {isEventInProgress(event) && (
                                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                                            {t('in_progress_badge')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">{(event.start as any).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <button onClick={onNavigate} className={`w-full mt-4 text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1 transition-colors ${getThemeClasses('bg-light')} ${getThemeClasses('text')} hover:opacity-80`}>
                {t('go_to_calendar')} <ChevronRight size={16} />
            </button>
        </div>
    );
};


const RecentFiles: React.FC<{
    files: FileData[];
    t: (key: string) => string;
}> = ({ files, t }) => {
    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold mb-4">{t('recent_files_title')}</h3>
            {files.length === 0 ? (
                <p className="text-center text-gray-500 italic py-4">{t('no_recent_files')}</p>
            ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {files.map(file => (
                        <li key={file.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-gray-800 truncate">{file.title}</p>
                                    <p className="text-xs text-gray-500">{(file.createdAt as any).toDate().toLocaleDateString()}</p>
                                </div>
                            </div>
                             <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-md shadow flex items-center gap-1 transition-colors active:scale-95"><Link className="w-3 h-3"/> {t('view_button')}</a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


// --- MAIN VIEW ---
interface HomeViewProps {
  user: AppUser;
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
  allEvents: CalendarEvent[];
  language: 'nl' | 'en';
  allUserTasks: ToDoTask[];
  allStudySessions: StudySession[];
  allUserFlashcardSets: FlashcardSet[];
  recentFiles: FileData[];
  setCurrentView: (view: string) => void;
  currentTime: Date;
}

const HomeView: React.FC<HomeViewProps> = ({ user, t, getThemeClasses, allEvents, language, allUserTasks, allStudySessions, allUserFlashcardSets, recentFiles, setCurrentView, currentTime }) => {
    const userFirstName = user.userName?.split(' ')[0] || '';
    const today = new Date();

    const weeklyStats = useMemo(() => {
        const { start: thisWeekStart, end: thisWeekEnd } = getWeekBounds();
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekEnd);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

        // Tasks Completed
        const thisWeekTasks = allUserTasks.filter(task => task.completed && task.completedAt && task.completedAt.toDate() >= thisWeekStart && task.completedAt.toDate() <= thisWeekEnd).length;
        const lastWeekTasks = allUserTasks.filter(task => task.completed && task.completedAt && task.completedAt.toDate() >= lastWeekStart && task.completedAt.toDate() <= lastWeekEnd).length;
        const tasksComparison = lastWeekTasks > 0 ? ((thisWeekTasks - lastWeekTasks) / lastWeekTasks) * 100 : (thisWeekTasks > 0 ? 100 : 0);

        // Study Time
        const thisWeekMinutes = allStudySessions
            .filter(s => s.date.toDate() >= thisWeekStart && s.date.toDate() <= thisWeekEnd)
            .reduce((sum, s) => sum + s.durationMinutes, 0);
        const lastWeekMinutes = allStudySessions
            .filter(s => s.date.toDate() >= lastWeekStart && s.date.toDate() <= lastWeekEnd)
            .reduce((sum, s) => sum + s.durationMinutes, 0);
        const timeComparison = lastWeekMinutes > 0 ? ((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100 : (thisWeekMinutes > 0 ? 100 : 0);
        
        // Flashcards Created
        const thisWeekSets = allUserFlashcardSets.filter(s => s.createdAt.toDate() >= thisWeekStart && s.createdAt.toDate() <= thisWeekEnd).length;
        const lastWeekSets = allUserFlashcardSets.filter(s => s.createdAt.toDate() >= lastWeekStart && s.createdAt.toDate() <= lastWeekEnd).length;
        const setsComparison = lastWeekSets > 0 ? ((thisWeekSets - lastWeekSets) / lastWeekSets) * 100 : (thisWeekSets > 0 ? 100 : 0);

        return {
            thisWeekTasks, tasksComparison,
            thisWeekMinutes, timeComparison,
            thisWeekSets, setsComparison,
        };
    }, [allUserTasks, allStudySessions, allUserFlashcardSets]);
    
    const todaysEvents = useMemo(() => {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
        return allEvents
            .filter(e => e.start.toDate() >= todayStart && e.start.toDate() <= todayEnd)
            .sort((a, b) => (a.start as any).toMillis() - (b.start as any).toMillis());
    }, [allEvents]);

    const widgetComponents: { [key: string]: React.ReactNode } = {
        agenda: <TodaysAgenda key="agenda" events={todaysEvents} t={t} getThemeClasses={getThemeClasses} onNavigate={() => setCurrentView('calendar')} currentTime={currentTime} />,
        files: <RecentFiles key="files" files={recentFiles} t={t} />,
    };

    const homeLayout = user.homeLayout || defaultHomeLayout;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className={`text-3xl font-bold ${getThemeClasses('text-strong')}`}>{t('welcome_message', { name: userFirstName })}</h1>
                <p className="text-gray-500">{today.toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                    <StatCard
                        icon={<CheckCircle size={24} />}
                        title={t('tasks_completed')}
                        value={weeklyStats.thisWeekTasks}
                        comparison={weeklyStats.tasksComparison}
                        bgClass="bg-emerald-100"
                        textClass="text-emerald-800"
                        iconBgClass="bg-emerald-200"
                    />
                    <StatCard
                        icon={<Clock size={24} />}
                        title={t('study_time_minutes')}
                        value={weeklyStats.thisWeekMinutes}
                        comparison={weeklyStats.timeComparison}
                        bgClass="bg-blue-100"
                        textClass="text-blue-800"
                        iconBgClass="bg-blue-200"
                    />
                     <StatCard
                        icon={<Layers size={24} />}
                        title={t('flashcards_created')}
                        value={weeklyStats.thisWeekSets}
                        comparison={weeklyStats.setsComparison}
                        bgClass="bg-rose-100"
                        textClass="text-rose-800"
                        iconBgClass="bg-rose-200"
                    />
                    <StatCard
                        icon={<Calendar size={24} />}
                        title={t('todays_events')}
                        value={todaysEvents.length}
                        comparison={null}
                        bgClass="bg-amber-100"
                        textClass="text-amber-800"
                        iconBgClass="bg-amber-200"
                    />
                </div>
                 <div className="lg:col-span-1 space-y-6">
                    {homeLayout.map(widgetId => widgetComponents[widgetId])}
                </div>
            </div>
        </div>
    );
};

export default HomeView;