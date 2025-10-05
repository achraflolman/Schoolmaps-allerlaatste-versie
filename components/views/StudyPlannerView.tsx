import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { db, appId, Timestamp } from '../../services/firebase';
import { ClipboardList, Loader2, PlusCircle, Trash2, Calendar, Clock, CheckSquare, Lightbulb, ChevronDown, ChevronUp, Check, X, Share2, Layers } from 'lucide-react';
import type { AppUser, ModalContent, StudyPlan, StudyPlanSubject, CalendarEvent } from '../../types';

interface StudyPlannerViewProps {
  user: AppUser;
  userId: string;
  userStudyPlans: StudyPlan[];
  allEvents: CalendarEvent[];
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
  tSubject: (key: string) => string;
  showAppModal: (content: ModalContent) => void;
  language: 'nl' | 'en';
}

const COLORS = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'];

const SharePlanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    plan: StudyPlan;
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: { text: string }) => void;
}> = ({ isOpen, onClose, plan, user, t, getThemeClasses, showAppModal }) => {
    const [email, setEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            showAppModal({ text: t('error_invalid_email') });
            return;
        }
        if (email.toLowerCase() === user.email.toLowerCase()) {
            showAppModal({ text: t('error_cannot_share_with_self') });
            return;
        }

        setIsSharing(true);
        try {
            const usersRef = db.collection(`users`);
            const userQuery = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

            if (userQuery.empty) {
                showAppModal({ text: t('error_user_not_found', { email }) });
                return;
            }
            const recipientUser = userQuery.docs[0].data() as AppUser;
            
            // Denormalize by copying plan data for easy retrieval by recipient
            const planDataToShare = {
                ...plan,
                sharerId: user.uid,
                sharerName: user.userName,
                recipientEmail: recipientUser.email,
                originalPlanId: plan.id,
                sharedAt: Timestamp.now(),
            };
            delete (planDataToShare as any).id; // Remove original ID

            await db.collection(`sharedPlans`).add(planDataToShare);

            showAppModal({ text: t('share_plan_success', { email }) });
            onClose();

        } catch (error) {
            console.error("Sharing failed:", error);
            showAppModal({ text: t('error_share_plan_failed') });
        } finally {
            setIsSharing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2 truncate">{t('share_plan_title', { title: plan.title })}</h3>
                <form onSubmit={handleShare}>
                    <label className="block text-gray-700 text-sm font-bold mb-2">{t('share_with_email')}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('placeholder_email')} className={`w-full p-2 border rounded-lg border-gray-300`} required />
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
                        <button type="submit" disabled={isSharing} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-32 flex items-center justify-center`}>
                            {isSharing ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Share2 size={16} className="mr-2"/>{t('share_button')}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const CreatePlanView: React.FC<Omit<StudyPlannerViewProps, 'userStudyPlans'> & { onPlanCreated: () => void, onCancel: () => void }> = (props) => {
    const { user, userId, t, tSubject, getThemeClasses, showAppModal, language, onPlanCreated, onCancel, allEvents } = props;
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
            const now = new Date();
            const testDateObj = new Date(testDate);
            testDateObj.setHours(23, 59, 59);
    
            const relevantEvents = allEvents.filter(event => {
                const eventDate = (event.start as any).toDate();
                return eventDate >= now && eventDate <= testDateObj;
            });
    
            let scheduleString = "The user's current schedule is as follows:\n";
            if (relevantEvents.length === 0) {
                scheduleString = "The user's calendar is currently empty for this period.";
            } else {
                const eventsByDay: Record<string, CalendarEvent[]> = relevantEvents.reduce((acc, event) => {
                    const day = (event.start as any).toDate().toISOString().split('T')[0];
                    if (!acc[day]) acc[day] = [];
                    acc[day].push(event);
                    return acc;
                }, {} as Record<string, CalendarEvent[]>);
    
                Object.keys(eventsByDay).sort().forEach(day => {
                    scheduleString += `- ${day}:\n`;
                    eventsByDay[day].forEach(event => {
                        const startTime = (event.start as any).toDate().toTimeString().substring(0, 5);
                        const endTime = (event.end as any).toDate().toTimeString().substring(0, 5);
                        scheduleString += `  - Busy from ${startTime} to ${endTime} for "${event.title}".\n`;
                    });
                });
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const today = new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const subjectsInfo = subjects.map(s => `- Subject: ${tSubject(s.subject)}, Topic: ${s.topic}, Material: ${s.amount}`).join('\n');
            const langName = language === 'nl' ? 'Dutch (Nederlands)' : 'English';
            
            const prompt = `You are an expert study planner. My test is on ${testDate}. Today is ${today}.
I need to study for the following subjects:
${subjectsInfo}

${scheduleString}

**CRITICAL RULES:**
1.  **Plan Around My Schedule:** Use my existing schedule to find free time slots. Do NOT schedule study sessions that conflict with my busy times.
2.  **Add Breaks:** If you see a long block of appointments (like a school day ending at 15:00), schedule a break of at least 1 hour before planning a study session (e.g., start studying at 16:00 or later).
3.  **Distribute Workload:** Break down study material into specific, manageable daily tasks. Spread the workload evenly and realistically; do not schedule more than two distinct study sessions per day.
4.  **Incorporate Revision:** Add specific revision sessions to review material learned on previous days, especially a day or two before the test.
5.  **Topic-Specific Tips:** The provided tip MUST be practical, insightful, and directly related to the specific topic of that day's task. Generic tips are unacceptable.
6.  **Time Slots & Breaks:** Assign a specific time slot (e.g., "16:00 - 17:30"). Don't make sessions longer than 90 minutes without suggesting a short break within the task description.
7.  **24-Hour Time:** Use 24-hour format for all times (e.g., 16:00 for 4 PM).
8.  **Language:** The generated "task" and "tip" fields MUST be in ${langName}.

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
                 const batch = db.batch();
                 const planRef = db.collection(`users/${userId}/studyPlans`).doc();

                 batch.set(planRef, {
                    userId,
                    title,
                    testDate: Timestamp.fromDate(new Date(testDate)),
                    subjects,
                    schedule: result.schedule,
                    createdAt: Timestamp.now()
                });

                result.schedule.forEach((item: any) => {
                    const [startTime, endTimeStr] = item.time.split(' - ');
                    const eventDate = new Date(`${item.day}T${startTime}`);
                    const eventEndDate = endTimeStr ? new Date(`${item.day}T${endTimeStr}`) : new Date(eventDate.getTime() + 90 * 60 * 1000);

                    if (!isNaN(eventDate.getTime())) {
                        const eventRef = db.collection(`users/${userId}/calendarEvents`).doc();
                        batch.set(eventRef, {
                            title: `${t('planner_task')}: ${item.task.substring(0, 50)}${item.task.length > 50 ? '...' : ''}`,
                            description: `${t('planner_tip')}: ${item.tip}`,
                            start: Timestamp.fromDate(eventDate),
                            end: Timestamp.fromDate(eventEndDate),
                            subject: item.subject,
                            type: 'study_plan',
                            ownerId: userId,
                            createdAt: Timestamp.now(),
                            studyPlanId: planRef.id,
                        });
                    }
                });

                await batch.commit();
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
    const { user, userId, userStudyPlans, t, showAppModal, getThemeClasses, tSubject, language } = props;
    const [isCreating, setIsCreating] = useState(false);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [planToShare, setPlanToShare] = useState<StudyPlan | null>(null);
    const [sharedPlans, setSharedPlans] = useState<StudyPlan[]>([]);
    
    useEffect(() => {
        const q = db.collection(`sharedPlans`).where('recipientEmail', '==', user.email);
        const unsubscribe = q.onSnapshot(snapshot => {
            const fetchedPlans = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    isShared: true,
                    sharerName: data.sharerName,
                    testDate: data.testDate,
                    createdAt: data.createdAt,
                } as StudyPlan
            });
            setSharedPlans(fetchedPlans);
        });
        return () => unsubscribe();
    }, [user.email]);

    const allPlans = useMemo(() => {
        return [...userStudyPlans, ...sharedPlans].sort((a,b) => (b.createdAt as any).toMillis() - (a.createdAt as any).toMillis());
    }, [userStudyPlans, sharedPlans]);

    const handleDeletePlan = (plan: StudyPlan) => {
        const isOwned = !plan.isShared;
        showAppModal({
            text: t('delete_plan_confirm'),
            confirmAction: async () => {
                if (isOwned) {
                    await db.doc(`users/${userId}/studyPlans/${plan.id}`).delete();
                } else {
                    await db.doc(`sharedPlans/${plan.id}`).delete();
                }
                showAppModal({ text: t('plan_deleted_success') });
            },
            cancelAction: () => {}
        });
    };
    
    const openShareModal = (plan: StudyPlan) => {
        setPlanToShare(plan);
        setIsShareModalOpen(true);
    };

    const togglePlanSelection = (planId: string) => {
        setSelectedPlanIds(prev => prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]);
    };

    const toggleSelectAll = () => {
        if (selectedPlanIds.length === allPlans.length) {
            setSelectedPlanIds([]);
        } else {
            setSelectedPlanIds(allPlans.map(p => p.id));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedPlanIds.length === 0) return;
        showAppModal({
            text: t('confirm_delete_plans', { count: selectedPlanIds.length }),
            confirmAction: async () => {
                const batch = db.batch();
                selectedPlanIds.forEach(planId => {
                    const plan = allPlans.find(p => p.id === planId);
                    if (plan) {
                        const collection = plan.isShared ? 'sharedPlans' : 'studyPlans';
                        const path = plan.isShared ? `${collection}/${planId}` : `users/${userId}/${collection}/${planId}`;
                        const docRef = db.doc(path);
                        batch.delete(docRef);
                    }
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
            {planToShare && <SharePlanModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} plan={planToShare} user={props.user} t={t} getThemeClasses={getThemeClasses} showAppModal={showAppModal} />}

            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className={`text-3xl font-bold ${getThemeClasses('text-strong')}`}>{t('study_planner_title')}</h2>
                 <div className="flex items-center gap-2">
                    {isSelecting ? (
                        <>
                            <button onClick={toggleSelectAll} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300">{t('select_all_button')}</button>
                            <button onClick={handleDeleteSelected} disabled={selectedPlanIds.length === 0} className="font-semibold text-sm py-2 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"><Trash2 size={14}/> {t('delete_selected_button')} ({selectedPlanIds.length})</button>
                            <button onClick={() => { setIsSelecting(false); setSelectedPlanIds([]); }} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200 hover:bg-gray-300">{t('cancel_button')}</button>
                        </>
                    ) : (
                        <>
                            {!isCreating && allPlans.length > 0 && (
                                <button onClick={() => setIsSelecting(true)} className={`p-2 rounded-lg bg-gray-200 hover:bg-gray-300`} title={t('select_button')}>
                                    <CheckSquare size={20} />
                                </button>
                            )}
                            {!isCreating && (
                                <button onClick={() => setIsCreating(true)} className={`flex items-center text-white font-bold p-2 rounded-lg shadow-md ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`} title={t('create_new_plan')}>
                                    <PlusCircle size={20}/>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {isCreating ? (
                <CreatePlanView {...props} onPlanCreated={() => setIsCreating(false)} onCancel={() => setIsCreating(false)} />
            ) : allPlans.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <ClipboardList className="mx-auto h-20 w-20 text-gray-300" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-700">{t('no_plans_yet')}</h3>
                    <p>{t('no_plans_cta')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {allPlans.map(plan => (
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
                                        {plan.isShared && <p className="text-xs text-gray-500 mt-1">{t('shared_by', { name: plan.sharerName })}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        {!isSelecting && !plan.isShared &&
                                            <button onClick={() => openShareModal(plan)} className="p-2 bg-blue-100 hover:bg-blue-200 rounded-md text-blue-600"><Share2 size={16}/></button>
                                        }
                                        <button onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-md">
                                            {expandedPlanId === plan.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                        </button>
                                        {!isSelecting && (
                                            <button onClick={() => handleDeletePlan(plan)} className="p-2 text-red-500 bg-red-100 hover:bg-red-200 rounded-md"><Trash2 size={16}/></button>
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