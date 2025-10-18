
import React, { useEffect, useState } from 'react';

interface LogoutAnimationViewProps {
  getThemeClasses: (variant: string) => string;
  onAnimationEnd: () => void;
  t: (key: string) => string;
  userName: string;
  triggerHapticFeedback: (pattern?: number | number[]) => void;
}

const LogoutAnimationView: React.FC<LogoutAnimationViewProps> = ({ getThemeClasses, onAnimationEnd, t, userName, triggerHapticFeedback }) => {
  const [text, setText] = useState('');
  const firstName = userName.split(' ')[0] || '';
  const fullText = `Tot ziens, ${firstName}! 👋`;

  useEffect(() => {
    triggerHapticFeedback([50, 100, 50]); // Vibrate on appear
    let index = 0;
    const intervalId = setInterval(() => {
      if (index >= fullText.length) {
        clearInterval(intervalId);
        setTimeout(() => {
          onAnimationEnd();
        }, 1500); // Wait 1.5s after typing
        return;
      }
      index++;
      setText(fullText.slice(0, index));
    }, 100);

    return () => clearInterval(intervalId);
  }, [fullText, onAnimationEnd, triggerHapticFeedback]);

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 animate-fade-in-slow ${getThemeClasses('bg')}`}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col justify-center" style={{ minHeight: '420px' }}>
        <div className="w-40 h-40 mx-auto rounded-full overflow-hidden shadow-lg border-4 border-white bg-blue-100 flex items-center justify-center">
          <img
            src="https://i.imgur.com/utgQioy.png"
            alt="Logout Robot"
            className="w-full h-full object-cover p-2"
          />
        </div>
        <h1 className="text-3xl font-semibold h-20 mt-4 text-gray-800">
          {text}
          <span className="animate-pulse">|</span>
        </h1>
      </div>
    </div>
  );
};

export default LogoutAnimationView;