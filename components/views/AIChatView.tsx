import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Tool, Type } from '@google/genai';
import { Send, Loader2, Bot, User, X, Settings, Save, History, PlusCircle, ArrowLeft } from 'lucide-react';
import { Timestamp, db, appId, arrayUnion } from '../../services/firebase';
import type { AppUser, ModalContent, CalendarEvent, StudyPlan, ChatMessage, ChatHistory } from '../../types';
import AvatarSelectionGrid from '../ui/AvatarSelectionGrid';
import { marked } from 'marked';

interface AIChatViewProps {
    user: AppUser;
    userId: string;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    onClose: () => void;
    addCalendarEvent: (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => Promise<string>;
    removeCalendarEvent: (title: string, date: string) => Promise<string>;
    userEvents: CalendarEvent[];
    userStudyPlans: StudyPlan[];
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
    chat: Chat | null;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatHistories: ChatHistory[];
    currentChatSessionId: string | null;
    setCurrentChatSessionId: (id: string | null) => void;
}

const AISettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: AppUser;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
}> = ({ isOpen, onClose, user, t, getThemeClasses, onProfileUpdate }) => {
  const [tempBotName, setTempBotName] = useState(user.aiBotName || 'AI Assistent');
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(user.aiBotAvatarUrl || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onProfileUpdate({
        aiBotName: tempBotName.trim() || 'AI Assistent',
        aiBotAvatarUrl: tempAvatarUrl,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save AI settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{t('customize_ai_title')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-800 text-sm font-bold mb-2">{t('bot_name_placeholder')}</label>
            <input
              type="text"
              value={tempBotName}
              onChange={(e) => setTempBotName(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-gray-800 text-sm font-bold mb-2">{t('select_bot_avatar')}</label>
            <AvatarSelectionGrid
              selectedAvatar={tempAvatarUrl}
              setSelectedAvatar={setTempAvatarUrl}
              userName={tempBotName || 'AI'}
              t={t}
              getThemeClasses={getThemeClasses}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
          <button onClick={handleSave} disabled={isSaving} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-32 flex justify-center items-center`}>
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : t('save_note_button')}
          </button>
        </div>
      </div>
    </div>
  );
};


const AIChatView: React.FC<AIChatViewProps> = (props) => {
    const { user, userId, t, tSubject, getThemeClasses, showAppModal, onClose, addCalendarEvent, removeCalendarEvent, userEvents, userStudyPlans, onProfileUpdate, chat, messages, setMessages, chatHistories, currentChatSessionId, setCurrentChatSessionId } = props;
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [view, setView] = useState<'chat' | 'history'>('chat');
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const botName = user.aiBotName || 'AI Assistent';
    const botAvatar = user.aiBotAvatarUrl || 'https://i.imgur.com/3flLpUQ.png';
    
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, view]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputValue]);


    const handleClose = () => setIsClosing(true);

    const handleStartNewChat = () => {
        setCurrentChatSessionId(null);
        setMessages([{ role: 'model', text: t('ai_chat_welcome', { userName: user.userName.split(' ')[0], botName }) }]);
        setView('chat');
    };

    const handleLoadChat = (sessionId: string) => {
        const historyItem = chatHistories.find(h => h.id === sessionId);
        if (historyItem) {
            setCurrentChatSessionId(sessionId);
            setMessages(historyItem.messages);
            setView('chat');
        }
    };

    const generateAndSaveChatTitle = async (sessionId: string, firstMessage: string) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Generate a very short, concise title (3-5 words max, in the user's language) for a chat conversation that starts with this message: "${firstMessage}"`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const title = response.text.trim().replace(/"/g, '');
            await db.doc(`artifacts/${appId}/users/${userId}/chatHistories/${sessionId}`).update({ title });
        } catch (e) {
            console.error(t('error_generating_title'), e);
        }
    };
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || !chat) return;

        const userMessage: ChatMessage = { role: 'user', text: inputValue };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');
        setIsLoading(true);
        
        let sessionId = currentChatSessionId;
        
        try {
            if (!sessionId) {
                const newChatRef = db.collection(`artifacts/${appId}/users/${userId}/chatHistories`).doc();
                sessionId = newChatRef.id;
                setCurrentChatSessionId(sessionId);
                await newChatRef.set({
                    userId,
                    title: `${currentInput.substring(0, 25)}...`, // Temp title
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    messages: [...messages, userMessage]
                });
                generateAndSaveChatTitle(sessionId, currentInput);
            } else {
                await db.doc(`artifacts/${appId}/users/${userId}/chatHistories/${sessionId}`).update({
                    messages: arrayUnion(userMessage),
                    updatedAt: Timestamp.now()
                });
            }
        
            const stream = await chat.sendMessageStream({ message: currentInput });
            let aggregatedText = '';
            let functionCalls: any[] | undefined;
            for await (const chunk of stream) {
                if (chunk.text) aggregatedText += chunk.text;
                if (chunk.functionCalls) functionCalls = chunk.functionCalls;
            }
            
            let finalResponseText = '';
            if (functionCalls) {
                const call = functionCalls[0];
                let resultText = '';
                if (call.name === 'addCalendarEvent') {
                    const args = call.args as any;
                    const startDateTime = new Date(`${args.date}T${args.time}`);
                    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
                    resultText = await addCalendarEvent({ title: args.title, description: `Added by ${botName}`, start: Timestamp.fromDate(startDateTime), end: Timestamp.fromDate(endDateTime), subject: args.subject, type: args.type });
                } else if (call.name === 'removeCalendarEvent') {
                    const args = call.args as { title: string, date: string };
                    resultText = await removeCalendarEvent(args.title, args.date);
                } else if (call.name === 'getCalendarEvents') {
                    const args = call.args as { date: string };
                    const targetDate = new Date(args.date + 'T00:00:00');
                    const eventsOnDate = userEvents.filter(event => event.start.toDate().toDateString() === targetDate.toDateString());
                    resultText = eventsOnDate.length > 0 ? `On ${args.date}, you have: ${eventsOnDate.map(e => `${e.title} at ${e.start.toDate().toLocaleTimeString()}`).join(', ')}.` : `No events found for ${args.date}.`;
                } else if (call.name === 'getStudyPlans') {
                     resultText = userStudyPlans.length > 0 ? `You have ${userStudyPlans.length} study plan(s): ${userStudyPlans.map(p => p.title).join(', ')}.` : "You have no study plans.";
                } else if (call.name === 'getStudyPlanDetails') {
                    const args = call.args as { title: string };
                    const plan = userStudyPlans.find(p => p.title.toLowerCase() === args.title.toLowerCase());
                    resultText = plan ? `Schedule for '${plan.title}': ${plan.schedule.map(item => `${item.day}: ${item.task}`).join('; ')}` : `Could not find a plan named '${args.title}'.`;
                }
                
                const functionResponseStream = await chat.sendMessageStream({ message: [{ functionResponse: { name: call.name, response: { result: resultText } } }] });
                for await (const finalChunk of functionResponseStream) {
                    if (finalChunk.text) finalResponseText += finalChunk.text;
                }
            } else {
                finalResponseText = aggregatedText;
            }

            if(finalResponseText){
                const modelMessage: ChatMessage = { role: 'model', text: finalResponseText };
                setMessages(prev => [...prev, modelMessage]);
                await db.doc(`artifacts/${appId}/users/${userId}/chatHistories/${sessionId}`).update({
                    messages: arrayUnion(modelMessage),
                    updatedAt: Timestamp.now()
                });
            }

        } catch (error) {
            console.error("AI Chat Error:", error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, something went wrong.' };
            setMessages(prev => [...prev, errorMessage]);
             if (sessionId) {
                await db.doc(`artifacts/${appId}/users/${userId}/chatHistories/${sessionId}`).update({
                    messages: arrayUnion(errorMessage),
                    updatedAt: Timestamp.now()
                });
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} t={t} getThemeClasses={getThemeClasses} onProfileUpdate={onProfileUpdate}/>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end justify-center" onClick={handleClose}>
                <div onClick={e => e.stopPropagation()} onAnimationEnd={() => { if (isClosing) onClose(); }}
                    className={`bg-slate-100 w-full max-w-2xl h-[90vh] md:h-[85vh] rounded-t-2xl shadow-2xl flex flex-col transform transition-transform duration-300 ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
                    <style>{`
                        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                        @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
                        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
                        .animate-slide-down { animation: slideDown 0.3s ease-in forwards; }
                        .chat-scroll::-webkit-scrollbar { width: 6px; }
                        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
                        .chat-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
                        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #aaa; }
                    `}</style>

                    <header className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            {view === 'history' ? <ArrowLeft onClick={() => setView('chat')} className="cursor-pointer"/> : <img src={botAvatar} alt="Bot Avatar" className="w-10 h-10 rounded-full object-cover" />}
                            <h2 className={`text-xl font-bold ${getThemeClasses('text-strong')}`}>{view === 'chat' ? botName : t('chat_history_title')}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                             {view === 'chat' && <button onClick={() => setView('history')} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><History/></button>}
                             <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><Settings/></button>
                             <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><X/></button>
                        </div>
                    </header>
                    
                    <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6 chat-scroll">
                        {view === 'chat' ? (
                            <>
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                        {msg.role === 'model' && <img src={botAvatar} alt="Bot Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                                        <div className={`p-3 rounded-2xl max-w-lg shadow-sm ${msg.role === 'user' ? `${getThemeClasses('bg')} text-white rounded-br-none` : 'bg-white text-gray-800 rounded-bl-none'}`}>
                                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}></div>
                                        </div>
                                        {msg.role === 'user' && (user.profilePictureUrl && user.profilePictureUrl !== 'NONE' ? <img src={user.profilePictureUrl} alt="User Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${getThemeClasses('bg')}`}>{user.userName.charAt(0).toUpperCase()}</div>)}
                                    </div>
                                ))}
                                {isLoading && <div className="flex items-end gap-3"><img src={botAvatar} alt="Bot Avatar" className="w-8 h-8 rounded-full object-cover" /><div className="p-3 rounded-2xl rounded-bl-none bg-white shadow-sm"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div></div></div></div>}
                            </>
                        ) : (
                            <div className="space-y-3">
                                {chatHistories.length === 0 && (
                                    <div className="text-center py-10 text-gray-500">
                                        <History className="mx-auto h-16 w-16 text-gray-300" />
                                        <p className="mt-2 font-semibold">No chat history yet.</p>
                                        <p className="text-sm">Start a new conversation to see it here.</p>
                                    </div>
                                )}
                                {chatHistories.map(history => (
                                    <div key={history.id} onClick={() => handleLoadChat(history.id)} className="p-3 bg-white rounded-lg shadow-sm cursor-pointer hover:bg-gray-50">
                                        <p className="font-semibold truncate">{history.title.replace(/\**/g, '')}</p>
                                        <p className="text-xs text-gray-500">{history.updatedAt.toDate().toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {view === 'chat' && (
                        <footer className="flex-shrink-0 p-3 bg-white/80 backdrop-blur-sm border-t">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage(e as any);
                                        }
                                    }}
                                    placeholder={t('ai_chat_placeholder')}
                                    className={`w-full py-3 px-5 bg-gray-100 rounded-2xl border-transparent focus:outline-none focus:ring-2 ${getThemeClasses('ring')} resize-none overflow-y-auto`}
                                    rows={1}
                                    style={{ maxHeight: '120px', lineHeight: '1.5rem' }}
                                    disabled={isLoading}
                                    autoFocus
                                />
                                <button type="submit" disabled={isLoading || !inputValue.trim()} className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-white shadow-md transition-all duration-200 active:scale-90 hover:scale-105 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 disabled:scale-100`}>
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </form>
                        </footer>
                    )}
                </div>
            </div>
        </>
    );
};

export default AIChatView;
