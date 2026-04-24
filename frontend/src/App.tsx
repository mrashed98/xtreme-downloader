import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Layout/Sidebar";
import { Navbar } from "./components/Layout/Navbar";
import { MobileBottomNav } from "./components/Layout/MobileBottomNav";
import { VideoPlayer } from "./components/Player/VideoPlayer";
import { Dashboard } from "./pages/Dashboard";
import { LiveTV } from "./pages/LiveTV";
import { Movies } from "./pages/Movies";
import { SeriesPage } from "./pages/SeriesPage";
import { Downloads } from "./pages/Downloads";

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
        <div className="app-shell">
          <div className="app-shell__backdrop" aria-hidden="true" />
          <Sidebar />
          <div className="app-shell__content">
            <Navbar />
            <main className="app-shell__main">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveTV />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/series" element={<SeriesPage />} />
                <Route path="/downloads" element={<Downloads />} />
              </Routes>
            </main>
          </div>
          <MobileBottomNav />
        </div>
        <VideoPlayer />
        <Toaster position="bottom-right" theme="dark" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
