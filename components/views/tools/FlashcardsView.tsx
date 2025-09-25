import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, appId, Timestamp, increment } from '../../../services/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import type { Flashcard, FlashcardSet, AppUser, ModalContent, SessionSummary, SessionAnswer } from '../../../types';
import { PlusCircle, Trash2, ArrowLeft, Save, BookOpen, Settings, Brain, BarChart, RotateCcw, X, Check, Loader2, FileQuestion, Star, Layers, Sparkles, Share2, ChevronDown, Folder, Type as TypeIcon, Globe, Calculator, Atom, FlaskConical, Dna, ScrollText, AreaChart, Users, Languages, Code, Paintbrush, Music, Dumbbell, Film, CheckCircle, Send } from 'lucide-react';
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

const StudyCardLayout: React.FC<{
    card: Flashcard;
    isFlipped: boolean;
    setIsFlipped: (flipped: boolean) => void;
    progressPercentage: number;
    set: FlashcardSet;
    onExit: () => void;
    t: (key: string, replacements?: any) => string;
    getThemeClasses: (variant: string) => string;
    cardsRemainingText: string;
    children: React.ReactNode;
}> = ({ card, isFlipped, setIsFlipped, progressPercentage, set, onExit, t, getThemeClasses, cardsRemainingText, children }) => {
    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} flex flex-col items-center space-y-4`} style={{ minHeight: '70vh' }}>
            <style>{`.backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }`}</style>
            
            <div className="w-full max-w-lg">
                <div className="w-full flex justify-between items-center mb-2">
                     <h3 className="font-bold text-xl text-center flex-grow truncate">{set.name}</h3>
                    <button onClick={onExit} className="p-2 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0"><X/></button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                    <div className={`${getThemeClasses('bg')} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <div className="font-semibold text-sm text-center text-gray-600">{cardsRemainingText}</div>
            </div>
            
            <div className="w-full max-w-lg flex-grow flex flex-col justify-center items-center">
                <div 
                    className={`relative w-full aspect-[2/1] cursor-pointer transition-transform duration-300`} 
                    style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : '' }}
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    <div className="absolute inset-0 bg-white rounded-xl shadow-lg flex items-center justify-center p-6 text-center text-xl font-semibold backface-hidden">
                        {card?.question}
                    </div>
                    <div className="absolute inset-0 bg-white rounded-xl shadow-lg flex items-center justify-center p-6 text-center text-lg text-gray-700 backface-hidden" style={{ transform: 'rotateY(180deg)'}}>
                        {card?.answer}
                    </div>
                </div>
            </div>
            
            <div className="w-full max-w-lg">
                {children}
            </div>
        </div>
    );
};

const NoCardsFoundView: React.FC<any> = ({ setView, t, getThemeClasses }) => (
    <div className="text-center p-8">
        <h3 className="text-xl font-bold">{t('no_flashcards_found')}</h3>
        <p className="text-gray-600 my-4">{t('add_cards_to_start', { default: "Add some cards to this set to start studying!"})}</p>
        <button onClick={() => setView('manage')} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
            {t('manage_cards')}
        </button>
    </div>
);

const AllCardsLearnedView: React.FC<any> = ({ set, setView, t, getThemeClasses }) => (
    <div className={`p-8 rounded-lg shadow-inner ${getThemeClasses('bg-light')} text-center`}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold">{t('all_cards_learned_title')}</h3>
        <p className="text-gray-600 my-4">{t('all_cards_learned_desc')}</p>
        <div className="flex justify-center gap-4">
            <button onClick={() => setView('mode-selection')} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('choose_other_method_button')}</button>
            <button onClick={() => setView('learn')} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('reset_and_start_over_button')}</button>
        </div>
    </div>
);

const SessionSummaryView: React.FC<any> = ({ set, summary, setView, onBack, onStartSession, setSelectedSet, ...props }) => {
    const { t, getThemeClasses, userId } = props;
    const { stats, answers, earnedStars } = summary;
    const incorrectAnswers = useMemo(() => answers.filter((a: SessionAnswer) => !a.isCorrect), [answers]);
    
    const formatDuration = (ms: number) => {
        const totalSeconds = Math.round(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };
    const duration = formatDuration(stats.endTime - stats.startTime);


    const handlePracticeIncorrect = () => {
        if (incorrectAnswers.length === 0) return;
        const incorrectCards = incorrectAnswers.map((a: SessionAnswer) => a.card);
        const newSet: FlashcardSet = {
            ...set,
            id: `practice-${set.id}-${Date.now()}`,
            name: `${set.name} - Incorrect`,
            cardCount: incorrectCards.length,
            isCombined: true,
            cards: incorrectCards
        };
        setSelectedSet(newSet);
        onStartSession('learn');
    };
    
    const handleCreateSetFromIncorrect = async () => {
        if (incorrectAnswers.length === 0) return;
        const newSetName = prompt(t('new_set_name_prompt'), `${set.name} - Practice`);
        if (!newSetName) return;

        const batch = db.batch();
        const setRef = db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).doc();
        batch.set(setRef, {
            name: newSetName,
            subject: set.subject,
            ownerId: userId,
            createdAt: Timestamp.now(),
            cardCount: incorrectAnswers.length
        });
        
        incorrectAnswers.forEach((answer: SessionAnswer) => {
            const cardRef = db.collection(`artifacts/${appId}/public/data/flashcards`).doc();
            const cardData: Partial<Flashcard> = { ...answer.card };
            delete cardData.id;
            batch.set(cardRef, { ...cardData, setId: setRef.id });
        });
        
        await batch.commit();
        props.showAppModal({ text: t('new_set_created_success', { name: newSetName }) });
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
                <h3 className="font-bold text-xl">{t('session_summary_title')}</h3>
                <div></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                 {earnedStars > 0 && (
                    <div className="mb-4">
                        <h4 className="font-bold text-lg">{t('stars_earned_title')}</h4>
                        <div className="flex justify-center items-center text-yellow-500">
                            {[...Array(earnedStars)].map((_, i) => <Star key={i} className="w-8 h-8 fill-current" />)}
                        </div>
                    </div>
                )}
                <h4 className="font-bold text-lg">{t('your_score', { correct: stats.correct, total: stats.total })}</h4>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-green-100 p-3 rounded-lg"><p className="text-green-800 font-bold text-2xl">{stats.correct}</p><p className="text-sm">{t('correct_answers')}</p></div>
                    <div className="bg-red-100 p-3 rounded-lg"><p className="text-red-800 font-bold text-2xl">{stats.incorrect}</p><p className="text-sm">{t('incorrect_answers')}</p></div>
                    <div className="bg-blue-100 p-3 rounded-lg"><p className="text-blue-800 font-bold text-2xl">{duration}</p><p className="text-sm">{t('time_spent')}</p></div>
                </div>
            </div>
            
            {incorrectAnswers.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow-md">
                     <h4 className="font-bold mb-2">{t('practice_incorrect')}</h4>
                     <div className="space-y-2 max-h-48 overflow-y-auto">
                        {incorrectAnswers.map((answer: SessionAnswer, index: number) => (
                            <div key={index} className="p-2 bg-red-50 rounded-md">
                                <p className="font-semibold text-sm">{answer.card.question}</p>
                                {answer.userAnswer && <p className="text-xs text-red-700"><b>{t('your_answer')}:</b> {answer.userAnswer}</p>}
                                <p className="text-xs text-green-700"><b>{t('correct_answer')}:</b> {answer.card.answer}</p>
                            </div>
                        ))}
                     </div>
                     <div className="flex gap-2 mt-4">
                         <button onClick={handlePracticeIncorrect} className={`w-full py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')}`}>{t('practice_incorrect')}</button>
                         <button onClick={handleCreateSetFromIncorrect} className="w-full py-2 px-4 rounded-lg bg-gray-200 font-semibold">{t('create_set_from_incorrect')}</button>
                     </div>
                </div>
            )}
             <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setView('mode-selection')} className="w-full py-2 px-4 rounded-lg bg-gray-200 font-bold">{t('choose_other_method_button')}</button>
                <button onClick={() => onStartSession('learn')} className="w-full py-2 px-4 rounded-lg bg-white shadow-md font-bold">{t('study_again_button')}</button>
             </div>
        </div>
    );
};

const congratulations = [ 'Correct!', 'Great job!', 'Awesome!', 'You got it!', 'Perfect!', 'Well done!' ];

const VocabSessionView = ({ set: currentSet, onSessionComplete, onExit, ...props}: any) => {
    const { t, getThemeClasses, showAppModal } = props;
    const [allCards, setAllCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [userAnswer, setUserAnswer] = useState('');
    const [feedbackText, setFeedbackText] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNextButton, setShowNextButton] = useState(false);
    const startTime = useRef(Date.now());
    
    const card = useMemo(() => sessionQueue[0], [sessionQueue]);

    useEffect(() => {
        const fetchCards = async () => {
            let fetchedCards: Flashcard[];
            if (currentSet.isCombined) {
                fetchedCards = currentSet.cards;
            } else {
                const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await q.get();
                fetchedCards = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard));
            }
             if (fetchedCards.length < 1) {
                showAppModal({ text: t('error_vocab_set_min_cards') });
                onExit();
                return;
            }
            setAllCards(fetchedCards);
            setSessionQueue(shuffleArray([...fetchedCards]));
            setIsLoading(false);
        };
        fetchCards().catch(() => showAppModal({text: t('error_failed_to_load_cards')}));
    }, [currentSet, showAppModal, t, onExit]);

    const handleNext = () => {
        setShowNextButton(false);
        setFeedbackText(null);
        setUserAnswer('');
        if (sessionQueue.length === 1) {
            const stats = { correct: sessionAnswers.filter(a=>a.isCorrect).length, incorrect: sessionAnswers.filter(a=>!a.isCorrect).length, total: sessionAnswers.length, startTime: startTime.current, endTime: Date.now() };
            onSessionComplete({ stats, answers: sessionAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        } else {
            setSessionQueue(q => q.slice(1));
        }
    };

    const handleAnswerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userAnswer.trim() || showNextButton) return;
        
        let isCorrect = userAnswer.trim().toLowerCase() === card.answer.trim().toLowerCase();
        
        if (!isCorrect && process.env.API_KEY) {
            setIsChecking(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `The flashcard question is "${card.question}". The stored correct answer is "${card.answer}". First, extract the primary term(s) from the stored answer, ignoring any explanations in parentheses or after commas. Then, evaluate if the user's answer, "${userAnswer}", is a correct translation, a valid synonym, or matches one of the primary terms. Respond with only "YES" or "NO".`;
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                if (response.text.trim().toUpperCase() === 'YES') {
                    isCorrect = true;
                }
            } catch (err) {
                console.error(err);
                showAppModal({text: t('error_ai_check_failed')});
            } finally {
                setIsChecking(false);
            }
        }
        
        setFeedbackText(isCorrect ? congratulations[Math.floor(Math.random() * congratulations.length)] : `${t('ai_feedback_incorrect', { correct_answer: card.answer })}`);
        setSessionAnswers(prev => [...prev, { card, userAnswer, isCorrect }]);
        setShowNextButton(true);
    };
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    const currentIndex = allCards.length - sessionQueue.length;
    const progressPercentage = allCards.length > 0 ? (((currentIndex + 1) / allCards.length) * 100) : 0;

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} flex flex-col items-center space-y-4`} style={{ minHeight: '70vh' }}>
             <div className="w-full max-w-lg">
                <div className="w-full flex justify-between items-center mb-2">
                     <h3 className="font-bold text-xl text-center flex-grow truncate">{currentSet.name}</h3>
                    <button onClick={onExit} className="p-2 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0"><X/></button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                    <div className={`${getThemeClasses('bg')} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <div className="font-semibold text-sm text-center text-gray-600">{t('cards_to_go_counter', { current: currentIndex + 1, total: allCards.length })}</div>
            </div>

            <div className="w-full max-w-lg flex-grow flex flex-col justify-center items-center">
                <div className="w-full aspect-[2/1] bg-white rounded-xl shadow-lg flex items-center justify-center p-6 text-center text-xl font-semibold">
                    {card?.question}
                </div>
            </div>
            
            <div className="w-full max-w-lg space-y-4">
                 {!showNextButton ? (
                    <form onSubmit={handleAnswerSubmit}>
                        <div className="flex gap-2">
                            <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder={t('your_answer')} className="w-full p-2 border rounded-lg h-12" disabled={isChecking}/>
                            <button type="submit" disabled={!userAnswer.trim() || isChecking} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-32 h-12 flex justify-center items-center`}>
                            {isChecking ? <Loader2 className="animate-spin"/> : t('submit_answer')}
                            </button>
                        </div>
                    </form>
                 ) : null }
                
                {feedbackText && (
                    <div className={`p-3 rounded-lg text-center font-bold animate-fade-in ${feedbackText.includes(t('ai_feedback_incorrect', {correct_answer: ''}).split(" ")[0]) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {feedbackText}
                    </div>
                )}
                
                {showNextButton && (
                     <button onClick={handleNext} className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('next_card')}</button>
                )}
            </div>
        </div>
    );
};

const AIGenerateCardsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (topic: string, text: string) => Promise<void>;
    isGenerating: boolean;
    getThemeClasses: (variant: string) => string;
    t: (key: string) => string;
}> = ({ isOpen, onClose, onGenerate, isGenerating, getThemeClasses, t }) => {
    const [topic, setTopic] = useState('');
    const [aiInput, setAiInput] = useState('');

    if (!isOpen) return null;

    const handleGenerateClick = () => {
        onGenerate(topic, aiInput).then(() => {
            setTopic('');
            setAiInput('');
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg space-y-4 animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-purple-500"/> {t('flashcard_ai_modal_title')}</h3>
                <p className="text-sm text-gray-600">{t('flashcard_ai_modal_desc')}</p>
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t('flashcard_ai_topic_placeholder')}
                    className="w-full p-2 border rounded-lg"
                    disabled={isGenerating}
                />
                <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    rows={8}
                    className="w-full p-2 border rounded-lg"
                    placeholder={t('flashcard_ai_placeholder')}
                    disabled={isGenerating}
                />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
                    <button onClick={handleGenerateClick} disabled={isGenerating || !aiInput.trim()} className={`py-2 px-4 rounded-lg text-white font-bold bg-purple-500 hover:bg-purple-600 w-48 flex justify-center items-center disabled:opacity-50`}>
                        {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('generating')}</> : t('generate_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

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
    manage: selectedSet && <CardManagerView {...props} set={selectedSet} onBack={() => setView(selectedSet.isShared ? 'set-list' : 'mode-selection')} />,
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

const SubjectSelectionForFlashcards: React.FC<any> = ({ onSelectSubject, ...props }) => {
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
    const [sharedSets, setSharedSets] = useState<FlashcardSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSetName, setNewSetName] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const [isCombiningLoading, setIsCombiningLoading] = useState(false);
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    
    const allSets = useMemo(() => [...ownedSets, ...sharedSets], [ownedSets, sharedSets]);

    useEffect(() => {
        if (user.uid === 'guest-user') { 
            setIsLoading(false); 
            return; 
        }
        
        setIsLoading(true);
        const ownedSetsQuery = db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).where('subject', '==', subject).orderBy('createdAt', 'desc');
        const sharedSetsQuery = db.collection(`artifacts/${appId}/public/data/sharedSets`).where('recipientEmail', '==', user.email).where('subject', '==', subject);

        const unsubOwned = ownedSetsQuery.onSnapshot(snap => {
            const owned = snap.docs.map(d => ({ id: d.id, ...d.data() } as FlashcardSet));
            setOwnedSets(owned);
            setIsLoading(false); // Set loading to false after the primary query returns.
        }, err => { 
            console.error("Error fetching owned sets:", err); 
            setIsLoading(false); 
        });

        const unsubShared = sharedSetsQuery.onSnapshot(snap => {
            const shared = snap.docs.map(d => {
                const data = d.data();
                return { id: data.setId, name: data.setName, subject: data.subject, ownerId: data.sharerId, cardCount: data.cardCount || 0, createdAt: data.createdAt, isShared: true, sharerName: data.sharerName } as FlashcardSet
            });
            setSharedSets(shared);
        }, err => console.error("Error fetching shared sets:", err));

        return () => { unsubOwned(); unsubShared(); };
    }, [userId, user.email, user.uid, subject]);

    const handleCreateSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.uid === 'guest-user') { showAppModal({ text: t('error_guest_action_not_allowed') }); return; }
        if (!newSetName.trim()) { showAppModal({ text: t('error_empty_set_name') }); return; }
        
        const docRef = await db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).add({ name: newSetName, subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 });
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
                const setRef = db.doc(`artifacts/${appId}/users/${userId}/flashcardDecks/${set.id}`);
                const cardsQuery = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', set.id);
                const cardsSnapshot = await cardsQuery.get();
                cardsSnapshot.forEach(cardDoc => batch.delete(cardDoc.ref));
                batch.delete(setRef);
                await batch.commit();
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

        const cardPromises = selectedSetIds.map(setId => {
            const set = allSets.find(s => s.id === setId);
            if (set?.isShared) {
                 return db.collection(`artifacts/${appId}/public/data/flashcards`).where('ownerId', '==', set.ownerId).where('setId', '==', setId).get();
            }
            return db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', setId).get();
        });
        const cardSnapshots = await Promise.all(cardPromises);
        const combinedCards = cardSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard)));

        const combinedSet: FlashcardSet = {
            id: 'combined-' + Date.now(),
            name: t('combined_set_name', { count: selectedSetIds.length }),
            subject, ownerId: userId, createdAt: Timestamp.now(),
            cardCount: combinedCards.length,
            isCombined: true,
            combinedFrom: selectedSetIds,
            cards: combinedCards
        };
        
        setIsCombiningLoading(false);
        setSelectedSet(combinedSet);
        setView('mode-selection');
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

            {isLoading ? <div className="text-center p-8"><Loader2 className="animate-spin" /></div> : 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allSets.length === 0 ? <p className="text-center italic text-gray-500 py-8 md:col-span-2">{t('no_sets_found')}</p> :
                 allSets.map(set => (
                    <div key={`${set.id}-${set.ownerId}`} onClick={() => isCombining ? toggleSetSelection(set.id) : null} className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden ${isCombining ? 'cursor-pointer' : ''} ${selectedSetIds.includes(set.id) ? `ring-2 ${getThemeClasses('ring')}` : ''}`}>
                        <div className="p-4 flex-grow">
                            <div className="flex justify-between items-start">
                                <div onClick={(e) => { if (isCombining) e.stopPropagation(); else { setSelectedSet(set); setView('mode-selection'); }}} className="cursor-pointer flex-grow pr-2">
                                    <h4 className="font-bold text-lg text-gray-800 truncate">{set.name}</h4>
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${getThemeClasses('text')}`}>{tSubject(set.subject)}</p>
                                    {set.isShared && <p className="text-xs text-gray-500 mt-1">{t('shared_by', { name: set.sharerName })}</p>}
                                </div>
                                {!set.isShared && !isCombining && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); onShare(set); }} className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors" title={t('share_button')}><Share2 className="w-4 h-4"/></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSet(set); }} className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors" title={t('confirm_delete_set', {name: set.name})}><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center text-sm">
                            <div className={`font-semibold ${getThemeClasses('text')}`}>{t('cards_in_set', { count: set.cardCount || 0 })}</div>
                            {!set.isShared && <button onClick={() => { setSelectedSet(set); setView('manage'); }} className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900 transition-colors"><Settings size={14}/> {t('manage_cards')}</button>}
                        </div>
                    </div>
                ))}
            </div>}
        </div>
    );
};

const ModeSelectionView = ({ set: currentSet, onStartSession, onBack, ...props }: any) => {
    const { getThemeClasses, t, showAppModal } = props;

    const handleResetProgress = () => {
        showAppModal({
            text: t('reset_srs_confirm'),
            confirmAction: async () => {
                const batch = db.batch();
                const cardsRef = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await cardsRef.get();
                snapshot.forEach(cardDoc => batch.update(cardDoc.ref, { dueDate: Timestamp.now(), interval: 0, easeFactor: 2.5 }));
                await batch.commit();
                showAppModal({text: "Progress reset."});
            },
            cancelAction: () => {}
        });
    };

    const studyModes = [
        { id: 'learn', title: t('study_mode_learn_title'), desc: t('study_mode_learn_desc'), icon: <Brain size={32} className={getThemeClasses('text')} /> },
        { id: 'cram', title: t('study_mode_cram_title'), desc: t('study_mode_cram_desc'), icon: <BarChart size={32} className={getThemeClasses('text')} /> },
        { id: 'mc', title: t('study_mode_mc_title'), desc: t('study_mode_mc_desc'), icon: <FileQuestion size={32} className={getThemeClasses('text')} /> },
        { id: 'vocab', title: t('study_mode_vocab_title'), desc: t('study_mode_vocab_desc'), icon: <TypeIcon size={32} className={getThemeClasses('text')} /> },
    ];
    
    return (
      <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
          <div className="flex justify-between items-center">
            <button onClick={onBack} title={currentSet.isCombined ? t('back_to_subjects_selection') : t('back_to_sets')} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
            {!currentSet.isShared && !currentSet.isCombined && <button onClick={handleResetProgress} className="text-xs font-semibold text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"><RotateCcw size={12}/>{t('reset_srs_progress')}</button>}
          </div>
          <h3 className="font-bold text-lg text-center">{t('choose_study_mode')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {studyModes.map(mode => (
                 <div key={mode.id} onClick={() => onStartSession(mode.id)} className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`p-4 rounded-full ${getThemeClasses('bg-light')} mb-4`}>{mode.icon}</div>
                  <h4 className="text-xl font-bold">{mode.title}</h4>
                  <p className="text-gray-600 text-sm mt-2 flex-grow">{mode.desc}</p>
                  <button className={`mt-4 w-full font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('start_session')}</button>
              </div>
              ))}
          </div>
      </div>
    );
};

const CardManagerView = ({ onBack, set: currentSet, ...props }: any) => {
    const { userId, t, getThemeClasses, showAppModal } = props;
    const [editableCards, setEditableCards] = useState<(Partial<Flashcard> & { isNew?: boolean })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

    useEffect(() => {
        if (currentSet.isCombined) {
            setEditableCards(currentSet.cards);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
        const unsubscribe = q.onSnapshot(snapshot => {
            const cards = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard));
            cards.sort((a, b) => (a.createdAt as any).toMillis() - (b.createdAt as any).toMillis());
            
            if (snapshot.empty) {
                const newRows = Array.from({ length: 5 }, (_, i) => ({ id: `new_${Date.now() + i}`, setId: currentSet.id, question: '', answer: '', isNew: true, ownerId: userId, createdAt: Timestamp.now() }));
                setEditableCards(newRows);
            } else {
                setEditableCards(cards);
            }
            setIsLoading(false);
        }, (error) => {
            showAppModal({text: t('error_failed_to_load_cards')});
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentSet, userId, showAppModal, t]);
    
    const handleGenerateWithAI = async (topic: string, textToParse: string) => {
        if (!process.env.API_KEY) return showAppModal({ text: t('error_missing_api_key') });
        if (!textToParse.trim()) return;
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are a flashcard creation assistant. The topic is "${topic}". Parse the following text into flashcards. If a line contains only a key term, create a question asking for its definition in the context of the topic, and provide the answer. For lines with a separator like ':', '-', create a standard question/answer pair. Text: \n\n${textToParse}`;
            
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash', contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] },
                },
              },
            });
            const jsonStr = response.text.trim();
            const generatedCards = JSON.parse(jsonStr).filter((c: any) => c.question?.trim() && c.answer?.trim());
            const newCards = generatedCards.map((c: any) => ({ ...c, id: `new_${Math.random()}`, setId: currentSet.id, isNew: true, ownerId: userId, createdAt: Timestamp.now() }));
            setEditableCards(prev => [...prev.filter(c => c.question?.trim() || c.answer?.trim()), ...newCards]);
        } catch (error) {
            showAppModal({ text: t('error_ai_parse_failed') });
        } finally {
            setIsGenerating(false);
            setIsAiModalOpen(false);
        }
    };

     const handleSaveCards = async () => {
        if (currentSet.isShared) return;
        const batch = db.batch();
        const setRef = db.doc(`artifacts/${appId}/users/${userId}/flashcardDecks/${currentSet.id}`);
        const cardsToAdd = editableCards.filter(c => c.isNew && c.question?.trim() && c.answer?.trim());
        
        cardsToAdd.forEach(card => {
            const cardRef = db.collection(`artifacts/${appId}/public/data/flashcards`).doc();
            batch.set(cardRef, { setId: currentSet.id, question: card.question, answer: card.answer, ownerId: userId, createdAt: Timestamp.now(), dueDate: Timestamp.now(), interval: 0, easeFactor: 2.5 });
        });

        editableCards.filter(c => !c.isNew).forEach(card => {
            const cardRef = db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`);
            batch.update(cardRef, { question: card.question, answer: card.answer });
        });
        
        if (cardsToAdd.length > 0) {
            batch.update(setRef, { cardCount: increment(cardsToAdd.length) });
        }
        await batch.commit();
        showAppModal({ text: t('flashcard_added_success') });
        onBack();
     };
     
    const handleCardChange = (id: string, field: 'question' | 'answer', value: string) => {
        setEditableCards(cards => cards.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleAddRow = () => setEditableCards(prev => [...prev, { id: `new_${Date.now()}`, setId: currentSet.id, question: '', answer: '', isNew: true, ownerId: userId, createdAt: Timestamp.now() }]);
    
    const handleDeleteCard = async (card: Partial<Flashcard> & { isNew?: boolean }) => {
        if (card.isNew) {
            setEditableCards(prev => prev.filter(c => c.id !== card.id));
        } else {
            showAppModal({
                text: t('confirm_delete_card'),
                confirmAction: async () => {
                    const setRef = db.doc(`artifacts/${appId}/users/${userId}/flashcardDecks/${currentSet.id}`);
                    await db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`).delete();
                    await setRef.update({ cardCount: increment(-1) });
                },
                cancelAction: () => {}
            });
        }
    };

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <AIGenerateCardsModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} onGenerate={handleGenerateWithAI} isGenerating={isGenerating} getThemeClasses={getThemeClasses} t={t} />
            <div className="flex justify-between items-center">
                <button onClick={onBack} title={t('back_to_sets')} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
                <h3 className="font-bold text-lg text-center">{t('add_flashcard')} - {currentSet.name}</h3>
                <div>{!currentSet.isShared && <button onClick={() => setIsAiModalOpen(true)} className="p-2 rounded-full text-purple-600 bg-purple-100 hover:bg-purple-200 transition-colors" title={t('flashcard_ai_modal_title')}><Sparkles size={20}/></button>}</div>
            </div>
            
            {isLoading ? <div className="text-center p-4"><Loader2 className="animate-spin"/></div> : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                    {editableCards.map((card, index) => (
                        <div key={card.id} className="flex items-start gap-2 bg-white p-2 rounded-lg shadow-sm">
                            <span className="font-semibold text-gray-400 pt-2">{index + 1}</span>
                            <div className="flex-grow space-y-1">
                                <textarea placeholder={t('question')} value={card.question} onChange={e => handleCardChange(card.id!, 'question', e.target.value)} className="w-full p-2 border rounded-md" rows={2} disabled={currentSet.isShared}/>
                                <textarea placeholder={t('answer')} value={card.answer} onChange={e => handleCardChange(card.id!, 'answer', e.target.value)} className="w-full p-2 border rounded-md" rows={2} disabled={currentSet.isShared}/>
                            </div>
                            {!currentSet.isShared && <button onClick={() => handleDeleteCard(card)} className="p-2 text-red-500 bg-red-100 hover:bg-red-200 rounded-md mt-2"><Trash2 size={16}/></button>}
                        </div>
                    ))}
                </div>
            )}

            {!currentSet.isShared && (
                <div className="flex justify-between items-center gap-4 pt-4 border-t">
                    <button onClick={handleAddRow} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95 text-sm">{t('add_more_rows')}</button>
                    <button onClick={handleSaveCards} className={`flex items-center gap-2 py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95`}><Save className="w-5 h-5"/> {t('save_all_cards')}</button>
                </div>
            )}
        </div>
     );
};


const CramSessionView = ({ set: currentSet, onSessionComplete, onExit, ...props }: any) => {
    const { t, getThemeClasses, showAppModal } = props;
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const startTime = useRef(Date.now());

    useEffect(() => {
        const fetchCards = async () => {
            if (currentSet.isCombined) {
                setCards(shuffleArray(currentSet.cards));
            } else {
                const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await q.get();
                setCards(shuffleArray(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard))));
            }
            setIsLoading(false);
        };
        fetchCards().catch(() => showAppModal({text: t('error_failed_to_load_cards')}));
    }, [currentSet, showAppModal, t]);

    const handleNext = () => {
        setSessionAnswers(prev => [...prev, { card: cards[currentIndex], isCorrect: true }]);
        setIsFlipped(false);
        setTimeout(() => {
             if (currentIndex + 1 >= cards.length) {
                const summary = { stats: { correct: cards.length, incorrect: 0, total: cards.length, startTime: startTime.current, endTime: Date.now() }, answers: [...sessionAnswers, { card: cards[currentIndex], isCorrect: true }], earnedStars: 5 };
                onSessionComplete(summary);
            } else {
                setCurrentIndex(i => i + 1);
            }
        }, 150);
    }
    
    const card = useMemo(() => cards[currentIndex], [cards, currentIndex]);
    const progressPercentage = cards.length > 0 ? (((currentIndex + 1) / cards.length) * 100) : 0;
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (cards.length === 0) return <NoCardsFoundView setView={(v:ViewType) => onExit()} t={t} getThemeClasses={getThemeClasses} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={progressPercentage} set={currentSet} onExit={onExit} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={t('cards_to_go_counter', { current: currentIndex + 1, total: cards.length })}>
        <div className="flex justify-center mt-4">
           <button onClick={handleNext} className={`w-full max-w-xs text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('next_card')}</button>
        </div>
    </StudyCardLayout>
};

const LearnSessionView = ({ set: currentSet, onSessionComplete, onExit, ...props}: any) => {
    const { t, getThemeClasses, showAppModal, setView } = props;
    const [dueCards, setDueCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const startTime = useRef(Date.now());

    useEffect(() => {
        const fetchCards = async () => {
            let fetchedCards: Flashcard[];
            if (currentSet.isCombined) {
                fetchedCards = shuffleArray(currentSet.cards);
            } else {
                const now = new Date();
                const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id).where('dueDate', '<=', Timestamp.fromDate(now)).orderBy('dueDate').limit(20);
                const snapshot = await q.get();
                fetchedCards = shuffleArray(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard)));
            }
            setDueCards(fetchedCards);
            setSessionQueue(fetchedCards);
            setIsLoading(false);
        };
        fetchCards().catch(() => showAppModal({text: t('error_failed_to_load_cards')}));
    }, [currentSet, showAppModal, t]);

    const updateCardSrs = async (card: Flashcard, knewIt: boolean) => {
        if (currentSet.isCombined || currentSet.isShared) return;
        const easeFactor = card.easeFactor || 2.5;
        let newInterval = knewIt ? (card.interval === 0 || card.interval === undefined ? 1 : (card.interval === 1 ? 6 : Math.ceil(card.interval * easeFactor))) : 1;
        let newEaseFactor = knewIt ? easeFactor : Math.max(1.3, easeFactor - 0.2);
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + newInterval);
        await db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`).update({ interval: newInterval, easeFactor: newEaseFactor, dueDate: Timestamp.fromDate(newDueDate) });
    };

    const handleFeedback = async (knewIt: boolean) => {
        if (!card) return;
        await updateCardSrs(card, knewIt);
        const newAnswers = [...sessionAnswers, { card, isCorrect: knewIt }];
        setSessionAnswers(newAnswers);
        
        if (sessionQueue.length === 1) {
            const stats = { correct: newAnswers.filter(a=>a.isCorrect).length, incorrect: newAnswers.filter(a=>!a.isCorrect).length, total: newAnswers.length, startTime: startTime.current, endTime: Date.now() };
            onSessionComplete({ stats, answers: newAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        } else {
            setIsFlipped(false);
            setTimeout(() => setSessionQueue(prev => prev.slice(1)), 150);
        }
    };

    const card = sessionQueue[0];
    const progressPercentage = dueCards.length > 0 ? (((dueCards.length - sessionQueue.length) / dueCards.length) * 100) : 0;

    useEffect(() => {
        if (!isLoading && dueCards.length > 0 && sessionQueue.length === 0) {
             const stats = { correct: sessionAnswers.filter(a=>a.isCorrect).length, incorrect: sessionAnswers.filter(a=>!a.isCorrect).length, total: sessionAnswers.length, startTime: startTime.current, endTime: Date.now() };
             onSessionComplete({ stats, answers: sessionAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        }
    }, [isLoading, sessionQueue, dueCards, onSessionComplete, sessionAnswers]);

    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (dueCards.length === 0) return <AllCardsLearnedView {...props} set={currentSet} setView={setView} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={progressPercentage} set={currentSet} onExit={onExit} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={t('cards_to_go', {count: sessionQueue.length})} >
         <div className="flex justify-around items-center mt-4">
            {isFlipped ? (
                <>
                    <button onClick={() => handleFeedback(false)} className="flex flex-col items-center gap-1 font-bold text-red-600 bg-red-100 rounded-lg py-3 px-6 transition-transform active:scale-90 hover:bg-red-200"><X size={24} /> {t('feedback_again')}</button>
                    <button onClick={() => handleFeedback(true)} className="flex flex-col items-center gap-1 font-bold text-green-600 bg-green-100 rounded-lg py-3 px-6 transition-transform active:scale-90 hover:bg-green-200"><Check size={24}/> {t('feedback_good')}</button>
                </>
            ) : ( <button onClick={() => setIsFlipped(true)} className={`w-full max-w-xs text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('show_answer')}</button> )}
        </div>
    </StudyCardLayout>
}

const MultipleChoiceSessionView = ({ set: currentSet, onSessionComplete, onExit, ...props }: any) => {
    const { t, getThemeClasses, showAppModal } = props;
    const [allCards, setAllCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [choices, setChoices] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNextButton, setShowNextButton] = useState(false);
    const startTime = useRef(Date.now());

    useEffect(() => {
        const fetchCards = async () => {
            let fetchedCards: Flashcard[];
            if (currentSet.isCombined) {
                fetchedCards = currentSet.cards;
            } else {
                const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await q.get();
                fetchedCards = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard));
            }
            if (fetchedCards.length < 2) {
                showAppModal({ text: t('error_flashcard_set_min_cards') });
                onExit();
                return;
            }
            setAllCards(fetchedCards);
            setSessionQueue(shuffleArray([...fetchedCards]));
            setIsLoading(false);
        };
        fetchCards().catch(() => showAppModal({text: t('error_failed_to_load_cards')}));
    }, [currentSet, showAppModal, t, onExit]);
    
    const card = useMemo(() => sessionQueue[0], [sessionQueue]);

    useEffect(() => {
        if(card && allCards.length > 1) {
            const distractors = shuffleArray(allCards.filter(c => c.id !== card.id)).slice(0, 3).map(c => c.answer);
            setChoices(shuffleArray([card.answer, ...distractors]));
        }
    }, [card, allCards]);

    const handleAnswer = (answer: string) => {
        if (feedback) return;
        const isCorrect = answer === card.answer;
        setSelectedChoice(answer);
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setSessionAnswers(prev => [...prev, { card, userAnswer: answer, isCorrect }]);
        setShowNextButton(true);
    };

    const handleNext = () => {
        setShowNextButton(false);
        setFeedback(null);
        setSelectedChoice(null);
        if (sessionQueue.length === 1) {
            const stats = { correct: sessionAnswers.filter(a=>a.isCorrect).length, incorrect: sessionAnswers.filter(a=>!a.isCorrect).length, total: sessionAnswers.length, startTime: startTime.current, endTime: Date.now() };
            onSessionComplete({ stats, answers: sessionAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        } else {
            setSessionQueue(q => q.slice(1));
        }
    };
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;

    const currentIndex = allCards.length - sessionQueue.length;
    const progressPercentage = allCards.length > 0 ? (((currentIndex + 1) / allCards.length) * 100) : 0;

    return (
        <StudyCardLayout
            card={card}
            isFlipped={false}
            setIsFlipped={() => {}}
            progressPercentage={progressPercentage}
            set={currentSet}
            onExit={onExit}
            t={t}
            getThemeClasses={getThemeClasses}
            cardsRemainingText={t('cards_to_go_counter', { current: currentIndex + 1, total: allCards.length })}
        >
            {showNextButton ? (
                <button onClick={handleNext} className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>{t('next_card')}</button>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {choices.map(choice => {
                        const isCorrectChoice = choice === card.answer;
                        const isSelectedChoice = choice === selectedChoice;
                        let buttonClass = 'bg-white hover:bg-gray-100';
                        if (feedback) {
                            if (isCorrectChoice) buttonClass = 'bg-green-200 border-green-400';
                            else if (isSelectedChoice) buttonClass = 'bg-red-200 border-red-400';
                            else buttonClass = 'bg-gray-100 opacity-60';
                        }
                        return (
                            <button
                                key={choice}
                                onClick={() => handleAnswer(choice)}
                                disabled={!!feedback}
                                className={`p-4 rounded-lg font-semibold text-center border-2 transition-all duration-300 ${buttonClass}`}
                            >
                                {choice}
                            </button>
                        );
                    })}
                </div>
            )}
        </StudyCardLayout>
    );
};
export default FlashcardsView;