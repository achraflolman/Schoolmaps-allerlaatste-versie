
import React, { useState, useRef, useEffect } from 'react';
import { db, appId } from '../../../services/firebase';
import { AlertTriangle, Play, Loader2 } from 'lucide-react';

interface DataRevertViewProps {
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
}

const DataRevertView: React.FC<DataRevertViewProps> = ({ t, getThemeClasses }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const logRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const copyCollection = async (sourcePath: string, destPath: string) => {
        addLog(`Starting copy from '${sourcePath}' to '${destPath}'...`);
        const sourceCol = await db.collection(sourcePath).get();
        if (sourceCol.empty) {
            addLog(`Source collection '${sourcePath}' is empty. Nothing to copy.`);
            return 0;
        }

        let count = 0;
        let batch = db.batch();
        for (const doc of sourceCol.docs) {
            const destDocRef = db.collection(destPath).doc(doc.id);
            batch.set(destDocRef, doc.data());
            count++;
            if (count % 499 === 0) { // Firestore batch limit is 500 operations
                await batch.commit();
                addLog(`Copied ${count} documents...`);
                batch = db.batch(); // Re-initialize batch
            }
        }
        if (count % 499 !== 0 || sourceCol.size < 500) { // Commit the remaining documents
             await batch.commit();
        }
        addLog(`Successfully copied ${count} documents from '${sourcePath}' to '${destPath}'.`);
        return count;
    };

    const deleteCollection = async (collectionPath: string) => {
        addLog(`Starting deletion of collection '${collectionPath}'...`);
        const collectionRef = db.collection(collectionPath);
        let snapshot = await collectionRef.limit(500).get();
        let deletedCount = 0;

        while(snapshot.size > 0) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += snapshot.size;
            addLog(`Deleted ${deletedCount} documents from '${collectionPath}'.`);
            snapshot = await collectionRef.limit(500).get();
        }
        if (deletedCount > 0) {
            addLog(`Successfully deleted collection '${collectionPath}'.`);
        } else {
            addLog(`Collection '${collectionPath}' was already empty or did not exist.`);
        }
    }

    const handleRestore = async () => {
        setIsProcessing(true);
        setLogs([]);
        addLog('Starting restoration process...');
        addLog('IMPORTANT: Ensure Firebase Security Rules are open (allow read, write: if true;) before starting.');

        try {
            // Phase 1: Data Copying
            addLog('--- PHASE 1: COPYING DATA ---');

            // USERS collection
            addLog('Processing USERS collection...');
            const usersSnapshot = await db.collection('users').get();
            addLog(`Found ${usersSnapshot.size} users in new structure.`);
            
            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                addLog(`Processing user: ${userData.userName} (${userId})`);

                // Copy user profile document
                const oldUserProfileRef = db.doc(`artifacts/${appId}/public/data/users/${userId}`);
                await oldUserProfileRef.set(userData, { merge: true }); // Use merge to be non-destructive
                addLog(`  > User profile copied.`);

                // Copy private user sub-collections
                const privateSubCollections = ['calendarEvents', 'chatHistories', 'flashcardDecks', 'notes', 'notifications', 'studyPlans', 'studySessions', 'tasks'];
                for (const subColName of privateSubCollections) {
                    const newSubColPath = `users/${userId}/${subColName}`;
                    const oldSubColPath = `artifacts/${appId}/users/${userId}/${subColName}`;
                    const subColSnapshot = await db.collection(newSubColPath).get();

                    if (!subColSnapshot.empty) {
                        addLog(`  > Found ${subColSnapshot.size} documents in '${subColName}'. Copying...`);
                        let batch = db.batch();
                        let count = 0;
                        for (const subDoc of subColSnapshot.docs) {
                            const oldSubDocRef = db.doc(`${oldSubColPath}/${subDoc.id}`);
                            batch.set(oldSubDocRef, subDoc.data());
                            count++;

                            if (count % 499 === 0) {
                                await batch.commit();
                                batch = db.batch();
                            }

                            // Special handling for flashcardDecks -> cards
                            if (subColName === 'flashcardDecks') {
                                const cardsPath = `${newSubColPath}/${subDoc.id}/cards`;
                                const oldCardsPath = `${oldSubColPath}/${subDoc.id}/cards`;
                                await copyCollection(cardsPath, oldCardsPath);
                            }
                        }
                         if (count % 499 !== 0 || subColSnapshot.size < 500) {
                            await batch.commit();
                        }
                        addLog(`  > Copied ${count} documents for '${subColName}'.`);
                    }
                }
            }
            addLog('Finished processing all users.');

            // Other public top-level collections
            const publicCollections = ['files', 'broadcasts', 'feedback', 'sharedSets', 'sharedPlans'];
            for (const colName of publicCollections) {
                 await copyCollection(colName, `artifacts/${appId}/public/data/${colName}`);
            }

            // Phase 2: Deletion
            addLog('--- PHASE 2: DELETING NEW COLLECTIONS ---');
            
            addLog('Deleting top-level USERS collection recursively...');
            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                addLog(`Deleting subcollections for user ${userId}...`);
                const subCollectionsToDelete = ['calendarEvents', 'chatHistories', 'flashcardDecks', 'notes', 'notifications', 'studyPlans', 'studySessions', 'tasks'];
                 for (const subColName of subCollectionsToDelete) {
                    if (subColName === 'flashcardDecks') {
                        const decksSnapshot = await db.collection(`users/${userId}/flashcardDecks`).get();
                        for (const deckDoc of decksSnapshot.docs) {
                            await deleteCollection(`users/${userId}/flashcardDecks/${deckDoc.id}/cards`);
                        }
                    }
                    await deleteCollection(`users/${userId}/${subColName}`);
                }
                await db.doc(`users/${userId}`).delete();
                addLog(`Deleted user document ${userId}.`);
            }
             addLog('Top-level USERS collection cleanup finished.');


            for (const colName of publicCollections) {
                 await deleteCollection(colName);
            }
            
            addLog('--- RESTORATION PROCESS COMPLETED SUCCESSFULLY! ---');

        } catch (error: any) {
            addLog(`!!! ERROR: An error occurred: ${error.message}`);
            addLog('Process halted. Please check logs and Firestore console.');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Herstel Oude Collecties</h2>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-4">
                <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle/> WAARSCHUWING</h3>
                <p className="text-red-700 text-sm mt-2">
                    Deze operatie zal data van de nieuwe, vereenvoudigde structuur (top-level collecties zoals 'users') terugzetten naar de oude, geneste structuur (onder 'artifacts'). Na het kopiëren worden de nieuwe collecties permanent verwijderd. Dit proces is onomkeerbaar.
                </p>
                 <p className="text-red-700 text-sm mt-2 font-bold">
                    Zorg ervoor dat uw Firebase Security Rules tijdelijk open staan (`allow read, write: if true;`) voordat u dit proces start.
                </p>
            </div>

            <button
                onClick={handleRestore}
                disabled={isProcessing}
                className={`w-full ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-60`}
            >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play/>}
                {isProcessing ? 'Bezig met herstellen...' : 'Start Herstelproces'}
            </button>

            <div className="mt-4">
                <h4 className="font-semibold mb-2">Logboek:</h4>
                <textarea
                    ref={logRef}
                    readOnly
                    value={logs.join('\n')}
                    className="w-full h-64 p-2 bg-gray-800 text-green-400 font-mono text-xs rounded-md border border-gray-600"
                    placeholder="Wachten op start van proces..."
                />
            </div>
        </div>
    );
};

export default DataRevertView;
