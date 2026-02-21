import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Layout/Sidebar";
import { Navbar } from "./components/Layout/Navbar";
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
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveTV />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/series" element={<SeriesPage />} />
                <Route path="/downloads" element={<Downloads />} />
              </Routes>
            </main>
          </div>
        </div>
        <VideoPlayer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
