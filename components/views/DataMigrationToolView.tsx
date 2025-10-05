import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db, appId } from '../../services/firebase';
import { AlertTriangle, Play, Loader2, CheckCircle, ArrowLeft, Database, Repeat } from 'lucide-react';

interface DataMigrationToolViewProps {
    onBack: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
}

const LogViewer: React.FC<{ logs: string[] }> = ({ logs }) => {
    const logRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <textarea
            ref={logRef}
            readOnly
            value={logs.join('\n')}
            className="w-full h-64 p-2 bg-gray-800 text-green-400 font-mono text-xs rounded-md border border-gray-600"
            placeholder="Process logs will appear here..."
        />
    );
};

const DataMigrationToolView: React.FC<DataMigrationToolViewProps> = ({ onBack, t, getThemeClasses }) => {
    const [activeTab, setActiveTab] = useState<'migrate' | 'revert'>('migrate');
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    const addLog = useCallback((message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    }, []);
    
    // --- Shared Helper Functions ---
    const copyCollection = async (sourcePath: string, destPath: string, isRecursive = false) => {
        addLog(`Copying from '${sourcePath}' to '${destPath}'...`);
        const sourceCol = await db.collection(sourcePath).get();
        if (sourceCol.empty) {
            addLog(`  -> Source is empty. Nothing to copy.`);
            return;
        }

        let batch = db.batch();
        let count = 0;
        for (const doc of sourceCol.docs) {
            const destDocRef = db.collection(destPath).doc(doc.id);
            batch.set(destDocRef, doc.data());
            count++;

            if (isRecursive) { // Handle sub-subcollections like flashcards
                if (sourcePath.endsWith('flashcardDecks')) {
                    await copyCollection(`${sourcePath}/${doc.id}/cards`, `${destPath}/${doc.id}/cards`);
                }
            }

            if (count % 499 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        if (count > 0 && (count % 499 !== 0 || sourceCol.size < 500)) {
            await batch.commit();
        }
        addLog(`  -> Copied ${count} documents.`);
    };

    const deleteCollection = async (collectionPath: string) => {
        addLog(`Deleting collection '${collectionPath}'...`);
        const collectionRef = db.collection(collectionPath);
        let snapshot = await collectionRef.limit(500).get();
        if (snapshot.empty) {
            addLog(`  -> Collection is empty. Nothing to delete.`);
            return;
        }
        while(snapshot.size > 0) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            addLog(`  -> Deleted ${snapshot.size} documents.`);
            snapshot = await collectionRef.limit(500).get();
        }
    };
    
    // --- FORWARD MIGRATION (OLD -> NEW) ---
    const handleMigrate = async () => {
        setIsProcessing(true);
        setIsFinished(false);
        setLogs([]);
        addLog('Starting migration from OLD (artifacts) to NEW structure...');

        try {
            // Copy users
            await copyCollection(`artifacts/${appId}/public/data/users`, 'users');

            // Copy public collections
            const publicCollections = ['files', 'broadcasts', 'feedback', 'sharedSets', 'sharedPlans'];
            for (const col of publicCollections) {
                await copyCollection(`artifacts/${appId}/public/data/${col}`, col);
            }

            // Copy user-specific private subcollections
            const usersSnapshot = await db.collection(`artifacts/${appId}/public/data/users`).get();
            addLog(`Found ${usersSnapshot.size} users to process for subcollections.`);
            for (const userDoc of usersSnapshot.docs) {
                addLog(`Processing subcollections for user ${userDoc.id}...`);
                const privateCollections = ['calendarEvents', 'chatHistories', 'flashcardDecks', 'notes', 'notifications', 'studyPlans', 'studySessions', 'tasks'];
                for (const col of privateCollections) {
                    await copyCollection(`artifacts/${appId}/users/${userDoc.id}/${col}`, `users/${userDoc.id}/${col}`, true);
                }
            }
            
            addLog('\n--- MIGRATION COMPLETED SUCCESSFULLY! ---');
            addLog('Data has been copied to the new structure. The old data has NOT been deleted for safety.');
            setIsFinished(true);
        } catch (error: any) {
            addLog(`\n!!! FATAL ERROR: ${error.message}`);
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- REVERT MIGRATION (NEW -> OLD) ---
    const handleRevert = async () => {
        setIsProcessing(true);
        setIsFinished(false);
        setLogs([]);
        addLog('Starting revert from NEW to OLD (artifacts) structure...');

        try {
            // Copy users
            await copyCollection('users', `artifacts/${appId}/public/data/users`);
            
            // Copy public collections
            const publicCollections = ['files', 'broadcasts', 'feedback', 'sharedSets', 'sharedPlans'];
            for (const col of publicCollections) {
                await copyCollection(col, `artifacts/${appId}/public/data/${col}`);
            }
            
            // Copy user subcollections
            const usersSnapshot = await db.collection('users').get();
            for (const userDoc of usersSnapshot.docs) {
                addLog(`Reverting subcollections for user ${userDoc.id}...`);
                const privateCollections = ['calendarEvents', 'chatHistories', 'flashcardDecks', 'notes', 'notifications', 'studyPlans', 'studySessions', 'tasks'];
                for (const col of privateCollections) {
                    await copyCollection(`users/${userDoc.id}/${col}`, `artifacts/${appId}/users/${userDoc.id}/${col}`, true);
                }
            }

            addLog('\n--- DELETING NEW STRUCTURE COLLECTIONS ---');
            for (const userDoc of usersSnapshot.docs) {
                addLog(`Deleting subcollections for user ${userDoc.id}...`);
                 const privateCollections = ['calendarEvents', 'chatHistories', 'flashcardDecks', 'notes', 'notifications', 'studyPlans', 'studySessions', 'tasks'];
                for (const col of privateCollections) {
                    if (col === 'flashcardDecks') {
                        const decks = await db.collection(`users/${userDoc.id}/flashcardDecks`).get();
                        for (const deckDoc of decks.docs) {
                            await deleteCollection(`users/${userDoc.id}/flashcardDecks/${deckDoc.id}/cards`);
                        }
                    }
                    await deleteCollection(`users/${userDoc.id}/${col}`);
                }
            }
            await deleteCollection('users');
            for (const col of publicCollections) {
                await deleteCollection(col);
            }

            addLog('\n--- REVERT COMPLETED SUCCESSFULLY! ---');
            setIsFinished(true);
        } catch (error: any) {
            addLog(`\n!!! FATAL ERROR: ${error.message}`);
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const resetState = () => {
        setLogs([]);
        setIsProcessing(false);
        setIsFinished(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-100">
            <div className="w-full max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Data Migration Tool</h2>
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft /></button>
                </div>

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('migrate')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'migrate' ? `${getThemeClasses('border')} ${getThemeClasses('text')}`: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Migrate to New
                        </button>
                        <button onClick={() => setActiveTab('revert')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'revert' ? `border-orange-500 text-orange-600`: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Revert to Old
                        </button>
                    </nav>
                </div>

                {isFinished ? (
                    <div className="text-center py-10">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
                        <h3 className="font-bold text-xl">Process Completed!</h3>
                        <p className="text-gray-600">Please review the logs below. You can now return to the login screen.</p>
                        <button onClick={resetState} className="mt-4 font-semibold bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg">Run Another Task</button>
                    </div>
                ) : (
                    <div className="py-6">
                        {activeTab === 'migrate' && (
                            <div>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                                    <h3 className="font-bold text-blue-800 flex items-center gap-2"><Database /> Migrate to New Structure</h3>
                                    <p className="text-blue-700 text-sm mt-2">
                                        This will copy all data from the old <code>artifacts/...</code> structure to new top-level collections (e.g., <code>users</code>, <code>files</code>). The old data will NOT be deleted for safety.
                                    </p>
                                </div>
                                <button onClick={handleMigrate} disabled={isProcessing} className={`w-full ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2`}>
                                    {isProcessing ? <Loader2 className="animate-spin"/> : <Play/>} Start Migration
                                </button>
                            </div>
                        )}
                        {activeTab === 'revert' && (
                            <div>
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-4">
                                    <h3 className="font-bold text-orange-800 flex items-center gap-2"><Repeat /> Revert to Old Structure</h3>
                                    <p className="text-orange-700 text-sm mt-2">
                                        This will copy data from the new top-level collections back to the old <code>artifacts/...</code> structure. After copying, the new collections will be PERMANENTLY DELETED. This is irreversible.
                                    </p>
                                </div>
                                <button onClick={handleRevert} disabled={isProcessing} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                                    {isProcessing ? <Loader2 className="animate-spin"/> : <Play/>} Start Revert
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                <LogViewer logs={logs} />
                 <div className="bg-red-50 p-3 rounded-lg border border-red-200 mt-4">
                    <p className="text-red-700 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16}/> Ensure Firebase Security Rules are open (`allow read, write: if true;`) before starting either process.</p>
                </div>
            </div>
        </div>
    );
};

export default DataMigrationToolView;
