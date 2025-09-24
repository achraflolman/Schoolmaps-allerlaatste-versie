


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, appId, Timestamp, increment } from '../../../services/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import type { Flashcard, FlashcardSet, AppUser, ModalContent, SessionSummary, SessionAnswer } from '../../../types';
import { PlusCircle, Trash2, ArrowLeft, Save, BookOpen, Settings, Brain, BarChart, RotateCcw, X, Check, Loader2, FileQuestion, Star, Layers, Sparkles, Share2, ChevronDown, Folder, Type as TypeIcon, Globe, Calculator, Atom, FlaskConical, Dna, ScrollText, AreaChart, Users, Languages, Code, Paintbrush, Music, Dumbbell, Film } from 'lucide-react';
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
}

type ViewType = 'subject-list' | 'set-list' | 'mode-selection' | 'manage' | 'learn' | 'cram' | 'mc' | 'vocab' | 'summary' | 'all-learned';

const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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

// --- Main Router Component ---
const FlashcardsView: React.FC<FlashcardsViewProps> = (props) => {
  const { setIsSessionActive } = props;
  const [view, setView] = useState<ViewType>('subject-list');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
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
    const [allSets, setAllSets] = useState<FlashcardSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSetName, setNewSetName] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const [isCombiningLoading, setIsCombiningLoading] = useState(false);
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    
    useEffect(() => {
        if (user.uid === 'guest-user') { setIsLoading(false); return; }
        
        const ownedSetsQuery = db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).where('subject', '==', subject).orderBy('createdAt', 'desc');
        const sharedSetsQuery = db.collection(`artifacts/${appId}/public/data/sharedSets`).where('recipientEmail', '==', user.email).where('subject', '==', subject);

        const unsubOwned = ownedSetsQuery.onSnapshot(snap => {
            const owned = snap.docs.map(d => ({ id: d.id, ...d.data() } as FlashcardSet));
            setAllSets(prev => [...owned, ...prev.filter(s => s.isShared)]);
            setIsLoading(false);
        }, err => { console.error(err); setIsLoading(false); });

        const unsubShared = sharedSetsQuery.onSnapshot(snap => {
            const shared = snap.docs.map(d => {
                const data = d.data();
                return { id: data.setId, name: data.setName, subject: data.subject, ownerId: data.sharerId, cardCount: data.cardCount || 0, createdAt: data.createdAt, isShared: true, sharerName: data.sharerName } as FlashcardSet
            });
            setAllSets(prev => [...shared, ...prev.filter(s => !s.isShared)]);
        }, err => console.error(err));

        return () => { unsubOwned(); unsubShared(); };
    }, [userId, user.email, user.uid, subject]);

    const handleCreateSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.uid === 'guest-user') { showAppModal({ text: t('error_guest_action_not_allowed') }); return; }
        if (!newSetName.trim()) { showAppModal({ text: t('error_empty_set_name') }); return; }
        
        const docRef = await db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).add({ name: newSetName, subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 });
        const newSet = { id: docRef.id, name: newSetName, subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 };
        
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

        // Simulate a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        const cardPromises = selectedSetIds.map(setId => {
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
                <button onClick={onBack} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_subjects_selection')}</button>
                <h3 className="font-bold text-xl">{t('sets_for_subject', { subject: tSubject(subject) })}</h3>
                {isCombining ? (
                    <div className="flex gap-2">
                        <button onClick={handleCombine} disabled={isCombiningLoading} className={`font-semibold text-sm py-2 px-3 rounded-lg text-white ${getThemeClasses('bg')} flex items-center gap-2`}>
                            {isCombiningLoading && <Loader2 size={16} className="animate-spin" />}
                            {t('combine_and_study')} ({selectedSetIds.length})
                        </button>
                        <button onClick={() => { setIsCombining(false); setSelectedSetIds([]); }} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200">{t('cancel_button')}</button>
                    </div>
                ) : (
                    <button onClick={() => setIsCombining(true)} className="font-semibold text-sm py-2 px-3 rounded-lg bg-gray-200">{t('select_and_combine')}</button>
                )}
            </div>
             <form onSubmit={handleCreateSet} className="flex gap-2">
                <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder={t('set_name_placeholder')} className="flex-grow p-2 border rounded-lg"/>
                <button type="submit" className={`flex items-center justify-center text-white font-bold p-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-12`}><PlusCircle size={20}/></button>
            </form>

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
            <button onClick={onBack} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {currentSet.isCombined ? t('back_to_subjects_selection') : t('back_to_sets')}</button>
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
                <button onClick={onBack} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
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
                const summary = { stats: { correct: cards.length, incorrect: 0, total: cards.length, startTime: startTime.current, endTime: Date.now() }, answers: [...sessionAnswers, { card: cards[currentIndex], isCorrect: true }] };
                onSessionComplete({ ...summary, earnedStars: 5 });
            } else {
                setCurrentIndex(i => i + 1);
            }
        }, 150);
    }
    
    const card = useMemo(() => cards[currentIndex], [cards, currentIndex]);
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (cards.length === 0) return <NoCardsFoundView setView={(v:ViewType) => onExit()} t={t} getThemeClasses={getThemeClasses} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={0} set={currentSet} onExit={onExit} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={t('cards_to_go_counter', { current: currentIndex + 1, total: cards.length })}>
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

    useEffect(() => {
        if (!isLoading && dueCards.length > 0 && sessionQueue.length === 0) {
             const stats = { correct: sessionAnswers.filter(a=>a.isCorrect).length, incorrect: sessionAnswers.filter(a=>!a.isCorrect).length, total: sessionAnswers.length, startTime: startTime.current, endTime: Date.now() };
             onSessionComplete({ stats, answers: sessionAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        }
    }, [isLoading, sessionQueue, dueCards, onSessionComplete, sessionAnswers]);

    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (dueCards.length === 0) return <AllCardsLearnedView {...props} set={currentSet} setView={setView} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={0} set={currentSet} onExit={onExit} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={t('cards_to_go', {count: sessionQueue.length})} >
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
    const { t, getThemeClasses, showAppModal, setView } = props;
    const [allCards, setAllCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [choices, setChoices] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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
        const newAnswers = [...sessionAnswers, { card, userAnswer: answer, isCorrect }];
        setSessionAnswers(newAnswers);

        setTimeout(() => {
            setFeedback(null);
            setSelectedChoice(null);
            if (sessionQueue.length === 1) {
                const stats = { correct: newAnswers.filter(a=>a.isCorrect).length, incorrect: newAnswers.filter(a=>!a.isCorrect).length, total: newAnswers.length, startTime: startTime.current, endTime: Date.now() };
                onSessionComplete({ stats, answers: newAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
            } else {
                setSessionQueue(q => q.slice(1));
            }
        }, 1200);
    }
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;

    const currentIndex = allCards.length - sessionQueue.length;

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 flex flex-col`}>
             <div className="flex justify-between items-center">
                <button onClick={onExit} className="font-semibold flex items-center gap-1 hover:underline self-start"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
                <div className={`font-semibold ${getThemeClasses('text')}`}>{t('cards_to_go_counter', { current: currentIndex + 1, total: allCards.length })}</div>
             </div>
             <h3 className="font-bold text-center text-xl">{currentSet.name}</h3>
             <div className="bg-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center h-48"><p className="text-2xl font-semibold">{card?.question}</p></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {choices.map(choice => {
                    let feedbackClass = `${getThemeClasses('bg')} border-transparent hover:saturate-150`;
                    if (feedback && selectedChoice === choice) feedbackClass = feedback === 'correct' ? 'bg-green-500 border-green-600' : 'bg-red-500 border-red-600';
                    else if (feedback && choice === card?.answer) feedbackClass = 'bg-green-500 border-green-600';
                    else if (feedback) feedbackClass = 'bg-gray-400 border-gray-500 opacity-70';
                    return <button key={choice} onClick={() => handleAnswer(choice)} disabled={!!feedback} className={`p-4 rounded-lg font-semibold text-white shadow-md border-b-4 transition-all active:scale-95 disabled:cursor-not-allowed ${feedbackClass}`}>{choice}</button>
                })}
             </div>
        </div>
    );
};

const VocabSessionView = ({ set: currentSet, onSessionComplete, onExit, ...props }: any) => {
    const { t, getThemeClasses, showAppModal, user } = props;
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [feedback, setFeedback] = useState<{ isCorrect: boolean, text: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
    const startTime = useRef(Date.now());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchCards = async () => {
            if (currentSet.isCombined) setCards(shuffleArray(currentSet.cards));
            else {
                const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await q.get();
                setCards(shuffleArray(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard))));
            }
            setIsLoading(false);
        };
        fetchCards().catch(() => showAppModal({text: t('error_failed_to_load_cards')}));
    }, [currentSet, showAppModal, t]);

    const handleNext = () => {
        setFeedback(null);
        setUserAnswer('');
        if (currentIndex + 1 >= cards.length) {
            const stats = { correct: sessionAnswers.filter(a=>a.isCorrect).length, incorrect: sessionAnswers.filter(a=>!a.isCorrect).length, total: sessionAnswers.length, startTime: startTime.current, endTime: Date.now() };
            onSessionComplete({ stats, answers: sessionAnswers, earnedStars: calculateStars(stats.correct, stats.total) });
        } else {
            setCurrentIndex(i => i + 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userAnswer.trim() || isChecking || feedback) return;
        
        const currentCard = cards[currentIndex];
        const isSimpleCorrect = userAnswer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();
        
        if (isSimpleCorrect) {
            setFeedback({ isCorrect: true, text: t('feedback_good') });
            setSessionAnswers(prev => [...prev, { card: currentCard, userAnswer, isCorrect: true }]);
            setTimeout(handleNext, 1500);
            return;
        }

        setIsChecking(true);
        setFeedback(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are a helpful language tutor. Your task is to grade a user's answer for a flashcard. The correct answer is: "${currentCard.answer}". The user's answer is: "${userAnswer}". Please evaluate if the user's answer is correct. An answer is correct if it is an exact match, a common synonym, a close translation, or captures the essential meaning of the correct answer. If the correct answer contains text in parentheses, that part is optional. Be lenient with minor typos. Respond with ONLY the single word "CORRECT" or "INCORRECT". Do not provide any explanation.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { thinkingConfig: { thinkingBudget: 0 } } });
            const resultText = response.text.trim().toUpperCase();
            const isCorrect = resultText.includes('CORRECT');
            setFeedback({ isCorrect, text: isCorrect ? t('feedback_good') : t('ai_feedback_incorrect', { correct_answer: currentCard.answer }) });
            setSessionAnswers(prev => [...prev, { card: currentCard, userAnswer, isCorrect }]);
            setTimeout(handleNext, 2000);
        } catch (error) {
            showAppModal({ text: t('error_ai_check_failed') });
        } finally {
            setIsChecking(false);
        }
    };
    
    useEffect(() => { inputRef.current?.focus(); }, [currentIndex]);

    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (cards.length === 0) return <NoCardsFoundView setView={(v:ViewType) => onExit()} t={t} getThemeClasses={getThemeClasses} />;
    
    const card = cards[currentIndex];
    
    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 flex flex-col`}>
             <div className="flex justify-between items-center">
                <button onClick={onExit} className="font-semibold flex items-center gap-1 hover:underline self-start"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
                <div className={`font-semibold ${getThemeClasses('text')}`}>{t('cards_to_go_counter', { current: currentIndex + 1, total: cards.length })}</div>
             </div>
             <h3 className="font-bold text-center text-xl">{currentSet.name}</h3>
             <div className="bg-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center h-48"><p className="text-2xl font-semibold">{card?.question}</p></div>
             <form onSubmit={handleSubmit} className="mt-2 space-y-3">
                <input ref={inputRef} type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder={t('your_answer')} className="w-full p-3 border rounded-lg text-center" disabled={isChecking || !!feedback} />
                <button type="submit" disabled={isChecking || !!feedback || !userAnswer.trim()} className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 flex items-center justify-center`}>
                    {isChecking ? <Loader2 className="w-5 h-5 animate-spin"/> : t('submit_answer')}
                </button>
             </form>
             {feedback && <div className={`mt-2 p-2 rounded-md text-center font-semibold text-sm ${feedback.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{feedback.text}</div>}
        </div>
    );
};

// --- Reusable UI Components for Study Sessions ---
const StudyCardLayout = ({ children, card, isFlipped, setIsFlipped, set: currentSet, onExit, t, getThemeClasses, cardsRemainingText }: any) => {
    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 flex flex-col`}>
            <style>{`.flip-card { transform-style: preserve-3d; } .flip-card-inner { transition: transform 0.6s; transform-style: preserve-3d; } .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); } .flip-card-front, .flip-card-back { -webkit-backface-visibility: hidden; backface-visibility: hidden; position: absolute; top: 0; left: 0; right: 0; bottom: 0; } .flip-card-back { transform: rotateY(180deg); }`}</style>
            <div className="flex justify-between items-center">
                <button onClick={onExit} className="font-semibold flex items-center gap-1 hover:underline self-start"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
                <div className={`font-semibold ${getThemeClasses('text')}`}>{cardsRemainingText}</div>
            </div>
            <div className="text-center"><h3 className="font-bold text-xl">{currentSet.name}</h3></div>
            <div className={`flip-card w-full h-64 sm:h-80 relative ${isFlipped ? 'flipped' : ''}`} style={{ perspective: '1000px' }}>
                <div className="flip-card-inner w-full h-full">
                    <div onClick={() => setIsFlipped(true)} className="flip-card-front bg-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center cursor-pointer"><p className="text-2xl font-semibold">{card?.question}</p></div>
                    <div onClick={() => setIsFlipped(false)} className={`flip-card-back ${getThemeClasses('bg')} text-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center cursor-pointer`}><p className="text-xl font-medium">{card?.answer}</p></div>
                </div>
            </div>
            {children}
        </div>
    );
}

const NoCardsFoundView = ({setView, onBack, t, getThemeClasses }: any) => (
    <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 text-center`}>
        <BookOpen className={`w-16 h-16 mx-auto ${getThemeClasses('text')}`} /><h3 className="font-bold text-lg">{t('no_flashcards_found')}</h3><p className="text-gray-600">Add some cards in the 'Manage' section to start studying.</p>
        <div className="flex justify-center gap-4 mt-4">
             <button onClick={onBack || (() => setView('set-list'))} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
             <button onClick={() => setView('manage')} className={`flex items-center gap-2 font-semibold text-sm py-2 px-3 rounded-lg transition-colors active:scale-95 text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}><Settings size={16}/> {t('manage_cards')}</button>
        </div>
    </div>
);

const AllCardsLearnedView = ({ set: currentSet, setView, ...props }: any) => {
    const { t, getThemeClasses } = props;
    const handleResetProgressAndRestart = async () => {
        const batch = db.batch();
        const cardsRef = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
        const snapshot = await cardsRef.get();
        snapshot.forEach(cardDoc => batch.update(cardDoc.ref, { dueDate: Timestamp.now(), interval: 0, easeFactor: 2.5 }));
        await batch.commit();
        setView('learn');
    };
    return (
        <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 text-center`}>
            <Check className={`w-16 h-16 mx-auto ${getThemeClasses('text')}`} /><h3 className="font-bold text-lg">{t('all_cards_learned_title')}</h3><p className="text-gray-600">{t('all_cards_learned_desc')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
                 <button onClick={() => setView('mode-selection')} className={`w-full sm:w-auto font-bold py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors active:scale-95 flex items-center justify-center gap-2`}><Layers size={16}/> {t('choose_other_method_button')}</button>
                 {!currentSet.isShared && !currentSet.isCombined && <button onClick={handleResetProgressAndRestart} className={`w-full sm:w-auto font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95 flex items-center justify-center gap-2`}><RotateCcw size={16}/> {t('reset_and_start_over_button')}</button>}
            </div>
        </div>
    );
};

const calculateStars = (correct: number, total: number) => {
    if (total === 0) return 0;
    const percentage = (correct / total) * 100;
    if (percentage >= 99) return 5;
    if (percentage >= 80) return 4;
    if (percentage >= 60) return 3;
    if (percentage >= 40) return 2;
    if (percentage >= 20) return 1;
    return 0;
};

const SessionSummaryView = ({ set, summary, setView, onStartSession, onBack, ...props }: any) => {
    const { t, getThemeClasses, userId, showAppModal, setSelectedSet } = props;
    const { stats, answers, earnedStars } = summary;
    const incorrectAnswers = answers.filter(a => !a.isCorrect);
    const correctAnswers = answers.filter(a => a.isCorrect);
    const grade = stats.total > 0 ? (stats.correct / stats.total) * 9 + 1 : 1;
    const timeSpentMs = stats.endTime - stats.startTime;
    const minutes = Math.floor(timeSpentMs / 60000);
    const seconds = ((timeSpentMs % 60000) / 1000).toFixed(0);

    const handlePracticeIncorrect = () => {
        const incorrectCards = incorrectAnswers.map(a => a.card);
        const practiceSet: FlashcardSet = {
            id: 'practice-' + Date.now(), name: `${set.name} - ${t('practice_incorrect')}`, subject: set.subject,
            ownerId: userId, createdAt: Timestamp.now(), cardCount: incorrectCards.length,
            isCombined: true, cards: incorrectCards
        };
        setSelectedSet(practiceSet);
        onStartSession('cram');
    };
    
    const handleCreateSetFromIncorrect = async () => {
        const newSetName = prompt(t('new_set_name_prompt'));
        if (!newSetName || incorrectAnswers.length === 0) return;

        const newSetRef = db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).doc();
        const batch = db.batch();
        batch.set(newSetRef, { name: newSetName, subject: set.subject, ownerId: userId, createdAt: Timestamp.now(), cardCount: incorrectAnswers.length });
        
        incorrectAnswers.forEach(({ card }) => {
            const newCardRef = db.collection(`artifacts/${appId}/public/data/flashcards`).doc();
            batch.set(newCardRef, { ...card, setId: newSetRef.id, ownerId: userId, createdAt: Timestamp.now() });
        });

        await batch.commit();
        showAppModal({ text: t('new_set_created_success', { name: newSetName }) });
    };

    return (
     <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-6`}>
        <div className="text-center">
            <h3 className="font-bold text-2xl">{t('session_summary_title')}</h3>
            <div className="mt-4">
                <p className="font-semibold text-lg">{t('stars_earned_title')}</p>
                <div className="flex justify-center items-center">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} size={40} className={`transition-colors ${i < earnedStars ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                    ))}
                </div>
            </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm font-bold text-gray-500">{t('your_grade')}</p><p className={`text-3xl font-bold ${grade < 5.5 ? 'text-red-500' : 'text-green-500'}`}>{grade.toFixed(1)}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm font-bold text-gray-500">{t('correct_answers')}</p><p className="text-3xl font-bold text-green-500">{stats.correct}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm font-bold text-gray-500">{t('incorrect_answers')}</p><p className="text-3xl font-bold text-red-500">{stats.incorrect}</p></div>
            <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm font-bold text-gray-500">{t('time_spent')}</p><p className="text-3xl font-bold text-gray-700">{minutes}:{seconds.padStart(2, '0')}</p></div>
        </div>
        <div className="space-y-4">
            {incorrectAnswers.length > 0 && (
                <div>
                    <h4 className="font-bold text-lg text-red-600 mb-2">{t('incorrect_answers')} ({incorrectAnswers.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {incorrectAnswers.map(({ card, userAnswer }, i) => (
                            <div key={i} className="bg-red-50 p-3 rounded-md border border-red-100 text-sm"><p className="font-semibold">{card.question}</p>{userAnswer && <p>{t('your_answer')}: <span className="text-red-700">{userAnswer}</span></p>}<p>{t('correct_answer')}: <span className="text-green-700 font-medium">{card.answer}</span></p></div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                         <button onClick={handlePracticeIncorrect} className={`w-full font-bold py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white`}>{t('practice_incorrect')}</button>
                         {!set.isCombined && <button onClick={handleCreateSetFromIncorrect} className={`w-full font-bold py-2 px-4 rounded-lg bg-orange-200 hover:bg-orange-300 text-orange-800`}>{t('create_set_from_incorrect')}</button>}
                    </div>
                </div>
            )}
            {correctAnswers.length > 0 && (
                <div>
                    <h4 className="font-bold text-lg text-green-600 mb-2">{t('correct_answers')} ({correctAnswers.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                         {correctAnswers.map(({ card, userAnswer }, i) => (
                            <div key={i} className="bg-green-50 p-3 rounded-md border border-green-100 text-sm"><p className="font-semibold">{card.question}</p>{userAnswer && <p>{t('your_answer')}: <span className="text-green-700">{userAnswer}</span></p>}<p>{t('correct_answer')}: <span className="text-green-700 font-medium">{card.answer}</span></p></div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        <div className="flex justify-center gap-4 mt-4 w-full">
            <button onClick={onBack} className={`w-full font-bold py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300`}>{t('choose_other_method_button')}</button>
        </div>
    </div>
    );
};

export default FlashcardsView;