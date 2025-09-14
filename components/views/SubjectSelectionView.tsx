import React, { useMemo } from 'react';
import type { AppUser } from '../../types';
import { Folder } from 'lucide-react';

interface SubjectSelectionViewProps {
  user: AppUser;
  t: (key: string) => string;
  tSubject: (key: string) => string;
  getThemeClasses: (variant: string) => string;
  setCurrentSubject: (subject: string) => void;
}

const SubjectSelectionView: React.FC<SubjectSelectionViewProps> = ({ user, t, tSubject, getThemeClasses, setCurrentSubject }) => {
  const userSubjects = useMemo(() => {
    const combined = new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]);
    return Array.from(combined);
  }, [user.selectedSubjects, user.customSubjects]);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className={`text-3xl font-bold text-center ${getThemeClasses('text-strong')}`}>{t('my_files')}</h2>
      
      {userSubjects.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
            <Folder className="mx-auto h-20 w-20 text-gray-300" />
            <h3 className="mt-4 text-xl font-semibold text-gray-700">{t('profile_incomplete_message')}</h3>
            <p>{t('go_to_settings_message')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {userSubjects.map(subject => (
            <button
              key={subject}
              onClick={() => setCurrentSubject(subject)}
              className={`p-6 bg-white rounded-lg shadow-md font-semibold text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 ${getThemeClasses('ring')} ${getThemeClasses('text-strong')}`}
            >
              <Folder className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />
              {tSubject(subject)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubjectSelectionView;
