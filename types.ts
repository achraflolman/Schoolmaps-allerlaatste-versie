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

export interface SessionAnswer {
  card: Flashcard;
  userAnswer?: string; // For vocabulary mode
  isCorrect: boolean;
}

export interface SessionSummary {
  stats: {
    correct: number;
    incorrect: number;
    total: number;
    startTime: number; // timestamp
    endTime: number; // timestamp
  };
  answers: SessionAnswer[];
  earnedStars: number;
}


export interface SyncedCalendar {
    id: string;
    name: string;
    url: string;
    provider: 'google' | 'apple' | 'teams' | 'canvas' | 'magister' | 'other';
    enabled: boolean;
}

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
    totalStars?: number;
    goals?: string[];
    syncedCalendars?: SyncedCalendar[];
    purchasedFileIds?: string[];
}

export interface FileData {
    id: string;
    title: string;
    description?: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    fileUrl: string;
    storagePath: string;
    isPublic?: boolean;
    // New fields for rich previews
    fileType?: 'pdf' | 'image' | 'other';
    pageCount?: number;
    // Star System Fields
    starPrice?: number;
    uploaderName?: string;
    downloads?: number;
    averageRating?: number;
    ratingCount?: number;
    ratings?: { [userId: string]: number }; // Map of userId to their rating (1-5)
    isPlaceholder?: boolean;
}

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    type: 'test' | 'presentation' | 'homework' | 'oral' | 'other' | 'work' | 'school' | 'free_period' | 'study_plan';
    subject: string;
    start: FirebaseTimestamp;
    end: FirebaseTimestamp;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
    isSynced?: boolean;
    sourceCalendar?: {
        name: string;
        provider: SyncedCalendar['provider'];
    };
    studyPlanId?: string;
}

export interface ModalContent {
    text: string;
    confirmAction?: () => void;
    cancelAction?: () => void;
}

export interface Notification {
    id: string;
    title: string;
    text: string;
    type: 'admin' | 'streak' | 'feedback_reply' | 'flashcard_share' | 'plan_share' | 'system';
    read: boolean;
    createdAt: FirebaseTimestamp;
    broadcastId?: string;
    feedbackId?: string;
    flashcardSetId?: string;
    subject?: string;
    planId?: string;
}

export interface BroadcastData {
    id: string;
    title: string;
    message: string;
    sender: string;
    createdAt: FirebaseTimestamp;
}

export interface ToDoTask {
    id: string;
    text: string;
    completed: boolean;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    completedAt?: FirebaseTimestamp;
    reminderAt?: FirebaseTimestamp;
    dueDate?: FirebaseTimestamp;
    recurring?: 'daily' | null;
}

export interface AdminSettings {
    themePreference: string;
    pinProtectionEnabled: boolean;
    fontPreference: string;
}

export interface Note {
    id: string;
    title: string;
    content: string; // For text notes: plain text. For drawing notes: JSON string of objects.
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    updatedAt?: FirebaseTimestamp;
    noteType?: 'text' | 'drawing'; // New property
    background?: 'blank' | 'grid' | 'lines'; // New property for drawing notes
    backgroundColor?: string; // New property for drawing notes page color
}

export interface FlashcardSet {
    id: string;
    name: string;
    subject: string;
    ownerId: string;
    createdAt: FirebaseTimestamp;
    cardCount: number;
    isShared?: boolean;
    sharerName?: string;
    // For combined sets feature
    isCombined?: boolean;
    combinedFrom?: string[];
    cards?: Flashcard[]; // For temporary in-memory combined sets
}

export interface StudyPlanSubject {
    subject: string;
    topic: string;
    amount: string;
}

export interface StudyScheduleItem {
    day: string;
    time: string;
    subject: string;
    task: string;
    tip: string;
}

export interface StudyPlan {
    id: string;
    userId: string;
    title: string;
    testDate: FirebaseTimestamp;
    subjects: StudyPlanSubject[];
    schedule: StudyScheduleItem[];
    createdAt: FirebaseTimestamp;
    isShared?: boolean;
    sharerName?: string;
}

export interface StudySession {
    id: string;
    userId: string;
    date: FirebaseTimestamp;
    durationMinutes: number;
    taskId: string | null;
}

export interface FeedbackReply {
    text: string;
    repliedAt: FirebaseTimestamp;
    repliedBy: string;
    isAdminReply: boolean;
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
    replies: FeedbackReply[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface ChatHistory {
    id: string;
    userId: string;
    title: string;
    createdAt: FirebaseTimestamp;
    updatedAt: FirebaseTimestamp;
    messages: ChatMessage[];
}

export interface ChatMessageData {
    id: string;
    senderId: string;
    text: string;
    createdAt: FirebaseTimestamp;
}

export interface Chat {
    id: string; // Composite key e.g., uid1_uid2
    participantIds: string[];
    participantInfo: {
        [uid: string]: {
            name: string;
            avatar: string | null;
        };
    };
    lastMessageAt: FirebaseTimestamp;
    lastMessageText: string;
}