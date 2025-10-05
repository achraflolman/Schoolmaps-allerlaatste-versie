import React, { useState, useEffect } from 'react';
import type { AppUser } from '../../types';
import AvatarSelectionGrid from './AvatarSelectionGrid';

interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string | null) => void;
  currentUser: AppUser;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
}

const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({ isOpen, onClose, onSave, currentUser, t, getThemeClasses }) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentUser.profilePictureUrl);

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(currentUser.profilePictureUrl === 'NONE' ? null : currentUser.profilePictureUrl);
    }
  }, [isOpen, currentUser.profilePictureUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60] animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{t('avatar_selection_title')}</h3>
        
        <AvatarSelectionGrid
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          userName={currentUser.userName}
          t={t}
          getThemeClasses={getThemeClasses}
        />

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
          <button onClick={handleSave} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-colors active:scale-95 w-32`}>
            {t('save_avatar_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarSelectionModal;