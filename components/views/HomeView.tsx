
import React, { useState, useMemo } from 'react';
import { 
    Link, Calendar, ArrowRight, Book, FileText,
    MessageSquare, Calculator, Speech, History, Globe, Atom, Beaker, Leaf, BookOpen, School, DollarSign, Laptop, Palette, Music, Volleyball, Scale, BookMarked, Briefcase, Award, GraduationCap, Building, LifeBuoy,
    Search, XCircle
} from 'lucide-react';
import type { AppUser, FileData, CalendarEvent } from '../../types';

const subjectIconMap: { [key: string]: React.FC<any> } = {
  "nederlands": (props) => <MessageSquare {...props} />,
  "wiskunde": (props) => <Calculator {...props} />,
  "engels": (props) => <Speech {...props} />,
  "geschiedenis": (props) => <History {...props} />,
  "aardrijkskunde": (props) => <Globe {...props} />,
  "natuurkunde": (props) => <Atom {...props} />,
  "scheikunde": (props) => <Beaker {...props} />,
  "biologie": (props) => <Leaf {...props} />,
  "frans": (props) => <BookOpen {...props} />,
  "duits": (props) => <School {...props} />,
  "latijn": (props) => <BookMarked {...props} />,
  "economie": (props) => <DollarSign {...props} />,
  "informatica": (props) => <Laptop {...props} />,
  "kunst": (props) => <Palette {...props} />,
  "muziek": (props) => <Music {...props} />,
  "lichamelijke_opvoeding": (props) => <Volleyball {...props} />,
  "maatschappijleer": (props) => <Scale {...props} />,
  "ckv": (props) => <Palette {...props} />,
  "algemeen": (props) => <Book {...props} />,
  "basisschool": (props) => <GraduationCap {...props} />,
  "basis": (props) => <School {...props} />,
  "mavo": (props) => <School {...props} />,
  "havo": (props) => <School {...props} />,
  "vwo": (props) => <School {...props} />,
  "mbo": (props) => <Briefcase {...props} />,
  "hbo": (props) => <Building {...props} />,
  "wo": (props) => <GraduationCap {...props} />,
  "anders": (props) => <Book {...props} />,
  "default": (props) => <Book {...props} />,
  "feedback_support": (props) => <LifeBuoy {...props} />,
};

interface HomeViewProps {
  user: AppUser;
  setCurrentView: (view: string) => void;
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
  tSubject: (key: string) => string;
  setCurrentSubject: (subject: string | null) => void;
  recentFiles: FileData[];
  userEvents: CalendarEvent[];
  language: 'nl' | 'en';
}

const fuzzyMatch = (query: string, text: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    let queryIndex = 0;
    let textIndex = 0;
    while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
        if (lowerQuery[queryIndex] === lowerText[textIndex]) {
            queryIndex++;
        }
        textIndex++;
    }
    return queryIndex === lowerQuery.length;
};

const SubjectsWidget: React.FC<Omit<HomeViewProps, 'recentFiles' | 'userEvents'>> = ({ user, setCurrentView, t, getThemeClasses, tSubject, setCurrentSubject }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const userSubjects = user.selectedSubjects || [];
    
    const filteredSubjects = useMemo(() => {
        if (!searchQuery.trim()) return userSubjects;
        return userSubjects.filter(subjectKey => fuzzyMatch(searchQuery, tSubject(subjectKey)));
    }, [searchQuery, userSubjects, tSubject]);

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
            <h2 className={`text-2xl font-bold mb-4 flex items-center gap-2 ${getThemeClasses('text-strong')}`}>
                <Book /> {t('your_subjects')}
            </h2>
            
            {userSubjects.length > 0 && (
                 <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder={t('search_subjects_placeholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-shadow"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
            
            {userSubjects.length === 0 ? (
                <div className={`p-6 rounded-lg text-center ${getThemeClasses('bg-light')}`}>
                    <p className="font-semibold text-lg">{t('profile_incomplete_message')}</p>
                    <p className="mt-2">{t('go_to_settings_message')}</p>
                    <button onClick={() => setCurrentView('settings')} className={`mt-4 font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-transform active:scale-95`}>
                        {t('settings')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {filteredSubjects.map(subjectKey => {
                        const Icon = subjectIconMap[subjectKey] || subjectIconMap.default;
                        return (
                            <button key={subjectKey} onClick={() => setCurrentSubject(subjectKey)} className={`p-3 sm:p-4 rounded-xl shadow-md flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 ${getThemeClasses('ring')} bg-gray-50 hover:bg-white`}>
                                <Icon className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 ${getThemeClasses('text')}`} />
                                <span className={`text-sm sm:text-base font-bold ${getThemeClasses('text-strong')} leading-tight`}>{tSubject(subjectKey)}</span>
                            </button>
                        );
                    })}
                    {filteredSubjects.length === 0 && userSubjects.length > 0 && (
                        <p className="col-span-full text-center text-gray-500 italic py-4">{t('no_subjects_found_search')}</p>
                    )}
                </div>
            )}
        </div>
    );
};

const AgendaWidget: React.FC<Pick<HomeViewProps, 'userEvents' | 't' | 'tSubject' | 'getThemeClasses' | 'language' | 'setCurrentView'>> = ({ userEvents, t, tSubject, getThemeClasses, language, setCurrentView }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysEvents = userEvents
        .filter(event => {
            const eventDate = event.start.toDate();
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === today.getTime();
        })
        .sort((a, b) => a.start.toMillis() - b.start.toMillis());
    
    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg space-y-3">
            <h2 className={`text-2xl font-bold mb-4 flex items-center gap-2 ${getThemeClasses('text-strong')}`}>
                <Calendar /> {t('todays_agenda_title')}
            </h2>
            {todaysEvents.length > 0 ? (
                todaysEvents.slice(0, 3).map(event => (
                    <div key={event.id} className={`p-3 rounded-lg border-l-4 ${getThemeClasses('border')} bg-slate-50`}>
                        <p className="font-bold">{event.title}</p>
                        <p className="text-sm text-gray-500 font-semibold">{tSubject(event.subject)}</p>
                        <p className={`text-sm font-semibold ${getThemeClasses('text')}`}>{event.start.toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                ))
            ) : (
                <div className="text-center py-4">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-gray-500 mt-2 text-sm">{t('no_events_today')}</p>
                </div>
            )}
            <button onClick={() => setCurrentView('calendar')} className={`w-full mt-2 flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                {t('go_to_calendar')} <ArrowRight size={16}/>
            </button>
        </div>
    );
};

const RecentFilesWidget: React.FC<Pick<HomeViewProps, 'recentFiles' | 't' | 'tSubject' | 'getThemeClasses'>> = ({ recentFiles, t, tSubject, getThemeClasses }) => {
    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
            <h2 className={`text-2xl font-bold mb-4 flex items-center gap-2 ${getThemeClasses('text-strong')}`}>
                <FileText /> {t('recent_files_title')}
            </h2>
            {recentFiles.length === 0 ? (
                <p className="text-center text-gray-500 italic text-sm py-4">{t('no_recent_files')}</p>
            ) : (
                <ul className="space-y-3">
                    {recentFiles.map(file => (
                        <li key={file.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between transition-shadow hover:shadow-md hover:bg-gray-100">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">{file.title}</p>

                                <p className="text-sm text-gray-500">({tSubject(file.subject)})</p>
                            </div>
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className={`ml-2 flex-shrink-0 bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-md shadow transition-colors active:scale-95 flex items-center gap-1`}>
                                <Link className="w-3 h-3 inline" /> {t('view_button')}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const HomeView: React.FC<HomeViewProps> = (props) => {
    const { user } = props;
    const homeLayout = user.homeLayout || ['subjects', 'agenda', 'files'];

    const widgetMap: { [key: string]: React.ReactNode } = {
        subjects: <SubjectsWidget {...props} />,
        agenda: <AgendaWidget {...props} />,
        files: <RecentFilesWidget {...props} />,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {homeLayout.map(widgetKey => (
                <div key={widgetKey}>
                    {widgetMap[widgetKey]}
                </div>
            ))}
        </div>
    );
};

export default HomeView;