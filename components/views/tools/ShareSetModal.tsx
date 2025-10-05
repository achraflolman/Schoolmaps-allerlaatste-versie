import React, { useState } from 'react';
import { db, appId, Timestamp } from '../../../services/firebase';
import type { AppUser, FlashcardSet, Flashcard } from '../../../types';
import { Loader2, Share2 } from 'lucide-react';

interface ShareSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    set: FlashcardSet;
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: { text: string }) => void;
}

const ShareSetModal: React.FC<ShareSetModalProps> = ({ isOpen, onClose, set, user, t, tSubject, getThemeClasses, showAppModal }) => {
    const [email, setEmail] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            showAppModal({ text: t('error_invalid_email') });
            return;
        }
        if (email.toLowerCase() === user.email.toLowerCase()) {
            showAppModal({ text: t('error_cannot_share_with_self') });
            return;
        }

        setIsSharing(true);
        try {
            // 1. Find the recipient user to ensure they exist
            const usersRef = db.collection(`users`);
            const userQuery = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

            if (userQuery.empty) {
                showAppModal({ text: t('error_user_not_found', { email }) });
                setIsSharing(false);
                return;
            }

            // 2. Read all cards from the sharer's set
            const cardsRef = db.collection(`users/${user.uid}/flashcardDecks/${set.id}/cards`);
            const cardsSnapshot = await cardsRef.get();
            const cardsToShare = cardsSnapshot.docs.map(doc => {
                // FIX: The document data from Firestore does not contain 'id' or 'setId'.
                // These are typically added programmatically after fetching.
                // Simply get the card data as is.
                const cardData = doc.data();
                return cardData;
            });

            // 3. Create a new document in the top-level 'sharedSets' collection with a robust name fallback
            await db.collection('sharedSets').add({
                name: set.name || 'Onbekende Set',
                subject: set.subject,
                sharerId: user.uid,
                sharerName: user.userName,
                recipientEmail: email.toLowerCase(),
                sharedAt: Timestamp.now(),
                cards: cardsToShare,
            });
            
            showAppModal({ text: t('share_success', { email }) });
            onClose();

        } catch (error) {
            console.error("Sharing failed:", error);
            showAppModal({ text: t('error_share_failed') });
        } finally {
            setIsSharing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2 truncate">{t('share_set_title', { name: set.name })}</h3>
                <form onSubmit={handleShare}>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        {t('share_with_email')}
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('placeholder_email')}
                        className={`w-full p-2 border rounded-lg border-gray-300`}
                        required
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                        <button type="submit" disabled={isSharing} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 transition-colors active:scale-95 w-32 flex items-center justify-center`}>
                            {isSharing ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Share2 size={16} className="mr-2"/>{t('share_button')}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShareSetModal;
