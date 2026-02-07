import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Palette, 
  Volume2, 
  VolumeX, 
  Moon, 
  Sun, 
  Monitor,
  Save,
  RefreshCw
} from 'lucide-react';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/contexts/SoundContext';
import { useGame } from '@/contexts/GameContext';
import PlayerAvatar from '@/components/PlayerAvatar';
import { toast } from 'sonner';

const avatarOptions = [
  '🎮', '🎯', '🎲', '🃏', '🎨', '🏆', '⭐', '🔥', '💎', '🌟',
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐙', '🦄',
  '👾', '🤖', '👻', '💀', '🎃', '🦸', '🧙', '🥷', '🦹', '🧛',
];

const Settings: React.FC = () => {
  const {
    theme,
    colorScheme,
    colorBlindMode,
    largeText,
    setTheme,
    setColorScheme,
    setColorBlindMode,
    setLargeText
  } = useTheme();
  const { soundEnabled, soundVolume, setSoundEnabled, setSoundVolume } = useSound();
  const { currentPlayer, setCurrentPlayer } = useGame();
  
  const [username, setUsername] = useState(currentPlayer?.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentPlayer?.avatar || '🎮');
  const [notifications, setNotifications] = useState(true);

  const handleSaveProfile = () => {
    if (currentPlayer) {
      setCurrentPlayer({
        ...currentPlayer,
        name: username || `Player${Math.floor(Math.random() * 9999)}`,
        avatar: selectedAvatar,
      });
      toast.success('Profile saved successfully!');
    }
  };

  const handleResetSettings = () => {
    setTheme('dark');
    setColorScheme('default');
    setSoundEnabled(true);
    setSoundVolume(80);
    setNotifications(true);
    setColorBlindMode(false);
    setLargeText(false);
    toast.info('Settings reset to defaults');
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <motion.div
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto space-y-8"
      >
        {/* Header */}
        <motion.div variants={sectionVariants}>
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Customize your PlayQ experience
          </p>
        </motion.div>

        {/* Profile Section */}
        <motion.div
          variants={sectionVariants}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">Profile</h2>
          </div>

          <div className="space-y-6">
            {/* Current Avatar */}
            <div className="flex items-center gap-4">
              <PlayerAvatar
                avatar={selectedAvatar}
                name={username || 'Player'}
                size="xl"
                showName={false}
              />
              <div>
                <p className="font-medium">{username || 'Player'}</p>
                <p className="text-sm text-muted-foreground">Your current avatar</p>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                maxLength={20}
                className="bg-muted border-0"
              />
            </div>

            {/* Avatar Selection */}
            <div className="space-y-2">
              <Label>Choose Avatar</Label>
              <div className="grid grid-cols-10 gap-2">
                {avatarOptions.map((avatar) => (
                  <motion.button
                    key={avatar}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      selectedAvatar === avatar
                        ? 'bg-primary neon-glow-cyan'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {avatar}
                  </motion.button>
                ))}
              </div>
            </div>

            <GamingButton variant="primary" onClick={handleSaveProfile}>
              <Save className="w-4 h-4" />
              Save Profile
            </GamingButton>
          </div>
        </motion.div>

        {/* Theme Section */}
        <motion.div
          variants={sectionVariants}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-secondary/10">
              <Palette className="w-5 h-5 text-secondary" />
            </div>
            <h2 className="font-display text-xl font-bold">Appearance</h2>
          </div>

          <div className="space-y-6">
            {/* Theme Mode */}
            <div className="space-y-2">
              <Label>Theme Mode</Label>
              <div className="flex gap-2">
                {[
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'light', icon: Sun, label: 'Light' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? 'default' : 'outline'}
                    onClick={() => setTheme(option.value as 'dark' | 'light')}
                    className="flex-1"
                  >
                    <option.icon className="w-4 h-4 mr-2" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label>Color Scheme</Label>
              <Select value={colorScheme} onValueChange={(value) => setColorScheme(value as "default" | "crimson" | "forest" | "ocean")}>
                <SelectTrigger className="bg-muted border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" />
                      Cyber (Default)
                    </div>
                  </SelectItem>
                  <SelectItem value="crimson">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 to-pink-500" />
                      Crimson
                    </div>
                  </SelectItem>
                  <SelectItem value="forest">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                      Forest
                    </div>
                  </SelectItem>
                  <SelectItem value="ocean">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                      Ocean
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Sound Section */}
        <motion.div
          variants={sectionVariants}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-accent/10">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-accent" />
              ) : (
                <VolumeX className="w-5 h-5 text-accent" />
              )}
            </div>
            <h2 className="font-display text-xl font-bold">Sound</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Sound Effects</Label>
                <p className="text-sm text-muted-foreground">
                  Card shuffles, dice rolls, and more
                </p>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Volume</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[soundVolume]}
                  onValueChange={(values) => setSoundVolume(values[0])}
                  max={100}
                  step={1}
                  disabled={!soundEnabled}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {soundVolume}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Turn notifications and game alerts
                </p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
          </div>
        </motion.div>

        {/* Accessibility Section */}
        <motion.div
          variants={sectionVariants}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-success/10">
              <Monitor className="w-5 h-5 text-success" />
            </div>
            <h2 className="font-display text-xl font-bold">Accessibility</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Color Blind Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enhanced color contrast for visibility
                </p>
              </div>
              <Switch
                checked={colorBlindMode}
                onCheckedChange={setColorBlindMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Large Text</Label>
                <p className="text-sm text-muted-foreground">
                  Increase text size throughout the app
                </p>
              </div>
              <Switch
                checked={largeText}
                onCheckedChange={setLargeText}
              />
            </div>
          </div>
        </motion.div>

        {/* Reset Button */}
        <motion.div
          variants={sectionVariants}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            onClick={handleResetSettings}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Settings;
