
import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface InfoViewProps {
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  setCurrentView: (view: string) => void;
}

const InfoView: React.FC<InfoViewProps> = ({ t, getThemeClasses, setCurrentView }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center">
        <button type="button" onClick={() => setCurrentView('settings')} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <ChevronLeft />
        </button>
        <h2 className={`text-2xl font-bold text-center flex-grow ${getThemeClasses('text-strong')}`}>{t('app_info')}</h2>
      </div>
      <div className={`p-6 rounded-lg ${getThemeClasses('bg-light')} space-y-6 text-gray-700`}>
        <div>
            <h3 className={`font-bold text-xl mb-2 ${getThemeClasses('text')}`}>Onze Missie</h3>
            <p>Schoolmaps is ontworpen als jouw ultieme partner voor het organiseren van je schoolleven. Ons doel is om alle tools die je nodig hebt voor succes op één centrale, intuïtieve en motiverende plek aan te bieden, zodat jij je kunt focussen op wat echt telt: leren en groeien.</p>
        </div>
        <div>
            <h3 className={`font-bold text-xl mb-2 ${getThemeClasses('text')}`}>Dashboard in één Oogopslag</h3>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
                <li><b>Bestandsbeheer:</b> Upload en organiseer al je schoolbestanden per vak. Voeg titels en beschrijvingen toe om alles snel terug te vinden. Nooit meer zoeken naar dat ene verslag!</li>
                <li><b>Intelligente Agenda:</b> Houd al je toetsen, huiswerk en presentaties bij. Met de AI Rooster Import-functie maak je in seconden een volledig weekschema door simpelweg je rooster te plakken.</li>
            </ul>
        </div>
        <div>
            <h3 className={`font-bold text-xl mb-2 ${getThemeClasses('text')}`}>Geef je Studie een Boost</h3>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
                <li><b>Flashcards 2.0:</b> Maak digitale flashcard-decks en leer efficiënt met ons Spaced Repetition Systeem (SRS) of test je kennis met de multiple choice-modus.</li>
                <li><b>Notities & Taken:</b> Leg snel ideeën vast in notities, georganiseerd per vak, of houd je voortgang bij met een simpele, effectieve takenlijst met herinneringen.</li>
                <li><b>Studeertimer & Planner:</b> Gebruik de Pomodoro-timer om gefocust te blijven en laat de AI Studieplanner een gepersonaliseerd leerschema voor je toetsen genereren.</li>
                <li><b>Voortgangsmonitor:</b> Krijg inzicht in waar je je tijd en moeite in steekt met visuele grafieken over je studie-activiteiten per vak.</li>
            </ul>
        </div>
         <div>
            <h3 className={`font-bold text-xl mb-2 ${getThemeClasses('text')}`}>Jouw Persoonlijke AI Assistent</h3>
            <p>Stel vragen, laat samenvattingen maken of beheer je agenda door simpelweg te chatten met je eigen, personaliseerbare AI-assistent. Een studiehulp die altijd voor je klaarstaat.</p>
        </div>
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>{t('version')} 1.3.0</p>
          <p>&copy; 2025 Schoolmaps. {t('copyright')}</p>
        </div>
      </div>
    </div>
  );
};

export default InfoView;