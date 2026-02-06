export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
}

export interface GameSettings {
  maxPlayers: number;
  timeLimit?: number;
  houseRules: Record<string, any>;
}

export interface Lobby {
  id: string;
  code: string;
  gameType: 'uno' | 'ludo' | 'pictionary' | 'dominoes';
  host: Player;
  players: Player[];
  settings: GameSettings;
  status: 'waiting' | 'starting' | 'in-progress' | 'finished';
  createdAt: Date;
}

export interface VoiceParticipant {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
  stream?: MediaStream;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount: number;
  avatar: string;
  isGroup: boolean;
  memberCount?: number;
}
