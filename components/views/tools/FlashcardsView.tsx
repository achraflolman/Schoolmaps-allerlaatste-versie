import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, appId, Timestamp, increment } from '../../../services/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import type { Flashcard, FlashcardSet, AppUser, ModalContent, SessionSummary, SessionAnswer } from '../../../types';
import { PlusCircle, Trash2, ArrowLeft, Save, BookOpen, Settings, Brain, BarChart, RotateCcw, X, Check, Loader2, FileQuestion, Star, Layers, Sparkles, Share2, ChevronDown, Folder, Type as TypeIcon, Globe, Calculator, Atom, FlaskConical, Dna, ScrollText, AreaChart, Users, Languages, Code, Paintbrush, Music, Dumbbell, Film, CheckCircle, Send, DownloadCloud } from 'lucide-react';
import ShareSetModal from './ShareSetModal';

interface FlashcardsViewProps {
  userId: string;
  user: AppUser;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  tSubject: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
  setIsSessionActive?: (isActive: boolean) => void;
  initialContext?: { set: FlashcardSet };
  onBack?: () => void;
}

type ViewType = 'subject-list' | 'set-list' | 'mode-selection' | 'manage' | 'learn' | 'cram' | 'mc' | 'vocab' | 'summary' | 'all-learned';

const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const calculateStars = (correct: number, total: number): number => {
    if (total === 0) return 0;
    const percentage = correct / total;
    if (percentage === 1) return 5;
    if (percentage >= 0.8) return 3;
    if (percentage >= 0.6) return 1;
    return 0;
};

// ====================================================================
// SUB-COMPONENTS (Moved to top to prevent ReferenceError)
// ====================================================================

const AIGenerateCardsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (topic: string, text: string) => Promise<void>;
    isGenerating: boolean;
    getThemeClasses: (variant: string) => string;
    t: (key: string) => string;
}> = ({ isOpen, onClose, onGenerate, isGenerating, getThemeClasses, t }) => {
    const [text, setText] = useState('');
    const [topic, setTopic] = useState('');

    if (!isOpen) return null;

    const handleGenerateClick = () => {
        if (text.trim()) {
            onGenerate(topic, text);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2">{t('flashcard_ai_modal_title')}</h3>
                <p className="text-sm text-gray-600 mb-4">{t('flashcard_ai_modal_desc')}</p>
                
                <div className="space-y-4">
                    <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={t('flashcard_ai_topic_placeholder')}
                        className="w-full p-2 border rounded-lg"
                        disabled={isGenerating}
                    />
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        className="w-full p-2 border rounded-lg"
                        placeholder={t('flashcard_ai_placeholder')}
                        disabled={isGenerating}
                    />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} disabled={isGenerating} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                    <button onClick={handleGenerateClick} disabled={isGenerating || !text.trim()} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95 w-32 flex items-center justify-center`}>
                        {isGenerating ? <Loader2 className="animate-spin"/> : t('generate_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CardManagerView: React.FC<any> = ({ set, onBack, userId, t, getThemeClasses, showAppModal }) => {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newCardRows, setNewCardRows] = useState<{ q: string, a: string }[]>([{ q: '', a: '' }]);

    useEffect(() => {
        if (set.isCombined || (set.isShared && set.cards)) {
            // For combined sets or newly accepted shared sets, cards are embedded
            const embeddedCards = (set.cards || []).map((c: any, i: number) => ({ ...c, id: `embedded-${i}` }));
            setCards(embeddedCards);
            setIsLoading(false);
            return;
        }
        
        // For regular and previously accepted sets, fetch from subcollection
        const unsub = db.collection(`users/${userId}/flashcardDecks/${set.id}/cards`).orderBy('createdAt', 'asc').onSnapshot(snap => {
            setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Flashcard)));
            setIsLoading(false);
        }, err => {
            console.error("Error fetching cards:", err);
            setIsLoading(false);
        });
        return () => unsub();
    }, [set, userId]);


    const handleSaveCards = async () => {
        const cardsToAdd = newCardRows.filter(row => row.q.trim() && row.a.trim());
        if (cardsToAdd.length === 0) {
            showAppModal({ text: t('error_empty_flashcard') });
            return;
        }
        const batch = db.batch();
        cardsToAdd.forEach(card => {
            const cardRef = db.collection(`users/${userId}/flashcardDecks/${set.id}/cards`).doc();
            batch.set(cardRef, { question: card.q, answer: card.a, ownerId: userId, createdAt: Timestamp.now(), dueDate: Timestamp.now(), interval: 0, easeFactor: 2.5 });
        });
        const setRef = db.doc(`users/${userId}/flashcardDecks/${set.id}`);
        batch.update(setRef, { cardCount: increment(cardsToAdd.length) });
        await batch.commit();
        setNewCardRows([{ q: '', a: '' }]);
        showAppModal({ text: t('flashcard_added_success') });
    };

    const handleDeleteCard = (cardId: string) => {
        const batch = db.batch();
        const cardRef = db.doc(`users/${userId}/flashcardDecks/${set.id}/cards/${cardId}`);
        batch.delete(cardRef);
        const setRef = db.doc(`users/${userId}/flashcardDecks/${set.id}`);
        batch.update(setRef, { cardCount: increment(-1) });
        batch.commit();
    };

    const handleAIGenerate = async (topic: string, text: string) => {
        setIsGenerating(true);
        showAppModal({ text: t('flashcards_creating_message') });
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on the following notes about "${topic}", generate a concise list of question-and-answer pairs for flashcards. The question should be on one line, and the answer on the next, separated by a newline. Example:
Question 1
Answer 1
Question 2
Answer 2

Notes:
---
${text}
---`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const generatedText = response.text;
            const lines = generatedText.split('\n').filter(line => line.trim() !== '');
            const generatedPairs = [];
            for (let i = 0; i < lines.length; i += 2) {
                if (lines[i+1]) {
                    generatedPairs.push({ q: lines[i].trim(), a: lines[i+1].trim() });
                }
            }
            setNewCardRows(prev => [...prev.filter(r => r.q.trim() || r.a.trim()), ...generatedPairs]);
            setIsAIGenerateOpen(false);
        } catch (error) {
            console.error(error);
            showAppModal({ text: "AI generation failed." });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
             <AIGenerateCardsModal isOpen={isAIGenerateOpen} onClose={() => setIsAIGenerateOpen(false)} onGenerate={handleAIGenerate} isGenerating={isGenerating} getThemeClasses={getThemeClasses} t={t} />
             <div className="flex justify-between items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
                <h3 className="font-bold text-xl text-center truncate">{set.name}</h3>
                <div className="w-9 h-9"></div>
            </div>

            {!(set.isShared && !set.isCombined) && (
                <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-lg">{t('add_flashcard')}</h4>
                        <button onClick={() => setIsAIGenerateOpen(true)} className={`flex items-center gap-2 py-2 px-3 rounded-lg text-white font-bold bg-purple-500 hover:bg-purple-600 transition-colors active:scale-95 text-sm`}>
                            <Sparkles size={16}/> {t('flashcard_ai_modal_title')}
                        </button>
                    </div>
                    {newCardRows.map((row, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input value={row.q} onChange={e => setNewCardRows(rows => rows.map((r, i) => i === index ? {...r, q: e.target.value} : r))} placeholder={t('question')} className="w-1/2 p-2 border rounded-lg" />
                            <input value={row.a} onChange={e => setNewCardRows(rows => rows.map((r, i) => i === index ? {...r, a: e.target.value} : r))} placeholder={t('answer')} className="w-1/2 p-2 border rounded-lg" />
                        </div>
                    ))}
                    <div className="flex justify-between gap-2">
                         <button onClick={() => setNewCardRows(prev => [...prev, ...Array(5).fill({q:'', a:''})])} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('add_more_rows')}</button>
                         <button onClick={handleSaveCards} className={`flex items-center gap-2 py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')}`}><Save size={16}/> {t('save_note_button')}</button>
                    </div>
                </div>
            )}
            
            <div className="bg-white p-4 rounded-lg shadow-md space-y-2 max-h-96 overflow-y-auto">
                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : cards.length === 0 ? <p className="text-center text-gray-500 italic p-4">{t('no_flashcards_found')}</p> : cards.map(card => (
                    <div key={card.id} className="p-2 border-b flex justify-between items-start">
                        <div>
                            <p className="font-semibold">{card.question}</p>
                            <p className="text-sm text-gray-600">{card.answer}</p>
                        </div>
                       {!(set.isShared && !set.isCombined) && <button onClick={() => handleDeleteCard(card.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full flex-shrink-0"><Trash2 size={16}/></button>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const LearnSessionView: React.FC<any> = ({ set, onExit, t }) => (
    <div>
        <button onClick={onExit}>{t('exit_session')}</button>
        <h1>{t('study_mode_learn_title')} for {set.name}</h1>
        <p>Implementation for learning session (SRS) will go here.</p>
    </div>
);

const CramSessionView: React.FC<any> = ({ set, onExit, t }) => (
    <div>
        <button onClick={onExit}>{t('exit_session')}</button>
        <h1>{t('study_mode_cram_title')} for {set.name}</h1>
        <p>Implementation for cramming session will go here.</p>
    </div>
);

const MultipleChoiceSessionView: React.FC<any> = ({ set, onExit, t }) => (
    <div>
        <button onClick={onExit}>{t('exit_session')}</button>
        <h1>{t('study_mode_mc_title')} for {set.name}</h1>
        <p>Implementation for multiple choice session will go here.</p>
    </div>
);

const VocabSessionView: React.FC<any> = ({ set, onExit, onSessionComplete, userId, t, getThemeClasses, showAppModal }) => {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const startTimeRef = useRef(Date.now());

    useEffect(() => {
        const fetchCards = async () => {
            setIsLoading(true);
            if (set.isCombined) {
                setCards(shuffleArray([...(set.cards || [])]));
            } else {
                const cardsSnapshot = await db.collection(`users/${userId}/flashcardDecks/${set.id}/cards`).get();
                setCards(shuffleArray(cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard))));
            }
            setIsLoading(false);
        };
        fetchCards();
    }, [set, userId]);

    if (isLoading) {
        return <div className="text-center p-8"><Loader2 className="animate-spin mx-auto" /> {t('loading_cards')}</div>;
    }

    if (cards.length === 0) {
        return <div>{t('no_flashcards_found')}</div>;
    }

    const currentCard = cards[currentIndex];

    const checkAnswer = async () => {
        setIsChecking(true);
        let isCorrect = userAnswer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();

        if (!isCorrect && process.env.API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `Is the user's answer "${userAnswer}" a correct synonym or alternative for the correct answer "${currentCard.answer}"? Answer only with "YES" or "NO".`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                if (response.text.trim().toUpperCase() === 'YES') {
                    isCorrect = true;
                }
            } catch (error) {
                console.error("AI check failed:", error);
                showAppModal({ text: t('error_ai_check_failed') });
            }
        }

        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setSessionAnswers(prev => [...prev, { card: currentCard, userAnswer, isCorrect }]);
        setIsChecking(false);
    };

    const nextCard = () => {
        setFeedback(null);
        setUserAnswer('');
        if (currentIndex + 1 < cards.length) {
            setCurrentIndex(prev => prev + 1);
        } else {
            const correct = sessionAnswers.filter(a => a.isCorrect).length;
            onSessionComplete({
                stats: { correct, incorrect: cards.length - correct, total: cards.length, startTime: startTimeRef.current, endTime: Date.now() },
                answers: sessionAnswers,
                earnedStars: calculateStars(correct, cards.length),
            });
        }
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex justify-between items-center">
                <button onClick={onExit} className="p-2 rounded-full hover:bg-gray-200"><X/></button>
                <h3 className="font-bold text-xl text-center">{set.name}</h3>
                <div className="font-semibold">{t('cards_to_go_counter', { current: currentIndex + 1, total: cards.length })}</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md min-h-[200px] flex items-center justify-center">
                <p className="text-2xl font-semibold text-center">{currentCard.question}</p>
            </div>
            
            {!feedback ? (
                 <form onSubmit={e => { e.preventDefault(); checkAnswer(); }} className="space-y-2">
                    <input
                        type="text"
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        placeholder={t('answer')}
                        className="w-full p-3 border rounded-lg text-lg"
                        autoFocus
                    />
                    <button type="submit" disabled={isChecking} className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg flex items-center justify-center ${getThemeClasses('bg')}`}>
                        {isChecking ? <><Loader2 className="animate-spin mr-2"/> {t('ai_checking_answer')}</> : t('submit_answer')}
                    </button>
                 </form>
            ) : (
                <div className="space-y-4">
                     <div className={`p-4 rounded-lg text-center font-semibold text-lg ${feedback === 'correct' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {feedback === 'correct' ? t('ai_feedback_correct') : t('ai_feedback_incorrect', { correct_answer: currentCard.answer })}
                    </div>
                    <button onClick={nextCard} className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg ${getThemeClasses('bg')}`}>
                        {t('next_card')}
                    </button>
                </div>
            )}
        </div>
    );
};

const SessionSummaryView: React.FC<any> = ({ set, summary, onBack, setView, onStartSession, setSelectedSet, t, getThemeClasses, userId }) => {
    const { stats, answers, earnedStars } = summary;
    const grade = (stats.correct / stats.total) * 9 + 1;

    const incorrectAnswers = answers.filter((a: SessionAnswer) => !a.isCorrect);

    const handleCreateSetFromIncorrect = async () => {
        if (incorrectAnswers.length === 0) return;
        
        const newSetName = prompt(t('new_set_name_prompt'), `${set.name} - ${t('practice_incorrect')}`);
        if (!newSetName) return;

        const batch = db.batch();
        const newSetRef = db.collection(`users/${userId}/flashcardDecks`).doc();
        batch.set(newSetRef, {
            name: newSetName,
            subject: set.subject,
            ownerId: userId,
            createdAt: Timestamp.now(),
            cardCount: incorrectAnswers.length
        });
        
        incorrectAnswers.forEach((answer: SessionAnswer) => {
            const newCardRef = newSetRef.collection('cards').doc();
            // Create a clean card object, resetting SRS data
            const newCardData = {
                question: answer.card.question,
                answer: answer.card.answer,
                ownerId: userId,
                createdAt: Timestamp.now(),
                dueDate: Timestamp.now(),
                interval: 0,
                easeFactor: 2.5,
            };
            batch.set(newCardRef, newCardData);
        });
        await batch.commit();
        alert(t('new_set_created_success', {name: newSetName}));
    };
    
    const handlePracticeIncorrect = () => {
        if (incorrectAnswers.length === 0) {
            alert(t('no_incorrect_answers'));
            return;
        }
        const practiceSet: FlashcardSet = {
            id: 'practice-' + Date.now(),
            name: `${set.name} - ${t('practice_incorrect')}`,
            subject: set.subject,
            ownerId: userId,
            createdAt: Timestamp.now(),
            cardCount: incorrectAnswers.length,
            isCombined: true,
            cards: incorrectAnswers.map((a: SessionAnswer) => a.card)
        };
        setSelectedSet(practiceSet);
        setView('mode-selection');
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200"><ArrowLeft/></button>
                <h3 className="font-bold text-xl text-center">{t('session_summary_title')}</h3>
                <div className="w-9 h-9"></div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                {earnedStars > 0 && (
                    <div className="mb-4">
                        <h4 className="font-bold text-lg">{t('stars_earned_title')}</h4>
                        <div className="flex justify-center text-yellow-400">
                            {Array.from({length: earnedStars}).map((_, i) => <Star key={i} size={32} className="fill-current"/>)}
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs uppercase text-gray-500">{t('your_grade')}</p><p className="text-2xl font-bold">{grade.toFixed(1)}</p></div>
                    <div><p className="text-xs uppercase text-gray-500">{t('correct_answers')}</p><p className="text-2xl font-bold text-green-600">{stats.correct}</p></div>
                    <div><p className="text-xs uppercase text-gray-500">{t('incorrect_answers')}</p><p className="text-2xl font-bold text-red-600">{stats.incorrect}</p></div>
                    <div><p className="text-xs uppercase text-gray-500">{t('time_spent')}</p><p className="text-2xl font-bold">{Math.round((stats.endTime - stats.startTime)/1000)}s</p></div>
                </div>
            </div>

            <div className="space-y-2">
                 <button onClick={handlePracticeIncorrect} disabled={incorrectAnswers.length === 0} className="w-full py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50">{t('practice_incorrect')} ({incorrectAnswers.length})</button>
                 <button onClick={handleCreateSetFromIncorrect} disabled={incorrectAnswers.length === 0} className="w-full py-2 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold disabled:opacity-50">{t('create_set_from_incorrect')}</button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2 bg-white p-4 rounded-lg shadow-md">
                {answers.map((answer: SessionAnswer, index: number) => (
                    <div key={index} className={`p-3 rounded-lg ${answer.isCorrect ? 'bg-green-50 border-l-4 border-green-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
                        <p className="font-semibold">{answer.card.question}</p>
                        <p className="text-sm"><span className="font-bold">{t('correct_answer')}:</span> {answer.card.answer}</p>
                        {!answer.isCorrect && answer.userAnswer && <p className="text-sm text-red-700"><span className="font-bold">{t('your_answer')}:</span> {answer.userAnswer}</p>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const AllCardsLearnedView: React.FC<any> = ({ set, setView, t, getThemeClasses }) => {
    return (
        <div className={`p-6 rounded-lg shadow-inner text-center ${getThemeClasses('bg-light')}`}>
            <CheckCircle className={`w-16 h-16 mx-auto mb-4 ${getThemeClasses('text')}`} />
            <h3 className="text-2xl font-bold">{t('all_cards_learned_title')}</h3>
            <p className="text-gray-600 mt-2 mb-6">{t('all_cards_learned_desc')}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button onClick={() => setView('mode-selection')} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('choose_other_method_button')}</button>
                <button onClick={() => { /* Need reset logic here if required */ setView('learn'); }} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')}`}>{t('reset_and_start_over_button')}</button>
            </div>
        </div>
    );
};

const SubjectSelectionForFlashcards: React.FC<any> = ({ onSelectSubject, onBack, ...props }) => {
    const { user, t, tSubject, getThemeClasses } = props;
    const userSubjects = useMemo(() => Array.from(new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])])), [user.selectedSubjects, user.customSubjects]);
    
    const subjectIcons = useMemo(() => ({
        'aardrijkskunde': <Globe className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'wiskunde': <Calculator className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'natuurkunde': <Atom className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'scheikunde': <FlaskConical className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'biologie': <Dna className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'geschiedenis': <ScrollText className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'latijn': <ScrollText className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'economie': <AreaChart className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'maatschappijleer': <Users className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'nederlands': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'engels': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'frans': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'duits': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'informatica': <Code className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'kunst': <Paintbrush className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'muziek': <Music className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'lichamelijke_opvoeding': <Dumbbell className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'ckv': <Film className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
        'default': <Folder className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />
    }), [getThemeClasses]);

    const getIconForSubject = (subjectKey: string) => {
      return subjectIcons[subjectKey as keyof typeof subjectIcons] || subjectIcons['default'];
    };
    
    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex items-center">
                {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>}
                <h3 className={`font-bold text-xl flex-grow text-center ${getThemeClasses('text-strong')}`}>{t('flashcards')}</h3>
                <div className="w-9 h-9"></div> {/* Placeholder for centering */}
            </div>

            {userSubjects.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <h3 className="text-xl font-semibold">{t('no_subjects_flashcards')}</h3>
                    <p>{t('go_to_settings_flashcards')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {userSubjects.map(subject => (
                        <button key={subject} onClick={() => onSelectSubject(subject)} className="bg-white p-6 rounded-lg shadow-md text-center font-semibold hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                            {getIconForSubject(subject)}
                            {tSubject(subject)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const SetListView: React.FC<any> = ({ subject, setSelectedSet, setView, onBack, onShare, ...props }) => {
    const { userId, t, tSubject, getThemeClasses, showAppModal, user } = props;
    const [ownedSets, setOwnedSets] = useState<FlashcardSet[]>([]);
    const [incomingSets, setIncomingSets] = useState<FlashcardSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSetName, setNewSetName] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const [isCombiningLoading, setIsCombiningLoading] = useState(false);
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    
    useEffect(() => {
        if (user.uid === 'guest-user') { 
            setIsLoading(false); 
            return; 
        }
        
        setIsLoading(true);

        const ownedSetsQuery = db.collection(`users/${userId}/flashcardDecks`).where('subject', '==', subject);
        const unsubOwned = ownedSetsQuery.onSnapshot(snap => {
            setOwnedSets(snap.docs.map(d => ({ id: d.id, ...d.data() } as FlashcardSet)));
            setIsLoading(false);
        }, err => { 
            console.error("Error fetching owned sets:", err); 
            showAppModal({ text: `Error fetching sets: ${err.message}` });
            setIsLoading(false); 
        });

        const sharedSetsQuery = db.collection('sharedSets').where('recipientEmail', '==', user.email).where('subject', '==', subject);
        const unsubShared = sharedSetsQuery.onSnapshot(snap => {
            const sets = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    name: data.name,
                    subject: data.subject,
                    createdAt: data.sharedAt,
                    cardCount: data.cards?.length || 0,
                    isShared: true,
                    sharerName: data.sharerName,
                    cards: data.cards,
                } as FlashcardSet
            });
            setIncomingSets(sets);
        });

        return () => {
            unsubOwned();
            unsubShared();
        };
    }, [userId, user.uid, user.email, subject, showAppModal]);
    
    const allSets = useMemo(() => {
        return [...ownedSets].sort((a,b) => (b.createdAt as any).toMillis() - (a.createdAt as any).toMillis());
    }, [ownedSets]);
    
    const handleAcceptSet = async (sharedSet: FlashcardSet) => {
        showAppModal({ text: 'Set importeren...' });
        const batch = db.batch();

        // 1. Create a new deck for the recipient
        const newSetRef = db.collection(`users/${userId}/flashcardDecks`).doc();
        batch.set(newSetRef, {
            name: sharedSet.name || 'Onbekende Set', // Fallback to prevent crash
            subject: sharedSet.subject,
            ownerId: userId,
            createdAt: Timestamp.now(),
            cardCount: sharedSet.cards?.length || 0,
            isShared: true, // Mark it as originally from a share
            sharerName: sharedSet.sharerName,
        });

        // 2. Copy all cards to the new deck as a subcollection
        (sharedSet.cards || []).forEach(cardData => {
            const newCardRef = newSetRef.collection('cards').doc();
            batch.set(newCardRef, { ...cardData, ownerId: userId });
        });

        // 3. Delete the temporary document from 'sharedSets'
        const sharedDocRef = db.doc(`sharedSets/${sharedSet.id}`);
        batch.delete(sharedDocRef);
        
        // 4. Find and delete the notification associated with this share
        const notifsRef = db.collection(`users/${userId}/notifications`);
        const notifQuery = notifsRef.where('flashcardSetId', '==', sharedSet.id).limit(1);
        const notifSnapshot = await notifQuery.get();
        if (!notifSnapshot.empty) {
            batch.delete(notifSnapshot.docs[0].ref);
        }

        try {
            await batch.commit();
            showAppModal({ text: `Set '${sharedSet.name || 'Onbekende Set'}' toegevoegd aan je collectie!` });
        } catch (error) {
            console.error("Failed to accept set:", error);
            showAppModal({ text: 'Importeren mislukt.' });
        }
    };

    const handleCreateSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.uid === 'guest-user') { showAppModal({ text: t('error_guest_action_not_allowed') }); return; }
        if (!newSetName.trim()) { showAppModal({ text: t('error_empty_set_name') }); return; }
        
        const docRef = await db.collection(`users/${userId}/flashcardDecks`).add({ name: newSetName, subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 });
        const newSet = { id: docRef.id, name: newSetName, subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0, isShared: false };
        
        showAppModal({ text: t('set_added_success') });
        setNewSetName('');
        setSelectedSet(newSet);
        setView('manage');
    };
    
    const handleDeleteSet = async (set: FlashcardSet) => {
        showAppModal({ text: t('confirm_delete_set', { name: set.name }),
            confirmAction: async () => {
                const batch = db.batch();
                const setRef = db.doc(`users/${userId}/flashcardDecks/${set.id}`);
                const cardsQuery = db.collection(`users/${userId}/flashcardDecks/${set.id}/cards`);
                
                try {
                    const cardsSnapshot = await cardsQuery.get();
                    cardsSnapshot.forEach(cardDoc => batch.delete(cardDoc.ref));
                    batch.delete(setRef);
                    await batch.commit();
                } catch (error: any) {
                    showAppModal({ text: `Failed to delete set: ${error.message}`});
                    return;
                }
                showAppModal({ text: t('set_deleted_success') });
            },
            cancelAction: () => {}
        });
    };
    
    const handleCombine = async () => {
        if (selectedSetIds.length < 2) {
            showAppModal({ text: t('error_select_min_two_sets') });
            return;
        }

        setIsCombiningLoading(true);
        showAppModal({ text: t('flashcards_creating_message') });

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            let combinedCards: Flashcard[] = [];
            for (const setId of selectedSetIds) {
                const set = allSets.find(s => s.id === setId);
                if (!set) continue;

                const cardsSnapshot = await db.collection(`users/${userId}/flashcardDecks/${setId}/cards`).get();
                const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard));
                combinedCards.push(...cards);
            }
    
            const combinedSet: FlashcardSet = {
                id: 'combined-' + Date.now(),
                name: t('combined_set_name', { count: selectedSetIds.length }),
                subject, ownerId: userId, createdAt: Timestamp.now(),
                cardCount: combinedCards.length,
                isCombined: true,
                combinedFrom: selectedSetIds,
                cards: combinedCards
            };
            
            setSelectedSet(combinedSet);
            setView('mode-selection');

        } catch (error: any) {
             showAppModal({ text: `Failed to combine sets: ${error.message}`});
        } finally {
            setIsCombiningLoading(false);
        }
    };

    const toggleSetSelection = (setId: string) => {
        setSelectedSetIds(prev => prev.includes(setId) ? prev.filter(id => id !== setId) : [...prev, setId]);
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
             <div className="flex justify-between items-center flex-wrap gap-2">
                <button onClick={onBack} title={t('back_to_subjects_selection')} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
                <h3 className="font-bold text-xl flex-grow text-center">{t('sets_for_subject', { subject: tSubject(subject) })}</h3>
                <div className="w-9 h-9"></div> {/* Placeholder for centering */}
            </div>
             <div className="flex gap-2">
                <form onSubmit={handleCreateSet} className="flex-grow flex gap-2">
                    <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder={t('set_name_placeholder')} className="flex-grow p-2 border rounded-lg"/>
                    <button type="submit" className={`flex items-center justify-center text-white font-bold p-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-12`}><PlusCircle size={20}/></button>
                </form>
                 {!isCombining ? (
                    <button onClick={() => setIsCombining(true)} className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 font-semibold p-2 rounded-lg w-12" title={t('select_button')}>
                        <Layers size={20}/>
                    </button>
                ) : null}
            </div>

            {isCombining ? (
                <div className="flex gap-2 justify-center p-2 bg-gray-100 rounded-lg">
                    <button onClick={handleCombine} disabled={isCombiningLoading} className={`font-semibold text-sm py-2 px-3 rounded-lg text-white ${getThemeClasses('bg')} flex items-center gap-2`}>
                        {isCombiningLoading && <Loader2 size={16} className="animate-spin" />}
                        {t('combine_and_study')} ({selectedSetIds.length})
                    </button>
                    <button onClick={() => { setIsCombining(false); setSelectedSetIds([]); }} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200">{t('cancel_button')}</button>
                </div>
            ) : null}

            {incomingSets.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-bold text-lg">Inkomende Gedeelde Sets</h4>
                    {incomingSets.map(set => (
                         <div key={set.id} className={`bg-indigo-50 p-3 rounded-lg shadow-md border-l-4 border-indigo-400 flex items-center justify-between`}>
                            <div>
                                <h4 className="font-bold text-indigo-800">{set.name}</h4>
                                <p className="text-xs text-indigo-600">{t('shared_by', { name: set.sharerName })}</p>
                            </div>
                            <button onClick={() => handleAcceptSet(set)} className="flex items-center gap-1 font-semibold text-sm bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-3 rounded-lg transition-colors">
                                <DownloadCloud size={16} /> Accepteren
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isLoading ? <div className="text-center p-8"><Loader2 className="animate-spin mx-auto" /></div> : 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allSets.length === 0 ? <p className="text-center italic text-gray-500 py-8 md:col-span-2">{t('no_sets_found')}</p> :
                 allSets.map(set => (
                    <div key={set.id} onClick={() => isCombining ? toggleSetSelection(set.id) : null} className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden ${isCombining ? 'cursor-pointer' : ''} ${selectedSetIds.includes(set.id) ? `ring-2 ${getThemeClasses('ring')}` : ''}`}>
                        <div className="p-4 flex-grow">
                            <div className="flex justify-between items-start">
                                <div onClick={(e) => { if (isCombining) e.stopPropagation(); else { setSelectedSet(set); setView('mode-selection'); }}} className="cursor-pointer flex-grow pr-2">
                                    <h4 className="font-bold text-lg text-gray-800 truncate">{set.name}</h4>
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${getThemeClasses('text')}`}>{tSubject(set.subject)}</p>
                                    {set.isShared && <p className="text-xs text-gray-500 mt-1">{t('shared_by', { name: set.sharerName })}</p>}
                                </div>
                                {!isCombining && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!set.isShared && <button onClick={(e) => { e.stopPropagation(); onShare(set); }} className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors" title={t('share_button')}><Share2 className="w-4 h-4"/></button>}
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSet(set); }} className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors" title={t('confirm_delete_set', {name: set.name})}><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center text-sm">
                            <div className={`font-semibold ${getThemeClasses('text')}`}>{t('cards_in_set', { count: set.cardCount || 0 })}</div>
                            <button onClick={() => { setSelectedSet(set); setView('manage'); }} className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900 transition-colors"><Settings size={14}/> {t('manage_cards')}</button>
                        </div>
                    </div>
                ))}
            </div>}
        </div>
    );
};

const ModeSelectionView = ({ set: currentSet, onStartSession, onBack, ...props }: any) => {
    const { getThemeClasses, t, showAppModal, userId } = props;

    const handleResetProgress = () => {
        showAppModal({
            text: t('reset_srs_confirm'),
            confirmAction: async () => {
                const batch = db.batch();
                const cardsRef = db.collection(`users/${userId}/flashcardDecks/${currentSet.id}/cards`);
                const snapshot = await cardsRef.get();
                snapshot.forEach(cardDoc => batch.update(cardDoc.ref, { dueDate: Timestamp.now(), interval: 0, easeFactor: 2.5 }));
                await batch.commit();
                showAppModal({text: "Progress reset."});
            },
            cancelAction: () => {}
        });
    };
    
    const modes = [
        { id: 'learn', title: t('study_mode_learn_title'), desc: t('study_mode_learn_desc'), icon: <Brain/> },
        { id: 'cram', title: t('study_mode_cram_title'), desc: t('study_mode_cram_desc'), icon: <BarChart/> },
        { id: 'mc', title: t('study_mode_mc_title'), desc: t('study_mode_mc_desc'), icon: <FileQuestion/> },
        { id: 'vocab', title: t('study_mode_vocab_title'), desc: t('study_mode_vocab_desc'), icon: <TypeIcon/> }
    ];

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
                <h3 className="font-bold text-xl flex-grow text-center truncate">{currentSet.name}</h3>
                {!(currentSet.isShared || currentSet.isCombined) && <button onClick={handleResetProgress} title={t('reset_srs_progress')} className="p-2 text-gray-500 hover:bg-orange-100 hover:text-orange-600 rounded-full transition-colors"><RotateCcw size={16}/></button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modes.map(mode => (
                    <button key={mode.id} onClick={() => onStartSession(mode.id)} className="bg-white p-6 rounded-lg shadow-md text-left hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                        <div className="flex items-center gap-3 mb-2">
                           <div className={`p-2 rounded-full ${getThemeClasses('bg-light')}`}>{React.cloneElement(mode.icon, { className: `w-6 h-6 ${getThemeClasses('text')}`})}</div>
                           <h4 className="font-bold text-lg">{mode.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600">{mode.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ====================================================================
// MAIN COMPONENT
// ====================================================================

const FlashcardsView: React.FC<FlashcardsViewProps> = (props) => {
  const { setIsSessionActive, initialContext } = props;
  const [view, setView] = useState<ViewType>(initialContext?.set ? 'mode-selection' : 'subject-list');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialContext?.set?.subject || null);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(initialContext?.set || null);
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [setForSharing, setSetForSharing] = useState<FlashcardSet | null>(null);

  useEffect(() => {
    const sessionViews = ['learn', 'cram', 'mc', 'vocab', 'summary', 'all-learned'];
    setIsSessionActive?.(sessionViews.includes(view));
  }, [view, setIsSessionActive]);

  const handleSessionComplete = (summary: SessionSummary) => {
    setLastSessionSummary(summary);
    if (summary.earnedStars > 0) {
        props.onProfileUpdate({ totalStars: increment(summary.earnedStars) as any });
    }
    setView('summary');
  };
  
  const handleStartSession = (mode: ViewType) => {
    if (selectedSet?.cardCount === 0 || (selectedSet?.isCombined && selectedSet?.cards?.length === 0)) {
        props.showAppModal({ text: props.t('no_flashcards_found') });
        return;
    }
    
    const minCards: { [key: string]: number } = {
        'mc': 2,
        'vocab': 1
    };

    if (minCards[mode] && selectedSet!.cardCount < minCards[mode]) {
        props.showAppModal({ text: props.t(mode === 'mc' ? 'error_flashcard_set_min_cards' : 'error_vocab_set_min_cards') });
        return;
    }

    setView(mode);
  }

  const openShareModal = (set: FlashcardSet) => {
    setSetForSharing(set);
    setIsShareModalOpen(true);
  };
  
  const handleExitSession = () => {
    props.showAppModal({
        text: props.t('exit_session_confirm'),
        confirmAction: () => {
            setView('mode-selection');
        },
        cancelAction: () => {}
    });
  }

  const Views: { [key: string]: React.ReactNode } = {
    'subject-list': <SubjectSelectionForFlashcards {...props} onSelectSubject={(subject) => { setSelectedSubject(subject); setView('set-list'); }} />,
    'set-list': selectedSubject && <SetListView {...props} subject={selectedSubject} setSelectedSet={setSelectedSet} setView={setView} onBack={() => { setView('subject-list'); setSelectedSubject(null); }} onShare={openShareModal} />,
    'mode-selection': selectedSet && <ModeSelectionView set={selectedSet} onStartSession={handleStartSession} onBack={() => setView('set-list')} {...props} />,
    manage: selectedSet && <CardManagerView {...props} set={selectedSet} onBack={() => setView(selectedSet.isCombined ? 'set-list' : 'mode-selection')} />,
    learn: selectedSet && <LearnSessionView {...props} set={selectedSet} onExit={handleExitSession} onSessionComplete={handleSessionComplete}/>,
    cram: selectedSet && <CramSessionView {...props} set={selectedSet} onExit={handleExitSession} onSessionComplete={handleSessionComplete}/>,
    mc: selectedSet && <MultipleChoiceSessionView {...props} set={selectedSet} onExit={handleExitSession} onSessionComplete={handleSessionComplete}/>,
    vocab: selectedSet && <VocabSessionView {...props} set={selectedSet} onExit={handleExitSession} onSessionComplete={handleSessionComplete}/>,
    summary: selectedSet && lastSessionSummary && <SessionSummaryView {...props} set={selectedSet} summary={lastSessionSummary} setView={setView} onBack={() => setView('mode-selection')} onStartSession={handleStartSession} setSelectedSet={setSelectedSet} />,
    'all-learned': selectedSet && <AllCardsLearnedView {...props} set={selectedSet} setView={setView} />
  }

  return (
    <div className="animate-fade-in">
      {setForSharing && <ShareSetModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} set={setForSharing} {...props}/>}
      {Views[view]}
    </div>
  );
};

export default FlashcardsView;