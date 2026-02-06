import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GameProvider } from "@/contexts/GameContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { UnoProvider } from "@/contexts/UnoContext";
import { LudoProvider } from "@/contexts/LudoContext";
import { DominoesProvider } from "@/contexts/DominoesContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Games from "./pages/Games";
import Lobby from "./pages/Lobby";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import UnoGame from "./pages/UnoGame";
import LudoGame from "./pages/LudoGame";
import DominoesGame from "./pages/DominoesGame";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LoadingProvider>
        <GameProvider>
          <UnoProvider>
            <LudoProvider>
              <DominoesProvider>
                <ChatProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route path="/" element={<Index />} />
                          <Route path="/games" element={<Games />} />
                          <Route path="/lobby/:code" element={<Lobby />} />
                          <Route path="/game/uno/:code" element={<UnoGame />} />
                          <Route path="/game/ludo/:code" element={<LudoGame />} />
                          <Route path="/game/dominoes/:code" element={<DominoesGame />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/chat" element={<Chat />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </BrowserRouter>
                  </TooltipProvider>
                </ChatProvider>
              </DominoesProvider>
            </LudoProvider>
          </UnoProvider>
        </GameProvider>
      </LoadingProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
