
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Tool, Type } from '@google/genai';
import { Send, Loader2, Bot, User, X, Settings, Save } from 'lucide-react';
import { Timestamp } from '../../services/firebase';
import type { AppUser, ModalContent, CalendarEvent, StudyPlan } from '../../types';
import AvatarSelectionGrid from '../ui/AvatarSelectionGrid';

interface AIChatViewProps {
    user: AppUser;
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
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
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
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : t('save_button')}
          </button>
        </div>
      </div>
    </div>
  );
};


const AIChatView: React.FC<AIChatViewProps> = ({ user, t, tSubject, getThemeClasses, showAppModal, onClose, addCalendarEvent, removeCalendarEvent, userEvents, userStudyPlans, onProfileUpdate }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const botName = user.aiBotName || 'AI Assistent';
    const botAvatar = user.aiBotAvatarUrl || 'https://i.imgur.com/3flLpUQ.png';
    
    const availableSubjects = [...(user.selectedSubjects || []), ...(user.customSubjects || [])];

    const wordCount = useMemo(() => {
        if (!inputValue) return 0;
        return inputValue.trim().split(/\s+/).filter(Boolean).length;
    }, [inputValue]);
    const isOverLimit = wordCount > 100;

    useEffect(() => {
        if (!process.env.API_KEY) {
            console.error("Gemini API key is missing. Please set it in your environment variables.");
            showAppModal({ text: t('error_missing_api_key') });
            onClose();
            return;
        }

        const addEventTool: FunctionDeclaration = {
            name: "addCalendarEvent",
            description: "Adds a new event to the user's calendar. Use the current year for dates unless another year is specified. Today's date is " + new Date().toISOString().split('T')[0],
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the event." },
                    date: { type: Type.STRING, description: "The date of the event in YYYY-MM-DD format." },
                    time: { type: Type.STRING, description: "The start time of the event in HH:MM format." },
                    subject: { type: Type.STRING, description: `The subject for the event. Must be one of: ${availableSubjects.join(', ')}` },
                    type: { type: Type.STRING, description: "The type of event. Must be one of: 'test', 'presentation', 'homework', 'oral', 'other', 'work', 'school'." }
                },
                required: ["title", "date", "time", "subject", "type"]
            }
        };

        const removeEventTool: FunctionDeclaration = {
            name: "removeCalendarEvent",
            description: "Removes an event from the user's calendar. Requires the exact title and date of the event.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the event to remove." },
                    date: { type: Type.STRING, description: "The date of the event to remove in YYYY-MM-DD format." }
                },
                required: ["title", "date"]
            }
        };

        const getEventsTool: FunctionDeclaration = {
            name: "getCalendarEvents",
            description: "Retrieves all calendar events for a specific date to let the user know what's on their schedule.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "The date to fetch events for, in YYYY-MM-DD format." },
                },
                required: ["date"]
            }
        };

        const getStudyPlansTool: FunctionDeclaration = {
            name: "getStudyPlans",
            description: "Retrieves an overview of all the user's study plans.",
            parameters: { type: Type.OBJECT, properties: {} }
        };

        const getStudyPlanDetailsTool: FunctionDeclaration = {
            name: "getStudyPlanDetails",
            description: "Retrieves the detailed schedule for a specific study plan, identified by its title.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The exact title of the study plan to retrieve." }
                },
                required: ["title"]
            }
        };

        const tools: Tool[] = [{ functionDeclarations: [addEventTool, removeEventTool, getEventsTool, getStudyPlansTool, getStudyPlanDetailsTool] }];

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstructionText = t('ai_system_instruction', { botName, userName: user.userName, subjects: availableSubjects.join(', ') });
            
            const chatInstance = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemInstructionText,
                    tools: tools,
                },
            });
            setChat(chatInstance);
             
            if (chatInstance && !isInitialized) {
                setIsInitialized(true);
                setIsLoading(true);

                const getGreeting = async () => {
                    try {
                        const stream = await chatInstance.sendMessageStream({ message: "Greet the user to start the conversation." }); 
                        let greetingText = '';
                        let hasStarted = false;
                        for await (const chunk of stream) {
                            if (chunk.text) {
                                if(!hasStarted) {
                                    setMessages([{ role: 'model', text: '' }]);
                                    hasStarted = true;
                                }
                                greetingText += chunk.text;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].text = greetingText;
                                    return newMessages;
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Failed to get initial greeting:", e);
                        setMessages([{ role: 'model', text: t('ai_chat_welcome') }]);
                    } finally {
                        setIsLoading(false);
                    }
                };
                getGreeting();
            }

        } catch (error) {
            console.error("Failed to initialize AI Chat:", error);
            showAppModal({ text: "Could not start AI Chat session." });
        }
        
        inputRef.current?.focus();

    }, [t, showAppModal, botName, user.userName, isInitialized, user.selectedSubjects, user.customSubjects, onClose]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || !chat || isOverLimit) return;
    
        const userMessageText = inputValue;
        setMessages(prev => [...prev, { role: 'user', text: userMessageText }]);
        setInputValue('');
        setIsLoading(true);
    
        try {
            const stream = await chat.sendMessageStream({ message: userMessageText });
            
            // Aggregate the full response first to handle function calls reliably
            let aggregatedText = '';
            let functionCalls: any[] | undefined;
            for await (const chunk of stream) {
                if (chunk.text) aggregatedText += chunk.text;
                if (chunk.functionCalls) functionCalls = chunk.functionCalls;
            }
    
            // Now, process the aggregated response
            if (functionCalls) {
                const call = functionCalls[0];
                let resultText = '';
    
                if (call.name === 'addCalendarEvent') {
                    const args = call.args as any;
                    const startDateTime = new Date(`${args.date}T${args.time}`);
                    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
                    resultText = await addCalendarEvent({
                        title: args.title, description: `Added by ${botName}`,
                        start: Timestamp.fromDate(startDateTime), end: Timestamp.fromDate(endDateTime),
                        subject: args.subject, type: args.type,
                    });
                } else if (call.name === 'removeCalendarEvent') {
                    const args = call.args as { title: string, date: string };
                    resultText = await removeCalendarEvent(args.title, args.date);
                } else if (call.name === 'getCalendarEvents') {
                    const args = call.args as { date: string };
                    const targetDate = new Date(args.date + 'T00:00:00');
                    const eventsOnDate = userEvents.filter(event => {
                        const eventDate = event.start.toDate();
                        return eventDate.getFullYear() === targetDate.getFullYear() &&
                               eventDate.getMonth() === targetDate.getMonth() &&
                               eventDate.getDate() === targetDate.getDate();
                    });

                    if (eventsOnDate.length > 0) {
                        const eventDescriptions = eventsOnDate.map(e => `${e.title} (${tSubject(e.subject)}) at ${e.start.toDate().toLocaleTimeString(user.languagePreference, { hour: '2-digit', minute: '2-digit' })}`).join(', ');
                        resultText = `On ${args.date}, you have: ${eventDescriptions}.`;
                    } else {
                        resultText = `I couldn't find any events for ${args.date}. Would you like to try another date?`;
                    }
                } else if (call.name === 'getStudyPlans') {
                    if (!userStudyPlans || userStudyPlans.length === 0) {
                        resultText = "The user currently has no study plans.";
                    } else {
                        const planSummaries = userStudyPlans.map(p => 
                            `Plan '${p.title}' for test on ${p.testDate.toDate().toLocaleDateString(user.languagePreference)}. It covers subjects: ${p.subjects.map(s => tSubject(s.subject)).join(', ')}.`
                        ).join('\n');
                        resultText = `The user has ${userStudyPlans.length} study plan(s):\n${planSummaries}`;
                    }
                } else if (call.name === 'getStudyPlanDetails') {
                    const args = call.args as { title: string };
                    const plan = userStudyPlans.find(p => p.title.toLowerCase() === args.title.toLowerCase());
                    if (plan) {
                        const scheduleDetails = plan.schedule.map(item => 
                            `- On ${item.day} at ${item.time}, study for ${tSubject(item.subject)}: '${item.task}'. Tip: ${item.tip}`
                        ).join('\n');
                        resultText = `Here is the schedule for '${plan.title}':\n${scheduleDetails}`;
                    } else {
                        resultText = `Could not find a study plan with the title '${args.title}'. The available plans are: ${userStudyPlans.map(p => p.title).join(', ')}.`;
                    }
                }
    
                // Send the function response back to the model
                const functionResponseStream = await chat.sendMessageStream({ 
                    message: [{ functionResponse: { name: call.name, response: { result: resultText } } }]
                });
    
                // Stream the final text response to the UI
                let finalResponseText = '';
                let hasStarted = false;
                for await (const finalChunk of functionResponseStream) {
                    if (finalChunk.text) {
                        if (!hasStarted) {
                            setMessages(prev => [...prev, { role: 'model', text: '' }]);
                            hasStarted = true;
                        }
                        finalResponseText += finalChunk.text;
                        setMessages(prev => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1].text = finalResponseText;
                            return newMessages;
                        });
                    }
                }
            } else if (aggregatedText) {
                // Handle a regular text response by streaming it to the UI
                setMessages(prev => [...prev, { role: 'model', text: aggregatedText }]);
            }
        } catch (error) {
            console.error("AI Chat Error:", error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, something went wrong.' }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            <AISettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                user={user}
                t={t}
                getThemeClasses={getThemeClasses}
                onProfileUpdate={onProfileUpdate}
            />
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end justify-center" onClick={onClose}>
                <div
                    onClick={e => e.stopPropagation()}
                    className="bg-slate-100 w-full max-w-2xl h-[90vh] md:h-[85vh] rounded-t-2xl shadow-2xl flex flex-col transform transition-transform duration-300 animate-slide-up"
                >
                    <style>{`
                        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
                        .chat-scroll::-webkit-scrollbar { width: 6px; }
                        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
                        .chat-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
                        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #aaa; }
                    `}</style>

                    <header className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <img src={botAvatar} alt="Bot Avatar" className="w-10 h-10 rounded-full object-cover" />
                            <h2 className={`text-xl font-bold ${getThemeClasses('text-strong')}`}>{botName}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><Settings/></button>
                             <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><X/></button>
                        </div>
                    </header>
                    
                    <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6 chat-scroll">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && (
                                    <img src={botAvatar} alt="Bot Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                )}
                                <div className={`p-3 rounded-2xl max-w-lg shadow-sm ${msg.role === 'user' ? `${getThemeClasses('bg')} text-white rounded-br-none` : 'bg-white text-gray-800 rounded-bl-none'}`}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                                {msg.role === 'user' && (
                                    user.profilePictureUrl && user.profilePictureUrl !== 'NONE' ? (
                                        <img src={user.profilePictureUrl} alt="User Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${getThemeClasses('bg')}`}>
                                            {user.userName.charAt(0).toUpperCase()}
                                        </div>
                                    )
                                )}
                            </div>
                        ))}
                        {isLoading && (messages.length === 0 || messages[messages.length - 1].role === 'user') && (
                            <div className="flex items-end gap-3">
                                <img src={botAvatar} alt="Bot Avatar" className="w-8 h-8 rounded-full object-cover" />
                                <div className="p-3 rounded-2xl rounded-bl-none bg-white shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                     <footer className="flex-shrink-0 p-3 bg-white/80 backdrop-blur-sm border-t">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={t('ai_chat_placeholder')}
                                className={`w-full p-3 px-5 bg-gray-100 rounded-full border transition-colors ${isOverLimit ? 'border-red-400 text-red-600' : 'border-transparent'} focus:outline-none focus:ring-2 ${isOverLimit ? 'focus:ring-red-400' : getThemeClasses('ring')}`}
                                disabled={isLoading}
                                autoFocus
                            />
                            <button type="submit" disabled={isLoading || !inputValue.trim() || isOverLimit} className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-white shadow-md transition-all duration-200 active:scale-90 hover:scale-105 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 disabled:scale-100`}>
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </form>
                         <div className="text-right text-xs mt-1 pr-[60px]">
                            <span className={`${isOverLimit ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                                {wordCount}/100
                            </span>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
};

export default AIChatView;
