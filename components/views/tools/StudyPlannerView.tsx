import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ClipboardList, Loader2, AlertTriangle, RefreshCw, Calendar, Clock, CheckSquare, Lightbulb } from 'lucide-react';
import type { AppUser, ModalContent, StudyScheduleItem, ToDoTask } from '../../../types';

// Duplicating the props interface from ToolsView as it's not exported
interface StudyPlannerViewProps {
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
  user: AppUser;
  tSubject: (key: string) => string;
}

const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({ user, t, tSubject, getThemeClasses, showAppModal }) => {
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [amount, setAmount] = useState('');
    const [testDate, setTestDate] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [schedule, setSchedule] = useState<StudyScheduleItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const userSubjects = useMemo(() => {
        const combined = new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]);
        return Array.from(combined);
    }, [user.selectedSubjects, user.customSubjects]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !topic || !amount || !testDate) {
            showAppModal({ text: t('error_all_fields_required') });
            return;
        }
        setIsLoading(true);
        setError(null);
        setSchedule(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const today = new Date().toLocaleDateString(user.languagePreference, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            const prompt = `You are my personal study planner. I have a test for the subject '${tSubject(subject)}' about '${topic}'. I need to learn '${amount}'. The test is on '${testDate}'. Today's date is '${today}'.

Create a concrete and achievable study schedule for me with the following structure:
- Determine the best days for me to study between today and the test date.
- Assign a specific time slot for studying on each of those days.
- Distribute the study material intelligently across the days, avoiding cramming everything at once.
- Incorporate repetition: schedule moments to review previously studied material.
- Provide a brief, actionable study tip for each study day to help me learn more effectively.

Return the output as a JSON object. The root object should have a key "schedule" which is an array of objects. Each object in the array represents a study day and should have the following properties:
- "day": The date of the study session in "YYYY-MM-DD" format.
- "time": The recommended study time slot (e.g., "16:00 - 17:30").
- "task": A clear description of what I should study that day (e.g., "Read Chapter 1 and take notes").
- "tip": A short, practical study tip for that day.`;
            
            const schema = {
                type: Type.OBJECT,
                properties: {
                    schedule: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.STRING },
                                time: { type: Type.STRING },
                                task: { type: Type.STRING },
                                tip: { type: Type.STRING }
                            },
                            required: ['day', 'time', 'task', 'tip']
                        }
                    }
                },
                required: ['schedule']
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                }
            });

            const jsonStr = response.text.trim();
            const result = JSON.parse(jsonStr);
            setSchedule(result.schedule);

        } catch (err) {
            console.error("AI Planner Error:", err);
            setError(t('planner_error_text'));
        } finally {
            setIsLoading(false);
        }
    };
    
    const todayISO = new Date().toISOString().split("T")[0];

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            {!schedule && !error && (
                <div className="bg-white p-4 rounded-lg shadow-md animate-fade-in">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ClipboardList /> {t('planner_create_your_schedule')}</h3>
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
                            <option value="">{t('planner_select_subject')}</option>
                            {userSubjects.map(s => <option key={s} value={s}>{tSubject(s)}</option>)}
                        </select>
                        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder={t('planner_topic_placeholder')} className="w-full p-2 border rounded-lg" required/>
                        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('planner_amount_placeholder')} className="w-full p-2 border rounded-lg" required/>
                        <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} min={todayISO} className="w-full p-2 border rounded-lg" required/>

                        <button type="submit" disabled={isLoading} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-70`}>
                            {isLoading ? <><Loader2 className="w-5 h-5 animate-spin"/> {t('planner_generating')}</> : t('planner_generate_button')}
                        </button>
                    </form>
                </div>
            )}
            
            {error && (
                 <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center animate-fade-in">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                    <h3 className="font-bold text-red-800">{t('planner_error_title')}</h3>
                    <p className="text-red-700 text-sm mb-4">{error}</p>
                    <button onClick={() => setError(null)} className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors active:scale-95">Try Again</button>
                </div>
            )}

            {schedule && (
                 <div className="animate-fade-in space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl">{t('planner_result_title', { subject: tSubject(subject) })}</h3>
                        <button onClick={() => setSchedule(null)} className="flex items-center gap-2 font-semibold bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-lg transition-colors active:scale-95">
                            <RefreshCw size={16} /> {t('planner_start_over')}
                        </button>
                     </div>
                     <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {schedule.map((item, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg shadow-md border-l-4" style={{ borderColor: COLORS[index % COLORS.length]}}>
                                <p className="font-bold text-lg flex items-center gap-2">
                                    <Calendar size={18} className={getThemeClasses('text')} />
                                    {new Date(item.day + 'T00:00:00').toLocaleDateString(user.languagePreference, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-sm text-gray-500 font-semibold flex items-center gap-2 mb-2 ml-1">
                                    <Clock size={14} /> {item.time}
                                </p>
                                <div className="mt-2 space-y-2">
                                    <p className="font-semibold flex items-start gap-2"><CheckSquare size={18} className="text-green-500 flex-shrink-0 mt-0.5" /> {item.task}</p>
                                    <p className="text-sm text-amber-800 bg-amber-50 p-2 rounded-md flex items-start gap-2"><Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/> {item.tip}</p>
                                </div>
                            </div>
                        ))}
                     </div>
                 </div>
            )}
        </div>
    );
};

const COLORS = [ '#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1' ];

export default StudyPlannerView;