import React, { useState, useRef, useEffect } from 'react';
import { db, appId } from '../../services/firebase';
import { AlertTriangle, Play, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';

interface EmergencyMigrationViewProps {
    onBackToLogin: () => void;
}

const EmergencyMigrationView: React.FC<EmergencyMigrationViewProps> = ({ onBackToLogin }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const logRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const copyCollectionWithSubcollections = async (sourcePath: string, destPath: string) => {
        addLog(`Copying from '${sourcePath}' to '${destPath}'...`);
        const sourceCol = await db.collection(sourcePath).get();
        if (sourceCol.empty) {
            addLog(`  -> Source is empty. Nothing to copy.`);
            return 0;
        }

        let count = 0;
        for (const doc of sourceCol.docs) {
            const destDocRef = db.doc(`${destPath}/${doc.id}`);
            await destDocRef.set(doc.data());
            count++;

            // Special handling for flashcardDecks -> cards subcollection
            if (sourcePath.endsWith('flashcardDecks')) {
                const cardsSourcePath = `${sourcePath}/${doc.id}/cards`;
                const cardsDestPath = `${destPath}/${doc.id}/cards`;
                await copyCollectionWithSubcollections(cardsSourcePath, cardsDestPath);
            }
        }
        addLog(`  -> Copied ${count} documents.`);
        return count;
    };

    const deleteCollection = async (collectionPath: string) => {
        const collectionRef = db.collection(collectionPath);
        let snapshot = await collectionRef.limit(500).get();
        let deletedCount = 0;

        while(snapshot.size > 0) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                // Recursively delete subcollections if necessary
                if (collectionPath.startsWith('users') && !collectionPath.includes('/')) {
                    // This is a top-level user doc, we handle its subcollections manually
                } else if (collectionPath.includes('flashcardDecks')) {
                    // This is a deck, we handle its 'cards' subcollection manually
                }
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += snapshot.size;
            addLog(`  -> Deleted ${deletedCount} docs from '${collectionPath}'.`);
            snapshot = await collectionRef.limit(500).get();
        }
    }

    const handleRestore = async () => {
        setIsProcessing(true);
        setIsFinished(false);
        setLogs([]);
        addLog('Starting emergency restoration process...');
        addLog('IMPORTANT: Ensure Firebase Security Rules are open (allow read, write: if true;) before starting.');

        try {
            // Phase 1: Data Copying
            addLog('\n--- PHASE 1: COPYING DATA ---');
            
            // USERS collection and their subcollections
            addLog('Processing USERS collection...');
            const usersSnapshot = await db.collection('users').get();
            addLog(`Found ${usersSnapshot.size} users in new structure.`);
            
            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                addLog(`\nProcessing user: ${userData.userName || 'Unknown Name'} (${userId})`);

                // Copy user profile document itself
                const oldUserDocPath = `artifacts/${appId}/public/data/users/${userId}`;
                await db.doc(oldUserDocPath).set(userData, { merge: true });
                addLog(`  -> User profile copied to '${oldUserDocPath}'.`);

                // List of all user-specific subcollections
                const userSubCollections = ['files', 'calendarEvents', 'studyPlans', 'notes', 'flashcardDecks', 'tasks', 'studySessions', 'notifications', 'chatHistories'];
                for (const subColName of userSubCollections) {
                    const newSubColPath = `users/${userId}/${subColName}`;
                    const oldSubColPath = `artifacts/${appId}/public/data/users/${userId}/${subColName}`;
                    await copyCollectionWithSubcollections(newSubColPath, oldSubColPath);
                }
            }
            addLog('\nFinished processing all users.');

            // PUBLIC top-level collections
            const publicCollections = ['broadcasts', 'feedback', 'sharedSets', 'sharedPlans'];
            for (const colName of publicCollections) {
                const oldPath = `artifacts/${appId}/public/data/${colName}`;
                await copyCollectionWithSubcollections(colName, oldPath);
            }

            // Phase 2: Deletion
            addLog('\n--- PHASE 2: DELETING NEW-STRUCTURE COLLECTIONS ---');
            addLog('Starting cleanup...');

            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                addLog(`\nDeleting data for user ${userId}...`);
                const subCollectionsToDelete = ['files', 'calendarEvents', 'studyPlans', 'notes', 'flashcardDecks', 'tasks', 'studySessions', 'notifications', 'chatHistories'];
                 for (const subColName of subCollectionsToDelete) {
                    if (subColName === 'flashcardDecks') {
                        const decksSnapshot = await db.collection(`users/${userId}/flashcardDecks`).get();
                        for (const deckDoc of decksSnapshot.docs) {
                            addLog(`  -> Deleting cards for deck ${deckDoc.id}`);
                            await deleteCollection(`users/${userId}/flashcardDecks/${deckDoc.id}/cards`);
                        }
                    }
                    addLog(`  -> Deleting subcollection '${subColName}'`);
                    await deleteCollection(`users/${userId}/${subColName}`);
                }
                await db.doc(`users/${userId}`).delete();
                addLog(`  -> Deleted user document ${userId}.`);
            }
            addLog('\nFinished deleting all user data from new structure.');

            for (const colName of publicCollections) {
                addLog(`Deleting top-level collection '${colName}'...`);
                 await deleteCollection(colName);
            }
            
            addLog('\n--- RESTORATION PROCESS COMPLETED SUCCESSFULLY! ---');
            addLog('You can now return to the login screen and try logging in again.');
            setIsFinished(true);

        } catch (error: any) {
            addLog(`\n!!! FATAL ERROR: An error occurred: ${error.message}`);
            addLog('Process halted. Please check the logs and your Firestore console.');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl animate-fade-in">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Noodhersteltool voor Data</h2>
                
                {isFinished ? (
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="font-bold text-green-800 text-xl">Herstel Voltooid!</h3>
                        <p className="text-green-700 text-sm mt-2">
                            Alle data is succesvol teruggezet. U kunt nu proberen opnieuw in te loggen.
                        </p>
                         <button
                            onClick={onBackToLogin}
                            className="mt-4 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                            <ArrowLeft size={16} /> Terug naar Inloggen
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-4">
                            <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle/> WAARSCHUWING</h3>
                            <p className="text-red-700 text-sm mt-2">
                                Deze tool is alleen voor noodgevallen als je niet kunt inloggen. Het zet de database terug naar de originele, geneste structuur. Na het kopiëren worden de nieuwe collecties permanent verwijderd. Dit kan niet ongedaan worden gemaakt.
                            </p>
                            <p className="text-red-700 text-sm mt-2 font-bold">
                                Voordat je start, MOET je de Firebase Security Rules volledig openzetten: <code>allow read, write: if true;</code>
                            </p>
                        </div>
        
                        <button
                            onClick={handleRestore}
                            disabled={isProcessing}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-60"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : <Play/>}
                            {isProcessing ? 'Herstellen...' : 'Start Herstelproces'}
                        </button>
                    </>
                )}


                <div className="mt-4">
                    <h4 className="font-semibold mb-2">Logboek:</h4>
                    <textarea
                        ref={logRef}
                        readOnly
                        value={logs.join('\n')}
                        className="w-full h-80 p-2 bg-gray-800 text-green-400 font-mono text-xs rounded-md border border-gray-600"
                        placeholder="Wachten op start van proces..."
                    />
                </div>
            </div>
        </div>
    );
};

export default EmergencyMigrationView;