import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, Edit, Trash2, Loader2, Sparkles, Download, RefreshCw, Link, Trash, Briefcase, School, BookOpen, FileText, Presentation, Mic, ClipboardList, Clock } from 'lucide-react';
import { db, appId, Timestamp } from '../../services/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import type { CalendarEvent, AppUser, ModalContent, SyncedCalendar } from '../../types';

interface CalendarViewProps {
  allEvents: CalendarEvent[];
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  tSubject: (key: string) => string;
  language: string;
  showAppModal: (content: ModalContent) => void;
  userId: string;
  user: AppUser;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
  currentTime: Date; // Added for compatibility
}

const eventTypeIconMap: { [key: string]: React.FC<any> } = {
    'work': ({ className }: { className: string }) => <Briefcase className={className} />,
    'school': ({ className }: { className: string }) => <School className={className} />,
    'homework': ({ className }: { className: string }) => <BookOpen className={className} />,
    'test': ({ className }: { className: string }) => <FileText className={className} />,
    'presentation': ({ className }: { className: string }) => <Presentation className={className} />,
    'oral': ({ className }: { className: string }) => <Mic className={className} />,
    'other': ({ className }: { className: string }) => <ClipboardList className={className} />,
    'free_period': ({ className }: { className: string }) => <Clock className={className} />,
    'study_plan': ({ className }: { className: string }) => <ClipboardList className={className} />,
};


// Helper to get a YYYY-MM-DD string from a Date object in its local timezone
const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// --- AI Importer Modal Component ---
interface AIParsedEvent {
    id: number;
    title: string;
    subject: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    description?: string;
    type: 'test' | 'presentation' | 'homework' | 'oral' | 'other' | 'work' | 'school';
}

const AIImporterModal: React.FC<Omit<CalendarViewProps, 'allEvents' | 'onProfileUpdate' | 'currentTime'> & { onClose: () => void }> = ({ user, t, tSubject, getThemeClasses, showAppModal, userId, language, onClose }) => {
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [parsedEvents, setParsedEvents] = useState<AIParsedEvent[]>([]);
    const [weeksToImport, setWeeksToImport] = useState(1);
    const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);

    const allUserSubjects = useMemo(() => {
        return Array.from(new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]));
    }, [user]);

    const handleAnalyze = async () => {
        if (!inputText.trim()) return;
        setIsLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const userSubjectsList = allUserSubjects.join(', ');
            const todayString = new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            const prompt = `Analyze the schedule text. The current date is ${todayString}.
For each event, extract:
1. "title": Short title. If "toets", "examen", or "proefwerk" is mentioned, make the title reflect a test.
2. "subject": The school subject. This MUST be one of the following, pick the closest match: ${userSubjectsList}. If no clear match is found, return an empty string for the subject.
3. "date": The specific date in YYYY-MM-DD format. Calculate this based on the current date and relative terms like "today", "tomorrow", "next week monday".
4. "time": Start time in HH:mm format. Default to 09:00 if not specified. Assume events last 1 hour.
5. "type": The event type. Must be one of 'test', 'presentation', 'homework', 'oral', 'other', 'work', 'school'. Infer this from keywords like "toets" (test), "opdracht" (homework), "presentatie" (presentation), "mondeling" (oral), "werk" (work), "school" (school).
6. "description": Optional extra details.

User's schedule:
---
${inputText}
---
`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                subject: { type: Type.STRING },
                                date: { type: Type.STRING },
                                time: { type: Type.STRING },
                                type: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ['title', 'subject', 'date', 'time', 'type']
                        }
                    }
                }
            });
            
            const jsonStr = response.text.trim();
            const events = JSON.parse(jsonStr).map((e: Omit<AIParsedEvent, 'id'>, index: number) => ({ ...e, id: index }));
            
            if (events.length === 0) {
                showAppModal({ text: t('ai_no_events_found') });
            } else {
                setParsedEvents(events);
                setSelectedEventIds(events.map((e: AIParsedEvent) => e.id));
                setStep('review');
            }
        } catch (error) {
            console.error("AI Parsing Error:", error);
            showAppModal({ text: t('ai_parsing_error') });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleImport = async () => {
        setIsLoading(true);
        const batch = db.batch();
        let eventsAddedCount = 0;

        const eventsToImport = parsedEvents.filter(e => selectedEventIds.includes(e.id));

        for (let week = 0; week < weeksToImport; week++) {
            for (const event of eventsToImport) {
                const targetDate = new Date(`${event.date}T${event.time}`);
                if (isNaN(targetDate.getTime())) continue;

                targetDate.setDate(targetDate.getDate() + (week * 7));

                const startDate = Timestamp.fromDate(targetDate);
                const endDate = Timestamp.fromDate(new Date(targetDate.getTime() + 60 * 60 * 1000)); // 1 hour duration
                
                let finalSubject = event.subject;
                if (!allUserSubjects.includes(finalSubject)) {
                    finalSubject = allUserSubjects[0] || 'algemeen'; // Fallback to first subject or general if none exist
                }

                const eventData = {
                    title: event.title,
                    description: event.description || '',
                    type: event.type,
                    subject: finalSubject,
                    start: startDate,
                    end: endDate,
                    ownerId: userId,
                    createdAt: Timestamp.now()
                };
                
                const newEventRef = db.collection(`artifacts/${appId}/users/${userId}/calendarEvents`).doc();
                batch.set(newEventRef, eventData);
                eventsAddedCount++;
            }
        }
        
        try {
            await batch.commit();
            showAppModal({ text: t('import_success', { count: eventsAddedCount }) });
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error("Import Error:", error);
            showAppModal({ text: t('import_error') });
            setIsLoading(false);
        }
    };
    
    const toggleEventSelection = (id: number) => {
        setSelectedEventIds(prev => prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]);
    };
    
    const eventsByDateGrouped = useMemo(() => {
        return parsedEvents.reduce((acc, event) => {
            (acc[event.date] = acc[event.date] || []).push(event);
            return acc;
        }, {} as { [key: string]: AIParsedEvent[] });
    }, [parsedEvents]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
                {step === 'input' && (
                    <>
                        <h3 className="text-xl font-bold">{t('ai_importer_title')}</h3>
                        <p className="text-sm text-gray-600">{t('ai_importer_description')}</p>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            rows={8}
                            className="w-full p-2 border rounded-lg"
                            placeholder="e.g., Maandag 9:00-10:00 wiskunde, woensdag proefwerk geschiedenis om 13:00"
                            disabled={isLoading}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
                            <button onClick={handleAnalyze} disabled={isLoading} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-48 flex justify-center items-center`}>
                                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('analyzing')}</> : t('analyze_button')}
                            </button>
                        </div>
                    </>
                )}
                {step === 'review' && (
                    <>
                        <h3 className="text-xl font-bold">{t('review_schedule')}</h3>
                        <div className="flex flex-wrap gap-4 items-center bg-gray-100 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                                <label className="font-semibold">{t('import_for_weeks')}:</label>
                                <input type="number" value={weeksToImport} onChange={e => setWeeksToImport(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 p-1 border rounded-md" />
                                <span>{t('weeks')}</span>
                            </div>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto p-2 border rounded-md">
                           {Object.keys(eventsByDateGrouped).sort().map(date => (
                                <div key={date}>
                                    <h4 className="font-bold capitalize">{new Date(date + 'T00:00:00').toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
                                    <ul className="list-inside ml-2">
                                        {eventsByDateGrouped[date].map((event) => (
                                            <li key={event.id} className="text-sm flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEventIds.includes(event.id)}
                                                    onChange={() => toggleEventSelection(event.id)}
                                                    className={`h-4 w-4 rounded ${getThemeClasses('text')} focus:ring-0`}
                                                />
                                                {event.time} - {event.title} ({tSubject(event.subject) || 'Vak Kiezen'}) - [{t(`event_${event.type}`)}]
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                         <div className="flex justify-between gap-2">
                            <button type="button" onClick={() => setStep('input')} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('edit_text_button')}</button>
                            <button onClick={handleImport} disabled={isLoading || selectedEventIds.length === 0} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-48 flex justify-center items-center disabled:opacity-50`}>
                                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('importing')}</> : t('import_button')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

const DownloadModal: React.FC<Pick<CalendarViewProps, 'allEvents' | 't' | 'getThemeClasses' | 'tSubject' | 'language' | 'showAppModal'> & { onClose: () => void }> = ({ allEvents, t, getThemeClasses, tSubject, language, showAppModal, onClose }) => {
    const [weeksToDownload, setWeeksToDownload] = useState(1);
    const [format, setFormat] = useState<'ics' | 'txt'>('ics');
    const [isDownloading, setIsDownloading] = useState(false);

    const formatIcsDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const generateIcsContent = (events: CalendarEvent[]): string => {
        let icsString = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//StudyBox//EN'
        ].join('\r\n');

        events.forEach(event => {
            const startDate = (event.start as any).toDate();
            const endDate = (event.end as any).toDate();

            icsString += '\r\n' + [
                'BEGIN:VEVENT',
                `UID:${event.id}@studybox.app`,
                `DTSTAMP:${formatIcsDate(new Date())}`,
                `DTSTART:${formatIcsDate(startDate)}`,
                `DTEND:${formatIcsDate(endDate)}`,
                `SUMMARY:${event.title}`,
                `DESCRIPTION:${event.description || ''}`,
                `LOCATION:${tSubject(event.subject)}`,
                'END:VEVENT'
            ].join('\r\n');
        });

        icsString += '\r\n' + 'END:VCALENDAR';
        return icsString;
    };

    const generateTxtContent = (events: CalendarEvent[]): string => {
        let txtString = `StudyBox Agenda\r\n===================\r\n\r\n`;
        const eventsByDate = events.reduce((acc, event) => {
            const dateStr = (event.start as any).toDate().toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(event);
            return acc;
        }, {} as Record<string, CalendarEvent[]>);

        const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        sortedDates.forEach(dateStr => {
            txtString += `--- ${dateStr} ---\r\n`;
            eventsByDate[dateStr]
                .sort((a, b) => (a.start as any).toMillis() - (b.start as any).toMillis())
                .forEach(event => {
                    const startTime = (event.start as any).toDate().toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
                    const endTime = (event.end as any).toDate().toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
                    txtString += `- ${startTime} - ${endTime}: ${event.title} (${tSubject(event.subject)})\r\n`;
                    if (event.description) txtString += `  ${event.description}\r\n`;
                });
            txtString += `\r\n`;
        });
        return txtString;
    };

    const handleDownload = () => {
        setIsDownloading(true);

        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + weeksToDownload * 7);

        const eventsToDownload = allEvents.filter(event => {
            const eventDate = (event.start as any).toDate();
            return eventDate >= now && eventDate <= endDate;
        });

        const content = format === 'ics' ? generateIcsContent(eventsToDownload) : generateTxtContent(eventsToDownload);
        const blob = new Blob([content], { type: format === 'ics' ? 'text/calendar' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studybox_agenda.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAppModal({ text: t('downloading_and_started') });
        setTimeout(() => {
            setIsDownloading(false);
            onClose();
        }, 1000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4 animate-scale-up">
                <h3 className="text-xl font-bold">{t('download_agenda')}</h3>
                <div className="flex items-center gap-2">
                    <label className="font-semibold">{t('download_weeks_label')}:</label>
                    <input type="number" value={weeksToDownload} onChange={e => setWeeksToDownload(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 p-1 border rounded-md" />
                    <span>{t('weeks')}</span>
                </div>
                <div>
                    <p className="font-semibold mb-2">{t('download_format_label')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={() => setFormat('ics')} className={`flex-1 text-left p-3 border rounded-lg ${format === 'ics' ? `${getThemeClasses('border')} ${getThemeClasses('bg-light')}` : 'bg-gray-100'}`}>Apple/Google (.ics)</button>
                        <button onClick={() => setFormat('txt')} className={`flex-1 text-left p-3 border rounded-lg ${format === 'txt' ? `${getThemeClasses('border')} ${getThemeClasses('bg-light')}` : 'bg-gray-100'}`}>Tekst (.txt)</button>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} disabled={isDownloading} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
                    <button onClick={handleDownload} disabled={isDownloading} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-48 flex justify-center items-center`}>
                        {isDownloading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('downloading_and_started')}</> : t('download_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SyncCalendarModal: React.FC<Pick<CalendarViewProps, 'user' | 't' | 'getThemeClasses' | 'showAppModal' | 'onProfileUpdate'> & { onClose: () => void }> = ({ user, t, getThemeClasses, showAppModal, onProfileUpdate, onClose }) => {
    const [calendars, setCalendars] = useState<SyncedCalendar[]>(user.syncedCalendars || []);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [provider, setProvider] = useState<SyncedCalendar['provider']>('other');
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCalId, setExpandedCalId] = useState<string | null>(null);

    const providerLinks: Record<SyncedCalendar['provider'], string> = {
        google: t('sync_calendar_tutorial_google'),
        apple: t('sync_calendar_tutorial_apple'),
        teams: t('sync_calendar_tutorial_teams'),
        canvas: t('sync_calendar_tutorial_canvas'),
        magister: t('sync_calendar_tutorial_magister'),
        other: '#',
    };

    const handleSave = async () => {
        if (!name.trim() || !url.trim()) return;
        setIsSaving(true);
        const newCalendar: SyncedCalendar = {
            id: Date.now().toString(),
            name, url, provider, enabled: true
        };
        const updatedCalendars = [...calendars, newCalendar];
        try {
            await onProfileUpdate({ syncedCalendars: updatedCalendars });
            setCalendars(updatedCalendars);
            setName('');
            setUrl('');
            setProvider('other');
        } catch (error) {
            showAppModal({ text: t('error_save_settings_failed') });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        const updatedCalendars = calendars.filter(c => c.id !== id);
        try {
            await onProfileUpdate({ syncedCalendars: updatedCalendars });
            setCalendars(updatedCalendars);
        } catch (error) {
            showAppModal({ text: t('error_save_settings_failed') });
        }
    };

    const handleToggleCalendarEnabled = async (id: string) => {
        const updatedCalendars = calendars.map(c =>
            c.id === id ? { ...c, enabled: !c.enabled } : c
        );
        try {
            await onProfileUpdate({ syncedCalendars: updatedCalendars });
            setCalendars(updatedCalendars);
        } catch (error) {
            showAppModal({ text: t('error_save_settings_failed') });
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold">{t('sync_calendar_title')}</h3>
                <p className="text-sm text-gray-600">{t('sync_calendar_desc')}</p>

                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div>
                        <p className="font-bold">{t('get_ical_link')}</p>
                        <p className="text-sm text-gray-500 mb-2">{t('how_to_get_link')}</p>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(providerLinks).filter(p => p !== 'other').map(p => (
                                <a key={p} href={providerLinks[p as SyncedCalendar['provider']]} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline bg-blue-100 px-2 py-1 rounded-md">{p.charAt(0).toUpperCase() + p.slice(1)}</a>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="font-bold">{t('paste_ical_link')}</p>
                        <div className="space-y-2 mt-2">
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('calendar_name')} className="w-full p-2 border rounded-lg" />
                            <select value={provider} onChange={e => setProvider(e.target.value as any)} className="w-full p-2 border rounded-lg bg-white">
                                <option value="other">{t('select_provider')}</option>
                                <option value="google">Google Calendar</option>
                                <option value="apple">Apple Calendar</option>
                                <option value="teams">Microsoft Teams</option>
                                <option value="canvas">Canvas</option>
                                <option value="magister">Magister</option>
                            </select>
                            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder={t('calendar_url')} className="w-full p-2 border rounded-lg" />
                            <button onClick={handleSave} disabled={isSaving} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                                {isSaving ? <Loader2 className="animate-spin" /> : t('save_calendar')}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold">{t('synced_calendars')}</h4>
                    {calendars.length === 0 ? (
                        <p className="text-sm text-gray-500 italic mt-2">{t('no_synced_calendars')}</p>
                    ) : (
                        <ul className="space-y-2 mt-2">
                            {calendars.map(cal => (
                                <li key={cal.id} className="p-2 bg-white border rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 cursor-pointer flex-grow" onClick={() => setExpandedCalId(expandedCalId === cal.id ? null : cal.id)}>
                                            <Link size={16} className="text-gray-400" />
                                            <span className="font-semibold">{cal.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleCalendarEnabled(cal.id)}
                                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${cal.enabled ? getThemeClasses('bg') : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${cal.enabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                                            </button>
                                            <button onClick={() => handleDelete(cal.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><Trash size={16} /></button>
                                        </div>
                                    </div>
                                    {expandedCalId === cal.id && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 break-all">
                                            {cal.url}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                 <div className="flex justify-end pt-2">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('close_button')}</button>
                </div>
            </div>
        </div>
    );
};

const WeekGridView: React.FC<Omit<CalendarViewProps, 'allEvents' | 'onProfileUpdate' | 'currentTime'> & {
    weekDays: Date[];
    eventsForWeek: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
    onGridCellClick: (date: Date) => void;
}> = ({
    weekDays, eventsForWeek, t, getThemeClasses, tSubject, language, onEventClick, onGridCellClick
}) => {
    const START_HOUR = 7;
    const END_HOUR = 22;
    const timeSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, i) => {
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = i % 2 === 0 ? '00' : '30';
        return `${hour.toString().padStart(2, '0')}:${minute}`;
    });

    const getEventPosition = (event: CalendarEvent) => {
        const start = (event.start as any).toDate();
        const end = (event.end as any).toDate();

        let dayIndex = start.getDay();
        dayIndex = (dayIndex === 0) ? 6 : dayIndex - 1; // Monday is 0, Sunday is 6
        const column = dayIndex + 2;

        const startMinutes = (start.getHours() * 60) + start.getMinutes();
        const endMinutes = (end.getHours() * 60) + end.getMinutes();

        const rowStart = Math.floor((startMinutes - (START_HOUR * 60)) / 30) + 2;
        const rowEnd = Math.ceil((endMinutes - (START_HOUR * 60)) / 30) + 2;
        
        if (rowStart < 2 || rowEnd > timeSlots.length + 2 || rowStart >= rowEnd) return null;

        return {
            gridColumn: column,
            gridRow: `${rowStart} / ${rowEnd}`,
        };
    };

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-x-auto p-1 h-full">
            <div
                className="grid gap-px relative h-full"
                style={{
                    gridTemplateColumns: 'auto repeat(7, minmax(120px, 1fr))',
                    gridTemplateRows: `auto repeat(${timeSlots.length}, 1fr)`,
                    backgroundColor: 'rgb(229 231 235)',
                }}
            >
                {/* Header row: empty corner + days */}
                <div className="bg-white sticky left-0 z-20"></div>
                {weekDays.map(day => (
                    <div key={day.toISOString()} className="bg-white p-2 text-center font-semibold sticky top-0 z-10">
                        <div className="text-xs uppercase text-gray-500">{day.toLocaleDateString(language, { weekday: 'short' })}</div>
                        <div className={`text-lg rounded-full w-8 h-8 flex items-center justify-center mx-auto ${day.toDateString() === new Date().toDateString() ? `${getThemeClasses('bg')} text-white` : ''}`}>
                            {day.getDate()}
                        </div>
                    </div>
                ))}

                {/* Time slots and grid cells */}
                {timeSlots.map((time, index) => (
                    <React.Fragment key={time}>
                        <div className="bg-white text-right pr-2 text-xs text-gray-500 sticky left-0 z-10 flex items-center justify-end">
                           {time.endsWith(':00') && <span>{time}</span>}
                        </div>
                        {weekDays.map((day, dayIndex) => (
                             <div
                                key={`${day.toISOString()}-${time}`}
                                className="bg-white hover:bg-gray-100 transition-colors"
                                style={{ gridColumn: dayIndex + 2, gridRow: index + 2 }}
                                onClick={() => {
                                    const [hour, minute] = time.split(':');
                                    const clickedDate = new Date(day);
                                    clickedDate.setHours(parseInt(hour, 10), parseInt(minute, 10));
                                    onGridCellClick(clickedDate);
                                }}
                            />
                        ))}
                    </React.Fragment>
                ))}

                {/* Events */}
                {eventsForWeek.map(event => {
                    const position = getEventPosition(event);
                    if (!position) return null;
                    
                    const eventClasses = event.type === 'study_plan'
                        ? `bg-purple-500 border-l-4 border-purple-700`
                        : `${getThemeClasses('bg')} border-l-4 ${getThemeClasses('border')}`;

                    return (
                        <div
                            key={event.id}
                            style={{ ...position, zIndex: 5 }}
                            onClick={() => onEventClick(event)}
                            className={`m-px p-1.5 rounded-md text-white text-xs overflow-hidden cursor-pointer shadow-sm ${eventClasses}`}
                        >
                            <p className="font-bold truncate">{event.title}</p>
                            <p className="truncate">{tSubject(event.subject)}</p>
                            <p className="opacity-80">{(event.start as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Calendar View Component ---
const CalendarView: React.FC<CalendarViewProps> = ({ allEvents, t, getThemeClasses, tSubject, language, showAppModal, userId, user, onProfileUpdate, currentTime }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('test');
  const [subject, setSubject] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const availableSubjects = useMemo(() => {
    const combined = new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]);
    return Array.from(combined);
  }, [user.selectedSubjects, user.customSubjects]);
  
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const newDate = new Date(d.getFullYear(), d.getMonth(), diff);
    newDate.setHours(0,0,0,0);
    return newDate;
  }, [currentDate]);

  const daysOfWeek = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        days.push(day);
    }
    return days;
  }, [startOfWeek]);
  
  const eventsByDay = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    allEvents.forEach(event => {
        if (event.start && (event.start as any).toDate) {
            const dateStr = toLocalDateString((event.start as any).toDate());
            if (!eventsMap.has(dateStr)) {
                eventsMap.set(dateStr, []);
            }
            eventsMap.get(dateStr)!.push(event);
        }
    });
    return eventsMap;
  }, [allEvents]);
  
  const eventsForCurrentWeek = useMemo(() => {
    const weekStartMs = startOfWeek.getTime();
    const weekEnd = new Date(startOfWeek);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndMs = weekEnd.getTime();

    return allEvents.filter(event => {
        if (!event.start || !(event.start as any).toDate) return false;
        const eventStartMs = (event.start as any).toDate().getTime();
        return eventStartMs >= weekStartMs && eventStartMs < weekEndMs;
    });
  }, [allEvents, startOfWeek]);

  const openModal = (eventToEdit: CalendarEvent | null, dateForNew: Date | null = null) => {
    if (eventToEdit) {
        setEditingEvent(eventToEdit);
        setTitle(eventToEdit.title);
        setDescription(eventToEdit.description || '');
        setType(eventToEdit.type);
        setSubject(eventToEdit.subject);
        const startDate = (eventToEdit.start as any).toDate();
        setEventDate(toLocalDateString(startDate));
        setStartTime(startDate.toTimeString().substring(0, 5));
        setEndTime((eventToEdit.end as any).toDate().toTimeString().substring(0, 5));
    } else {
        setEditingEvent(null);
        setTitle('');
        setDescription('');
        setType('test');
        setSubject(availableSubjects[0] || '');
        const initialDate = dateForNew || new Date();
        setEventDate(toLocalDateString(initialDate));
        setStartTime(initialDate.toTimeString().substring(0,5));
        setEndTime(new Date(initialDate.getTime() + 60*60*1000).toTimeString().substring(0,5));
    }
    setIsModalOpen(true);
  };
  
  const handleSaveEvent = async () => {
    if (user.uid === 'guest-user') {
        showAppModal({ text: t('error_guest_action_not_allowed') });
        return;
    }
    if (!title.trim() || !subject || !eventDate || !startTime || !endTime) {
        showAppModal({ text: t('error_fill_all_fields') });
        return;
    }

    setIsSaving(true);
    const startDateTime = new Date(`${eventDate}T${startTime}`);
    const endDateTime = new Date(`${eventDate}T${endTime}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        showAppModal({ text: 'Invalid date or time.' });
        setIsSaving(false);
        return;
    }

    const eventData = {
        title,
        description,
        type,
        subject,
        start: Timestamp.fromDate(startDateTime),
        end: Timestamp.fromDate(endDateTime),
        ownerId: userId,
    };
    
    try {
        if (editingEvent) {
            await db.doc(`artifacts/${appId}/users/${userId}/calendarEvents/${editingEvent.id}`).update({ ...eventData, updatedAt: Timestamp.now() });
            showAppModal({ text: t('success_event_updated') });
        } else {
            await db.collection(`artifacts/${appId}/users/${userId}/calendarEvents`).add({ ...eventData, createdAt: Timestamp.now() });
            showAppModal({ text: t('success_event_added') });
        }
        setIsModalOpen(false);
    } catch (error) {
        const err = error as Error;
        showAppModal({ text: `Error saving event: ${err.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    if (event.isSynced) return;
    showAppModal({
        text: t('delete_event_confirm', { title: event.title }),
        confirmAction: async () => {
            try {
                await db.doc(`artifacts/${appId}/users/${userId}/calendarEvents/${event.id}`).delete();
                setViewingEvent(null);
            } catch (error) {
                console.error("Failed to delete event:", error);
            }
        },
        cancelAction: () => {}
    });
};

  const selectedDayEventsAndGaps = useMemo(() => {
    const dayEvents = (eventsByDay.get(toLocalDateString(selectedDate)) || []).sort((a,b) => (a.start as any).toMillis() - (b.start as any).toMillis());
    const itemsWithGaps: CalendarEvent[] = [];
    let lastEventEnd: Date | null = null;

    dayEvents.forEach(event => {
        const eventStart = (event.start as any).toDate();
        if(lastEventEnd && eventStart.getTime() > lastEventEnd.getTime() + 60000) { // Gap of more than 1 min
             itemsWithGaps.push({
                id: `gap-${lastEventEnd.getTime()}`,
                title: `Tussenuur`,
                type: 'free_period',
                subject: 'algemeen',
                start: Timestamp.fromDate(lastEventEnd),
                end: Timestamp.fromDate(eventStart),
                ownerId: userId,
                createdAt: Timestamp.now(),
            });
        }
        itemsWithGaps.push(event);
        lastEventEnd = (event.end as any).toDate();
    });

    return itemsWithGaps;
  }, [eventsByDay, selectedDate, userId]);
  
  return (
    <>
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center flex-wrap gap-y-2">
             <h2 className={`text-3xl font-bold ${getThemeClasses('text-strong')}`}>{t('calendar_title')}</h2>
            <div className="flex gap-2 items-center">
                 <button type="button" onClick={() => setIsSyncModalOpen(true)} className={`flex items-center text-yellow-800 font-bold p-2 sm:py-2 sm:px-4 rounded-lg transition-transform active:scale-95 bg-yellow-200 hover:bg-yellow-300`}>
                    <RefreshCw className={`w-5 h-5 sm:mr-2`}/> <span className="hidden sm:inline">{t('settings_sync_calendar')}</span>
                 </button>
                 <button type="button" onClick={() => setIsDownloadModalOpen(true)} className={`flex items-center text-white font-bold p-2 sm:py-2 sm:px-4 rounded-lg transition-transform active:scale-95 bg-blue-500 hover:bg-blue-600`}>
                    <Download className="w-5 h-5 sm:mr-2"/> <span className="hidden sm:inline">{t('download_button')}</span>
                 </button>
                 <button type="button" onClick={() => setIsAIModalOpen(true)} className={`flex items-center text-white font-bold p-2 sm:py-2 sm:px-4 rounded-lg transition-transform active:scale-95 bg-purple-500 hover:bg-purple-600`}>
                    <Sparkles className="w-5 h-5 sm:mr-2"/> <span className="hidden sm:inline">{t('ai_importer_title')}</span>
                </button>
                <button type="button" onClick={() => openModal(null, selectedDate)} className={`flex items-center text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                    <PlusCircle className="w-5 h-5 sm:mr-2"/> <span className="hidden sm:inline">{t('add_event')}</span>
                </button>
            </div>
        </div>

        <div className={`p-4 rounded-xl shadow-lg ${getThemeClasses('bg-light')}`}>
            <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() - 7)))} className="p-2 rounded-full hover:bg-gray-200 transition-colors active:scale-90"><ChevronLeft/></button>
                <h3 className="text-lg font-semibold">{startOfWeek.toLocaleDateString(language, { month: 'long', year: 'numeric' })}</h3>
                <button type="button" onClick={() => setCurrentDate(d => new Date(d.setDate(d.getDate() + 7)))} className="p-2 rounded-full hover:bg-gray-200 transition-colors active:scale-90"><ChevronRight/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
                {daysOfWeek.map(day => {
                    const isToday = day.getTime() === today.getTime();
                    const isSelected = day.toDateString() === selectedDate.toDateString();
                    const dateStr = toLocalDateString(day);
                    return (
                        <div key={day.toISOString()} onClick={() => setSelectedDate(day)}
                            className={`p-1 sm:p-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? `${getThemeClasses('bg')} text-white shadow-md` : 'hover:bg-gray-100'} ${isToday && !isSelected ? `border-2 ${getThemeClasses('border')}`:''}`}>
                            <div className="text-xs font-bold">{day.toLocaleDateString(language, { weekday: 'short' })}</div>
                            <div className="text-base sm:text-lg">{day.getDate()}</div>
                            {eventsByDay.has(dateStr) && <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${isSelected ? 'bg-white' : getThemeClasses('bg')}`}></div>}
                        </div>
                    );
                })}
            </div>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-gray-200 rounded-lg">
            <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors w-full ${viewMode === 'list' ? `bg-white shadow text-gray-800` : `text-gray-500 hover:bg-gray-300`}`}>List</button>
            <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors w-full ${viewMode === 'week' ? `bg-white shadow text-gray-800` : `text-gray-500 hover:bg-gray-300`}`}>{t('weekly_overview')}</button>
        </div>

        {viewMode === 'list' ? (
             <div className="rounded-xl h-[50vh] overflow-y-auto space-y-3">
                 <h3 className="text-xl font-bold mb-4 sticky top-0 bg-slate-50/80 backdrop-blur-sm py-2 px-1 z-10">{selectedDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                 {selectedDayEventsAndGaps.length === 0 ? (
                    <p className="text-center text-gray-500 italic py-4">{t('no_events_day')}</p>
                ) : (
                    <ul className="space-y-3">
                    {selectedDayEventsAndGaps.map(event => {
                        const EventIcon = eventTypeIconMap[event.type] || ClipboardList;
                        if (event.type === 'free_period') {
                            return (
                                <li key={event.id} className="p-3 rounded-lg flex items-start gap-3 bg-red-50 border-l-4 border-red-400">
                                    <EventIcon className="w-5 h-5 mt-1 text-red-500" />
                                    <div className="flex-grow">
                                        <p className="font-bold text-red-700">{event.title}</p>
                                        <p className="text-sm text-red-600">{(event.start as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})} - {(event.end as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </li>
                            );
                        }

                        const eventClasses = event.type === 'study_plan'
                            ? 'border-purple-400 bg-purple-50 hover:shadow-md'
                            : `${getThemeClasses('border')} ${getThemeClasses('bg-light')} hover:shadow-md`;

                        const iconClasses = event.type === 'study_plan'
                            ? 'text-purple-600'
                            : getThemeClasses('text');

                        return (
                            <li key={event.id} onClick={() => setViewingEvent(event)} className={`p-3 rounded-lg flex items-start gap-3 transition-colors cursor-pointer border-l-4 ${eventClasses}`}>
                                <EventIcon className={`w-5 h-5 mt-1 ${iconClasses}`} />
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        {event.isSynced && <Link size={14} className="text-gray-400 flex-shrink-0"/>}
                                        <p className="font-bold truncate">{event.title}</p>
                                    </div>
                                    <p className="text-sm text-gray-500">{(event.start as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})} - {(event.end as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</p>
                                    {event.description && <p className="text-sm text-gray-600 mt-1 truncate">{event.description.replace(/\\/g, '')}</p>}
                                </div>
                            </li>
                        );
                    })}
                    </ul>
                )}
             </div>
        ) : (
            <div className="h-[75vh]">
                 <WeekGridView
                    weekDays={daysOfWeek}
                    eventsForWeek={eventsForCurrentWeek}
                    t={t}
                    getThemeClasses={getThemeClasses}
                    tSubject={tSubject}
                    language={language}
                    user={user}
                    userId={userId}
                    showAppModal={showAppModal}
                    onEventClick={(event) => setViewingEvent(event)}
                    onGridCellClick={(date) => openModal(null, date)}
                />
            </div>
        )}
    </div>
    
      {isModalOpen && (
          <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-fade-in p-4">
              <div onClick={(e) => e.stopPropagation()} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold">{editingEvent ? t('edit_event') : t('add_event')}</h3>
                  <input type="text" placeholder={t('event_title')} value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-lg" required />
                  <textarea placeholder={t('event_description')} value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg" />
                  <div className="grid grid-cols-2 gap-4">
                      <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border rounded-lg bg-white" required>
                          <option value="test">{t('event_test')}</option>
                          <option value="presentation">{t('event_presentation')}</option>
                          <option value="homework">{t('event_homework')}</option>
                          <option value="oral">{t('event_oral')}</option>
                          <option value="work">{t('event_work')}</option>
                          <option value="school">{t('event_school')}</option>
                          <option value="other">{t('event_other')}</option>
                      </select>
                      <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
                          <option value="">Select Subject</option>
                          {availableSubjects.map(s => <option key={s} value={s}>{tSubject(s)}</option>)}
                      </select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full p-2 border rounded-lg col-span-1" required />
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded-lg col-span-1" required />
                      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded-lg col-span-1" required />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                      <button type="button" onClick={handleSaveEvent} disabled={isSaving} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95 w-36 flex justify-center items-center`}>
                         {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            editingEvent ? t('save_note_button') : t('add_event_button')
                        )}
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {isAIModalOpen && <AIImporterModal user={user} t={t} tSubject={tSubject} getThemeClasses={getThemeClasses} showAppModal={showAppModal} userId={userId} language={language} onClose={() => setIsAIModalOpen(false)} />}

      {isDownloadModalOpen && <DownloadModal allEvents={allEvents} t={t} getThemeClasses={getThemeClasses} tSubject={tSubject} language={language} showAppModal={showAppModal} onClose={() => setIsDownloadModalOpen(false)} />}
      
      {isSyncModalOpen && <SyncCalendarModal user={user} t={t} getThemeClasses={getThemeClasses} showAppModal={showAppModal} onClose={() => setIsSyncModalOpen(false)} onProfileUpdate={onProfileUpdate} />}

      {viewingEvent && (
        <div onClick={() => setViewingEvent(null)} className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
            <div onClick={(e) => e.stopPropagation()} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold">{viewingEvent.title}</h3>
                <p><span className="font-semibold">{t('event_subject')}:</span> {tSubject(viewingEvent.subject)}</p>
                <p><span className="font-semibold">{t('event_type')}:</span> {t(`event_${viewingEvent.type}`)}</p>
                <p><span className="font-semibold">Tijd:</span> {(viewingEvent.start as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})} - {(viewingEvent.end as any).toDate().toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</p>
                {viewingEvent.description && (
                    <div>
                        <p className="font-semibold">{t('event_description')}:</p>
                        <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md mt-1">{viewingEvent.description.replace(/\\/g, '')}</p>
                    </div>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <button type="button" onClick={() => setViewingEvent(null)} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('close_button')}</button>
                    {!viewingEvent.isSynced && viewingEvent.type !== 'study_plan' && (
                        <>
                         <button type="button" onClick={() => { handleDeleteEvent(viewingEvent); }} className={`flex items-center gap-2 py-2 px-4 rounded-lg text-white font-bold bg-red-600 hover:bg-red-700 transition-colors active:scale-95`}>
                           <Trash2 className="w-4 h-4" /> 
                         </button>
                         <button type="button" onClick={() => { openModal(viewingEvent, null); setViewingEvent(null); }} className={`flex items-center gap-2 py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95`}>
                           <Edit className="w-4 h-4" /> {t('edit_event')}
                         </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default CalendarView;