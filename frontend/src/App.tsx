import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TopNav } from "./components/Layout/TopNav";
import { MobileTop } from "./components/Layout/MobileTop";
import { MobileBottomNav } from "./components/Layout/MobileBottomNav";
import { AddToHomeScreen } from "./components/Layout/AddToHomeScreen";
import { VideoPlayer } from "./components/Player/VideoPlayer";
import { Dashboard } from "./pages/Dashboard";
import { LiveTV } from "./pages/LiveTV";
import { Movies } from "./pages/Movies";
import { SeriesPage } from "./pages/SeriesPage";
import { Downloads } from "./pages/Downloads";
import { SettingsPage } from "./pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="xapp">
          <TopNav />
          <MobileTop />
          <main className="xmain">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/live" element={<LiveTV />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/series" element={<SeriesPage />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <MobileBottomNav />
          <AddToHomeScreen />
        </div>
        <VideoPlayer />
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              boxShadow: "var(--shadow-pop)",
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
