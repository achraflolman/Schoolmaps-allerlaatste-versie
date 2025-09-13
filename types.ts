
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface AppUser {
    uid: string;
    email: string;
    userName: string;
    profilePictureUrl: string | null;
    createdAt: firebase.firestore.Timestamp | Date;
    selectedSubjects: string[];
    schoolName: string;
    className: string;
    educationLevel: string;
    languagePreference: 'nl' | 'en';
    themePreference: string;
    fontPreference?: string;
    homeLayout?: string[];
    customSubjects?: string[];
    lastLoginDate?: firebase.firestore.Timestamp | Date;
    streakCount?: number;
    notificationsEnabled?: boolean;
    isAdmin?: boolean;
    disabled?: boolean;
    isVerifiedByEmail?: boolean;
    focusDuration?: number;
    breakDuration?: number;
    dismissedBroadcastIds?: string[];
    dismissedFeedbackIds?: string[];
    aiBotName?: string;
    aiBotAvatarUrl?: string | null;
    hasCompletedOnboarding?: boolean;
}

export interface AdminSettings {
    themePreference: string;
    fontPreference: string;
    pinProtectionEnabled: boolean;
}

export interface FileData {
    id: string;
    title: string;
    description: string;
    subject: string;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    fileUrl: string;
    storagePath: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: firebase.firestore.Timestamp;
    end: firebase.firestore.Timestamp;
    type: 'test' | 'presentation' | 'homework' | 'oral' | 'other' | 'work' | 'school';
    subject: string;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    updatedAt?: firebase.firestore.Timestamp;
}

export interface Note {
    id: string;
    title: string;
    content: string;
    subject: string;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    updatedAt?: firebase.firestore.Timestamp;
}

export interface ToDoTask {
    id: string;
    text: string;
    completed: boolean;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    updatedAt?: firebase.firestore.Timestamp;
    reminderAt?: firebase.firestore.Timestamp;
}

export interface Flashcard {
    id: string;
    question: string;
    answer: string;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    dueDate?: firebase.firestore.Timestamp;
    interval?: number;
    easeFactor?: number;
}

export interface FlashcardSet {
    id:string;
    name: string;
    subject: string;
    ownerId: string;
    createdAt: firebase.firestore.Timestamp;
    cardCount: number;
}

export interface StudyScheduleItem {
  day: string; // YYYY-MM-DD
  time: string;
  task: string;
  tip: string;
  subject?: string;
}

export interface StudyPlanSubject {
    subject: string;
    topic: string;
    amount: string;
}

export interface StudyPlan {
    id: string;
    userId: string;
    title: string;
    testDate: firebase.firestore.Timestamp;
    subjects: StudyPlanSubject[];
    schedule: StudyScheduleItem[];
    createdAt: firebase.firestore.Timestamp;
}


export interface ModalContent {
    text: string;
    confirmAction?: () => void;
    cancelAction?: () => void;
}

export interface Notification {
    id: string;
    title?: string;
    text: string;
    type: 'system' | 'admin' | 'streak' | 'feedback_reply';
    read: boolean;
    createdAt: firebase.firestore.Timestamp;
    broadcastId?: string;
    feedbackId?: string;
}

export interface BroadcastData {
    id: string;
    title: string;
    message: string;
    createdAt: firebase.firestore.Timestamp;
}

export interface FeedbackReply {
    text: string;
    repliedAt: firebase.firestore.Timestamp;
    repliedBy: 'admin';
    isAdminReply: true;
}

export interface Feedback {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    subject: string;
    message: string;
    status: 'new' | 'replied';
    createdAt: firebase.firestore.Timestamp;
    replies?: FeedbackReply[];
}
