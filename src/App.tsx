import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SoundProvider } from "@/contexts/SoundContext";
import { GameProvider } from "@/contexts/GameContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { UnoProvider } from "@/contexts/UnoContext";
import { LudoProvider } from "@/contexts/LudoContext";
import { DominoesProvider } from "@/contexts/DominoesContext";
import { PictionaryProvider } from "@/contexts/PictionaryContext";
import { WhotProvider } from "@/contexts/WhotContext";
import Layout from "@/components/Layout";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Suspense, lazy } from "react";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Games = lazy(() => import("./pages/Games"));
const Lobby = lazy(() => import("./pages/Lobby"));
const Settings = lazy(() => import("./pages/Settings"));
const Chat = lazy(() => import("./pages/Chat"));
const UnoGame = lazy(() => import("./pages/UnoGame"));
const LudoGame = lazy(() => import("./pages/LudoGame"));
const DominoesGame = lazy(() => import("./pages/DominoesGame"));
const PictionaryGame = lazy(() => import("./pages/PictionaryGame"));
const WhotGame = lazy(() => import("./pages/WhotGame"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <SoundProvider>
        <LoadingProvider>
          <GameProvider>
            <NotificationProvider>
              <UnoProvider>
                <LudoProvider>
                  <DominoesProvider>
                    <PictionaryProvider>
                      <WhotProvider>
                        <ChatProvider>
                          <VoiceProvider>
                            <TooltipProvider>
                              <Toaster />
                              <Sonner />
                              <BrowserRouter>
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    <Route element={<Layout />}>
                                      <Route path="/" element={<Index />} />
                                      <Route path="/games" element={<Games />} />
                                      <Route path="/lobby/:code" element={<Lobby />} />
                                      <Route path="/game/uno/:code" element={<UnoGame />} />
                                      <Route path="/game/ludo/:code" element={<LudoGame />} />
                                      <Route path="/game/dominoes/:code" element={<DominoesGame />} />
                                      <Route path="/game/pictionary/:code" element={<PictionaryGame />} />
                                      <Route path="/game/whot/:code" element={<WhotGame />} />
                                      <Route path="/settings" element={<Settings />} />
                                      <Route path="/chat" element={<Chat />} />
                                    </Route>
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                </Suspense>
                                <PWAInstallPrompt />
                              </BrowserRouter>
                            </TooltipProvider>
                          </VoiceProvider>
                        </ChatProvider>
                      </WhotProvider>
                    </PictionaryProvider>
                  </DominoesProvider>
                </LudoProvider>
              </UnoProvider>
            </NotificationProvider>
          </GameProvider>
        </LoadingProvider>
      </SoundProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
