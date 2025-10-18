import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../services/firebase';
import type { AppUser, ModalContent, AdminSettings } from '../../types';
import { LogOut, Send, Users, RefreshCw, UserCheck, UserX, Search, MessageCircle, Award, Settings } from 'lucide-react';
import AdminSettingsView from './admin/AdminSettingsView';

interface AdminViewProps {
    user: AppUser;
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    handleLogout: () => void;
    showAppModal: (content: ModalContent) => void;
    onUserClick: (user: AppUser) => void;
    adminSettings: AdminSettings;
    onAdminSettingsUpdate: (updatedData: Partial<AdminSettings>) => Promise<void>;
    onPinDisableRequest: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ user, t, tSubject, getThemeClasses, handleLogout, showAppModal, onUserClick, adminSettings, onAdminSettingsUpdate, onPinDisableRequest }) => {
    const [activeTab, setActiveTab] = useState('users');
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await db.collection('users').get();
            const users = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
            setAllUsers(users.filter(u => u.email !== 'admin1069@gmail.com'));
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchData();
        }
    }, [activeTab, fetchData]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return allUsers;
        return allUsers.filter(u => 
            u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allUsers, searchQuery]);

    const handleUserStatusToggle = (targetUser: AppUser) => {
        const action = targetUser.disabled ? 'enable' : 'disable';
        showAppModal({
            text: t(action === 'enable' ? 'confirm_enable_user' : 'confirm_disable_user', { name: targetUser.userName }),
            confirmAction: async () => {
                try {
                    await db.doc(`users/${targetUser.uid}`).update({ disabled: !targetUser.disabled });
                    showAppModal({ text: t('user_status_updated') });
                    fetchData(); // Refresh data
                } catch (error) {
                    showAppModal({ text: t('error_user_status_update') });
                }
            },
            cancelAction: () => {}
        });
    };
    
    const handleVerifyUser = (targetUser: AppUser) => {
        showAppModal({
            text: t('confirm_verify_user', { name: targetUser.userName }),
            confirmAction: async () => {
                try {
                    await db.doc(`users/${targetUser.uid}`).update({ isVerifiedByEmail: true });
                    showAppModal({ text: t('user_verified_success') });
                    fetchData();
                } catch (error) {
                    showAppModal({ text: t('error_user_verify_failed') });
                }
            },
            cancelAction: () => {}
        });
    };

    const renderUsers = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-xs">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('admin_search_placeholder')} className="w-full p-2 pl-8 border rounded-lg"/>
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <button onClick={fetchData} className="p-2 bg-gray-200 rounded-lg"><RefreshCw className={isLoading ? 'animate-spin' : ''} /></button>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('last_login')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status')}</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map(u => (
                        <tr key={u.uid} onClick={() => onUserClick(u)} className="hover:bg-gray-50 cursor-pointer">
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="ml-4"><div className="text-sm font-medium text-gray-900">{u.userName}</div><div className="text-sm text-gray-500">{u.email}</div></div></div></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.lastLoginDate?.toDate().toLocaleDateString() || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{u.disabled ? t('disabled') : t('active')}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleUserStatusToggle(u)} className={`p-2 rounded-full ${u.disabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{u.disabled ? <UserCheck size={16}/> : <UserX size={16}/>}</button>
                                {!u.isVerifiedByEmail && <button onClick={() => handleVerifyUser(u)} className="ml-2 p-2 rounded-full bg-blue-100 text-blue-600">{t('verify_user_button')}</button>}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                 </table>
            </div>
        </div>
    );
    
    // Placeholder for other admin views that might be part of the full component
    const AdminBroadcastView = () => <div>Broadcasts View (not implemented)</div>;
    const AdminFeedbackView = () => <div>Feedback View (not implemented)</div>;
    const AdminLeaderboardView = () => <div>Leaderboard View (not implemented)</div>;
    
    const tabs = [
        { id: 'users', label: t('users'), icon: Users },
        { id: 'broadcasts', label: t('broadcasts'), icon: Send },
        { id: 'feedback', label: t('admin_feedback_dashboard'), icon: MessageCircle },
        { id: 'leaderboard', label: t('admin_streak_leaderboard'), icon: Award },
        { id: 'settings', label: t('settings'), icon: Settings }
    ];

    const renderContent = () => {
        switch(activeTab) {
            case 'users': return renderUsers();
            case 'broadcasts': return <AdminBroadcastView />;
            case 'feedback': return <AdminFeedbackView />;
            case 'leaderboard': return <AdminLeaderboardView />;
            case 'settings': return <AdminSettingsView t={t} getThemeClasses={getThemeClasses} settings={adminSettings} onUpdate={onAdminSettingsUpdate} onPinDisableRequest={onPinDisableRequest} />;
            default: return null;
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">{t('admin_dashboard')}</h1>
                <button onClick={handleLogout} className="flex items-center gap-2 font-semibold bg-red-100 text-red-600 px-4 py-2 rounded-lg"><LogOut size={16}/> {t('logout_button')}</button>
            </header>
            <div className="flex border-b mb-6">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-2 px-4 font-semibold ${activeTab === tab.id ? `${getThemeClasses('text')} border-b-2 ${getThemeClasses('border')}` : 'text-gray-500'}`}>
                        <tab.icon size={18}/> {tab.label}
                    </button>
                ))}
            </div>
            {renderContent()}
        </div>
    );
};

export default AdminView;
