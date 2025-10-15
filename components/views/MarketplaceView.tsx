import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, increment, arrayUnion, Timestamp } from '../../services/firebase';
import type { AppUser, FileData, ModalContent } from '../../types';
import * as pdfjs from 'pdf.js';
import {
    Star, Download, Search, Loader2, X, User as UserIcon, MessageSquare, ArrowLeft,
    Folder, Globe, Calculator, Atom, FlaskConical, Dna,
    ScrollText, AreaChart, Users, Languages, Code, Paintbrush,
    Music, Dumbbell, Film, ChevronDown
} from 'lucide-react';

// Set worker source for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.worker.js';

interface MarketplaceViewProps {
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    userId: string;
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
}

const Rating: React.FC<{ rating: number; onRate?: (rating: number) => void; isInteractive: boolean; userRating?: number; }> = ({ rating, onRate, isInteractive, userRating }) => {
    const [hoverRating, setHoverRating] = useState(0);
    return (
        <div className="flex items-center" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating || userRating || rating) >= star;
                const isUserChoice = userRating && userRating >= star;
                return <Star key={star} onClick={() => isInteractive && onRate && onRate(star)} onMouseEnter={() => isInteractive && setHoverRating(star)} className={`w-5 h-5 transition-colors ${isInteractive ? 'cursor-pointer' : ''} ${isFilled ? isUserChoice ? 'text-blue-500 fill-current' : 'text-yellow-400 fill-current' : 'text-gray-300'}`} />;
            })}
        </div>
    );
};

const FileDetailModal: React.FC<{ file: FileData; user: AppUser; t: MarketplaceViewProps['t']; getThemeClasses: MarketplaceViewProps['getThemeClasses']; onClose: () => void; onPurchase: (file: FileData) => void; onRate: (file: FileData, rating: number) => void; showAppModal: MarketplaceViewProps['showAppModal']; }> = ({ file, user, t, getThemeClasses, onClose, onPurchase, onRate, showAppModal }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(true);

    useEffect(() => {
        if (file.fileType === 'pdf' && file.fileUrl !== '#') {
            setIsLoadingPreview(true);
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(file.fileUrl)}`;
            const loadPdf = async () => {
                try {
                    const pdf = await pdfjs.getDocument(proxyUrl).promise;
                    const page = await pdf.getPage(1);
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const viewport = page.getViewport({ scale: 1.5 });
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    if (context) await page.render({ canvasContext: context, viewport: viewport }).promise;
                } catch (error) { console.error('Failed to render PDF preview:', error); }
                finally { setIsLoadingPreview(false); }
            };
            loadPdf();
        } else {
            setIsLoadingPreview(false);
        }
    }, [file]);

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start"><h3 className="text-2xl font-bold mb-2 text-gray-800">{file.title}</h3><button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 -mt-1 -mr-1"><X className="w-5 h-5"/></button></div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="flex items-center gap-3"><div className="p-2 bg-gray-100 rounded-full"><UserIcon size={16}/></div><p className="font-semibold text-gray-700">{file.uploaderName}</p><button onClick={() => showAppModal({text: t('view_profile_coming_soon')})} className="flex items-center gap-1 text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-lg font-semibold"><MessageSquare size={14}/> {t('send_message')}</button></div>
                    <div><h4 className="font-bold">{t('file_preview')}</h4><div className="mt-1 border rounded-lg p-2 bg-gray-50 min-h-48 flex justify-center items-center">{isLoadingPreview ? <Loader2 className="animate-spin" /> : file.fileType === 'pdf' ? <canvas ref={canvasRef}></canvas> : file.fileType === 'image' ? <img src={file.fileUrl} alt="Preview" className="max-w-full max-h-96 rounded"/> : <p>{t('preview_not_available')}</p>}</div>{file.pageCount && <p className="text-sm text-gray-500 mt-1">{t('page_count', {count: file.pageCount})}</p>}</div>
                    <div><h4 className="font-bold">{t('description')}</h4><p className="text-gray-600 bg-gray-50 p-3 rounded-md mt-1">{file.description || 'Geen beschrijving.'}</p></div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div><h4 className="font-bold">{t('rating')}</h4><Rating rating={file.averageRating ?? 0} onRate={(r) => onRate(file, r)} isInteractive={user.purchasedFileIds?.includes(file.id) ?? false} userRating={file.ratings?.[user.uid]}/><p className="text-xs text-gray-500">({file.ratingCount ?? 0} beoordelingen)</p></div>
                        <div><h4 className="font-bold">{t('downloads')}</h4><p className="text-lg font-semibold">{file.downloads ?? 0}</p></div>
                    </div>
                    {(user.purchasedFileIds?.includes(file.id)) && (<div><h4 className="font-bold">{t('rate_file')}</h4><Rating rating={0} onRate={(r) => onRate(file, r)} isInteractive={true} userRating={file.ratings?.[user.uid]}/></div>)}
                </div>
                <div className="mt-6 pt-4 border-t">
                     <button onClick={() => onPurchase(file)} disabled={file.isPlaceholder || file.ownerId === user.uid || user.purchasedFileIds?.includes(file.id)} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${file.ownerId === user.uid ? 'bg-gray-400' : (user.purchasedFileIds?.includes(file.id)) ? `bg-green-500` : ((user.totalStars ?? 0) >= (file.starPrice ?? 0)) ? getThemeClasses('bg') + ' ' + getThemeClasses('hover-bg') : 'bg-red-400'}`}>
                        {file.ownerId === user.uid ? t('your_file') : (user.purchasedFileIds?.includes(file.id)) ? t('owned') : <><Star size={18} className="fill-current"/>{t('purchase_and_download')} ({file.starPrice ?? 0})</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CustomDropdown: React.FC<{
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    getThemeClasses: (variant: string) => string;
}> = ({ options, value, onChange, getThemeClasses }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedLabel = options.find(opt => opt.value === value)?.label;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} type="button" className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <span>{selectedLabel}</span>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 top-full mt-2 w-full bg-white rounded-lg shadow-lg border animate-fade-in-fast">
                    {options.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-2.5 text-sm hover:bg-gray-100 ${value === option.value ? `font-semibold ${getThemeClasses('text')}` : ''}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const MarketplaceView: React.FC<MarketplaceViewProps> = ({ user, t, tSubject, getThemeClasses, showAppModal, userId, onProfileUpdate }) => {
    const [allFiles, setAllFiles] = useState<FileData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'popular' | 'rating'>('newest');
    const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
    const [selectedMarketplaceSubject, setSelectedMarketplaceSubject] = useState<string | null>(null);

    const userSubjects = useMemo(() => {
        const combined = new Set([...(user.selectedSubjects || []), ...(user.customSubjects || [])]);
        return Array.from(combined);
    }, [user.selectedSubjects, user.customSubjects]);

    useEffect(() => {
        setIsLoading(true);
        const q = db.collection('files').where('isPublic', '==', true);
        const unsubscribe = q.onSnapshot(snapshot => {
            setAllFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData)));
            setIsLoading(false);
        }, err => {
            console.error(err);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const displayedFiles = useMemo(() => {
        if (!selectedMarketplaceSubject) return [];
        return allFiles
            .filter(file => {
                const subjectMatch = file.subject === selectedMarketplaceSubject;
                const searchMatch = !searchQuery.trim() || file.title.toLowerCase().includes(searchQuery.toLowerCase()) || (file.description || '').toLowerCase().includes(searchQuery.toLowerCase());
                const priceMatch = priceFilter === 'all' || (priceFilter === 'free' && (!file.starPrice || file.starPrice === 0)) || (priceFilter === 'paid' && file.starPrice && file.starPrice > 0);
                return subjectMatch && searchMatch && priceMatch;
            })
            .sort((a, b) => {
                switch (sortOrder) {
                    case 'popular': return (b.downloads ?? 0) - (a.downloads ?? 0);
                    case 'rating': return (b.averageRating ?? 0) - (a.averageRating ?? 0);
                    case 'newest':
                    default: return (b.createdAt as any).toMillis() - (a.createdAt as any).toMillis();
                }
            });
    }, [allFiles, searchQuery, selectedMarketplaceSubject, sortOrder, priceFilter]);

    const handlePurchase = async (file: FileData) => { /* ... purchase logic ... */ };
    const handleRate = async (file: FileData, rating: number) => { /* ... rating logic ... */ };

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
    
    const sortOptions = [
        { value: 'newest', label: t('sort_newest') },
        { value: 'popular', label: t('sort_popular') },
        { value: 'rating', label: t('sort_rating') }
    ];
    
    const priceOptions = [
        { value: 'all', label: t('price_range') },
        { value: 'free', label: t('free') },
        { value: 'paid', label: t('paid') }
    ];

    return (
        <>
            {selectedFile && <FileDetailModal file={selectedFile} user={user} t={t} getThemeClasses={getThemeClasses} onClose={() => setSelectedFile(null)} onPurchase={handlePurchase} onRate={handleRate} showAppModal={showAppModal} />}
             <style>{`.animate-fade-in-fast { animation: fadeIn 0.2s ease-out; }`}</style>
            <div className="space-y-6 animate-fade-in">
                {!selectedMarketplaceSubject ? (
                    <>
                        <h2 className={`text-3xl font-bold text-center ${getThemeClasses('text-strong')}`}>{t('marketplace_title')}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {userSubjects.map(subject => (
                                <button
                                key={subject}
                                onClick={() => setSelectedMarketplaceSubject(subject)}
                                className={`p-6 bg-white rounded-lg shadow-md font-semibold text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-2 ${getThemeClasses('ring')} ${getThemeClasses('text-strong')}`}
                                >
                                {getIconForSubject(subject)}
                                {tSubject(subject)}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                         <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedMarketplaceSubject(null)} title={t('back_to_subjects')} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300">
                                <ArrowLeft/>
                            </button>
                            <h2 className={`text-2xl font-bold text-center flex-grow ${getThemeClasses('text-strong')}`}>
                                {tSubject(selectedMarketplaceSubject)}
                            </h2>
                            <div className="w-9"></div> {/* Placeholder for alignment */}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="relative lg:col-span-2">
                                <input type="text" placeholder={t('search_marketplace_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            <CustomDropdown options={priceOptions} value={priceFilter} onChange={(v) => setPriceFilter(v as any)} getThemeClasses={getThemeClasses} />
                            <CustomDropdown options={sortOptions} value={sortOrder} onChange={(v) => setSortOrder(v as any)} getThemeClasses={getThemeClasses} />
                        </div>

                        {isLoading ? <div className="text-center p-8"><Loader2 className="animate-spin mx-auto text-gray-500" /></div> :
                        displayedFiles.length === 0 ? <p className="text-center italic text-gray-500 py-8">{t('no_files_in_marketplace')}</p> :
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {displayedFiles.map(file => (
                                <button key={file.id} onClick={() => setSelectedFile(file)} className="bg-white rounded-lg shadow-md flex flex-col text-left hover:shadow-xl hover:-translate-y-1 transition-all">
                                    <div className="p-4 flex-grow">
                                        <h3 className="font-bold text-lg leading-tight mb-1">{file.title}</h3>
                                        <p className="text-xs text-gray-500 mb-2">{t('by_uploader', { name: file.uploaderName?.split(' ')[0] || 'Unknown' })}</p>
                                        <div className="flex items-center justify-between mt-3 text-sm">
                                            <Rating rating={file.averageRating ?? 0} isInteractive={false} />
                                            <div className="flex items-center gap-1 text-gray-500"><Download size={14}/><span>{file.downloads ?? 0}</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 rounded-b-lg text-center">
                                        <div className={`font-bold flex items-center justify-center gap-1 ${getThemeClasses('text-strong')}`}>
                                            <Star size={16} className="fill-current"/><span>{file.starPrice ?? 0}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        }
                    </>
                )}
            </div>
        </>
    );
};

export default MarketplaceView;