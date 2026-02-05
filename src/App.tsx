import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GameProvider } from "@/contexts/GameContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Games from "./pages/Games";
import Lobby from "./pages/Lobby";
import Settings from "./pages/Settings";
import Leaderboard from "./pages/Leaderboard";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LoadingProvider>
        <GameProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/games" element={<Games />} />
                  <Route path="/lobby/:code" element={<Lobby />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/chat" element={<Chat />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </GameProvider>
      </LoadingProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
