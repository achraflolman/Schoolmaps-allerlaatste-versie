
import React, { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';

interface FaqViewProps {
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  getThemeClasses: (variant: string) => string;
  setCurrentView: (view: string) => void;
}

const FaqView: React.FC<FaqViewProps> = ({ t, getThemeClasses, setCurrentView }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqData = [
    { q: 'Hoe voeg ik nieuwe vakken toe?', a: 'Je kunt nieuwe vakken toevoegen via het \'Instellingen\' menu (tandwiel-icoon). Onder \'Account\' kun je je geselecteerde vakken aanpassen en via het invoerveld ook je eigen, unieke vakken toevoegen.' },
    { q: 'Is mijn data veilig?', a: 'Absoluut. Al je gegevens, zoals bestanden, notities en agenda-items, worden veilig opgeslagen en zijn alleen toegankelijk via jouw persoonlijke account. We delen je data nooit met derden.' },
    { q: 'Kan ik mijn account op meerdere apparaten gebruiken?', a: 'Ja! StudyBox is een web-app, wat betekent dat je kunt inloggen vanaf elke computer, tablet of telefoon met een internetbrowser. Al je gegevens worden automatisch gesynchroniseerd.'},
    { q: 'Wat kan de AI-assistent voor mij doen?', a: 'Je AI-assistent is een krachtige studiehulp. Je kunt hem vragen stellen over schoolonderwerpen, teksten laten samenvatten, of opdrachten geven zoals "voeg een toets Engels toe voor volgende week vrijdag om 10:00". De assistent kan direct je agenda beheren.' },
    { q: 'Hoe werkt het Spaced Repetition Systeem (SRS) voor flashcards?', a: 'SRS is een slimme leermethode. Het systeem berekent wanneer je een kaartje dreigt te vergeten en toont het je precies op dat moment opnieuw. Hierdoor onthoud je informatie veel efficiënter voor de lange termijn.'},
    { q: 'Ik heb een bug gevonden of een suggestie, wat nu?', a: 'Fantastisch! We stellen je feedback enorm op prijs. Ga naar \'Instellingen\' en klik op \'Feedback & Support\'. Daar kun je ons direct een bericht sturen. We lezen alles en proberen de app continu te verbeteren.' }
  ];
  
  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center">
        <button type="button" onClick={() => setCurrentView('settings')} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <ChevronLeft />
        </button>
        <h2 className={`text-2xl font-bold text-center flex-grow ${getThemeClasses('text-strong')}`}>{t('faq')}</h2>
      </div>
      <div className={`p-4 rounded-lg space-y-3 ${getThemeClasses('bg-light')}`}>
        {faqData.map((item, index) => (
          <div key={index} className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300 border ${openFaq === index ? getThemeClasses('border') : 'border-transparent'}`}>
            <button
              onClick={() => toggleFaq(index)}
              className={`w-full flex justify-between items-center p-4 text-left font-semibold hover:bg-gray-50 transition-colors ${openFaq === index ? getThemeClasses('text') : ''}`}
            >
              <span>{item.q}</span>
              <ChevronDown className={`transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`} />
            </button>
            <div
              className="overflow-hidden transition-all duration-500 ease-in-out"
              style={{ maxHeight: openFaq === index ? '200px' : '0px', opacity: openFaq === index ? 1 : 0 }}
            >
              <div className="p-4 pt-0 text-gray-600">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FaqView;