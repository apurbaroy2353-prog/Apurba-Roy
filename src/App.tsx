import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setAccessToken,
} from './services/auth';
import {
  getStoredAlbums,
  saveAlbum,
  deleteAlbum,
  getStoredSubmissions,
  getAlbumBySlug,
} from './services/albumStorage';
import { Album, ClientSelectionSubmission } from './types';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientGalleryView } from './components/ClientGalleryView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setLocalAccessToken] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [submissions, setSubmissions] = useState<ClientSelectionSubmission[]>([]);

  // Navigation mode: 'admin' | 'client'
  const [viewMode, setViewMode] = useState<'admin' | 'client'>('admin');
  const [currentClientAlbum, setCurrentClientAlbum] = useState<Album | null>(null);
  const [isAdminPreviewing, setIsAdminPreviewing] = useState<boolean>(false);

  // Initialize Auth state listener
  useEffect(() => {
    initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setLocalAccessToken(token);
      },
      () => {
        setUser(null);
        setLocalAccessToken(null);
      }
    );
  }, []);

  // Load albums & submissions from storage
  const loadData = () => {
    const loadedAlbums = getStoredAlbums();
    const loadedSubmissions = getStoredSubmissions();
    setAlbums(loadedAlbums);
    setSubmissions(loadedSubmissions);
    return { loadedAlbums, loadedSubmissions };
  };

  useEffect(() => {
    const { loadedAlbums } = loadData();

    // Check URL parameters: e.g. ?album=sophie-julian-wedding
    const searchParams = new URLSearchParams(window.location.search);
    const albumSlug = searchParams.get('album');
    if (albumSlug) {
      const match = loadedAlbums.find(
        (a) => a.slug === albumSlug || a.id === albumSlug
      );
      if (match) {
        setCurrentClientAlbum(match);
        setViewMode('client');
        setIsAdminPreviewing(false);
      }
    }
  }, []);

  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setLocalAccessToken(res.accessToken);
        setAccessToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      alert('Sign in failed: ' + err.message);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setLocalAccessToken(null);
  };

  const handleCreateAlbum = (newAlbum: Album) => {
    saveAlbum(newAlbum);
    loadData();
  };

  const handleDeleteAlbum = (albumId: string) => {
    deleteAlbum(albumId);
    loadData();
  };

  const handleViewAsClient = (album: Album) => {
    setCurrentClientAlbum(album);
    setViewMode('client');
    setIsAdminPreviewing(true);
  };

  const handleBackToAdmin = () => {
    // Clean url query if viewing
    window.history.replaceState({}, '', window.location.pathname);
    setViewMode('admin');
    setCurrentClientAlbum(null);
    setIsAdminPreviewing(false);
    loadData();
  };

  if (viewMode === 'client' && currentClientAlbum) {
    return (
      <ClientGalleryView
        album={currentClientAlbum}
        accessToken={accessToken}
        isAdminViewing={isAdminPreviewing}
        onBackToAdmin={handleBackToAdmin}
      />
    );
  }

  return (
    <AdminDashboard
      user={user}
      accessToken={accessToken}
      albums={albums}
      submissions={submissions}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onCreateAlbum={handleCreateAlbum}
      onDeleteAlbum={handleDeleteAlbum}
      onViewAsClient={handleViewAsClient}
      onRefreshData={loadData}
    />
  );
}
