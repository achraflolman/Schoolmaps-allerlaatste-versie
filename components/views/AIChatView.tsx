import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Tool, Type, GenerateContentResponse, FunctionCall } from '@google/genai';
import { Send, Loader2, Bot, User, X, Settings, Save, History, PlusCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { Timestamp, db, appId, arrayUnion } from '../../services/firebase';
import type { AppUser, ModalContent, CalendarEvent, StudyPlan, ChatMessage, ChatHistory } from '../../types';

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatInlineMarkdown = (value: string) => {
    let formatted = value;
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    return formatted;
};

const renderMarkdown = (markdown: string) => {
    if (!markdown) return '';

    const lines = markdown.split(/\r?\n/);
    const html: string[] = [];
    let inUnorderedList = false;
    let inOrderedList = false;

    const closeLists = () => {
        if (inUnorderedList) {
            html.push('</ul>');
            inUnorderedList = false;
        }
        if (inOrderedList) {
            html.push('</ol>');
            inOrderedList = false;
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^[-*+]\s+/.test(trimmed)) {
            if (!inUnorderedList) {
                closeLists();
                inUnorderedList = true;
                html.push('<ul class="list-disc pl-5 space-y-1">');
            }
            const content = trimmed.replace(/^[-*+]\s+/, '');
            html.push(`<li>${formatInlineMarkdown(escapeHtml(content))}</li>`);
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOrderedList) {
                closeLists();
                inOrderedList = true;
                html.push('<ol class="list-decimal pl-5 space-y-1">');
            }
            const content = trimmed.replace(/^\d+\.\s+/, '');
            html.push(`<li>${formatInlineMarkdown(escapeHtml(content))}</li>`);
            continue;
        }

        closeLists();

        if (!trimmed) {
            html.push('<p>&nbsp;</p>');
            continue;
        }

        html.push(`<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`);
    }

    closeLists();

    return html.join('');
};

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
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onProfileUpdate({
        aiBotName: tempBotName.trim() || 'AI Assistent',
        aiBotAvatarUrl: null, // Always set to null
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
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">{t('cancel_button')}</button>
          <button onClick={handleSave} disabled={isSaving} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} w-32 flex items-center justify-center`}>
            {isSaving ? <Loader2 className="animate-spin" /> : t('save_avatar_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatBubble: React.FC<{
    msg: ChatMessage;
    isTyping: boolean;
    getThemeClasses: (variant: string) => string;
    user: AppUser;
}> = ({ msg, isTyping, getThemeClasses, user }) => {
    const [displayedText, setDisplayedText] = useState(isTyping ? '' : msg.text);

    useEffect(() => {
        if (isTyping) {
            let i = 0;
            const textToType = msg.text || '';
            setDisplayedText(''); // Reset before typing
            const intervalId = setInterval(() => {
                if (i < textToType.length) {
                    setDisplayedText(prev => prev + textToType.charAt(i));
                    i++;
                } else {
                    clearInterval(intervalId);
                }
            }, 15); // Adjust typing speed
            return () => clearInterval(intervalId);
        } else {
            setDisplayedText(msg.text);
        }
    }, [isTyping, msg.text]);
    
    const bubbleContent = useMemo(() => {
        return { __html: renderMarkdown(displayedText || '') };
    }, [displayedText]);

    return (
        <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && <div className={`p-2 rounded-full flex-shrink-0 text-white ${getThemeClasses('bg')}`}><Bot size={16}/></div>}
            <div
                className={`prose max-w-xs p-3 rounded-xl ${msg.role === 'model' ? 'bg-gray-100' : `${getThemeClasses('bg')} text-white`}`}
                dangerouslySetInnerHTML={bubbleContent}
            ></div>
            {msg.role === 'user' && (
                user.profilePictureUrl && user.profilePictureUrl !== 'NONE' 
                    ? <img src={user.profilePictureUrl} className="w-8 h-8 rounded-full object-cover"/> 
                    : <div className="p-2 rounded-full bg-gray-200"><User size={16}/></div>
            )}
        </div>
    );
};


const AIChatView: React.FC<AIChatViewProps> = ({
    user, userId, t, tSubject, getThemeClasses, showAppModal, onClose,
    addCalendarEvent, removeCalendarEvent, userEvents, userStudyPlans,
    onProfileUpdate, chat, messages, setMessages, chatHistories,
    currentChatSessionId, setCurrentChatSessionId
}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const generateTitleForChat = async (chatMessages: ChatMessage[]): Promise<string> => {
        if (!process.env.API_KEY) return 'Chat';
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Summarize the following conversation in 5 words or less to use as a title. The conversation is between a user and a study assistant. Focus on the main topic. Conversation:\n\n${chatMessages.slice(1, 4).map(m => `${m.role}: ${m.text}`).join('\n')}`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            return response.text.trim().replace(/["']/g, '');
        } catch (error) {
            console.error("Title generation failed:", error);
            return t('error_generating_title');
        }
    };
    
    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            let response: GenerateContentResponse = await chat.sendMessage({ message: userMessage.text });

            while (response.functionCalls && response.functionCalls.length > 0) {
                const functionResponses = [];
                for (const funcCall of response.functionCalls) {
                    let result: any;
                    switch (funcCall.name) {
                        case 'addCalendarEvent': {
                            const { title, date, time, subject, type } = funcCall.args;
                            const start = new Date(`${date}T${time}`);
                            const end = new Date(start.getTime() + 60 * 60 * 1000);
                            result = await addCalendarEvent({ title, start: Timestamp.fromDate(start), end: Timestamp.fromDate(end), subject, type });
                            break;
                        }
                        case 'removeCalendarEvent':
                            result = await removeCalendarEvent(funcCall.args.title, funcCall.args.date);
                            break;
                        case 'getCalendarEvents': {
                            const date = new Date(funcCall.args.date + "T00:00:00");
                            const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59);
                            const events = userEvents
                                .filter(e => e.start.toDate() >= date && e.start.toDate() <= endOfDay)
                                .sort((a, b) => a.start.toMillis() - b.start.toMillis());

                            if (events.length > 0) {
                                result = `Here are the events for ${funcCall.args.date}:\n` + 
                                         events.map(e => `- ${e.start.toDate().toLocaleTimeString(user.languagePreference || 'nl-NL', {hour: '2-digit', minute:'2-digit'})}: ${e.title} (${tSubject(e.subject)})`).join('\n');
                            } else {
                                result = `There are no events scheduled for ${funcCall.args.date}.`;
                            }
                            break;
                        }
                        case 'getStudyPlans':
                            result = userStudyPlans.length > 0 ? JSON.stringify(userStudyPlans.map(p => ({ title: p.title, testDate: p.testDate.toDate().toISOString().split('T')[0] }))) : "No study plans found.";
                            break;
                        case 'getStudyPlanDetails': {
                            const plan = userStudyPlans.find(p => p.title.toLowerCase() === funcCall.args.title.toLowerCase());
                            result = plan ? JSON.stringify(plan.schedule) : `Study plan with title "${funcCall.args.title}" not found.`;
                            break;
                        }
                        default: result = { error: "Unknown function" };
                    }
                    functionResponses.push({ id: funcCall.id, name: funcCall.name, response: { result } });
                }
                response = await chat.sendMessage({ functionResponses });
            }
            
            setIsLoading(false);
            const modelMessage: ChatMessage = { role: 'model', text: response.text || "Sorry, I received an empty response." };
            setMessages(prev => [...prev, modelMessage]);

            // This effect happens after the state update that includes the model's message
            // so `allMessages` will be up-to-date for saving.
        } catch (error) {
            setIsLoading(false);
            setMessages(prev => [...prev, { role: 'model', text: `Sorry, something went wrong. Error: ${(error as Error).message}` }]);
        }
    };
    
    // Effect for saving chat history after a model's response is fully added
    useEffect(() => {
        if (messages.length > 0 && messages[messages.length - 1].role === 'model') {
            const saveHistory = async () => {
                if (currentChatSessionId) {
                    await db.doc(`users/${userId}/chatHistories/${currentChatSessionId}`).update({ messages, updatedAt: Timestamp.now() });
                } else {
                    const title = messages.length > 2 ? await generateTitleForChat(messages) : t('new_chat');
                    const newDocRef = await db.collection(`users/${userId}/chatHistories`).add({
                        userId, title, messages, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                    });
                    setCurrentChatSessionId(newDocRef.id);
                }
            };
            saveHistory();
        }
    }, [messages]);
    
    const handleHistorySelect = (history: ChatHistory) => {
        setCurrentChatSessionId(history.id);
        setMessages(history.messages);
        setIsHistoryOpen(false);
    };

    const handleNewChat = () => {
        onClose(); // Resets state in parent
        setIsHistoryOpen(false);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] sm:w-96 h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-fade-in-up">
            <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} {...{ user, t, getThemeClasses, onProfileUpdate }}/>
            <header className={`p-4 rounded-t-2xl flex justify-between items-center text-white ${getThemeClasses('bg')}`}>
                <div className="flex items-center gap-3">
                    <Bot className="w-6 h-6"/>
                    <h3 className="font-bold text-lg">{user.aiBotName || 'AI Assistant'}</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="p-2 rounded-full hover:bg-white/20"><History size={20}/></button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-white/20"><Settings size={20}/></button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20"><X size={20}/></button>
                </div>
            </header>

            {isHistoryOpen && (
                <div className="absolute inset-0 bg-white z-10 flex flex-col p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-lg">{t('chat_history_title')}</h4>
                        <button onClick={() => setIsHistoryOpen(false)} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft/></button>
                    </div>
                     <button onClick={handleNewChat} className={`w-full mb-4 flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')}`}>
                        <PlusCircle size={18}/> {t('new_chat')}
                    </button>
                    <div className="flex-grow overflow-y-auto space-y-2">
                        {chatHistories.map(h => (
                            <div key={h.id} onClick={() => handleHistorySelect(h)} className={`p-3 rounded-lg cursor-pointer ${currentChatSessionId === h.id ? getThemeClasses('bg-light') : 'bg-gray-100 hover:bg-gray-200'}`}>
                                <p className="font-semibold truncate">{h.title}</p>
                                <p className="text-xs text-gray-500">{(h.updatedAt as any).toDate().toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                   <ChatBubble 
                        key={index}
                        msg={msg}
                        isTyping={msg.role === 'model' && index === messages.length - 1 && !isLoading}
                        getThemeClasses={getThemeClasses}
                        user={user}
                   />
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full flex-shrink-0 text-white ${getThemeClasses('bg')}`}><Bot size={16}/></div>
                        <div className="p-3 rounded-xl bg-gray-100"><Loader2 className="animate-spin" /></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder={t('ai_chat_placeholder')} className="flex-grow p-2 border rounded-lg"/>
                    <button type="submit" disabled={isLoading} className={`p-3 rounded-lg text-white ${getThemeClasses('bg')} disabled:opacity-50`}>
                        {isLoading ? <Loader2 className="animate-spin"/> : <Send/>}
                    </button>
                </form>
            </div>
             <style>{`.animate-fade-in-up { animation: fadeInUp 0.3s ease-out; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; translateY(0); } }`}</style>
        </div>
    );
};

export default AIChatView;