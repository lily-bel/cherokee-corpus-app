import React from 'react';
import { useAuth } from './AuthContext';
import { UserIcon } from './Icons';

export interface UserAuthButtonProps {
  className?: string;
  onClick?: () => void;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({ className, onClick }) => {
  const { user, syncStatus, openAuthModal } = useAuth();

  const handleClick = onClick || openAuthModal;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className || "p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors relative"}
      title={user ? `${user.displayName || user.email || 'Account'} (${syncStatus === 'synced' ? 'Backed Up' : syncStatus === 'syncing' ? 'Backing Up...' : syncStatus === 'error' ? 'Sync Error' : 'Online'})` : "Sign In / Cloud Backup"}
    >
      {user?.photoURL ? (
        <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full object-cover border border-amber-500" />
      ) : (
        <UserIcon size={20} />
      )}
      {user && (
        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
          syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'
        }`} />
      )}
    </button>
  );
};
