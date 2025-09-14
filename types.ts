import type { FirebaseTimestamp } from './services/firebase';

export interface AppUser {
    uid: string;
    email: string;
    userName: string;
    profilePictureUrl: string | null;
    createdAt: FirebaseTimestamp | Date;
    selectedSubjects: string[];
    schoolName: string;
    className: string;
    educationLevel: string;
    languagePreference: 'nl' | 'en';
    themePreference: string;
    fontPreference?: string;
    homeLayout?: string[];
    customSubjects?: string[];
    lastLoginDate?: FirebaseTimestamp | Date;
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
    createdAt: FirebaseTimestamp;
    fileUrl: string;
    storagePath: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: FirebaseTimestamp;
    end: FirebaseTimestamp;
    type: 'test' | 'presentation' | 'homework' | 'oral' | 'other' | 'work' | 'school';
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
}

export interface Note {
    id: string;
    title: string;
    content: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
}

export interface ToDoTask {
    id: string;
    text: string;
    completed: boolean;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
    reminderAt?: FirebaseTimestamp;
    completedAt?: FirebaseTimestamp;
}

export interface StudySession {
    id: string;
    userId: string;
    date: FirebaseTimestamp;
    durationMinutes: number;
    taskId?: string | null;
}

export interface Flashcard {
    id: string;
    question: string;
    answer: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    dueDate?: FirebaseTimestamp;
    interval?: number;
    easeFactor?: number;
}

export interface FlashcardSet {
    id:string;
    name: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
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
    testDate: FirebaseTimestamp;
    subjects: StudyPlanSubject[];
    schedule: StudyScheduleItem[];
    createdAt: FirebaseTimestamp;
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
    createdAt: FirebaseTimestamp;
    broadcastId?: string;
    feedbackId?: string;
}

export interface BroadcastData {
    id: string;
    title: string;
    message: string;
    createdAt: FirebaseTimestamp;
}

export interface FeedbackReply {
    text: string;
    repliedAt: FirebaseTimestamp;
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
    createdAt: FirebaseTimestamp;
    replies?: FeedbackReply[];
}