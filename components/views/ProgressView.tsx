import React, { useMemo } from 'react';
import type { AppUser, CalendarEvent, FileData, Note, FlashcardSet } from '../../types';
import { BarChart3, Clock, Layers, CalendarCheck, ArrowLeft } from 'lucide-react';

interface ProgressViewProps {
  user: AppUser;
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
  tSubject: (key: string) => string;
  userEvents: CalendarEvent[];
  allUserFiles: FileData[];
  allUserNotes: Note[];
  allUserFlashcardSets: FlashcardSet[];
  onBack?: () => void;
}

const COLORS = [
  '#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1',
  '#d946ef', '#f97316', '#eab308', '#22c55e'
];

const PieChart: React.FC<{ data: { name: string; value: number; color: string }[], size?: number }> = ({ data, size = 200 }) => {
    if (!data || data.length === 0) return null;
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return null;

    let cumulative = 0;

    const paths = data.map((item, index) => {
        const percentage = item.value / total;
        const startAngle = (cumulative / total) * 360;
        const endAngle = ((cumulative + item.value) / total) * 360;
        cumulative += item.value;

        const largeArcFlag = percentage > 0.5 ? 1 : 0;
        const x1 = 50 + 45 * Math.cos(Math.PI * (startAngle - 90) / 180);
        const y1 = 50 + 45 * Math.sin(Math.PI * (startAngle - 90) / 180);
        const x2 = 50 + 45 * Math.cos(Math.PI * (endAngle - 90) / 180);
        const y2 = 50 + 45 * Math.sin(Math.PI * (endAngle - 90) / 180);

        return (
            <path
                key={index}
                d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                fill={item.color}
            />
        );
    });

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
            {paths}
        </svg>
    );
};

const ChartSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    t: (key: string) => string;
    animationDelay?: string;
    children: React.ReactNode;
}> = ({ title, icon, t, children, animationDelay = '0s' }) => {
    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg" style={{ animationDelay, opacity: 0, animationFillMode: 'forwards', animationName: 'fadeInUp', animationDuration: '0.5s' }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">{icon} {title}</h3>
            {children}
        </div>
    );
};

const ProgressView: React.FC<ProgressViewProps> = ({ user, t, getThemeClasses, tSubject, userEvents, allUserFiles, allUserNotes, allUserFlashcardSets, onBack }) => {
  
    const timeData = useMemo(() => {
        const dataMap = new Map<string, number>();
        userEvents.forEach(event => {
            const durationMinutes = ((event.end as any).toMillis() - (event.start as any).toMillis()) / 60000;
            dataMap.set(event.subject, (dataMap.get(event.subject) || 0) + durationMinutes);
        });
        return Array.from(dataMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value);
    }, [userEvents]);
    
    const timeChartData = useMemo(() => timeData.map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] })), [timeData]);
    const totalTimeValue = useMemo(() => timeData.reduce((acc, item) => acc + item.value, 0), [timeData]);

    const contentData = useMemo(() => {
        const dataMap = new Map<string, number>();
        allUserFiles.forEach(item => dataMap.set(item.subject, (dataMap.get(item.subject) || 0) + 1));
        allUserNotes.forEach(item => dataMap.set(item.subject, (dataMap.get(item.subject) || 0) + 1));
        allUserFlashcardSets.forEach(item => dataMap.set(item.subject, (dataMap.get(item.subject) || 0) + 1));
        return Array.from(dataMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value);
    }, [allUserFiles, allUserNotes, allUserFlashcardSets]);

    const contentChartData = useMemo(() => contentData.map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] })), [contentData]);
    const totalContentValue = useMemo(() => contentData.reduce((acc, item) => acc + item.value, 0), [contentData]);

    const eventTypeData = useMemo(() => {
        const typeMap = new Map<string, number>();
        userEvents.forEach(event => {
            typeMap.set(event.type, (typeMap.get(event.type) || 0) + 1);
        });
        return Array.from(typeMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [userEvents]);
    const maxEventTypeValue = useMemo(() => Math.max(...eventTypeData.map(d => d.value), 0), [eventTypeData]);

    return (
        <div className="space-y-6">
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <div className="flex items-center">
                {onBack && <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>}
                <h2 className={`text-3xl font-bold text-center flex-grow flex items-center justify-center gap-2 ${getThemeClasses('text-strong')}`}>
                    <BarChart3 /> {t('progress')}
                </h2>
                <div className="w-9 h-9"></div> {/* Placeholder */}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <ChartSection title={t('time_spent_per_subject')} icon={<Clock className={getThemeClasses('text')} />} t={t}>
                        {timeData.length === 0 || totalTimeValue === 0 ? (
                            <p className="text-gray-500 italic text-center py-8">{t('no_data_for_chart')}</p>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <div className="flex-shrink-0"><PieChart data={timeChartData} size={180} /></div>
                                <div className="flex-grow w-full">
                                    <p className="font-bold text-lg mb-2">{t('total_study_time')}: {(totalTimeValue / 60).toFixed(1)} {t('hours')}</p>
                                    <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                                        {timeChartData.map(item => (
                                            <li key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /><span className="font-semibold">{tSubject(item.name)}</span></div>
                                                <span className="text-gray-600">{(item.value / 60).toFixed(1)} {t('hours')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </ChartSection>
                </div>
                
                <ChartSection title={t('content_per_subject')} icon={<Layers className={getThemeClasses('text')} />} t={t} animationDelay="0.2s">
                     {contentData.length === 0 || totalContentValue === 0 ? (
                        <p className="text-gray-500 italic text-center py-8">{t('no_data_for_chart')}</p>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex-shrink-0"><PieChart data={contentChartData} size={180} /></div>
                            <div className="flex-grow w-full">
                                <p className="font-bold text-lg mb-2">{t('total_items')}: {Math.round(totalContentValue)} {t('items')}</p>
                                <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                                    {contentChartData.map(item => (
                                        <li key={item.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /><span className="font-semibold">{tSubject(item.name)}</span></div>
                                            <span className="text-gray-600">{Math.round(item.value)} {t('items')}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </ChartSection>

                <ChartSection title={t('event_type_distribution')} icon={<CalendarCheck className={getThemeClasses('text')} />} t={t} animationDelay="0.4s">
                    {eventTypeData.length === 0 ? (
                        <p className="text-gray-500 italic text-center py-8">{t('no_data_for_chart')}</p>
                    ) : (
                        <div className="space-y-3 pt-4">
                            {eventTypeData.map((item, index) => (
                                <div key={item.name} className="space-y-1">
                                    <div className="flex justify-between items-center text-sm font-semibold">
                                        <span>{t(`event_${item.name}`)}</span>
                                        <span>{item.value}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4">
                                        <div 
                                            className="h-4 rounded-full transition-all duration-500"
                                            style={{ 
                                                width: `${(item.value / maxEventTypeValue) * 100}%`,
                                                backgroundColor: COLORS[index % COLORS.length]
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ChartSection>
            </div>
        </div>
    );
};

export default ProgressView;