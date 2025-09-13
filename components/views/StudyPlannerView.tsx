import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { db, appId, Timestamp } from '../../services/firebase';
import { ClipboardList, Loader2, PlusCircle, Trash2, Calendar, Clock, CheckSquare, Lightbulb, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import type { AppUser, ModalContent, StudyPlan, StudyPlanSubject } from '../../types';

interface StudyPlannerViewProps {
  user: AppUser;
  userId: string;
  userStudyPlans: StudyPlan[];
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
  tSubject: (key: string) => string;
  showAppModal: (content: ModalContent) => void;
  language: 'nl' | 'en';
}

const COLORS = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'];

const CreatePlanView: React.FC<Omit<StudyPlannerViewProps, 'userStudyPlans'> & { onPlanCreated: () => void, onCancel: () => void }> = ({ user, userId, t, tSubject, getThemeClasses, showAppModal, language, onPlanCreated, onCancel }) => {
    const [title, setTitle] = useState('');
    const [subjects, setSubjects] = useState<StudyPlanSubject[]>([{ subject: '', topic: '', amount: '' }]);
    const [testDate, setTestDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const userSubjects = useMemo(() => {
        const combined = new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]);
        return Array.from(combined);
    }, [user.selectedSubjects, user.customSubjects]);

    const handleSubjectChange = (index: number, field: keyof StudyPlanSubject, value: string) => {
        const newSubjects = [...subjects];
        newSubjects[index][field] = value;
        setSubjects(newSubjects);
    };

    const addSubjectRow = () => setSubjects([...subjects, { subject: '', topic: '', amount: '' }]);
    const removeSubjectRow = (index: number) => setSubjects(subjects.filter((_, i) => i !== index));

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const areSubjectsValid = subjects.every(s => s.subject && s.topic && s.amount);
        if (!title || !testDate || !areSubjectsValid) {
            showAppModal({ text: t('error_all_fields_required') });
            return;
        }
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const today = new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const subjectsInfo = subjects.map(s => `- Subject: ${tSubject(s.subject)}, Topic: ${s.topic}, Material: ${s.amount}`).join('\n');
            const langName = language === 'nl' ? 'Dutch (Nederlands)' : 'English';

            const prompt = `You are an expert study planner. My test is on ${testDate}. Today is ${today}.
I need to study for the following subjects:
${subjectsInfo}

Create a realistic, day-by-day study schedule. The generated "task" and "tip" fields MUST be in ${langName}.

**CRITICAL RULES:**
1.  **Assume School Hours:** Assume I have a normal school/work day from 08:30 to 15:00. Plan all study sessions OUTSIDE of these hours.
2.  **Distribute Workload:** Break down study material into specific, manageable daily tasks. Spread the workload evenly and realistically; do not schedule more than two distinct study sessions per day.
3.  **Incorporate Revision:** Add specific revision sessions to review material learned on previous days, especially a day or two before the test.
4.  **Topic-Specific Tips:** The provided tip MUST be practical, insightful, and directly related to the specific topic of that day's task. Generic tips are unacceptable.
5.  **Time Slots & Breaks:** Assign a specific time slot (e.g., "16:00 - 17:30"). Don't make sessions longer than 90 minutes without suggesting a short break.
6.  **24-Hour Time:** Use 24-hour format for all times (e.g., 16:00 for 4 PM, 21:00 for 9 PM).

Return the output as a JSON object. The root object must have a key "schedule" which is an array of objects. Each object represents a study task and must have these properties:
- "day": The date in "YYYY-MM-DD" format.
- "time": The study time slot.
- "subject": The subject key (e.g., "wiskunde", "geschiedenis"). Use the original keys I provided.
- "task": The specific, quantitative task for the day (in ${langName}).
- "tip": The topic-specific study tip (in ${langName}).`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            schedule: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        day: { type: Type.STRING },
                                        time: { type: Type.STRING },
                                        subject: { type: Type.STRING },
                                        task: { type: Type.STRING },
                                        tip: { type: Type.STRING }
                                    },
                                    required: ['day', 'time', 'subject', 'task', 'tip']
                                }
                            }
                        },
                        required: ['schedule']
                    }
                }
            });

            const jsonStr = response.text.trim();
            const result = JSON.parse(jsonStr);
            
            if (result.schedule && result.schedule.length > 0) {
                 await db.collection(`artifacts/${appId}/users/${userId}/studyPlans`).add({
                    userId,
                    title,
                    testDate: Timestamp.fromDate(new Date(testDate)),
                    subjects,
                    schedule: result.schedule,
                    createdAt: Timestamp.now()
                });
                showAppModal({ text: t('plan_created_success') });
                onPlanCreated();
            } else {
                showAppModal({ text: t('planner_error_text') });
            }

        } catch (err) {
            console.error("AI Planner Error:", err);
            showAppModal({ text: t('planner_error_text') });
        } finally {
            setIsLoading(false);
        }
    };
    
    const todayISO = new Date().toISOString().split("T")[0];

    return (
        <div className="bg-white p-4 rounded-lg shadow-md animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{t('create_new_plan')}</h3>
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('plan_title_placeholder')} className="w-full p-2 border rounded-lg" required />
                
                {subjects.map((s, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="font-semibold">{t('subject')} #{index + 1}</label>
                            {subjects.length > 1 && <button type="button" onClick={() => removeSubjectRow(index)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>}
                        </div>
                        <select value={s.subject} onChange={e => handleSubjectChange(index, 'subject', e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
                            <option value="">{t('planner_select_subject')}</option>
                            {userSubjects.map(sub => <option key={sub} value={sub}>{tSubject(sub)}</option>)}
                        </select>
                        <input type="text" value={s.topic} onChange={e => handleSubjectChange(index, 'topic', e.target.value)} placeholder={t('planner_topic_placeholder')} className="w-full p-2 border rounded-lg" required/>
                        <input type="text" value={s.amount} onChange={e => handleSubjectChange(index, 'amount', e.target.value)} placeholder={t('planner_amount_placeholder')} className="w-full p-2 border rounded-lg" required/>
                    </div>
                ))}
                
                <button type="button" onClick={addSubjectRow} className="w-full py-2 px-4 text-sm font-semibold bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center gap-2">
                    <PlusCircle size={16}/> {t('add_subject_button')}
                </button>
                
                <div>
                    <label className="font-semibold">{t('plan_test_date')}</label>
                    <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} min={todayISO} className="w-full p-2 border rounded-lg" required/>
                </div>

                <button type="submit" disabled={isLoading} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-70`}>
                    {isLoading ? <><Loader2 className="w-5 h-5 animate-spin"/> {t('creating_plan')}</> : t('planner_generate_button')}
                </button>
            </form>
        </div>
    );
};

const StudyPlannerView: React.FC<StudyPlannerViewProps> = (props) => {
    const { userId, userStudyPlans, t, showAppModal, getThemeClasses, tSubject, language } = props;
    const [isCreating, setIsCreating] = useState(false);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

    const handleDeletePlan = (planId: string) => {
        showAppModal({
            text: t('delete_plan_confirm'),
            confirmAction: async () => {
                await db.doc(`artifacts/${appId}/users/${userId}/studyPlans/${planId}`).delete();
                showAppModal({ text: t('plan_deleted_success') });
            },
            cancelAction: () => {}
        });
    };

    const togglePlanSelection = (planId: string) => {
        setSelectedPlanIds(prev => prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]);
    };

    const toggleSelectAll = () => {
        if (selectedPlanIds.length === userStudyPlans.length) {
            setSelectedPlanIds([]);
        } else {
            setSelectedPlanIds(userStudyPlans.map(p => p.id));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedPlanIds.length === 0) return;
        showAppModal({
            text: t('confirm_delete_plans', { count: selectedPlanIds.length }),
            confirmAction: async () => {
                const batch = db.batch();
                selectedPlanIds.forEach(planId => {
                    const docRef = db.doc(`artifacts/${appId}/users/${userId}/studyPlans/${planId}`);
                    batch.delete(docRef);
                });
                await batch.commit();
                showAppModal({ text: t('plan_deleted_success') });
                setSelectedPlanIds([]);
                setIsSelecting(false);
            },
            cancelAction: () => {}
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className={`text-3xl font-bold ${getThemeClasses('text-strong')}`}>{t('study_planner_title')}</h2>
                {isSelecting ? (
                    <div className="flex items-center gap-2">
                        <button onClick={toggleSelectAll} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300">{t('select_all_button')}</button>
                        <button onClick={handleDeleteSelected} disabled={selectedPlanIds.length === 0} className="font-semibold text-sm py-2 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"><Trash2 size={14}/> {t('delete_selected_button')} ({selectedPlanIds.length})</button>
                        <button onClick={() => { setIsSelecting(false); setSelectedPlanIds([]); }} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300">{t('cancel_button')}</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {!isCreating && userStudyPlans.length > 0 && (
                            <button onClick={() => setIsSelecting(true)} className={`font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300`}>{t('select_button')}</button>
                        )}
                        {!isCreating && (
                            <button onClick={() => setIsCreating(true)} className={`flex items-center text-white font-bold py-2 px-4 rounded-lg shadow-md ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                                <PlusCircle className="w-5 h-5 mr-2"/> {t('create_new_plan')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isCreating ? (
                <CreatePlanView {...props} onPlanCreated={() => setIsCreating(false)} onCancel={() => setIsCreating(false)} />
            ) : userStudyPlans.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <ClipboardList className="mx-auto h-20 w-20 text-gray-300" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-700">{t('no_plans_yet')}</h3>
                    <p>{t('no_plans_cta')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {userStudyPlans.map(plan => (
                        <div key={plan.id} className={`bg-white p-4 rounded-lg shadow-md transition-all ${isSelecting ? 'pl-2' : ''}`}>
                           <div className="flex items-start gap-2">
                               {isSelecting && (
                                   <div className="flex items-center h-full pt-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedPlanIds.includes(plan.id)}
                                        onChange={() => togglePlanSelection(plan.id)}
                                        className={`h-5 w-5 rounded ${getThemeClasses('text')} focus:ring-0`}
                                    />
                                   </div>
                               )}
                               <div className="flex-grow flex justify-between items-start gap-2">
                                    <div>
                                        <h3 className="font-bold text-lg">{plan.title}</h3>
                                        <p className="text-sm text-gray-500">{t('plan_for_date', { date: (plan.testDate as any).toDate().toLocaleDateString(language) })}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* FIX: Corrected a variable name from 'id' to 'plan.id' in the onClick handler for toggling the display of a study plan's details, resolving a 'Cannot find name' error. */}
                                        <button onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-md">
                                            {expandedPlanId === plan.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                        </button>
                                        {!isSelecting && (
                                            <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-red-500 bg-red-100 hover:bg-red-200 rounded-md"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                               </div>
                           </div>
                            
                            {expandedPlanId === plan.id && (
                                <div className="mt-4 pt-4 border-t space-y-3 animate-fade-in">
                                    {plan.schedule.sort((a,b) => a.day.localeCompare(b.day)).map((item, index) => (
                                        <div key={index} className="p-3 rounded-lg border-l-4" style={{ backgroundColor: '#fafafa', borderColor: COLORS[index % COLORS.length] }}>
                                            <p className="font-bold flex items-center gap-2"><Calendar size={16}/> {new Date(item.day + 'T00:00:00').toLocaleDateString(language, { weekday: 'long', day: 'numeric' })}</p>
                                            <p className="text-sm text-gray-500 ml-1 mb-2 flex items-center gap-2"><Clock size={14}/> {item.time}</p>
                                            <p className="font-semibold flex items-start gap-2"><CheckSquare size={18} className="text-green-500 mt-0.5"/> {tSubject(item.subject || '')}: {item.task}</p>
                                            <p className="text-sm text-amber-800 bg-amber-50 p-2 rounded-md mt-2 flex items-start gap-2"><Lightbulb size={16} className="text-amber-500 mt-0.5"/> {item.tip}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudyPlannerView;
