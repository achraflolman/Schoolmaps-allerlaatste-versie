import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Share2, PlusCircle, Trash2, Link, Search, XCircle, LoaderCircle, Star, Download, MessageSquare, User as UserIcon, X, Send } from 'lucide-react';
import { db, storage, appId, Timestamp, increment, arrayUnion } from '../../services/firebase';
import type { FileData, ModalContent, AppUser, ChatMessageData, Chat } from '../../types';
import * as pdfjs from 'pdf.js';

// Set worker source for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.worker.js';

interface SubjectViewProps {
    user: AppUser;
    currentSubject: string;
    subjectFiles: FileData[];
    setCurrentSubject: (subject: string | null) => void;
    t: (key: string, replacements?: { [key: string]: string | number }) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    userId: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    copyTextToClipboard: (text: string, title?: string) => boolean;
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
}

const SubjectView: React.FC<SubjectViewProps> = (props) => {
    const { user, currentSubject, subjectFiles, setCurrentSubject, t, tSubject, getThemeClasses, showAppModal, userId, searchQuery, setSearchQuery, copyTextToClipboard, onProfileUpdate } = props;
    
    // UI State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);

    // "My Files" State
    const [newFileTitle, setNewFileTitle] = useState('');
    const [newFileDescription, setNewFileDescription] = useState('');
    const [starPrice, setStarPrice] = useState('');
    const [selectedFileUpload, setSelectedFileUpload] = useState<File | null>(null);
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isPublic, setIsPublic] = useState(true);

    const handleAddFile = async () => {
        if (!newFileTitle.trim()) return showAppModal({ text: t('error_enter_file_title') });
        if (!selectedFileUpload) return showAppModal({ text: t('error_select_file_to_upload') });

        setIsUploading(true);
        try {
            const fileData: Partial<FileData> = {};
            const fileType = selectedFileUpload.type;

            if (fileType.startsWith('image/')) {
                fileData.fileType = 'image';
            } else if (fileType === 'application/pdf') {
                fileData.fileType = 'pdf';
                const arrayBuffer = await selectedFileUpload.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                fileData.pageCount = pdf.numPages;
            } else {
                fileData.fileType = 'other';
            }

            const filePath = `files/${userId}/${currentSubject}/${Date.now()}-${selectedFileUpload.name}`;
            const storageRef = storage.ref(filePath);
            await storageRef.put(selectedFileUpload);
            const fileUrl = await storageRef.getDownloadURL();

            const finalFileData: Omit<FileData, 'id'> = {
                title: newFileTitle,
                description: newFileDescription,
                subject: currentSubject,
                ownerId: userId,
                createdAt: Timestamp.now(),
                fileUrl,
                storagePath: filePath,
                isPublic,
                uploaderName: user.userName,
                downloads: 0,
                averageRating: 0,
                ratingCount: 0,
                ratings: {},
                fileType: fileData.fileType,
                pageCount: fileData.pageCount,
                starPrice: isPublic ? (parseInt(starPrice, 10) || 0) : undefined,
            };

            await db.collection(`files`).add(finalFileData);
            showAppModal({ text: t('success_file_added') });
            setNewFileTitle(''); setNewFileDescription(''); setStarPrice(''); setSelectedFileUpload(null);
            const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            const err = error as Error;
            showAppModal({ text: t('error_add_file_failed', { message: err.message }) });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteFiles = () => {
        if (selectedFileIds.length === 0) return showAppModal({ text: t('error_select_files_delete') });
        showAppModal({
            text: t('confirm_delete_files', { count: selectedFileIds.length }),
            confirmAction: async () => {
                const batch = db.batch();
                for (const fileId of selectedFileIds) {
                    const file = subjectFiles.find(f => f.id === fileId);
                    if (file) {
                        if (file.storagePath) storage.ref(file.storagePath).delete().catch(console.error);
                        batch.delete(db.doc(`files/${fileId}`));
                    }
                }
                await batch.commit();
                showAppModal({ text: t('success_files_deleted') });
                setSelectedFileIds([]);
                setIsSelecting(false);
            },
            cancelAction: () => {}
        });
    };
    
    const handleOpenDetailModal = (file: FileData) => {
        setSelectedFile(file);
        setIsDetailModalOpen(true);
    };
    
    return (
        <>
            {isDetailModalOpen && selectedFile && <FileDetailModal file={selectedFile} t={t} onClose={() => setIsDetailModalOpen(false)} />}

            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentSubject(null)} title={t('back_to_subjects')} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300">
                        <ChevronLeft/>
                    </button>
                    <h2 className={`text-2xl font-bold text-center flex-grow ${getThemeClasses('text-strong')}`}>
                        {tSubject(currentSubject)}
                    </h2>
                    <div className="w-9"></div> {/* Placeholder for alignment */}
                </div>
                
                <div className="space-y-6">
                    {/* Add File Form */}
                    <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
                        <h3 className="font-bold text-lg">{t('add_file_section_title')}</h3>
                        <div className="flex rounded-lg border p-1 bg-gray-100">
                            <button onClick={() => setIsPublic(true)} className={`w-1/2 rounded-md py-2 text-sm font-semibold ${isPublic ? 'bg-white shadow' : 'text-gray-600'}`}>{t('public_share')}</button>
                            <button onClick={() => setIsPublic(false)} className={`w-1/2 rounded-md py-2 text-sm font-semibold ${!isPublic ? 'bg-white shadow' : 'text-gray-600'}`}>{t('private_upload')}</button>
                        </div>
                        <input type="text" placeholder={t('file_title_placeholder')} value={newFileTitle} onChange={e => setNewFileTitle(e.target.value)} className="w-full p-2 border rounded-lg" disabled={isUploading}/>
                        <textarea placeholder={t('file_description_placeholder')} value={newFileDescription} onChange={e => setNewFileDescription(e.target.value)} className="w-full p-2 border rounded-lg" disabled={isUploading}/>
                        {isPublic && <input type="number" placeholder={t('star_price')} min="0" value={starPrice} onChange={e => setStarPrice(e.target.value)} className="w-full p-2 border rounded-lg" disabled={isUploading}/>}
                        <input id="file-input" type="file" onChange={e => setSelectedFileUpload(e.target.files ? e.target.files[0] : null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" disabled={isUploading}/>
                        <button onClick={handleAddFile} disabled={isUploading} className={`w-full flex justify-center items-center text-white font-bold py-2 px-4 rounded-lg ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-70`}>
                            {isUploading ? <><LoaderCircle className="w-5 h-5 mr-2 animate-spin"/> {t('uploading')}</> : <><PlusCircle className="w-5 h-5 mr-2"/> {t('add_file_button')}</>}
                        </button>
                    </div>
                    {/* File List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center gap-2">
                            <div className="relative flex-grow"><input type="text" placeholder={t('search_my_files')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="p-2 pl-8 border rounded-lg w-full"/><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /></div>
                            {isSelecting ? <div className="flex gap-2"><button onClick={handleDeleteFiles} disabled={selectedFileIds.length === 0} className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg flex items-center gap-1 disabled:opacity-50"><Trash2 size={16}/>({selectedFileIds.length})</button><button onClick={() => { setIsSelecting(false); setSelectedFileIds([]); }} className="bg-gray-300 py-2 px-3 rounded-lg">{t('cancel_button')}</button></div> : <button onClick={() => setIsSelecting(true)} className={`text-white py-2 px-3 rounded-lg ${getThemeClasses('bg')}`}>{t('select_files_button')}</button>}
                        </div>
                        {subjectFiles.length === 0 ? <p className="text-center text-gray-500 italic py-4">{t('no_files_found')}</p> : <ul className="space-y-3">{subjectFiles.map(file => <li key={file.id} onClick={isSelecting ? () => setSelectedFileIds(p => p.includes(file.id) ? p.filter(id => id !== file.id) : [...p, file.id]) : () => handleOpenDetailModal(file)} className={`bg-white p-3 rounded-lg shadow-sm flex items-center justify-between transition-all ${isSelecting ? 'cursor-pointer' : 'hover:shadow-md'} ${selectedFileIds.includes(file.id) ? `ring-2 ${getThemeClasses('ring')}`: ''}`}>{isSelecting && <input type="checkbox" readOnly checked={selectedFileIds.includes(file.id)} className={`mr-4 w-5 h-5 rounded ${getThemeClasses('text')} focus:ring-0`} />}<div className="flex-1 min-w-0"><p className="font-semibold truncate">{file.title}</p><p className="text-sm text-gray-500">{(file.createdAt as any).toDate().toLocaleDateString()}</p></div><a href={file.fileUrl} onClick={(e) => isSelecting && e.preventDefault()} target="_blank" rel="noopener noreferrer" className="ml-2 bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-md shadow flex items-center gap-1"><Link size={12}/> {t('view_button')}</a></li>)}</ul>}
                    </div>
                </div>
            </div>
        </>
    );
};

const FileDetailModal: React.FC<{ file: FileData, t: Function, onClose: Function }> = ({ file, t, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(true);

    useEffect(() => {
        if (file.fileType === 'pdf' && file.fileUrl !== '#') {
            setIsLoadingPreview(true);
            const loadPdf = async () => {
                try {
                    const pdf = await pdfjs.getDocument(file.fileUrl).promise;
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start"><h3 className="text-2xl font-bold mb-2">{file.title}</h3><button onClick={() => onClose()} className="p-1 -mt-1 -mr-1"><X size={20}/></button></div>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div><h4 className="font-bold">{t('file_preview')}</h4><div className="mt-1 border rounded-lg p-2 bg-gray-50 min-h-48 flex justify-center items-center">{isLoadingPreview ? <LoaderCircle className="animate-spin" /> : file.fileType === 'pdf' ? <canvas ref={canvasRef}></canvas> : file.fileType === 'image' ? <img src={file.fileUrl} alt="Preview" className="max-w-full max-h-96 rounded"/> : <p>{t('preview_not_available')}</p>}</div>{file.pageCount && <p className="text-sm text-gray-500 mt-1">{t('page_count', {count: file.pageCount})}</p>}</div>
                    <div><h4 className="font-bold">{t('description')}</h4><p className="text-gray-600 bg-gray-50 p-3 rounded-md mt-1">{file.description || 'N/A'}</p></div>
                </div>
            </div>
        </div>
    );
};

export default SubjectView;