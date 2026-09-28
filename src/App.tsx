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
import { Album, ClientSelectionSubmission, CustomerGallery } from './types';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientGalleryView } from './components/ClientGalleryView';
import { CustomerGalleryView } from './components/CustomerGalleryView';
import { getCustomerGalleryByToken } from './services/customerGalleryService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setLocalAccessToken] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [submissions, setSubmissions] = useState<ClientSelectionSubmission[]>([]);

  // Navigation mode: 'admin' | 'client' | 'customer_gallery'
  const [viewMode, setViewMode] = useState<'admin' | 'client' | 'customer_gallery'>('admin');
  const [currentClientAlbum, setCurrentClientAlbum] = useState<Album | null>(null);
  const [customerGalleryToken, setCustomerGalleryToken] = useState<string | null>(null);
  const [customerGalleryObject, setCustomerGalleryObject] = useState<CustomerGallery | null>(null);
  const [isAdminPreviewing, setIsAdminPreviewing] = useState<boolean>(false);

  // Initialize Auth state listener with persistent token recovery
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setLocalAccessToken(token || null);
      },
      () => {
        setUser(null);
        setLocalAccessToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
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

    // 1. Check Customer Gallery selection link (/select/:token or ?select=:token or #select/:token)
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    let tokenMatch: string | null = null;
    if (pathname.includes('/select/')) {
      const parts = pathname.split('/select/');
      if (parts[1]) tokenMatch = parts[1].split('/')[0].split('?')[0];
    } else if (searchParams.get('select')) {
      tokenMatch = searchParams.get('select');
    } else if (hash.includes('select/')) {
      const parts = hash.split('select/');
      if (parts[1]) tokenMatch = parts[1].split('/')[0].split('?')[0];
    }

    if (tokenMatch) {
      setCustomerGalleryToken(tokenMatch);
      setViewMode('customer_gallery');
      setIsAdminPreviewing(false);
      return;
    }

    // 2. Check legacy album parameters: e.g. ?album=sophie-julian-wedding
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
      if (
        err.code !== 'auth/popup-closed-by-user' &&
        err.code !== 'auth/cancelled-popup-request'
      ) {
        alert('Google Drive Connection: ' + (err.message || 'Please check your connection and allow popups.'));
      }
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

  const handleOpenCustomerGalleryView = (gallery: CustomerGallery) => {
    setCustomerGalleryObject(gallery);
    setCustomerGalleryToken(gallery.secureToken);
    setViewMode('customer_gallery');
    setIsAdminPreviewing(true);
  };

  const handleBackToAdmin = () => {
    // Clean url query if viewing
    window.history.replaceState({}, '', window.location.pathname.replace(/\/select\/.*$/, ''));
    setViewMode('admin');
    setCurrentClientAlbum(null);
    setCustomerGalleryToken(null);
    setCustomerGalleryObject(null);
    setIsAdminPreviewing(false);
    loadData();
  };

  // Render Customer Gallery View (No login required)
  if (viewMode === 'customer_gallery' && customerGalleryToken) {
    return (
      <CustomerGalleryView
        token={customerGalleryToken}
        initialGallery={customerGalleryObject}
        isAdminPreview={isAdminPreviewing}
        onBackToAdmin={handleBackToAdmin}
      />
    );
  }

  // Render Legacy Client View
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

  // Render Admin Dashboard
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
      onOpenCustomerGalleryView={handleOpenCustomerGalleryView}
      onRefreshData={loadData}
    />
  );
}

