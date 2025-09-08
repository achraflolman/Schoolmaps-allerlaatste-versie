
import React, { useState, useMemo } from 'react';
import { PlusCircle, Trash2, Calculator, Target } from 'lucide-react';

interface GradeCalculatorViewProps {
  t: (key: string, replacements?: any) => string;
  getThemeClasses: (variant: string) => string;
}

interface GradeEntry {
  id: number;
  name: string;
  grade: string;
  weight: string;
}

const FormattedResultMessage: React.FC<{ message: string }> = ({ message }) => {
    const parts = message.split(/(\*\*.*?\*\*)/g);
    return (
        <p>
            {parts.map((part, i) =>
                part.startsWith('**') && part.endsWith('**') ?
                <strong key={i}>{part.slice(2, -2)}</strong> :
                part
            )}
        </p>
    );
};

const GradeCalculatorView: React.FC<GradeCalculatorViewProps> = ({ t, getThemeClasses }) => {
    const [grades, setGrades] = useState<GradeEntry[]>([{ id: 1, name: '', grade: '', weight: '100' }]);
    const [nextId, setNextId] = useState(2);

    // Goal calculator state
    const [desiredAverage, setDesiredAverage] = useState('');
    const [futureWeight, setFutureWeight] = useState('');
    const [neededGradeResult, setNeededGradeResult] = useState<string | null>(null);

    const handleGradeChange = (id: number, field: keyof Omit<GradeEntry, 'id'>, value: string) => {
        setGrades(grades.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const addGradeRow = () => {
        setGrades([...grades, { id: nextId, name: '', grade: '', weight: '' }]);
        setNextId(nextId + 1);
    };

    const removeGradeRow = (id: number) => {
        if (grades.length > 1) {
            setGrades(grades.filter(g => g.id !== id));
        }
    };

    const { currentAverage, totalWeight } = useMemo(() => {
        let totalWeightedGrade = 0;
        let totalWeightValue = 0;

        grades.forEach(g => {
            const grade = parseFloat(g.grade.replace(',', '.'));
            const weight = parseFloat(g.weight.replace(',', '.'));
            if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
                totalWeightedGrade += grade * weight;
                totalWeightValue += weight;
            }
        });

        if (totalWeightValue === 0) return { currentAverage: null, totalWeight: 0 };
        return { currentAverage: totalWeightedGrade / totalWeightValue, totalWeight: totalWeightValue };
    }, [grades]);

    const calculateNeededGrade = () => {
        const goal = parseFloat(desiredAverage.replace(',', '.'));
        const fWeight = parseFloat(futureWeight.replace(',', '.'));

        if (isNaN(goal) || isNaN(fWeight) || fWeight <= 0 || currentAverage === null) {
            setNeededGradeResult(null);
            return;
        }

        if (goal <= currentAverage) {
            setNeededGradeResult(t('goal_easy_message'));
            return;
        }
        
        const currentWeightedSum = currentAverage * totalWeight;
        const newTotalWeight = totalWeight + fWeight;
        
        const requiredGrade = (goal * newTotalWeight - currentWeightedSum) / fWeight;
        
        if (requiredGrade > 10) {
            setNeededGradeResult(t('goal_impossible_message'));
        } else {
             setNeededGradeResult(t('grade_needed_message', { grade: `**${requiredGrade.toFixed(2)}**`, goal: `**${desiredAverage}**` }));
        }
    };


    return (
        <div className={`p-4 rounded-lg shadow-inner ${getThemeClasses('bg-light')} space-y-4`}>
            {/* Main Calculator */}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Calculator /> {t('grade_calculator_title')}</h3>
                <div className="space-y-2">
                    {grades.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <input type="text" placeholder={t('grade_name_placeholder')} value={g.name} onChange={e => handleGradeChange(g.id, 'name', e.target.value)} className="w-full sm:w-2/5 p-2 border rounded-lg" />
                            <input type="text" inputMode="decimal" placeholder={t('grade')} value={g.grade} onChange={e => handleGradeChange(g.id, 'grade', e.target.value)} className="w-1/2 sm:w-1/4 p-2 border rounded-lg" />
                            <input type="text" inputMode="numeric" placeholder={t('weight')} value={g.weight} onChange={e => handleGradeChange(g.id, 'weight', e.target.value)} className="w-1/2 sm:w-1/4 p-2 border rounded-lg" />
                            <button onClick={() => removeGradeRow(g.id)} disabled={grades.length <= 1} className="p-2 text-red-500 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <button onClick={addGradeRow} className={`mt-4 w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')}`}>
                    <PlusCircle size={16} /> {t('add_grade')}
                </button>
                {currentAverage !== null && (
                    <div className={`mt-4 p-4 rounded-lg text-center ${getThemeClasses('bg')}`}>
                        <p className="text-white font-semibold">{t('current_average')}</p>
                        <p className="text-white text-3xl font-bold">{currentAverage.toFixed(2)}</p>
                    </div>
                )}
            </div>
            
            {/* Goal Calculator */}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Target /> {t('goal_calculator_title')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" inputMode="decimal" placeholder={t('desired_average')} value={desiredAverage} onChange={e => setDesiredAverage(e.target.value)} className="p-2 border rounded-lg" />
                    <input type="text" inputMode="numeric" placeholder={t('future_exam_weight')} value={futureWeight} onChange={e => setFutureWeight(e.target.value)} className="p-2 border rounded-lg" />
                </div>
                 <button onClick={calculateNeededGrade} disabled={currentAverage === null} className={`mt-4 w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-transform active:scale-95 ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50`}>
                    {t('calculate_needed_grade')}
                </button>
                 {neededGradeResult && (
                    <div className={`mt-4 p-3 rounded-lg text-center bg-blue-100 text-blue-800 font-semibold whitespace-pre-wrap`}>
                       <FormattedResultMessage message={neededGradeResult} />
                    </div>
                 )}
            </div>
        </div>
    );
};

export default GradeCalculatorView;