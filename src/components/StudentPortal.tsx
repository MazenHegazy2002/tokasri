'use client';

import React, { useState, useRef, useEffect } from 'react';

interface StudentPortalProps {
  state: any;
  currentUser: any;
  lang: 'en' | 'ar';
  setLang: (l: 'en' | 'ar') => void;
  mobile: boolean;
  onAction: (action: string, payload?: any) => Promise<any>;
  onUploadFile: (file: File) => Promise<{ url: string; fileName: string; sizeLabel: string } | null>;
  onNavigatePortal: (portal: 'public' | 'student' | 'admin', subRoute?: string, extra?: any) => void;
  onLogout?: () => void;
  initialSubRoute?: string;
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  activeLessonId: string;
  setActiveLessonId: (id: string) => void;
}

export default function StudentPortal({
  state,
  currentUser,
  lang,
  setLang,
  mobile,
  onAction,
  onUploadFile,
  onNavigatePortal,
  onLogout,
  initialSubRoute = 'dashboard',
  activeCourseId,
  setActiveCourseId,
  activeLessonId,
  setActiveLessonId,
}: StudentPortalProps) {
  const [route, setRoute] = useState<string>(initialSubRoute || 'dashboard');
  const [tab, setTab] = useState<'overview' | 'resources' | 'notes' | 'discussion'>('resources');

  // Video player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1325); // 22:05 default display
  const [speed, setSpeed] = useState<number>(1);
  const [captionsOn, setCaptionsOn] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [discInput, setDiscInput] = useState<string>('');

  // Quiz state
  const [qi, setQi] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizDone, setQuizDone] = useState<boolean>(false);
  const [timerSec, setTimerSec] = useState<number>(702); // 11:42

  // Research upload state
  const [resTitle, setResTitle] = useState<string>('');
  const [resType, setResType] = useState<string>('Original research');
  const [resSup, setResSup] = useState<string>('Dr. Toka Essam Samir');
  const [resCoAuthors, setResCoAuthors] = useState<string>('');
  const [resAbstract, setResAbstract] = useState<string>('');
  const [resFileName, setResFileName] = useState<string>('');
  const [resFileUrl, setResFileUrl] = useState<string>('');
  const [resFileSize, setResFileSize] = useState<string>('');
  const [uploadingRes, setUploadingRes] = useState<boolean>(false);
  const [resSubmittedMsg, setResSubmittedMsg] = useState<string>('');

  // Certificate modal preview
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  // Universal PDF & File Preview modal + inline preview state
  const [previewFile, setPreviewFile] = useState<{
    title: string;
    url: string;
    ext?: string;
    meta?: string;
    canDownload?: boolean;
  } | null>(null);
  const [inlineResourceIdx, setInlineResourceIdx] = useState<number | null>(0);
  const [inlineSubPreviewId, setInlineSubPreviewId] = useState<string | null>(null);

  const fileAccess = {
    allowLessonPdfDownload: true,
    allowResourceDownload: true,
    allowResearchDownload: true,
    allowPublicPreviewDownload: true,
    ...(state.fileAccess || state.settings?.file_access_settings || {}),
  };

  const withPdfToolbarRule = (url: string, canDownload: boolean) => {
    if (!url) return url;
    if (canDownload) return url;
    return url.includes('#') ? `${url}&toolbar=0&navpanes=0` : `${url}#toolbar=0&navpanes=0`;
  };

  useEffect(() => {
    if (initialSubRoute) setRoute(initialSubRoute);
  }, [initialSubRoute]);

  useEffect(() => {
    if (route !== 'quiz' || quizDone) return;
    const iv = setInterval(() => {
      setTimerSec(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [route, quizDone]);

  const isRtl = lang === 'ar';
  const user = currentUser || (state.users || []).find((u: any) => u.id === 'u-mariam') || {
    id: 'u-mariam',
    name: 'Mariam Hassan',
    faculty: 'Medicine',
    year_level: 2,
    avatar_initials: 'MH',
    plan: 'Membership',
    membership_renews: 'Nov 14',
  };

  const courses = state.courses || [];
  const currentCourse = courses.find((c: any) => c.id === activeCourseId) || courses[0];
  const allCourseLessons = (currentCourse?.modules || []).flatMap((m: any) => m.items || []);
  const currentLesson =
    allCourseLessons.find((l: any) => l.id === activeLessonId) ||
    allCourseLessons.find((l: any) => l.id === 'l5') ||
    allCourseLessons[0];

  // Quiz questions for active quiz lesson (or l8 default)
  const allQuizzes = courses.flatMap((c: any) =>
    (c.modules || []).flatMap((m: any) =>
      (m.items || []).filter((i: any) => i.type === 'quiz').map((i: any) => ({ ...i, courseTitle: c.title, moduleTitle: m.t }))
    )
  );
  const currentQuizLesson =
    (currentLesson?.type === 'quiz' ? currentLesson : null) ||
    allQuizzes.find((q: any) => q.id === 'l8') ||
    allQuizzes[0];

  const Q =
    currentQuizLesson?.questions?.length > 0
      ? currentQuizLesson.questions
      : [
          {
            text: 'A researcher follows 500 smokers and 500 non-smokers for 10 years to compare lung cancer rates. Which study design is this?',
            opts: ['Case-control study', 'Prospective cohort study', 'Cross-sectional study', 'Randomized controlled trial'],
            a: 1,
          },
        ];

  const safeQi = Math.min(qi, Math.max(0, Q.length - 1));
  const curQ = Q[safeQi];
  const correctCount = Q.filter((x: any, i: number) => answers[i] === x.a).length;
  const scorePct = Q.length ? Math.round((correctCount / Q.length) * 100) : 0;
  const passedQuiz = scorePct >= (currentQuizLesson?.passMark || 70);

  // User enrollments & progress
  const userEnrollments = (state.enrollments || []).filter((e: any) => e.user_id === user.id);
  const currentEnrollment = userEnrollments.find((e: any) => e.course_id === currentCourse?.id);
  const completedIds: string[] = currentEnrollment?.completedLessons || ['l1', 'l2', 'l3', 'l4'];

  const myCourses = courses
    .filter((c: any) => userEnrollments.some((e: any) => e.course_id === c.id) || user.plan === 'Membership')
    .slice(0, 6)
    .map((c: any) => {
      const en = userEnrollments.find((e: any) => e.course_id === c.id);
      return {
        ...c,
        p: `${en ? en.progress_pct : 0}%`,
      };
    });

  // Notes & Discussions for current lesson
  const lessonNotes = (state.lessonNotes || []).filter((n: any) => n.lesson_id === currentLesson?.id);
  const lessonDiscussions = (state.lessonDiscussions || []).filter((d: any) => d.lesson_id === currentLesson?.id);

  // Research submissions
  const mySubmissions = (state.researchSubmissions || []).filter(
    (s: any) => s.userId === user.id || s.a === user.name
  );
  const allOrMySubmissions = mySubmissions.length > 0 ? mySubmissions : state.researchSubmissions || [];

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) {
      setPlaying(!playing);
      return;
    }
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (videoRef.current) {
      videoRef.current.playbackRate = next;
    }
  };

  const handleMarkCompleteAndNext = async () => {
    if (currentCourse && currentLesson) {
      await onAction('toggle_lesson_complete', {
        userId: user.id,
        courseId: currentCourse.id,
        lessonId: currentLesson.id,
      });
      const idx = allCourseLessons.findIndex((l: any) => l.id === currentLesson.id);
      if (idx >= 0 && idx < allCourseLessons.length - 1) {
        const nextLes = allCourseLessons[idx + 1];
        setActiveLessonId(nextLes.id);
        if (nextLes.type === 'quiz') {
          setQi(0);
          setAnswers({});
          setQuizDone(false);
          setRoute('quiz');
        }
      }
    }
  };

  const handlePrevLesson = () => {
    const idx = allCourseLessons.findIndex((l: any) => l.id === currentLesson?.id);
    if (idx > 0) {
      setActiveLessonId(allCourseLessons[idx - 1].id);
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !currentLesson) return;
    const sec = Math.floor(currentTime || 554);
    await onAction('add_lesson_note', {
      userId: user.id,
      lessonId: currentLesson.id,
      timestampSec: sec,
      timestampLabel: formatTime(sec),
      content: noteInput.trim(),
    });
    setNoteInput('');
  };

  const handleAddDiscussion = async () => {
    if (!discInput.trim() || !currentLesson) return;
    await onAction('add_lesson_discussion', {
      lessonId: currentLesson.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role || 'student',
      content: discInput.trim(),
    });
    setDiscInput('');
  };

  const handleQuizNextOrSubmit = async () => {
    if (safeQi < Q.length - 1) {
      setQi(safeQi + 1);
    } else {
      setQuizDone(true);
      await onAction('submit_quiz_attempt', {
        userId: user.id,
        userName: user.name,
        lessonId: currentQuizLesson?.id || 'l8',
        courseId: currentQuizLesson?.courseId || currentCourse?.id || 'course-1',
        scorePct,
        passed: passedQuiz,
        answers,
      });
    }
  };

  const handleResearchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRes(true);
    const up = await onUploadFile(file);
    setUploadingRes(false);
    if (up) {
      setResFileName(up.fileName);
      setResFileUrl(up.url);
      setResFileSize(up.sizeLabel);
    }
  };

  const handleSubmitResearch = async () => {
    if (!resTitle.trim()) return;
    await onAction('submit_research', {
      userId: user.id,
      authorName: user.name,
      title: resTitle.trim(),
      type: resType,
      supervisor: resSup || 'Dr. Toka Essam Samir',
      coAuthors: resCoAuthors,
      abstractText: resAbstract || 'Student research manuscript submitted via SRI EPNU platform.',
      fileName: resFileName || 'manuscript_v1.pdf',
      fileUrl: resFileUrl || '/files/protocol-template.pdf',
      fileSize: resFileSize || '1.8 MB',
    });
    setResTitle('');
    setResCoAuthors('');
    setResAbstract('');
    setResFileName('');
    setResSubmittedMsg('Submitted! Your manuscript is now in the Co-Admin first-review queue.');
    setTimeout(() => setResSubmittedMsg(''), 5000);
  };

  const navD = [
    ['dashboard', 'space_dashboard', isRtl ? 'الرئيسية' : 'Dashboard', isRtl ? 'الرئيسية' : 'Home'],
    ['player', 'play_lesson', isRtl ? 'دوراتي' : 'My courses', isRtl ? 'تعلّم' : 'Learn'],
    ['quiz', 'quiz', isRtl ? 'الاختبارات' : 'Quizzes', isRtl ? 'اختبارات' : 'Quizzes'],
    ['research', 'science', isRtl ? 'أبحاثي' : 'Research', isRtl ? 'الأبحاث' : 'Research'],
    ['certs', 'workspace_premium', isRtl ? 'الإرشاد والشهادات' : 'Live & Certs', isRtl ? 'الشهادات' : 'Certs'],
    ['billing', 'receipt_long', isRtl ? 'الاشتراك' : 'Billing', isRtl ? 'الدفع' : 'Billing'],
  ] as const;

  const STAGE_STYLE: Record<string, { label: string; sc: string; sb: string }> = {
    co: { label: 'Co-admin review', sc: '#1446A0', sb: '#E3ECFB' },
    ad: { label: 'Admin review', sc: '#B07A08', sb: '#FCF1D6' },
    ok: { label: 'Approved', sc: '#1E8A5A', sb: '#E3F3EA' },
    ch: { label: 'Changes requested', sc: '#C2412D', sb: '#FBE7E3' },
  };

  const lessonResources =
    currentLesson?.resources?.length > 0
      ? currentLesson.resources
      : [
          { ext: 'PDF', t: 'Study design decision chart', s: '2 pages · 340 KB', url: '/files/study-design-chart.pdf' },
          { ext: 'PDF', t: 'Lecture slides: Observational designs', s: '28 pages · 4.1 MB', url: '/files/observational-slides.pdf' },
          { ext: 'DOC', t: 'Example study worksheet', s: 'DOCX · 96 KB', url: '/files/pico-worksheet.pdf' },
        ];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F6F3EC',
        fontFamily: isRtl ? "'Cairo', 'Montserrat', sans-serif" : "'Montserrat', sans-serif",
        color: '#0E1736',
        fontSize: 15,
        lineHeight: 1.5,
      }}
    >
      {/* DESKTOP SIDEBAR */}
      {!mobile && (
        <aside
          className="no-print"
          style={{
            width: 248,
            flex: 'none',
            background: '#071A44',
            color: '#fff',
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 14px',
          }}
        >
          <a
            href="#public"
            onClick={e => {
              e.preventDefault();
              onNavigatePortal('public', 'landing');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#fff',
              padding: '0 8px 24px',
              textDecoration: 'none',
            }}
          >
            <img src="/assets/sri-logo.png" alt="SRI" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>SRI</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: '#4BB4EC',
                }}
              >
                {isRtl ? 'بوابة الطالب' : 'Student'}
              </span>
            </span>
          </a>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navD.map(([k, icon, label]) => {
              const active = route === k;
              return (
                <a
                  key={k}
                  href={`#${k}`}
                  onClick={e => {
                    e.preventDefault();
                    if (k === 'billing') {
                      onNavigatePortal('public', 'checkout');
                    } else {
                      setRoute(k);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 12px',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    color: active ? '#fff' : 'rgba(255,255,255,.7)',
                    background: active ? 'rgba(75,180,236,.16)' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 21 }}>
                    {icon}
                  </span>
                  {label}
                </a>
              );
            })}
          </nav>

          <div
            style={{
              marginTop: 'auto',
              background: 'rgba(255,255,255,.06)',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F2B22E', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {user.plan || 'Membership'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>
              Active · renews {user.membership_renews || 'Nov 14'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={() => onNavigatePortal('public', 'landing')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.2)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Public Site
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    flex: 1,
                    background: 'rgba(194,65,45,.22)',
                    border: '1px solid rgba(194,65,45,.45)',
                    color: '#FF9B8A',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 8px 0' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#4BB4EC',
                color: '#071A44',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {user.avatar_initials || 'MH'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>
                {user.faculty} · Year {user.year_level}
              </span>
            </div>
          </div>
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0, paddingBottom: mobile ? 84 : 0 }}>
        {/* MOBILE TOP BAR */}
        {mobile && (
          <div
            className="no-print"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: '#071A44',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
            }}
          >
            <img
              src="/assets/sri-logo.png"
              alt="SRI"
              onClick={() => onNavigatePortal('public', 'landing')}
              style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 800 }}>SRI Student</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                style={{
                  background: 'rgba(255,255,255,.12)',
                  border: 0,
                  color: '#fff',
                  borderRadius: 999,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {lang === 'en' ? 'عربي' : 'EN'}
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    background: 'rgba(194,65,45,.25)',
                    border: '1px solid rgba(194,65,45,.5)',
                    color: '#FF9B8A',
                    borderRadius: 999,
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Sign out
                </button>
              )}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#4BB4EC',
                  color: '#071A44',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {user.avatar_initials || 'MH'}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2A: STUDENT DASHBOARD */}
        {route === 'dashboard' && (
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: 'clamp(20px,4vw,40px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: '#5A6280' }}>Tuesday, 27 October 2026</div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(30px,4vw,44px)',
                    margin: '4px 0 0',
                    lineHeight: 1.1,
                  }}
                >
                  {isRtl ? `مساء الخير، ${user.name}` : `Good afternoon, ${user.name.split(' ')[0]}`}
                </h1>
              </div>
              {!mobile && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'en' ? 'العربية (RTL)' : 'English'}
                  </button>
                  <button
                    onClick={() => onNavigatePortal('public', 'landing')}
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Public Catalog
                  </button>
                </div>
              )}
            </div>

            {/* CONTINUE LEARNING BANNER */}
            <a
              href="#player"
              onClick={e => {
                e.preventDefault();
                setActiveCourseId('course-1');
                setActiveLessonId('l5');
                setRoute('player');
              }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                background: '#071A44',
                borderRadius: 20,
                overflow: 'hidden',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  flex: '1 1 280px',
                  minHeight: 180,
                  background:
                    'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px)',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: '#F2B22E',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 32, color: '#071A44' }}>
                    play_arrow
                  </span>
                </span>
                <span
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: 'rgba(255,255,255,.5)',
                  }}
                >
                  lesson thumbnail
                </span>
              </div>
              <div
                style={{
                  flex: '1 1 340px',
                  padding: 26,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: '#4BB4EC',
                  }}
                >
                  {isRtl ? 'أكمل التعلم' : 'Continue learning'}
                </div>
                <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.25 }}>
                  Study designs: Observational vs experimental
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                  Research Methodology Foundations · Module 2 · 14 min left
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 99,
                      background: 'rgba(255,255,255,.15)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${currentEnrollment?.progress_pct || 42}%`,
                        height: '100%',
                        background: '#F2B22E',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{currentEnrollment?.progress_pct || 42}%</span>
                </div>
              </div>
            </a>

            {/* DUE THIS WEEK & MY RESEARCH SUMMARY */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
                gap: 20,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 18,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{isRtl ? 'مهام هذا الأسبوع' : 'Due this week'}</span>
                </div>
                {[
                  {
                    icon: 'quiz',
                    t: 'Module 2 quiz',
                    s: 'Research Methodology · 5 questions',
                    when: 'Thu',
                    c: '#C2412D',
                    target: 'quiz',
                  },
                  {
                    icon: 'videocam',
                    t: 'Live session: Literature search',
                    s: 'With Dr. Salma Reda · Zoom',
                    when: 'Sat 7pm',
                    c: '#0A2160',
                    target: 'certs',
                  },
                  {
                    icon: 'description',
                    t: 'Revise manuscript intro',
                    s: 'Requested by co-admin',
                    when: 'Sun',
                    c: '#B07A08',
                    target: 'research',
                  },
                ].map((d, idx) => (
                  <a
                    key={idx}
                    href={`#${d.target}`}
                    onClick={e => {
                      e.preventDefault();
                      setRoute(d.target);
                    }}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      color: '#0E1736',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      className="material-icon"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: '#EFE6CF',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 21,
                        color: '#0A2160',
                      }}
                    >
                      {d.icon}
                    </span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{d.t}</span>
                      <span style={{ fontSize: 12, color: '#5A6280' }}>{d.s}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.c }}>{d.when}</span>
                  </a>
                ))}
              </div>

              <a
                href="#research"
                onClick={e => {
                  e.preventDefault();
                  setRoute('research');
                }}
                style={{
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 18,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  color: '#0E1736',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{isRtl ? 'أبحاثي العلمية' : 'My research'}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#B07A08',
                      background: '#FCF1D6',
                      padding: '4px 10px',
                      borderRadius: 999,
                    }}
                  >
                    {STAGE_STYLE[allOrMySubmissions[0]?.st || 'ad']?.label || 'In review'}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>
                  {allOrMySubmissions[0]?.t || 'Antibiotic resistance awareness among first-year medical students'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {[
                    { t: 'Submitted', c: '#1E8A5A' },
                    { t: 'Co-admin', c: allOrMySubmissions[0]?.st === 'co' ? '#F2B22E' : '#1E8A5A' },
                    {
                      t: 'Admin',
                      c:
                        allOrMySubmissions[0]?.st === 'ok'
                          ? '#1E8A5A'
                          : allOrMySubmissions[0]?.st === 'ad'
                          ? '#F2B22E'
                          : '#EEEAE0',
                    },
                    { t: 'Approved', c: allOrMySubmissions[0]?.st === 'ok' ? '#1E8A5A' : '#EEEAE0' },
                  ].map((sd, idx) => (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 6, borderRadius: 99, background: sd.c, marginRight: 4 }} />
                      <span style={{ fontSize: 11, color: '#5A6280', fontWeight: 600 }}>{sd.t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: '#3A4260', background: '#F6F3EC', borderRadius: 10, padding: 12 }}>
                  {allOrMySubmissions[0]?.notes?.[0]?.text ||
                    'Co-admin forwarded to admin with comments. Waiting for final approval.'}
                </div>
              </a>
            </div>

            {/* MY COURSES GRID */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 14 }}>
                {isRtl ? 'دوراتي التدريبية' : 'My courses'}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))',
                  gap: 16,
                }}
              >
                {myCourses.map((c: any) => (
                  <a
                    key={c.id}
                    href="#player"
                    onClick={e => {
                      e.preventDefault();
                      setActiveCourseId(c.id);
                      const firstLes = c.modules?.[0]?.items?.[0]?.id || '';
                      if (firstLes) setActiveLessonId(firstLes);
                      setRoute('player');
                    }}
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 16,
                      overflow: 'hidden',
                      color: '#0E1736',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '16/8',
                        background: 'repeating-linear-gradient(135deg,#E9EEF7 0 10px,#DDE5F2 10px 20px)',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {c.coverImage ? (
                        <img
                          src={c.coverImage}
                          alt={c.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5A6B90' }}>
                          course cover
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                        {isRtl ? c.titleAr : c.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 5,
                            borderRadius: 99,
                            background: '#EEEAE0',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ width: c.p, height: '100%', background: '#1446A0' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6280' }}>{c.p}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2B: COURSE PLAYER (VIDEO & PDFS) */}
        {route === 'player' && currentCourse && (
          <div
            style={{
              maxWidth: 1360,
              margin: '0 auto',
              padding: 'clamp(12px,3vw,32px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: '1 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                style={{
                  fontSize: 13,
                  color: '#5A6280',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <a
                    href="#dashboard"
                    onClick={e => {
                      e.preventDefault();
                      setRoute('dashboard');
                    }}
                  >
                    {isRtl ? 'دوراتي' : 'My courses'}
                  </a>
                  <span>/</span>
                  <span style={{ fontWeight: 600, color: '#0E1736' }}>
                    {isRtl ? currentCourse.titleAr : currentCourse.title}
                  </span>
                </div>
                <select
                  value={currentCourse.id}
                  onChange={e => {
                    const cid = e.target.value;
                    setActiveCourseId(cid);
                    const c = courses.find((x: any) => x.id === cid);
                    const fl = c?.modules?.[0]?.items?.[0]?.id;
                    if (fl) setActiveLessonId(fl);
                  }}
                  style={{
                    border: '1px solid #D8D3C6',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#fff',
                  }}
                >
                  {courses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* VIDEO OR PDF STAGE */}
              {currentLesson?.type === 'pdf' ? (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 16,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      background: '#071A44',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: '#FBE7E3',
                          color: '#C2412D',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 11,
                        }}
                      >
                        PDF
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{currentLesson.t}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
                          {currentLesson.d} · Official SRI Course Document
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() =>
                          setPreviewFile({
                            title: currentLesson.t,
                            url: currentLesson.fileUrl || '/files/pico-worksheet.pdf',
                            ext: 'PDF',
                            meta: `${currentLesson.d || 'PDF Document'} · Official SRI Course Document`,
                            canDownload: fileAccess.allowLessonPdfDownload,
                          })
                        }
                        style={{
                          background: 'rgba(255,255,255,.14)',
                          border: '1px solid rgba(255,255,255,.28)',
                          color: '#fff',
                          padding: '8px 14px',
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 17 }}>
                          open_in_full
                        </span>
                        {isRtl ? 'معاينة ملء الشاشة' : 'Full Screen Preview'}
                      </button>
                      {fileAccess.allowLessonPdfDownload ? (
                        <a
                          href={currentLesson.fileUrl || '/files/pico-worksheet.pdf'}
                          download
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: '#F2B22E',
                            color: '#071A44',
                            padding: '8px 16px',
                            borderRadius: 999,
                            fontWeight: 800,
                            fontSize: 12,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 18 }}>
                            download
                          </span>
                          {isRtl ? 'تحميل PDF' : 'Download PDF'}
                        </a>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(255,255,255,.14)',
                            color: '#F2B22E',
                            padding: '8px 14px',
                            borderRadius: 999,
                            fontWeight: 800,
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            visibility
                          </span>
                          {isRtl ? 'عرض فقط (التحميل غير متاح)' : 'View Only'}
                        </span>
                      )}
                    </div>
                  </div>
                  <iframe
                    src={withPdfToolbarRule(
                      currentLesson.fileUrl || '/files/pico-worksheet.pdf',
                      fileAccess.allowLessonPdfDownload
                    )}
                    title={currentLesson.t}
                    style={{ width: '100%', height: 480, border: 0, background: '#F3F1EB' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    aspectRatio: '16/9',
                    background: '#050F2A',
                    borderRadius: 16,
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundImage:
                      'repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 12px,transparent 12px 24px)',
                  }}
                >
                  <video
                    ref={videoRef}
                    src={currentLesson?.videoUrl || '/files/sample-lecture.mp4'}
                    onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={e => {
                      if (e.currentTarget.duration) setDuration(e.currentTarget.duration);
                    }}
                    onEnded={() => setPlaying(false)}
                    onClick={togglePlay}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      position: 'absolute',
                      inset: 0,
                      opacity: playing ? 1 : 0.45,
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: 'rgba(255,255,255,.65)',
                      position: 'absolute',
                      top: 14,
                      left: 16,
                      zIndex: 2,
                    }}
                  >
                    {currentLesson?.t || 'lesson video'}
                  </span>

                  {!playing && (
                    <button
                      onClick={togglePlay}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        border: 0,
                        background: '#F2B22E',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        zIndex: 2,
                        boxShadow: '0 12px 30px rgba(0,0,0,.4)',
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 40, color: '#071A44' }}>
                        play_arrow
                      </span>
                    </button>
                  )}

                  {captionsOn && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 58,
                        background: 'rgba(0,0,0,.78)',
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 13,
                        zIndex: 2,
                      }}
                    >
                      [CC] Comparing cohort, case-control, and randomized controlled trial designs in clinical research…
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      color: '#fff',
                      background: 'linear-gradient(transparent,rgba(0,0,0,.75))',
                      zIndex: 2,
                    }}
                  >
                    <button
                      onClick={togglePlay}
                      style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 0 }}
                    >
                      <span className="material-icon" style={{ fontSize: 22 }}>
                        {playing ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                      {playing ? formatTime(currentTime) : '09:14'} / {currentLesson?.d || '22:05'}
                    </span>
                    <div
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        if (videoRef.current && videoRef.current.duration) {
                          videoRef.current.currentTime = ratio * videoRef.current.duration;
                        }
                      }}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 99,
                        background: 'rgba(255,255,255,.25)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: playing && duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '42%',
                          height: '100%',
                          background: '#F2B22E',
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <button
                      onClick={cycleSpeed}
                      style={{
                        background: 'rgba(255,255,255,.15)',
                        border: 0,
                        color: '#fff',
                        borderRadius: 6,
                        padding: '3px 7px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {speed}×
                    </button>
                    <button
                      onClick={() => setCaptionsOn(!captionsOn)}
                      style={{
                        background: 'none',
                        border: 0,
                        color: captionsOn ? '#F2B22E' : '#fff',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 22 }}>
                        closed_caption
                      </span>
                    </button>
                    <button
                      onClick={() => videoRef.current?.requestFullscreen?.()}
                      style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 0 }}
                    >
                      <span className="material-icon" style={{ fontSize: 22 }}>
                        fullscreen
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* LESSON HEADER & PREV / COMPLETE BUTTONS */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: '#1446A0',
                    }}
                  >
                    {currentLesson?.type === 'pdf' ? 'PDF Document' : 'Video Lesson'} · {currentLesson?.d}
                  </div>
                  <h1 style={{ fontSize: 'clamp(20px,2.4vw,26px)', margin: '4px 0 0', lineHeight: 1.25 }}>
                    {isRtl ? currentLesson?.tAr || currentLesson?.t : currentLesson?.t}
                  </h1>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() =>
                      setPreviewFile({
                        title:
                          currentLesson?.type === 'pdf'
                            ? currentLesson.t
                            : `${currentLesson?.t || 'Lesson'} — Slides & Reference PDF`,
                        url:
                          currentLesson?.type === 'pdf'
                            ? currentLesson.fileUrl || '/files/pico-worksheet.pdf'
                            : currentLesson?.slidesUrl || '/files/observational-slides.pdf',
                        ext: 'PDF',
                        meta: currentLesson?.d || 'Official SRI Course Material',
                        canDownload: fileAccess.allowLessonPdfDownload,
                      })
                    }
                    style={{
                      border: '1.5px solid #1446A0',
                      background: '#F4F7FD',
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#1446A0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 18 }}>
                      visibility
                    </span>
                    {currentLesson?.type === 'pdf'
                      ? isRtl
                        ? 'معاينة PDF'
                        : 'Preview PDF'
                      : isRtl
                      ? 'معاينة شرائح الدرس PDF'
                      : 'Preview Slides PDF'}
                  </button>
                  <button
                    onClick={handlePrevLesson}
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      color: '#0E1736',
                    }}
                  >
                    {isRtl ? 'السابق' : 'Previous'}
                  </button>
                  <button
                    onClick={handleMarkCompleteAndNext}
                    style={{
                      border: 0,
                      background: '#071A44',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {completedIds.includes(currentLesson?.id)
                      ? isRtl
                        ? 'تم الإكمال ✓ التالي'
                        : 'Completed ✓ Next'
                      : isRtl
                      ? 'تحديد كمكتمل والتالي'
                      : 'Mark complete & next'}
                  </button>
                </div>
              </div>

              {/* TABS: OVERVIEW, RESOURCES, NOTES, DISCUSSION */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4DFD3', overflowX: 'auto' }}>
                {(
                  [
                    ['overview', isRtl ? 'نظرة عامة' : 'Overview'],
                    ['resources', `${isRtl ? 'المرفقات والملفات' : 'Resources & Files'} · ${lessonResources.length}`],
                    ['notes', `${isRtl ? 'ملاحظاتي' : 'Notes'} · ${lessonNotes.length}`],
                    ['discussion', `${isRtl ? 'النقاش والأسئلة' : 'Q&A'} · ${lessonDiscussions.length}`],
                  ] as const
                ).map(([k, label]) => {
                  const active = tab === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTab(k)}
                      style={{
                        background: 'none',
                        border: 0,
                        borderBottom: `2.5px solid ${active ? '#1446A0' : 'transparent'}`,
                        padding: '12px 14px',
                        fontWeight: 700,
                        fontSize: 14,
                        color: active ? '#0E1736' : '#5A6280',
                        cursor: 'pointer',
                        marginBottom: -1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {tab === 'overview' && (
                <div style={{ color: '#3A4260', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
                    {currentLesson?.overview ||
                      'This lesson compares cohort, case-control and cross-sectional studies with randomized controlled trials, and walks through when each one fits your research question.\n\nBefore the module quiz, download the design decision chart in Resources and try classifying the three example studies.'}
                  </p>
                </div>
              )}

              {tab === 'resources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lessonResources.map((f: any, idx: number) => {
                    const isPdf = (f.ext || 'PDF').toUpperCase() === 'PDF';
                    const fileUrl = f.url || '/files/study-design-chart.pdf';
                    const isInlineOpen = inlineResourceIdx === idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#fff',
                          border: `1.5px solid ${isInlineOpen ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 14,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div
                          style={{
                            padding: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              background: isPdf ? '#FBE7E3' : '#E3ECFB',
                              color: isPdf ? '#C2412D' : '#1446A0',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 11,
                              fontWeight: 800,
                              flex: 'none',
                            }}
                          >
                            {f.ext || 'PDF'}
                          </span>
                          <span style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{f.t}</span>
                            <span style={{ fontSize: 12, color: '#5A6280' }}>{f.s}</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setInlineResourceIdx(isInlineOpen ? null : idx)}
                              style={{
                                border: '1.5px solid #D3CDBF',
                                background: isInlineOpen ? '#071A44' : '#fff',
                                color: isInlineOpen ? '#fff' : '#0E1736',
                                borderRadius: 10,
                                padding: '8px 12px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <span className="material-icon" style={{ fontSize: 17 }}>
                                {isInlineOpen ? 'expand_less' : 'visibility'}
                              </span>
                              {isInlineOpen
                                ? isRtl
                                  ? 'إخفاء المعاينة'
                                  : 'Hide Preview'
                                : isRtl
                                ? 'معاينة مضمنة'
                                : 'Inline Preview'}
                            </button>
                            <button
                              onClick={() =>
                                setPreviewFile({
                                  title: f.t,
                                  url: fileUrl,
                                  ext: f.ext || 'PDF',
                                  meta: f.s,
                                  canDownload: fileAccess.allowResourceDownload,
                                })
                              }
                              style={{
                                border: 0,
                                background: '#1446A0',
                                color: '#fff',
                                borderRadius: 10,
                                padding: '8px 12px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <span className="material-icon" style={{ fontSize: 17 }}>
                                open_in_full
                              </span>
                              {isRtl ? 'ملء الشاشة' : 'Full Preview'}
                            </button>
                            {fileAccess.allowResourceDownload ? (
                              <a
                                href={fileUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  border: 0,
                                  background: '#EFE6CF',
                                  borderRadius: 10,
                                  width: 38,
                                  height: 38,
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                }}
                                title="Download file"
                              >
                                <span className="material-icon" style={{ fontSize: 20, color: '#0A2160' }}>
                                  download
                                </span>
                              </a>
                            ) : (
                              <span
                                style={{
                                  background: '#F6F3EC',
                                  border: '1px solid #E4DFD3',
                                  color: '#5A6280',
                                  borderRadius: 10,
                                  padding: '8px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 15 }}>
                                  visibility
                                </span>
                                {isRtl ? 'عرض فقط' : 'View Only'}
                              </span>
                            )}
                          </div>
                        </div>
                        {isInlineOpen && (
                          <div style={{ borderTop: '1px solid #E4DFD3', background: '#F6F3EC', padding: 12 }}>
                            <iframe
                              src={withPdfToolbarRule(fileUrl, fileAccess.allowResourceDownload)}
                              title={f.t}
                              style={{
                                width: '100%',
                                height: 380,
                                border: '1px solid #E4DFD3',
                                borderRadius: 10,
                                background: '#fff',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      placeholder="Notes are saved with a timestamp from the video…"
                      style={{
                        flex: 1,
                        minHeight: 80,
                        border: '1px solid #D8D3C6',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 14,
                        background: '#fff',
                        resize: 'vertical',
                      }}
                    />
                    <button
                      onClick={handleAddNote}
                      style={{
                        alignSelf: 'flex-end',
                        background: '#071A44',
                        color: '#fff',
                        border: 0,
                        borderRadius: 10,
                        padding: '12px 18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Save Note ({playing ? formatTime(currentTime) : '09:14'})
                    </button>
                  </div>
                  {lessonNotes.map((n: any) => (
                    <div
                      key={n.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 12,
                        padding: 14,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          background: '#E3ECFB',
                          color: '#1446A0',
                          padding: '4px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {n.timestamp_label}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, color: '#0E1736' }}>{n.content}</span>
                      <button
                        onClick={() => onAction('delete_lesson_note', { id: n.id })}
                        style={{ background: 'none', border: 0, color: '#C2412D', cursor: 'pointer' }}
                      >
                        <span className="material-icon" style={{ fontSize: 18 }}>
                          delete
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'discussion' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={discInput}
                      onChange={e => setDiscInput(e.target.value)}
                      placeholder="Ask a question about this lesson or study design…"
                      style={{
                        flex: 1,
                        border: '1px solid #D8D3C6',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 14,
                        background: '#fff',
                      }}
                    />
                    <button
                      onClick={handleAddDiscussion}
                      style={{
                        background: '#F2B22E',
                        color: '#071A44',
                        border: 0,
                        borderRadius: 10,
                        padding: '0 18px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Post
                    </button>
                  </div>
                  {lessonDiscussions.map((d: any) => (
                    <div
                      key={d.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 12,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{d.user_name}</span>
                        {d.user_role === 'admin' && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              background: '#071A44',
                              color: '#F2B22E',
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            Instructor · SRI
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: '#8A90A6', marginLeft: 'auto' }}>{d.created_at}</span>
                      </div>
                      <div style={{ fontSize: 14, color: '#3A4260' }}>{d.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COURSE OUTLINE SIDEBAR */}
            <aside
              style={{
                flex: '1 1 320px',
                maxWidth: '100%',
                minWidth: 0,
                background: '#fff',
                border: '1px solid #E4DFD3',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #EEEAE0' }}>
                <div style={{ fontWeight: 700 }}>{isRtl ? 'محتوى الدورة' : 'Course content'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 99,
                      background: '#EEEAE0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((completedIds.length / Math.max(1, allCourseLessons.length)) * 100)
                        )}%`,
                        height: '100%',
                        background: '#1446A0',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                    {completedIds.length} / {allCourseLessons.length}
                  </span>
                </div>
              </div>

              {(currentCourse.modules || []).map((m: any, mIdx: number) => (
                <React.Fragment key={m.id}>
                  <div
                    style={{
                      padding: '14px 18px 6px',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: '#5A6280',
                    }}
                  >
                    {String(mIdx + 1).padStart(2, '0')} · {isRtl ? m.tAr || m.t : m.t}
                  </div>
                  {(m.items || []).map((l: any) => {
                    const isNow = l.id === currentLesson?.id;
                    const isDone = completedIds.includes(l.id);
                    const icon = isDone
                      ? 'check_circle'
                      : isNow
                      ? 'play_circle'
                      : l.type === 'quiz'
                      ? 'quiz'
                      : l.type === 'pdf'
                      ? 'description'
                      : 'radio_button_unchecked';
                    const ic = isDone ? '#1E8A5A' : isNow ? '#1446A0' : '#9AA0B5';
                    return (
                      <a
                        key={l.id}
                        href={l.type === 'quiz' ? '#quiz' : '#player'}
                        onClick={e => {
                          e.preventDefault();
                          setActiveLessonId(l.id);
                          if (l.type === 'quiz') {
                            setQi(0);
                            setAnswers({});
                            setQuizDone(false);
                            setRoute('quiz');
                          } else {
                            setRoute('player');
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 18px',
                          color: '#0E1736',
                          textDecoration: 'none',
                          background: isNow ? '#F1F5FD' : 'transparent',
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 20, color: ic }}>
                          {icon}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: isNow ? 700 : 500 }}>
                          {isRtl ? l.tAr || l.t : l.t}
                        </span>
                        <span style={{ fontSize: 12, color: '#8A90A6' }}>{l.d}</span>
                      </a>
                    );
                  })}
                </React.Fragment>
              ))}
            </aside>
          </div>
        )}

        {/* SCREEN 2C: QUIZ ENGINE */}
        {route === 'quiz' && (
          <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(20px,4vw,48px) clamp(16px,4vw,40px)' }}>
            {!quizDone ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#5A6280' }}>
                      {currentQuizLesson?.t || 'Module 2 quiz · Study designs'}
                    </span>
                    {allQuizzes.length > 1 && (
                      <select
                        value={currentQuizLesson?.id || ''}
                        onChange={e => {
                          setActiveLessonId(e.target.value);
                          setQi(0);
                          setAnswers({});
                          setQuizDone(false);
                        }}
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 12,
                          background: '#fff',
                        }}
                      >
                        {allQuizzes.map((qz: any) => (
                          <option key={qz.id} value={qz.id}>
                            {qz.t} ({qz.questions?.length || 0} Q)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#0A2160',
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      padding: '7px 12px',
                      borderRadius: 999,
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 18 }}>
                      timer
                    </span>
                    {formatTime(timerSec)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4, margin: '18px 0 28px' }}>
                  {Q.map((_: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 99,
                        background:
                          i === safeQi ? '#1446A0' : answers[i] !== undefined ? '#8DB0D6' : '#E4DFD3',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1446A0',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Question {safeQi + 1} of {Q.length}
                </div>
                <h1 style={{ fontSize: 'clamp(20px,2.6vw,26px)', lineHeight: 1.35, margin: '10px 0 24px' }}>
                  {curQ?.text}
                </h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(curQ?.opts || []).map((t: string, idx: number) => {
                    const on = answers[safeQi] === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswers(st => ({ ...st, [safeQi]: idx }))}
                        style={{
                          textAlign: isRtl ? 'right' : 'left',
                          background: on ? '#F1F5FD' : '#fff',
                          border: `2px solid ${on ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 14,
                          padding: '16px 18px',
                          display: 'flex',
                          gap: 14,
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: 15,
                          color: '#0E1736',
                          minHeight: 56,
                        }}
                      >
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            flex: 'none',
                            borderRadius: '50%',
                            border: `2px solid ${on ? '#1446A0' : '#E4DFD3'}`,
                            background: on ? '#1446A0' : '#fff',
                            color: on ? '#fff' : '#5A6280',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {'ABCD'[idx]}
                        </span>
                        <span>{t}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
                  <button
                    onClick={() => setQi(Math.max(0, safeQi - 1))}
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '12px 20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0E1736',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleQuizNextOrSubmit}
                    style={{
                      border: 0,
                      background: '#071A44',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '13px 24px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {safeQi < Q.length - 1 ? 'Next question' : 'Submit quiz'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    background: '#071A44',
                    color: '#fff',
                    borderRadius: 22,
                    padding: 'clamp(24px,5vw,44px)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 28,
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: -30,
                      bottom: -30,
                      width: 200,
                      height: 200,
                      backgroundImage: 'radial-gradient(#F2B22E 2px,transparent 2.4px)',
                      backgroundSize: '13px 13px',
                      opacity: 0.3,
                    }}
                  />
                  <div style={{ fontWeight: 900, fontSize: 'clamp(64px,10vw,96px)', lineHeight: 1, color: '#F2B22E' }}>
                    {scorePct}%
                  </div>
                  <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: '#4BB4EC',
                      }}
                    >
                      {passedQuiz ? 'Passed ✓ Certificate Unlocked' : 'Not passed yet'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 24 }}>
                      {correctCount} of {Q.length} correct
                    </div>
                    <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>
                      Pass mark is {currentQuizLesson?.passMark || 70}%. Your best score counts toward the SRI EPNU
                      certificate.
                    </div>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 18, margin: '32px 0 14px' }}>Review answers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Q.map((x: any, i: number) => {
                    const isOk = answers[i] === x.a;
                    return (
                      <div
                        key={i}
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 14,
                          padding: 16,
                          display: 'flex',
                          gap: 14,
                        }}
                      >
                        <span
                          className="material-icon"
                          style={{ fontSize: 24, color: isOk ? '#1E8A5A' : '#C2412D' }}
                        >
                          {isOk ? 'check_circle' : 'cancel'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{x.text}</div>
                          <div style={{ fontSize: 13, color: '#5A6280' }}>Correct answer: {x.opts?.[x.a]}</div>
                          {x.explanation && (
                            <div style={{ fontSize: 12, color: '#1446A0', marginTop: 2 }}>{x.explanation}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setQuizDone(false);
                      setQi(0);
                      setAnswers({});
                    }}
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '12px 20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0E1736',
                    }}
                  >
                    Retake quiz
                  </button>
                  <button
                    onClick={() => setRoute('player')}
                    style={{
                      border: 0,
                      background: '#F2B22E',
                      color: '#071A44',
                      borderRadius: 999,
                      padding: '13px 22px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Continue course
                  </button>
                  {passedQuiz && (
                    <button
                      onClick={() => setRoute('certs')}
                      style={{
                        border: 0,
                        background: '#071A44',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '13px 22px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      View My Certificate →
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SCREEN 2D: RESEARCH UPLOAD & STATUS */}
        {route === 'research' && (
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: 'clamp(20px,4vw,40px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(30px,4vw,44px)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {isRtl ? 'أبحاثي العلمية' : 'My research'}
              </h1>
              <p style={{ margin: '6px 0 0', color: '#5A6280' }}>
                {isRtl
                  ? 'يتم قراءة كل بحث بواسطة مساعد المشرف (Co-admin) أولاً، ثم اعتماده من الإدارة (Admin).'
                  : 'Every submission is read by a co-admin first, then approved by an admin.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
              <div
                style={{
                  flex: '1 1 440px',
                  minWidth: 0,
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 18,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 17 }}>
                  {isRtl ? 'تقديم ورقة بحثية جديدة' : 'New submission'}
                </div>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5A6280',
                  }}
                >
                  Title
                  <input
                    value={resTitle}
                    onChange={e => setResTitle(e.target.value)}
                    placeholder="Full manuscript title"
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15 }}
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                    gap: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#5A6280',
                    }}
                  >
                    Type
                    <select
                      value={resType}
                      onChange={e => setResType(e.target.value)}
                      style={{
                        border: '1px solid #D8D3C6',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 15,
                        background: '#fff',
                      }}
                    >
                      <option>Original research</option>
                      <option>Systematic review</option>
                      <option>Case report</option>
                      <option>Abstract / poster</option>
                    </select>
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#5A6280',
                    }}
                  >
                    Supervisor
                    <input
                      value={resSup}
                      onChange={e => setResSup(e.target.value)}
                      placeholder="Dr. …"
                      style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15 }}
                    />
                  </label>
                </div>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5A6280',
                  }}
                >
                  Co-authors
                  <input
                    value={resCoAuthors}
                    onChange={e => setResCoAuthors(e.target.value)}
                    placeholder="Names, separated by commas"
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15 }}
                  />
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5A6280',
                  }}
                >
                  Abstract
                  <textarea
                    rows={4}
                    value={resAbstract}
                    onChange={e => setResAbstract(e.target.value)}
                    placeholder="250 words max"
                    style={{
                      border: '1px solid #D8D3C6',
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 15,
                      resize: 'vertical',
                    }}
                  />
                </label>

                <label
                  style={{
                    border: '2px dashed #B9C6E2',
                    background: '#F4F7FD',
                    borderRadius: 14,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#0E1736',
                  }}
                >
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResearchFileUpload} style={{ display: 'none' }} />
                  <span className="material-icon" style={{ fontSize: 32, color: '#1446A0' }}>
                    upload_file
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {uploadingRes
                      ? 'Uploading manuscript...'
                      : resFileName
                      ? `${resFileName} · ${resFileSize}`
                      : 'Drop your manuscript or browse'}
                  </span>
                  <span style={{ fontSize: 12, color: '#5A6280' }}>PDF or DOCX, up to 25 MB</span>
                </label>

                {resFileName && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      background: '#F6F3EC',
                      border: '1px solid #E4DFD3',
                      borderRadius: 12,
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: '#FBE7E3',
                          color: '#C2412D',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: 10,
                        }}
                      >
                        PDF
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{resFileName}</div>
                        <div style={{ fontSize: 11, color: '#5A6280' }}>{resFileSize || 'Ready to submit'}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFile({
                          title: resFileName,
                          url: resFileUrl || '/files/protocol-template.pdf',
                          ext: 'PDF',
                          meta: `${resFileSize || '1.8 MB'} · Manuscript Draft`,
                        })
                      }
                      style={{
                        border: 0,
                        background: '#071A44',
                        color: '#fff',
                        borderRadius: 999,
                        padding: '7px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 16 }}>
                        visibility
                      </span>
                      Preview File
                    </button>
                  </div>
                )}

                {resSubmittedMsg && (
                  <div
                    style={{
                      background: '#E3F3EA',
                      color: '#1E8A5A',
                      padding: 12,
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {resSubmittedMsg}
                  </div>
                )}

                <button
                  onClick={handleSubmitResearch}
                  style={{
                    border: 0,
                    background: '#F2B22E',
                    color: '#071A44',
                    borderRadius: 12,
                    padding: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 15,
                  }}
                >
                  {isRtl ? 'إرسال للمراجعة والتحكيم' : 'Submit for review'}
                </button>
              </div>

              {/* SUBMISSIONS STATUS LIST */}
              <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {allOrMySubmissions.map((s: any) => {
                  const stInfo = STAGE_STYLE[s.st] || STAGE_STYLE.co;
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 18,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.35 }}>{s.t}</div>
                        <span
                          style={{
                            flex: 'none',
                            fontSize: 12,
                            fontWeight: 700,
                            color: stInfo.sc,
                            background: stInfo.sb,
                            padding: '4px 10px',
                            borderRadius: 999,
                          }}
                        >
                          {stInfo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#5A6280' }}>
                        {s.type} · submitted {s.when} · {s.sup}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {(s.timeline || []).map((e: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: e.c || '#1E8A5A',
                                  marginTop: 4,
                                  flex: 'none',
                                }}
                              />
                              <span style={{ width: 2, flex: 1, background: '#EEEAE0', minHeight: 14 }} />
                            </div>
                            <div
                              style={{
                                paddingBottom: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{e.t}</span>
                              <span style={{ fontSize: 13, color: '#5A6280' }}>{e.d}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingTop: 6,
                          borderTop: '1px solid #F0ECE2',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setInlineSubPreviewId(inlineSubPreviewId === s.id ? null : s.id)}
                            style={{
                              border: '1.5px solid #D3CDBF',
                              background: inlineSubPreviewId === s.id ? '#071A44' : '#fff',
                              color: inlineSubPreviewId === s.id ? '#fff' : '#0E1736',
                              borderRadius: 999,
                              padding: '7px 13px',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 16 }}>
                              {inlineSubPreviewId === s.id ? 'expand_less' : 'visibility'}
                            </span>
                            {inlineSubPreviewId === s.id ? 'Hide Inline PDF' : `Inline Preview (${s.file})`}
                          </button>
                          <button
                            onClick={() =>
                              setPreviewFile({
                                title: `${s.t} (${s.file})`,
                                url: s.fileUrl || '/files/protocol-template.pdf',
                                ext: 'PDF',
                                meta: `${s.type} · Supervisor: ${s.sup}`,
                                canDownload: fileAccess.allowResearchDownload,
                              })
                            }
                            style={{
                              border: 0,
                              background: '#1446A0',
                              color: '#fff',
                              borderRadius: 999,
                              padding: '7px 13px',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 16 }}>
                              open_in_full
                            </span>
                            Full Preview
                          </button>
                        </div>
                        {fileAccess.allowResearchDownload ? (
                          <a
                            href={s.fileUrl || '/files/protocol-template.pdf'}
                            download
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#1446A0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none',
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 16 }}>
                              download
                            </span>
                            Download ({s.file})
                          </a>
                        ) : (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#5A6280',
                              background: '#F6F3EC',
                              padding: '5px 10px',
                              borderRadius: 999,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 15 }}>
                              visibility
                            </span>
                            View Only ({s.file})
                          </span>
                        )}
                      </div>
                      {inlineSubPreviewId === s.id && (
                        <iframe
                          src={withPdfToolbarRule(
                            s.fileUrl || '/files/protocol-template.pdf',
                            fileAccess.allowResearchDownload
                          )}
                          title={s.t}
                          style={{
                            width: '100%',
                            height: 360,
                            border: '1px solid #E4DFD3',
                            borderRadius: 12,
                            background: '#F6F3EC',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2E: LIVE MENTORSHIP SESSIONS & CERTIFICATES */}
        {route === 'certs' && (
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              padding: 'clamp(20px,4vw,40px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 32,
            }}
          >
            {/* CERTIFICATES SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,4vw,42px)',
                    margin: 0,
                  }}
                >
                  {isRtl ? 'شهاداتي المعتمدة وجلسات الإرشاد' : 'Certificates & Live Mentorship'}
                </h1>
                <p style={{ margin: '6px 0 0', color: '#5A6280' }}>
                  Official EPNU Student Research Initiative certificates and live mentorship booking.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))',
                  gap: 18,
                }}
              >
                {(state.certificates || []).map((cert: any) => (
                  <div
                    key={cert.id}
                    style={{
                      background: '#fff',
                      border: '2px solid #F2B22E',
                      borderRadius: 18,
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src="/assets/sri-logo.png" alt="SRI" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#1446A0', letterSpacing: '.1em' }}>
                          {cert.certificate_code}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 17 }}>{cert.course_title}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#5A6280' }}>
                      Awarded to <b>{cert.user_name}</b> · Score: <b>{cert.score_pct}%</b> · Mentor: {cert.mentor}
                    </div>
                    <button
                      onClick={() => setSelectedCert(cert)}
                      style={{
                        alignSelf: 'flex-start',
                        background: '#071A44',
                        color: '#F2B22E',
                        border: 0,
                        borderRadius: 999,
                        padding: '10px 18px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Open &amp; Print Official Certificate
                    </button>
                  </div>
                ))}
              </div>

              {selectedCert && (
                <div
                  style={{
                    background: '#fff',
                    border: '6px double #071A44',
                    borderRadius: 20,
                    padding: 'clamp(28px,5vw,56px)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                    position: 'relative',
                    boxShadow: '0 24px 60px rgba(7,26,68,.15)',
                  }}
                >
                  <img src="/assets/sri-logo.png" alt="SRI" style={{ width: 84, height: 84, borderRadius: '50%' }} />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '.2em',
                      textTransform: 'uppercase',
                      color: '#1446A0',
                    }}
                  >
                    East Port Said National University · Student Research Initiative
                  </div>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 'clamp(30px,4vw,46px)',
                      margin: 0,
                      color: '#071A44',
                    }}
                  >
                    Certificate of Achievement
                  </h2>
                  <div style={{ fontSize: 15, color: '#5A6280' }}>This certifies that</div>
                  <div
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 'clamp(26px,3.6vw,38px)',
                      color: '#0A2160',
                      borderBottom: '2px solid #F2B22E',
                      paddingBottom: 6,
                    }}
                  >
                    {selectedCert.user_name}
                  </div>
                  <div style={{ maxWidth: 520, fontSize: 15, color: '#3A4260' }}>
                    has successfully completed the course <b>{selectedCert.course_title}</b> and passed the scientific
                    research assessment with a score of <b>{selectedCert.score_pct}%</b>.
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-around',
                      width: '100%',
                      maxWidth: 560,
                      marginTop: 20,
                      gap: 20,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#071A44' }}>{selectedCert.mentor}</div>
                      <div style={{ color: '#5A6280' }}>Course Director · SRI EPNU</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#071A44' }}>Dr. Toka Essam Samir</div>
                      <div style={{ color: '#5A6280' }}>Founder · Student Research Initiative</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#1446A0' }}>
                        {selectedCert.certificate_code}
                      </div>
                      <div style={{ color: '#5A6280' }}>Issued {selectedCert.issued_date}</div>
                    </div>
                  </div>
                  <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button
                      onClick={() => window.print()}
                      style={{
                        background: '#F2B22E',
                        color: '#071A44',
                        border: 0,
                        borderRadius: 999,
                        padding: '11px 22px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Print / Save as PDF
                    </button>
                    <button
                      onClick={() => setSelectedCert(null)}
                      style={{
                        background: '#EFE6CF',
                        color: '#071A44',
                        border: 0,
                        borderRadius: 999,
                        padding: '11px 18px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE SESSIONS BOOKING */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>
                {isRtl ? 'جلسات الإرشاد المباشرة القادمة' : 'Upcoming Live Mentorship Sessions'}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))',
                  gap: 16,
                }}
              >
                {(state.liveSessions || []).map((ls: any) => {
                  const isBooked = (ls.bookedUsers || []).includes(user.id);
                  return (
                    <div
                      key={ls.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 16,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: '#E3ECFB',
                            color: '#1446A0',
                            padding: '4px 10px',
                            borderRadius: 999,
                          }}
                        >
                          {ls.platform}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                          {ls.date_label} · {ls.time_label}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{isRtl ? ls.title_ar || ls.title : ls.title}</div>
                      <div style={{ fontSize: 13, color: '#5A6280' }}>
                        Mentor: {ls.mentor} · {(ls.bookedUsers || []).length} students registered
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                        <button
                          onClick={() =>
                            onAction('toggle_book_session', {
                              sessionId: ls.id,
                              userId: user.id,
                            })
                          }
                          style={{
                            flex: 1,
                            border: isBooked ? '1.5px solid #1E8A5A' : 0,
                            background: isBooked ? '#E3F3EA' : '#071A44',
                            color: isBooked ? '#1E8A5A' : '#fff',
                            borderRadius: 999,
                            padding: '10px 16px',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {isBooked ? 'Seat Reserved ✓ (Click to cancel)' : 'Reserve My Seat'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* UNIVERSAL PDF & FILE PREVIEW MODAL */}
        {previewFile && (
          <div
            onClick={() => setPreviewFile(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,26,68,.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(12px,3vw,32px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 1080,
                height: 'min(88vh, 860px)',
                background: '#fff',
                borderRadius: 20,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,.45)',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  background: '#071A44',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#FBE7E3',
                      color: '#C2412D',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 11,
                      flex: 'none',
                    }}
                  >
                    {previewFile.ext || 'PDF'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {previewFile.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                      {previewFile.meta || 'Official SRI Course & Research File Preview'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {previewFile.canDownload !== false ? (
                    <>
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(255,255,255,.14)',
                          border: '1px solid rgba(255,255,255,.25)',
                          color: '#fff',
                          padding: '8px 14px',
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 16 }}>
                          open_in_new
                        </span>
                        Open in New Tab
                      </a>
                      <a
                        href={previewFile.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#F2B22E',
                          color: '#071A44',
                          padding: '8px 14px',
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 17 }}>
                          download
                        </span>
                        Download
                      </a>
                    </>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(255,255,255,.14)',
                        border: '1px solid rgba(255,255,255,.25)',
                        color: '#F2B22E',
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 16 }}>
                        visibility
                      </span>
                      View Only (Download Disabled by Admin)
                    </span>
                  )}
                  <button
                    onClick={() => setPreviewFile(null)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(255,255,255,.18)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                    title="Close preview"
                  >
                    <span className="material-icon" style={{ fontSize: 20 }}>
                      close
                    </span>
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, background: '#F3F1EB', position: 'relative' }}>
                {/\.(mp4|webm|mov)$/i.test(previewFile.url) || previewFile.ext === 'VIDEO' ? (
                  <video
                    src={previewFile.url}
                    controls
                    controlsList={previewFile.canDownload === false ? 'nodownload' : undefined}
                    autoPlay
                    style={{ width: '100%', height: '100%', background: '#050F2A' }}
                  />
                ) : (
                  <iframe
                    src={withPdfToolbarRule(previewFile.url, previewFile.canDownload !== false)}
                    title={previewFile.title}
                    style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* OFFICIAL MERCHANT APPROVAL & POLICIES FOOTER */}
        <footer
          className="no-print"
          style={{
            marginTop: 'auto',
            borderTop: '1px solid #E4DFD3',
            background: '#EFE6CF',
            padding: '22px clamp(20px,4vw,40px)',
            fontSize: 12.5,
            color: '#3A4260',
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <strong style={{ color: '#071A44' }}>
                Student Research Initiative (SRI) · East Port Said National University (EPNU) — All Prices in Egyptian Pounds (EGP)
              </strong>
              <span>
                Email: <a href="mailto:contact@sri-epnu.edu.eg" style={{ color: '#1446A0', fontWeight: 700 }}>contact@sri-epnu.edu.eg</a> · Phone:{' '}
                <a href="tel:+201012345678" style={{ color: '#071A44', fontWeight: 700 }}>+20 101 234 5678</a> · Location: Building 14, Academic District, New Cairo, Cairo, Egypt
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontWeight: 700 }}>
              <a
                href="/"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'landing');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                Courses &amp; Pricing (EGP)
              </a>
              <a
                href="/about"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'about');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                About Us
              </a>
              <a
                href="/contact"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'contact');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                Contact Us
              </a>
              <a
                href="/privacy-policy"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'privacy');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                Privacy Policy
              </a>
              <a
                href="/refund-policy"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'refund');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                Refund &amp; Cancellation Policy
              </a>
              <a
                href="/delivery-policy"
                onClick={e => {
                  e.preventDefault();
                  onNavigatePortal('public', 'delivery');
                }}
                style={{ color: '#071A44', textDecoration: 'none' }}
              >
                Delivery &amp; Shipping Policy
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {mobile && (
        <nav
          className="no-print"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            background: '#071A44',
            display: 'flex',
            padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
          }}
        >
          {navD.slice(0, 5).map(([k, icon, , short]) => {
            const active = route === k;
            return (
              <a
                key={k}
                href={`#${k}`}
                onClick={e => {
                  e.preventDefault();
                  setRoute(k);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '6px 0',
                  minHeight: 52,
                  color: active ? '#F2B22E' : 'rgba(255,255,255,.7)',
                  textDecoration: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span className="material-icon" style={{ fontSize: 24 }}>
                  {icon}
                </span>
                {short}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
