import React, { useMemo } from 'react';
import type { AppUser } from '../../types';
import {
    Folder, Globe, Calculator, Atom, FlaskConical, Dna,
    ScrollText, AreaChart, Users, Languages, Code, Paintbrush,
    Music, Dumbbell, Film
} from 'lucide-react';

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

  const subjectIcons = useMemo(() => ({
    'aardrijkskunde': <Globe className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'wiskunde': <Calculator className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'natuurkunde': <Atom className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'scheikunde': <FlaskConical className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'biologie': <Dna className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'geschiedenis': <ScrollText className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'latijn': <ScrollText className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'economie': <AreaChart className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'maatschappijleer': <Users className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'nederlands': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'engels': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'frans': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'duits': <Languages className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'informatica': <Code className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'kunst': <Paintbrush className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'muziek': <Music className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'lichamelijke_opvoeding': <Dumbbell className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'ckv': <Film className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />,
    'default': <Folder className={`w-12 h-12 mx-auto mb-2 ${getThemeClasses('text')}`} />
  }), [getThemeClasses]);

  const getIconForSubject = (subjectKey: string) => {
      return subjectIcons[subjectKey as keyof typeof subjectIcons] || subjectIcons['default'];
  };

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
              {getIconForSubject(subject)}
              {tSubject(subject)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubjectSelectionView;