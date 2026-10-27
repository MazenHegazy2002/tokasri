'use client';

import React, { useState, useEffect } from 'react';
import PublicPortal from './PublicPortal';
import StudentPortal from './StudentPortal';
import AdminPortal from './AdminPortal';

interface LMSClientAppProps {
  initialState: any;
  initialPortal?: 'public' | 'student' | 'admin';
  initialSubRoute?: string;
}

export default function LMSClientApp({
  initialState,
  initialPortal = 'public',
  initialSubRoute = 'landing',
}: LMSClientAppProps) {
  const [state, setState] = useState<any>(initialState);
  const [portal, setPortal] = useState<'public' | 'student' | 'admin'>(initialPortal);
  const [subRoute, setSubRoute] = useState<string>(initialSubRoute);
  const [adminRole, setAdminRole] = useState<'admin' | 'co'>(
    initialState?.authenticatedUser?.role === 'coadmin' ? 'co' : 'admin'
  );
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [mobile, setMobile] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(initialState?.authenticatedUser || null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('course-1');
  const [activeLessonId, setActiveLessonId] = useState<string>('l5');

  useEffect(() => {
    const checkWidth = () => setMobile(window.innerWidth < 760);
    checkWidth();
    window.addEventListener('resize', checkWidth);

    // Clear any legacy localStorage auth state from prior versions
    try {
      localStorage.removeItem('sri_auth_user');
    } catch {
      // ignore storage errors
    }

    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const handleSelectUser = (user: any) => {
    setCurrentUser(user);
  };

  const handleAction = async (action: string, payload: any = {}) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (data?.state) {
        setState(data.state);
        if (data.state.authenticatedUser !== undefined) {
          setCurrentUser(data.state.authenticatedUser);
        }
      }
      return data;
    } catch (err) {
      console.error('Action error:', err);
      return { error: 'Network error' };
    }
  };

  const handleLogout = async () => {
    await handleAction('logout');
    setCurrentUser(null);
    setPortal('public');
    setSubRoute('login');
    window.scrollTo(0, 0);
  };

  const handleUploadFile = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data?.ok) {
        return {
          url: data.url,
          fileName: data.fileName,
          sizeLabel: data.sizeLabel,
        };
      }
      return null;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleNavigatePortal = (
    targetPortal: 'public' | 'student' | 'admin',
    targetSubRoute?: string,
    extra?: any
  ) => {
    if ((targetPortal === 'student' || targetPortal === 'admin') && !currentUser && !extra?.authenticatedUser) {
      setPortal('public');
      setSubRoute('login');
      window.scrollTo(0, 0);
      return;
    }

    const activeUser = extra?.authenticatedUser || currentUser;

    if (targetPortal === 'admin' && activeUser?.role === 'student') {
      setPortal('student');
      setSubRoute('dashboard');
      return;
    }

    setPortal(targetPortal);
    if (targetSubRoute) setSubRoute(targetSubRoute);
    if (activeUser?.role === 'coadmin') {
      setAdminRole('co');
    } else if (extra?.role) {
      setAdminRole(extra.role);
    } else if (activeUser?.role === 'admin') {
      setAdminRole('admin');
    }
    if (extra?.courseId) setSelectedCourseId(extra.courseId);
    if (extra?.lessonId) setActiveLessonId(extra.lessonId);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {portal === 'public' && (
        <PublicPortal
          state={state}
          currentUser={currentUser}
          lang={lang}
          setLang={setLang}
          mobile={mobile}
          onAction={handleAction}
          onUploadFile={handleUploadFile}
          onNavigatePortal={handleNavigatePortal}
          onSelectUser={handleSelectUser}
          onLogout={handleLogout}
          initialSubRoute={subRoute}
          selectedCourseId={selectedCourseId}
          setSelectedCourseId={setSelectedCourseId}
        />
      )}

      {portal === 'student' && (
        <StudentPortal
          state={state}
          currentUser={currentUser}
          lang={lang}
          setLang={setLang}
          mobile={mobile}
          onAction={handleAction}
          onUploadFile={handleUploadFile}
          onNavigatePortal={handleNavigatePortal}
          onLogout={handleLogout}
          initialSubRoute={subRoute}
          activeCourseId={selectedCourseId}
          setActiveCourseId={setSelectedCourseId}
          activeLessonId={activeLessonId}
          setActiveLessonId={setActiveLessonId}
        />
      )}

      {portal === 'admin' && (
        <AdminPortal
          state={state}
          currentUser={currentUser}
          lang={lang}
          setLang={setLang}
          mobile={mobile}
          onAction={handleAction}
          onUploadFile={handleUploadFile}
          onNavigatePortal={handleNavigatePortal}
          onLogout={handleLogout}
          initialSubRoute={subRoute}
          initialRole={currentUser?.role === 'coadmin' ? 'co' : adminRole}
        />
      )}
    </div>
  );
}
