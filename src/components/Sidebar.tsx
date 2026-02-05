import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Gamepad2, Settings, MessageSquare, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGame } from '@/contexts/GameContext';
import { useChat } from '@/contexts/ChatContext';
import PlayerAvatar from './PlayerAvatar';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Gamepad2, label: 'Games', path: '/games' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { currentPlayer } = useGame();
  const { getUnreadTotal } = useChat();
  const unreadCount = getUnreadTotal();

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="hidden sm:flex flex-col w-64 h-screen glass-card border-r border-border p-4 fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <Link to="/" className="mb-8">
        <motion.h1
          className="font-display text-3xl font-bold gradient-text"
          whileHover={{ scale: 1.02 }}
        >
          PlayQ
        </motion.h1>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                className={cn(
                  'relative flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 w-1 h-8 rounded-r-full bg-gradient-primary"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.label === 'Chat' && unreadCount > 0 && (
                  <span className="absolute right-4 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="pt-4 border-t border-border">
        {currentPlayer && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <PlayerAvatar
              avatar={currentPlayer.avatar}
              name={currentPlayer.name}
              size="sm"
              showName={false}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{currentPlayer.name}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <User className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
