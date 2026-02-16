import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/Toaster';
import { ThemeProvider } from '@/components/ThemeToggle';
import { LanguageProvider } from '@/hooks/useLanguage';
import { AuthProvider } from '@/hooks/useAuth';
import { SocketProvider } from '@/lib/socket';

// صفحات
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import Reels from '@/pages/Reels';
import Friends from '@/pages/Friends';
import Messages from '@/pages/Messages';
import ApiMarket from '@/pages/ApiMarket';
import LiveRadar from '@/pages/LiveRadar';

// مكونات
import Layout from '@/components/layout/Layout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="facetok-theme">
        <LanguageProvider>
          <AuthProvider>
            <SocketProvider>
              <Router>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="reels" element={<Reels />} />
                    <Route path="profile/:userId?" element={<Profile />} />
                    <Route path="friends" element={<Friends />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="api-market" element={<ApiMarket />} />
                    <Route path="live-radar" element={<LiveRadar />} />
                  </Route>
                </Routes>
              </Router>
              <Toaster />
            </SocketProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;