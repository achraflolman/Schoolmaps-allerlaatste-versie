import React from 'react';

interface WelcomeViewProps {
    onFinish: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onFinish, t, getThemeClasses }) => {
    return (
        <div className={`min-h-screen w-full flex items-center justify-center p-4 animate-fade-in-slow ${getThemeClasses('bg')}`}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col justify-center animate-scale-up" style={{ minHeight: '420px'}}>
                
                <lottie-player
                    src="https://lottie.host/178950d3-0d60-4b31-8e39-a91656b8ed83/lK4o2yTo5P.json"
                    background="transparent"
                    speed="1"
                    style={{ width: '250px', height: '250px', margin: '0 auto' }}
                    loop
                    autoplay
                ></lottie-player>

                <h1 className="text-3xl font-bold mt-4">HEY! Welkom bij StudyBox</h1>
                <p className={`text-lg mt-2 font-medium ${getThemeClasses('text')}`}>Laten we het leren makkelijk maken!</p>

                <button 
                    onClick={onFinish} 
                    className={`w-full mt-8 font-bold py-3 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-[.98]`}
                >
                    Aan de slag
                </button>
            </div>
             <style>{`
                @keyframes scaleUp { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                .animate-scale-up { animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
             `}</style>
        </div>
    );
};

export default WelcomeView;