import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, appId, Timestamp, increment } from '../../../services/firebase';
import { GoogleGenAI, Type } from '@google/genai';
import type { Flashcard, FlashcardSet, AppUser, ModalContent } from '../../../types';
import { PlusCircle, Trash2, ArrowLeft, Save, BookOpen, Settings, Brain, BarChart, RotateCcw, X, Check, Loader2, FileQuestion, Star, Layers, Sparkles, Share2, ChevronDown } from 'lucide-react';
import ShareSetModal from './ShareSetModal';

interface FlashcardsViewProps {
  userId: string;
  user: AppUser;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  tSubject: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  showAppModal: (content: ModalContent) => void;
}

type ViewType = 'set-list' | 'mode-selection' | 'manage' | 'learn' | 'cram' | 'mc' | 'summary' | 'all-learned';
interface SessionStats { correct: number; incorrect: number; total: number; }

const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// --- Main Router Component ---
const FlashcardsView: React.FC<FlashcardsViewProps> = (props) => {
  const [view, setView] = useState<ViewType>('set-list');
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
  const [lastSessionStats, setLastSessionStats] = useState<SessionStats | null>(null);
  const [lastSessionMode, setLastSessionMode] = useState<ViewType | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [setForSharing, setSetForSharing] = useState<FlashcardSet | null>(null);

  const handleSessionComplete = (stats: SessionStats, mode: ViewType) => {
    setLastSessionStats(stats);
    setLastSessionMode(mode);
    setView('summary');
  };
  
  const openShareModal = (set: FlashcardSet) => {
    setSetForSharing(set);
    setIsShareModalOpen(true);
  };

  const goBack = () => {
    setView('set-list');
  };

  const Views: { [key: string]: React.ReactNode } = {
    'set-list': <SetListView {...props} setSelectedSet={setSelectedSet} setView={setView} onShare={openShareModal} />,
    'mode-selection': selectedSet && <ModeSelectionView set={selectedSet} setView={setView} onBack={goBack} {...props} />,
    manage: selectedSet && <CardManagerView {...props} set={selectedSet} onBack={goBack} />,
    learn: selectedSet && <LearnSessionView {...props} set={selectedSet} setView={setView} onSessionComplete={handleSessionComplete}/>,
    cram: selectedSet && <CramSessionView {...props} set={selectedSet} setView={setView} onSessionComplete={handleSessionComplete}/>,
    mc: selectedSet && <MultipleChoiceSessionView {...props} set={selectedSet} setView={setView} onSessionComplete={handleSessionComplete}/>,
    summary: selectedSet && lastSessionStats && lastSessionMode && <SessionSummaryView {...props} set={selectedSet} stats={lastSessionStats} setView={setView} onBack={goBack} mode={lastSessionMode}/>,
    'all-learned': selectedSet && <AllCardsLearnedView {...props} set={selectedSet} setView={setView} />
  }

  return (
    <div className="animate-fade-in">
      {setForSharing && <ShareSetModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} set={setForSharing} {...props}/>}
      {Views[view]}
    </div>
  );
};

const CustomDropdown: React.FC<{
    options: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
    getThemeClasses: (variant: string) => string;
}> = ({ options, selectedValue, onSelect, getThemeClasses }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === selectedValue)?.label || 'Select';

    return (
        <div className="relative w-full sm:w-auto" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full sm:w-56 flex items-center justify-between p-2 border rounded-lg bg-white shadow-sm text-left"
            >
                <span className="font-semibold">{selectedLabel}</span>
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-full sm:w-56 bg-white border rounded-lg shadow-lg z-10 animate-fade-in-fast overflow-y-auto max-h-60">
                    {options.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => {
                                onSelect(value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-2 hover:bg-gray-100 ${selectedValue === value ? getThemeClasses('text') + ' font-bold' : ''}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Sub-Views for Flashcards ---
const SetListView: React.FC<any> = ({ setSelectedSet, setView, onShare, ...props }) => {
    const { userId, t, tSubject, getThemeClasses, showAppModal, user } = props;
    const [allSets, setAllSets] = useState<FlashcardSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState('all');
    const [newSetName, setNewSetName] = useState('');

    const userSubjects = useMemo(() => Array.from(new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])])), [user.selectedSubjects, user.customSubjects]);
    
    const dropdownOptions = useMemo(() => [
      { value: 'all', label: t('all_subjects_option') },
      ...userSubjects.map(s => ({ value: s, label: tSubject(s) }))
    ], [userSubjects, t, tSubject]);

    useEffect(() => {
        if (user.uid === 'guest-user') { setIsLoading(false); return; }
        
        const ownedSetsQuery = db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).orderBy('createdAt', 'desc');
        const sharedSetsQuery = db.collection(`artifacts/${appId}/public/data/sharedSets`).where('recipientEmail', '==', user.email);

        const unsubOwned = ownedSetsQuery.onSnapshot(snap => {
            const owned = snap.docs.map(d => ({ id: d.id, ...d.data() } as FlashcardSet));
            setAllSets(prev => [...owned, ...prev.filter(s => s.isShared)]);
            setIsLoading(false);
        }, err => { console.error(err); setIsLoading(false); });

        const unsubShared = sharedSetsQuery.onSnapshot(snap => {
            const shared = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: data.setId, name: data.setName, subject: data.subject, ownerId: data.sharerId,
                    cardCount: data.cardCount || 0, createdAt: data.createdAt, isShared: true, sharerName: data.sharerName,
                } as FlashcardSet
            });
            setAllSets(prev => [...shared, ...prev.filter(s => !s.isShared)]);
            setIsLoading(false);
        }, err => { console.error(err); setIsLoading(false); });

        return () => { unsubOwned(); unsubShared(); };
    }, [userId, user.email, user.uid]);
    
    const filteredSets = useMemo(() => {
        if (selectedSubject === 'all') return allSets;
        return allSets.filter(s => s.subject === selectedSubject);
    }, [selectedSubject, allSets]);

    const handleCreateSet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.uid === 'guest-user') { showAppModal({ text: t('error_guest_action_not_allowed') }); return; }
        const subjectForNewSet = (selectedSubject === 'all' && userSubjects.length > 0) ? userSubjects[0] : selectedSubject;
        if(subjectForNewSet === 'all'){ showAppModal({ text: t('select_a_subject_first') }); return; }
        if (!newSetName.trim()) { showAppModal({ text: t('error_empty_set_name') }); return; }
        
        const docRef = await db.collection(`artifacts/${appId}/users/${userId}/flashcardDecks`).add({ name: newSetName, subject: subjectForNewSet, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 });
        const newSet = { id: docRef.id, name: newSetName, subject: subjectForNewSet, ownerId: userId, createdAt: Timestamp.now(), cardCount: 0 };
        
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

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
             <div className="flex justify-between items-center flex-wrap gap-2">
                <CustomDropdown options={dropdownOptions} selectedValue={selectedSubject} onSelect={setSelectedSubject} getThemeClasses={getThemeClasses} />
                 <form onSubmit={handleCreateSet} className="flex-grow sm:flex-grow-0 flex gap-2">
                    <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder={t('set_name_placeholder')} className="flex-grow p-2 border rounded-lg"/>
                    <button type="submit" className={`flex items-center justify-center text-white font-bold p-2 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-12`}><PlusCircle size={20}/></button>
                </form>
            </div>

            {isLoading ? <div className="text-center p-8"><Loader2 className="animate-spin" /></div> : 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSets.length === 0 ? <p className="text-center italic text-gray-500 py-8 md:col-span-2">{t('no_sets_found')}</p> :
                 filteredSets.map(set => (
                    <div key={`${set.id}-${set.ownerId}`} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col overflow-hidden">
                        <div className="p-4 flex-grow">
                            <div className="flex justify-between items-start">
                                <div onClick={() => { setSelectedSet(set); setView('mode-selection'); }} className="cursor-pointer flex-grow pr-2">
                                    <h4 className="font-bold text-lg text-gray-800 truncate">{set.name}</h4>
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${getThemeClasses('text')}`}>{tSubject(set.subject)}</p>
                                    {set.isShared && <p className="text-xs text-gray-500 mt-1">{t('shared_by', { name: set.sharerName })}</p>}
                                </div>
                                {!set.isShared && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); onShare(set); }} className="p-2 text-gray-500 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors" title={t('share_button')}>
                                            <Share2 className="w-4 h-4"/>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSet(set); }} className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors" title={t('confirm_delete_set', {name: set.name})}>
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center text-sm">
                            <div className={`font-semibold ${getThemeClasses('text')}`}>{t('cards_in_set', { count: set.cardCount || 0 })}</div>
                            <button onClick={() => { setSelectedSet(set); setView('manage'); }} className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                                <Settings size={14}/> {t('manage_cards')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>}
        </div>
    );
};

const ModeSelectionView = ({ onBack, set: currentSet, setView, ...props }: any) => {
    const { getThemeClasses, t, userId, showAppModal } = props;

    const handleResetProgress = () => {
        showAppModal({
            text: t('reset_srs_confirm'),
            confirmAction: async () => {
                const batch = db.batch();
                const cardsRef = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
                const snapshot = await cardsRef.get();
                snapshot.forEach(cardDoc => {
                    batch.update(cardDoc.ref, {
                        dueDate: Timestamp.now(),
                        interval: 0,
                        easeFactor: 2.5,
                    });
                });
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
    ];
    
    return (
      <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
          <div className="flex justify-between items-center">
            <button onClick={onBack} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
            {!currentSet.isShared && <button onClick={handleResetProgress} className="text-xs font-semibold text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"><RotateCcw size={12}/>{t('reset_srs_progress')}</button>}
          </div>
          <h3 className="font-bold text-lg text-center">{t('choose_study_mode')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {studyModes.map(mode => (
                 <div key={mode.id} onClick={() => currentSet.cardCount > 0 ? setView(mode.id) : showAppModal({text: t('no_flashcards_found')})} className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`p-4 rounded-full ${getThemeClasses('bg-light')} mb-4`}>
                      {mode.icon}
                  </div>
                  <h4 className="text-xl font-bold">{mode.title}</h4>
                  <p className="text-gray-600 text-sm mt-2 flex-grow">{mode.desc}</p>
                  <button disabled={currentSet.cardCount === 0} className={`mt-4 w-full font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 disabled:cursor-not-allowed`}>{t('start_session')}</button>
              </div>
              ))}
          </div>
      </div>
    );
};

const CardManagerView = ({ onBack, set: currentSet, ...props }: any) => {
    const { userId, t, getThemeClasses, showAppModal } = props;
    const [editableCards, setEditableCards] = useState<(Flashcard & { isNew?: boolean })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiInput, setAiInput] = useState('');

    useEffect(() => {
        setIsLoading(true);
        const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id).orderBy('createdAt');
        const unsubscribe = q.onSnapshot(snapshot => {
            setEditableCards(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard)));
            setIsLoading(false);
        }, (error) => {
            showAppModal({text: t('error_failed_to_load_cards')});
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentSet.id, showAppModal, t]);
    
    const handleGenerateWithAI = async () => {
        if (!aiInput.trim()) return;
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Parse the following text into flashcards. Each line or item separated by a colon (:) or dash (-) should be a card. The part before the separator is the question, and the part after is the answer. Text: \n\n${aiInput}`;
            
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                    },
                    required: ['question', 'answer']
                  },
                },
              },
            });

            const jsonStr = response.text.trim();
            const newCards = JSON.parse(jsonStr).map((c: any) => ({ ...c, id: `new_${Math.random()}`, setId: currentSet.id, isNew: true, ownerId: userId, createdAt: Timestamp.now() }));
            setEditableCards(prev => [...prev, ...newCards]);
            setAiInput('');
        } catch (error) {
            console.error(error);
            showAppModal({ text: t('error_ai_parse_failed') });
        } finally {
            setIsGenerating(false);
        }
    };

     const handleSaveCards = async () => {
        if (currentSet.isShared) return;
        
        const batch = db.batch();
        const setRef = db.doc(`artifacts/${appId}/users/${userId}/flashcardDecks/${currentSet.id}`);
        let newCardsCount = 0;

        for (const card of editableCards) {
            if (card.question.trim() && card.answer.trim()) {
                if (card.isNew) {
                    const cardRef = db.collection(`artifacts/${appId}/public/data/flashcards`).doc();
                    batch.set(cardRef, { 
                        setId: currentSet.id,
                        question: card.question, 
                        answer: card.answer, 
                        ownerId: userId, 
                        createdAt: Timestamp.now(), 
                        dueDate: Timestamp.now(), 
                        interval: 0, 
                        easeFactor: 2.5 
                    });
                    newCardsCount++;
                } else {
                    const cardRef = db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`);
                    batch.update(cardRef, { question: card.question, answer: card.answer });
                }
            }
        }
        
        if (newCardsCount > 0) {
            batch.update(setRef, { cardCount: increment(newCardsCount) });
        }
        await batch.commit();
        showAppModal({ text: t('flashcard_added_success') });
     };
     
    const handleCardChange = (id: string, field: 'question' | 'answer', value: string) => {
        setEditableCards(cards => cards.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleAddRow = () => {
        setEditableCards(prev => [...prev, { id: `new_${Date.now()}`, setId: currentSet.id, question: '', answer: '', isNew: true, ownerId: userId, createdAt: Timestamp.now() }]);
    };
    
    const handleDeleteCard = async (card: Flashcard & { isNew?: boolean }) => {
        if (card.isNew) {
            setEditableCards(prev => prev.filter(c => c.id !== card.id));
        } else {
            showAppModal({
                text: t('confirm_delete_card'),
                confirmAction: async () => {
                    const setRef = db.doc(`artifacts/${appId}/users/${userId}/flashcardDecks/${currentSet.id}`);
                    await db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`).delete();
                    await setRef.update({ cardCount: increment(-1) });
                    showAppModal({ text: t('card_deleted_success') });
                },
                cancelAction: () => {}
            });
        }
    };


     return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
                <h3 className="font-bold text-lg text-center">{t('add_flashcard')} - {currentSet.name}</h3>
                <div/>
            </div>

            {!currentSet.isShared && (
                <div className="bg-white p-3 rounded-lg shadow-sm space-y-2">
                    <h4 className="font-semibold flex items-center gap-2"><Sparkles className="text-purple-500"/> {t('ai_generate_cards_title')}</h4>
                    <p className="text-xs text-gray-500">{t('ai_generate_cards_desc')}</p>
                    <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={4} className="w-full p-2 border rounded-md" placeholder="Begrip 1: Uitleg 1&#10;Term 2 - Definition 2" />
                    <button onClick={handleGenerateWithAI} disabled={isGenerating} className={`w-full flex justify-center items-center gap-2 text-white font-bold py-2 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 active:scale-95 disabled:opacity-70`}>
                        {isGenerating ? <><Loader2 className="animate-spin w-5 h-5"/> {t('generating')}</> : t('ai_generate_button')}
                    </button>
                </div>
            )}
            
            {isLoading ? <div className="text-center p-4"><Loader2 className="animate-spin"/></div> : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                    {editableCards.map((card, index) => (
                        <div key={card.id} className="flex items-start gap-2 bg-white p-2 rounded-lg shadow-sm">
                            <span className="font-semibold text-gray-400 pt-2">{index + 1}</span>
                            <div className="flex-grow space-y-1">
                                <textarea placeholder={t('question')} value={card.question} onChange={e => handleCardChange(card.id, 'question', e.target.value)} className="w-full p-2 border rounded-md" rows={2} disabled={currentSet.isShared}/>
                                <textarea placeholder={t('answer')} value={card.answer} onChange={e => handleCardChange(card.id, 'answer', e.target.value)} className="w-full p-2 border rounded-md" rows={2} disabled={currentSet.isShared}/>
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


const CramSessionView = ({ set: currentSet, onSessionComplete, ...props }: any) => {
    const { t, getThemeClasses, showAppModal, setView } = props;
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
        const unsubscribe = q.onSnapshot(snapshot => {
            setCards(shuffleArray(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard))));
            setIsLoading(false);
        }, (error) => {
            showAppModal({text: t('error_failed_to_load_cards')});
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentSet.id, showAppModal, t]);

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
             if (currentIndex + 1 >= cards.length) {
                onSessionComplete({ correct: cards.length, incorrect: 0, total: cards.length }, 'cram');
            } else {
                setCurrentIndex(i => i + 1);
            }
        }, 150);
    }
    
    const card = useMemo(() => cards[currentIndex], [cards, currentIndex]);
    
    useEffect(() => {
        setIsFlipped(false);
    }, [card]);

    const progressPercentage = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> Loading cards...</div>;
    if (cards.length === 0) return <NoCardsFoundView setView={setView} t={t} getThemeClasses={getThemeClasses} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={progressPercentage} set={currentSet} setView={setView} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={`${currentIndex + 1} / ${cards.length}`}>
        <div className="flex justify-center mt-4">
           <button onClick={handleNext} className={`w-full max-w-xs text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                {t('next_card')}
            </button>
        </div>
    </StudyCardLayout>
};

const LearnSessionView = ({ set: currentSet, onSessionComplete, ...props}: any) => {
    const { userId, t, getThemeClasses, showAppModal, setView } = props;
    const [dueCards, setDueCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [stats, setStats] = useState<SessionStats>({ correct: 0, incorrect: 0, total: 0});
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = db.collection(`artifacts/${appId}/public/data/flashcards`)
            .where('setId', '==', currentSet.id)
            .where('dueDate', '<=', Timestamp.now())
            .orderBy('dueDate')
            .limit(20);
        const unsubscribe = q.onSnapshot(snapshot => {
            const fetchedCards = shuffleArray(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard)));
            setDueCards(fetchedCards);
            setSessionQueue(fetchedCards);
            setStats({ correct: 0, incorrect: 0, total: fetchedCards.length });
            setIsLoading(false);
        }, (error) => {
            showAppModal({text: t('error_failed_to_load_cards')});
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentSet.id, showAppModal, t]);

    const updateCardSrs = async (card: Flashcard, knewIt: boolean) => {
        if (currentSet.isShared) return;

        const easeFactor = card.easeFactor || 2.5;
        let newInterval;
        let newEaseFactor = easeFactor;

        if (knewIt) {
            if (card.interval === 0 || card.interval === undefined) newInterval = 1;
            else if (card.interval === 1) newInterval = 6;
            else newInterval = Math.ceil(card.interval * easeFactor);
        } else {
            newInterval = 1;
            newEaseFactor = Math.max(1.3, easeFactor - 0.2);
        }
        
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + newInterval);
        
        const cardRef = db.doc(`artifacts/${appId}/public/data/flashcards/${card.id}`);
        await cardRef.update({
            interval: newInterval,
            easeFactor: newEaseFactor,
            dueDate: Timestamp.fromDate(newDueDate)
        });
    };

    const handleFeedback = async (knewIt: boolean) => {
        if (!card) return;
        
        await updateCardSrs(card, knewIt);
        setStats(s => ({...s, correct: s.correct + (knewIt ? 1 : 0), incorrect: s.incorrect + (knewIt ? 0 : 1)}));

        setIsFlipped(false);
        setTimeout(() => setSessionQueue(prev => prev.slice(1)), 150);
    };

    const card = sessionQueue[0];
    
    useEffect(() => {
        setIsFlipped(false);
    }, [card]);

    const progressPercentage = dueCards.length > 0 ? ((dueCards.length - sessionQueue.length) / dueCards.length) * 100 : 0;

    useEffect(() => {
        if (!isLoading && sessionQueue.length === 0 && dueCards.length > 0) {
            const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id).where('dueDate', '<=', Timestamp.now()).limit(1);
            q.get().then(snapshot => {
                if (snapshot.empty) {
                     setView('all-learned');
                } else {
                    onSessionComplete(stats, 'learn');
                }
            });
        }
    }, [isLoading, sessionQueue.length, dueCards.length, onSessionComplete, stats, setView, currentSet.id]);

    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> Loading cards...</div>;
    if (dueCards.length === 0) return <AllCardsLearnedView {...props} set={currentSet} setView={setView} />

    return <StudyCardLayout card={card} isFlipped={isFlipped} setIsFlipped={setIsFlipped} progressPercentage={progressPercentage} set={currentSet} setView={setView} t={t} getThemeClasses={getThemeClasses} cardsRemainingText={t('cards_to_go', {count: sessionQueue.length})} >
         <div className="flex justify-around items-center mt-4">
            {isFlipped ? (
                <>
                    <button onClick={() => handleFeedback(false)} className="flex flex-col items-center gap-1 font-bold text-red-600 bg-red-100 rounded-lg py-3 px-6 transition-transform active:scale-90 hover:bg-red-200">
                        <X size={24} /> {t('feedback_again')}
                    </button>
                    <button onClick={() => handleFeedback(true)} className="flex flex-col items-center gap-1 font-bold text-green-600 bg-green-100 rounded-lg py-3 px-6 transition-transform active:scale-90 hover:bg-green-200">
                        <Check size={24}/> {t('feedback_good')}
                    </button>
                </>
            ) : (
                 <button onClick={() => setIsFlipped(true)} className={`w-full max-w-xs text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                    {t('show_answer')}
                </button>
            )}
        </div>
    </StudyCardLayout>
}

const MultipleChoiceSessionView = ({ set: currentSet, onSessionComplete, ...props }: any) => {
    const { t, getThemeClasses, showAppModal, setView } = props;
    const [allCards, setAllCards] = useState<Flashcard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
    const [choices, setChoices] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [stats, setStats] = useState<SessionStats>({ correct: 0, incorrect: 0, total: 0});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
        const unsubscribe = q.onSnapshot(snapshot => {
            const fetchedCards = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Flashcard));
            if (fetchedCards.length < 2) {
                showAppModal({ text: t('error_flashcard_set_min_cards') });
                setView('mode-selection');
                return;
            }
            setAllCards(fetchedCards);
            const shuffledQueue = shuffleArray([...fetchedCards]);
            setSessionQueue(shuffledQueue);
            setStats({ correct: 0, incorrect: 0, total: shuffledQueue.length });
            setIsLoading(false);
        }, (error) => {
            showAppModal({text: t('error_failed_to_load_cards')});
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentSet.id, showAppModal, t, setView]);
    
    const card = useMemo(() => sessionQueue[0], [sessionQueue]);

    useEffect(() => {
        if(card && allCards.length > 1) {
            const distractors = shuffleArray(allCards.filter(c => c.id !== card.id))
                .slice(0, 3)
                .map(c => c.answer);
            setChoices(shuffleArray([card.answer, ...distractors]));
        }
    }, [card, allCards]);

    const handleAnswer = (answer: string) => {
        if (feedback) return;
        const isCorrect = answer === card.answer;
        setSelectedChoice(answer);
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        const newStats = {...stats, correct: stats.correct + (isCorrect ? 1 : 0), incorrect: stats.incorrect + (isCorrect ? 0 : 1)};
        setStats(newStats);

        setTimeout(() => {
            setFeedback(null);
            setSelectedChoice(null);
            if (sessionQueue.length === 1) {
                onSessionComplete(newStats, 'mc');
            } else {
                setSessionQueue(q => q.slice(1));
            }
        }, 1200);
    }
    
    if (isLoading) return <div className="text-center p-8 flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> {t('loading_cards')}</div>;
    if (allCards.length < 2) return <NoCardsFoundView setView={setView} t={t} getThemeClasses={getThemeClasses} />;

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 flex flex-col`}>
             <button onClick={() => setView('mode-selection')} className="font-semibold flex items-center gap-1 hover:underline self-start mb-2"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
             <h3 className="font-bold text-center text-xl">{currentSet.name}</h3>
             <div className="bg-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center h-48">
                <p className="text-2xl font-semibold">{card?.question}</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {choices.map(choice => {
                    let feedbackClass = `${getThemeClasses('bg')} border-transparent hover:saturate-150`;
                    if (feedback && selectedChoice === choice) {
                        feedbackClass = feedback === 'correct' ? 'bg-green-500 border-green-600' : 'bg-red-500 border-red-600';
                    } else if (feedback && choice === card?.answer) {
                        feedbackClass = 'bg-green-500 border-green-600';
                    } else if (feedback) {
                        feedbackClass = 'bg-gray-400 border-gray-500 opacity-70';
                    }
                    
                    return (
                        <button key={choice} onClick={() => handleAnswer(choice)} disabled={!!feedback}
                            className={`p-4 rounded-lg font-semibold text-white shadow-md border-b-4 transition-all active:scale-95 disabled:cursor-not-allowed ${feedbackClass}`}>
                            {choice}
                        </button>
                    )
                })}
             </div>
        </div>
    );
};

// --- Reusable UI Components for Study Sessions ---
const StudyCardLayout = ({ children, card, isFlipped, setIsFlipped, progressPercentage, set: currentSet, setView, t, getThemeClasses, cardsRemainingText }: any) => {

    useEffect(() => {
        setIsFlipped(false);
    }, [card, setIsFlipped]);

    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 flex flex-col`}>
            <style>{`
                .flip-card { transform-style: preserve-3d; }
                .flip-card-inner { transition: transform 0.6s; transform-style: preserve-3d; }
                .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
                .flip-card-front, .flip-card-back { 
                -webkit-backface-visibility: hidden; backface-visibility: hidden; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                }
                .flip-card-back { transform: rotateY(180deg); }
            `}</style>
            <button onClick={() => setView('mode-selection')} className="font-semibold flex items-center gap-1 hover:underline self-start mb-2"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
            <div className="text-center">
                <h3 className="font-bold text-xl">{currentSet.name}</h3>
                <p className={`font-semibold ${getThemeClasses('text')}`}>{cardsRemainingText}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 my-4">
                <div className={`${getThemeClasses('bg')} h-2.5 rounded-full transition-all duration-300`} style={{width: `${progressPercentage}%`}}></div>
            </div>
            <div className={`flip-card w-full h-64 sm:h-80 relative ${isFlipped ? 'flipped' : ''}`} style={{ perspective: '1000px' }}>
                <div className="flip-card-inner w-full h-full">
                    <div onClick={() => setIsFlipped(true)} className="flip-card-front bg-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center cursor-pointer">
                        <p className="text-2xl font-semibold">{card?.question}</p>
                    </div>
                    <div onClick={() => setIsFlipped(false)} className={`flip-card-back ${getThemeClasses('bg')} text-white rounded-lg shadow-lg flex items-center justify-center p-6 text-center cursor-pointer`}>
                        <p className="text-xl font-medium">{card?.answer}</p>
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}

const NoCardsFoundView = ({setView, t, getThemeClasses }: any) => (
    <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 text-center`}>
        <BookOpen className={`w-16 h-16 mx-auto ${getThemeClasses('text')}`} />
        <h3 className="font-bold text-lg">{t('no_flashcards_found')}</h3>
        <p className="text-gray-600">Add some cards in the 'Manage' section to start studying.</p>
        <div className="flex justify-center gap-4 mt-4">
             <button onClick={() => setView('set-list')} className="font-semibold flex items-center gap-1 hover:underline"><ArrowLeft size={16}/> {t('back_to_sets')}</button>
             <button onClick={() => setView('manage')} className={`flex items-center gap-2 font-semibold text-sm py-2 px-3 rounded-lg transition-colors active:scale-95 text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}><Settings size={16}/> {t('manage_cards')}</button>
        </div>
    </div>
);

const AllCardsLearnedView = ({ set: currentSet, setView, ...props }: any) => {
    const { userId, t, getThemeClasses } = props;

    const handleResetProgressAndRestart = async () => {
        const batch = db.batch();
        const cardsRef = db.collection(`artifacts/${appId}/public/data/flashcards`).where('setId', '==', currentSet.id);
        const snapshot = await cardsRef.get();
        snapshot.forEach(cardDoc => {
            batch.update(cardDoc.ref, {
                dueDate: Timestamp.now(),
                interval: 0,
                easeFactor: 2.5,
            });
        });
        await batch.commit();
        setView('learn');
    };

    return (
        <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 text-center`}>
            <Check className={`w-16 h-16 mx-auto ${getThemeClasses('text')}`} />
            <h3 className="font-bold text-lg">{t('all_cards_learned_title')}</h3>
            <p className="text-gray-600">{t('all_cards_learned_desc')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
                 <button onClick={() => setView('mode-selection')} className={`w-full sm:w-auto font-bold py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors active:scale-95 flex items-center justify-center gap-2`}>
                    <Layers size={16}/> {t('choose_other_method_button')}
                </button>
                 {!currentSet.isShared && (
                    <button onClick={handleResetProgressAndRestart} className={`w-full sm:w-auto font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95 flex items-center justify-center gap-2`}>
                        <RotateCcw size={16}/> {t('reset_and_start_over_button')}
                    </button>
                 )}
            </div>
        </div>
    );
};

const SessionSummaryView = ({ setView, t, getThemeClasses, stats, mode }: any) => {
    const handleStudyAgain = () => {
         setView(mode);
    }
    return (
     <div className={`p-6 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4 text-center flex flex-col items-center justify-center`}>
        <Star className={`w-20 h-20 mx-auto text-amber-400`} />
        <h3 className="font-bold text-2xl">{t('session_complete')}</h3>
        <p className="text-xl font-semibold">{t('your_score', { correct: stats.correct, total: stats.total })}</p>
        <p className="text-gray-600">{t('well_done_message')}</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4 w-full max-w-sm">
             <button onClick={() => setView('mode-selection')} className={`w-full font-bold py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors active:scale-95`}>
                {t('choose_other_method_button')}
            </button>
            <button onClick={handleStudyAgain} className={`w-full font-bold py-2 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95`}>
                {t('study_again_button')}
            </button>
        </div>
    </div>
    );
};

export default FlashcardsView;
