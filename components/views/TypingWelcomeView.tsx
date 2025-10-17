
import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface TypingWelcomeViewProps {
    onContinue: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    triggerHapticFeedback: (pattern?: number | number[]) => void;
}

const TypingWelcomeView: React.FC<TypingWelcomeViewProps> = ({ onContinue, t, getThemeClasses, triggerHapticFeedback }) => {
    const [text, setText] = useState('');
    const fullText = "Heey! Ik ben Mimi, jouw studiemaatje bij StudyBox 😸";

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            setText(current => {
                if (index >= fullText.length) {
                    clearInterval(intervalId);
                    return current;
                }
                index++;
                return fullText.slice(0, index);
            });
        }, 50);

        return () => clearInterval(intervalId);
    }, [fullText]);

    const handleContinueClick = () => {
        triggerHapticFeedback();
        onContinue();
    };

    return (
        <div className={`min-h-screen w-full flex items-center justify-center p-4 animate-fade-in-slow ${getThemeClasses('bg')}`}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col justify-center" style={{ minHeight: '420px'}}>
                
                <div className="w-40 h-40 mx-auto rounded-full overflow-hidden shadow-lg border-4 border-white bg-blue-100 flex items-center justify-center">
                    <img
                        src="https://i.imgur.com/Lsutr8n.png"
                        alt="Welcome Robot"
                        className="w-full h-full object-cover p-2"
                    />
                </div>

                <h1 className="text-2xl font-semibold h-20 mt-4">
                    {text}
                    <span className="animate-pulse">|</span>
                </h1>

                <button 
                    onClick={handleContinueClick} 
                    className={`w-full mt-6 font-bold py-3 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-[.98] flex items-center justify-center gap-2`}
                >
                    {t('next_button')} <ArrowRight size={18}/>
                </button>
            </div>
             <style>{`
                @keyframes scaleUp { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                .animate-scale-up { animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
             `}</style>
        </div>
    );
};

export default TypingWelcomeView;
