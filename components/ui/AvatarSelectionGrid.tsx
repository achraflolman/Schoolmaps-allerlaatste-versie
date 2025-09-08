import React from 'react';
import { CheckCircle } from 'lucide-react';
import { availableAvatars } from '../../constants/avatars';

interface AvatarSelectionGridProps {
  selectedAvatar: string | null;
  setSelectedAvatar: (url: string | null) => void;
  userName: string;
  t: (key: string) => string;
  getThemeClasses: (variant: string) => string;
}

const AvatarSelectionGrid: React.FC<AvatarSelectionGridProps> = ({ selectedAvatar, setSelectedAvatar, userName, t, getThemeClasses }) => {
  const isNoAvatarSelected = selectedAvatar === null || selectedAvatar === 'NONE';
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U';

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-80 overflow-y-auto p-2 bg-gray-50 rounded-lg">
      {/* No Avatar Option */}
      <div
        onClick={() => setSelectedAvatar(null)}
        className={`relative cursor-pointer p-2 rounded-lg transition-all duration-200 ${isNoAvatarSelected ? 'ring-2 ' + getThemeClasses('ring') : ''}`}
      >
        <div className={`w-full aspect-square rounded-full flex items-center justify-center text-white text-3xl font-bold ${getThemeClasses('bg')}`}>
          {initial}
        </div>
        {isNoAvatarSelected && (
          <CheckCircle className={`absolute -top-1 -right-1 w-6 h-6 text-white ${getThemeClasses('bg')} rounded-full p-0.5`} />
        )}
        <p className="text-xs text-center font-semibold mt-1">{t('no_avatar_option')}</p>
      </div>

      {/* Avatar List */}
      {availableAvatars.map((avatarUrl) => (
        <div
          key={avatarUrl}
          onClick={() => setSelectedAvatar(avatarUrl)}
          className={`relative cursor-pointer p-2 rounded-lg transition-all duration-200 ${selectedAvatar === avatarUrl ? 'ring-2 ' + getThemeClasses('ring') : ''}`}
        >
          <img src={avatarUrl} alt="Avatar" className="w-full aspect-square rounded-full object-cover" />
          {selectedAvatar === avatarUrl && (
            <CheckCircle className={`absolute -top-1 -right-1 w-6 h-6 text-white ${getThemeClasses('bg')} rounded-full p-0.5`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default AvatarSelectionGrid;
