import React, { useState } from 'react';
import type { AppUser } from '../../types';
import { Rocket } from 'lucide-react';

interface AISetupViewProps {
  user: AppUser;
  onFinish: () => void;
  onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
}

const AISetupView: React.FC<AISetupViewProps> = ({ user, onFinish, onProfileUpdate, t, getThemeClasses }) => {
  const [botName, setBotName] = useState(user.aiBotName || 'AI Assistent');
  const [isSaving, setIsSaving] = useState(false);

  const handleFinish = async () => {
    setIsSaving(true);
    await onProfileUpdate({
      aiBotName: botName.trim() || 'AI Assistent',
      aiBotAvatarUrl: null, // Always set to null
      hasCompletedOnboarding: true,
    });
    // No need to set isSaving to false, as the component will unmount
    onFinish();
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 animate-fade-in-slow ${getThemeClasses('bg')}`}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
        <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 ${getThemeClasses('bg-light')}`}>
            <div className={getThemeClasses('text')}>
                <Rocket className="w-12 h-12" />
            </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('customize_ai_title')}</h1>
        <p className="text-gray-600 mb-6">Personaliseer je slimme studiehulpje.</p>
        
        <div className="space-y-4 text-left">
          <div>
            <label className="block text-gray-800 text-sm font-bold mb-2">{t('bot_name_placeholder')}</label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder={'e.g., Study Bot'}
              className={`shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${getThemeClasses('ring')}`}
            />
          </div>
        </div>
        
        <button
          onClick={handleFinish}
          disabled={isSaving}
          className={`w-full mt-6 font-bold py-3 px-4 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-[.98] disabled:opacity-70`}
        >
          {isSaving ? t('saving') : t('intro_finish_button')}
        </button>
      </div>
    </div>
  );
};

export default AISetupView;