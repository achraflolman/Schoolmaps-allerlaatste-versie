// FIX: Import FirebaseTimestamp to resolve type errors within this file.
import type { FirebaseTimestamp } from './services/firebase';

export interface Flashcard {
    id: string;
    setId: string;
    question: string;
    answer: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    dueDate?: FirebaseTimestamp;
    interval?: number;
    easeFactor?: number;
}

// FIX: Added export for AppUser type.
export interface AppUser {
    uid: string;
    email: string;
    userName: string;
    profilePictureUrl: string | null;
    isAdmin?: boolean;
    createdAt?: FirebaseTimestamp;
    selectedSubjects: string[];
    customSubjects: string[];
    schoolName: string;
    className: string;
    educationLevel: string;
    languagePreference: 'nl' | 'en';
    themePreference: string;
    fontPreference: string;
    homeLayout: string[];
    streakCount?: number;
    lastLoginDate?: FirebaseTimestamp;
    notificationsEnabled: boolean;
    disabled: boolean;
    isVerifiedByEmail: boolean;
    focusDuration?: number;
    breakDuration?: number;
    dismissedBroadcastIds: string[];
    dismissedFeedbackIds: string[];
    aiBotName: string;
    aiBotAvatarUrl: string | null;
    hasCompletedOnboarding: boolean;
}

// FIX: Added export for FileData type.
export interface FileData {
    id: string;
    title: string;
    description?: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    fileUrl: string;
    storagePath: string;
}

// FIX: Added export for CalendarEvent type.
export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    type: 'test' | 'presentation' | 'homework' | 'oral' | 'other' | 'work' | 'school';
    subject: string;
    start: FirebaseTimestamp;
    end: FirebaseTimestamp;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
}

// FIX: Added export for ModalContent type.
export interface ModalContent {
    text: string;
    confirmAction?: () => void;
    cancelAction?: () => void;
}

// FIX: Added export for Notification type.
export interface Notification {
    id: string;
    title: string;
    text: string;
    type: 'admin' | 'streak' | 'feedback_reply' | 'flashcard_share' | 'system';
    read: boolean;
    createdAt: FirebaseTimestamp;
    broadcastId?: string;
    feedbackId?: string;
    flashcardSetId?: string;
    subject?: string;
}

// FIX: Added export for BroadcastData type.
export interface BroadcastData {
    id: string;
    title: string;
    message: string;
    sender: string;
    createdAt: FirebaseTimestamp;
}

// FIX: Added export for ToDoTask type.
export interface ToDoTask {
    id: string;
    text: string;
    completed: boolean;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    completedAt?: FirebaseTimestamp;
    reminderAt?: FirebaseTimestamp;
}

// FIX: Added export for AdminSettings type.
export interface AdminSettings {
    themePreference: string;
    pinProtectionEnabled: boolean;
    fontPreference: string;
}

// FIX: Added export for Note type.
export interface Note {
    id: string;
    title: string;
    content: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
}

// FIX: Added export for FlashcardSet type.
export interface FlashcardSet {
    id: string;
    name: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    cardCount: number;
    isShared?: boolean;
    sharerName?: string;
}

// FIX: Added export for StudyPlanSubject type.
export interface StudyPlanSubject {
    subject: string;
    topic: string;
    amount: string;
}

// FIX: Added export for StudyScheduleItem type.
export interface StudyScheduleItem {
    day: string;
    time: string;
    subject: string;
    task: string;
    tip: string;
}

// FIX: Added export for StudyPlan type.
export interface StudyPlan {
    id: string;
    userId: string;
    title: string;
    testDate: FirebaseTimestamp;
    subjects: StudyPlanSubject[];
    schedule: StudyScheduleItem[];
    createdAt: FirebaseTimestamp;
}

// FIX: Added export for StudySession type.
export interface StudySession {
    id: string;
    userId: string;
    date: FirebaseTimestamp;
    durationMinutes: number;
    taskId: string | null;
}

// FIX: Added export for FeedbackReply type.
export interface FeedbackReply {
    text: string;
    repliedAt: FirebaseTimestamp;
    repliedBy: string;
    isAdminReply: boolean;
}

// FIX: Added export for Feedback type.
export interface Feedback {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    subject: string;
    message: string;
    status: 'new' | 'replied';
    createdAt: FirebaseTimestamp;
    replies: FeedbackReply[];
}
