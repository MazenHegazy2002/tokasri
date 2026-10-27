'use client';

import React, { useState, useEffect } from 'react';

interface AdminPortalProps {
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
  initialRole?: 'admin' | 'co';
}

export default function AdminPortal({
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
  initialRole = 'admin',
}: AdminPortalProps) {
  const isStrictCoAdmin = currentUser?.role === 'coadmin';
  const [role, setRole] = useState<'admin' | 'co'>(isStrictCoAdmin ? 'co' : initialRole);
  const [route, setRoute] = useState<string>(initialSubRoute || 'dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Course Builder & Topic Editor state
  const [selectedCourseId, setSelectedCourseId] = useState<string>('course-1');
  const [ti, setTi] = useState<number>(0);
  const [li, setLi] = useState<number>(0);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [showNewCourseModal, setShowNewCourseModal] = useState<boolean>(false);
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newCourseMentor, setNewCourseMentor] = useState<string>('Dr. Toka Essam Samir');
  const [newCoursePrice, setNewCoursePrice] = useState<string>('450');
  const [newCourseCat, setNewCourseCat] = useState<string>('c1');
  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);

  // Media library state
  const [mediaTab, setMediaTab] = useState<'video' | 'pdf'>('video');
  const [msel, setMsel] = useState<string | null>(null);

  // Quizzes state
  const [qkey, setQkey] = useState<string>('l8');
  const [qtab, setQtab] = useState<'q' | 'r'>('q');
  const [showChatGptBox, setShowChatGptBox] = useState<boolean>(true);
  const [chatGptRawText, setChatGptRawText] = useState<string>('');
  const [parsedChatGptQuestions, setParsedChatGptQuestions] = useState<
    Array<{ text: string; opts: string[]; a: number; explanation?: string }>
  >([]);
  const [quizImportMsg, setQuizImportMsg] = useState<string>('');
  const [promptCopiedMsg, setPromptCopiedMsg] = useState<string>('');

  function parseChatGptQuizText(raw: string): Array<{ text: string; opts: string[]; a: number; explanation?: string }> {
    const trimmed = (raw || '').trim();
    if (!trimmed) return [];

    // 1. Try JSON array first if user pasted JSON output from ChatGPT
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : parsed.questions || [];
        if (Array.isArray(arr) && arr.length > 0) {
          return arr
            .map((item: any) => {
              const opts = Array.isArray(item.opts || item.options || item.choices)
                ? (item.opts || item.options || item.choices).map((x: any) => String(x))
                : ['Option A', 'Option B', 'Option C', 'Option D'];
              while (opts.length < 4) opts.push(`Option ${'ABCD'[opts.length]}`);
              let a = 0;
              const rawAns = item.a ?? item.correct ?? item.correctIndex ?? item.answer;
              if (typeof rawAns === 'number') {
                a = Math.max(0, Math.min(3, rawAns));
              } else if (typeof rawAns === 'string') {
                const idx = 'ABCD'.indexOf(rawAns.trim().toUpperCase()[0]);
                if (idx >= 0) a = idx;
                else {
                  const matchIdx = opts.findIndex((o: string) => o.toLowerCase().includes(rawAns.trim().toLowerCase()));
                  if (matchIdx >= 0) a = matchIdx;
                }
              }
              return {
                text: String(item.text || item.question || item.q || '').trim(),
                opts: opts.slice(0, 4),
                a,
                explanation: String(item.explanation || '').trim(),
              };
            })
            .filter((q: any) => q.text);
        }
      } catch {
        // Fall through to natural-language ChatGPT text parser
      }
    }

    // Map English & Arabic option letters to 0..3
    const letterToIndex = (ch: string): number => {
      const upper = ch.trim().toUpperCase();
      if (upper === 'A' || ch === 'أ' || ch === 'ا' || ch === '1') return 0;
      if (upper === 'B' || ch === 'ب' || ch === '2') return 1;
      if (upper === 'C' || ch === 'ج' || ch === 'ت' || ch === '3') return 2;
      if (upper === 'D' || ch === 'د' || ch === 'ث' || ch === '4') return 3;
      return -1;
    };

    // Check for trailing Answer Key at the bottom (e.g. "1. B, 2. C" or "1: B")
    const globalAnswerKey: Record<number, number> = {};
    const lines = trimmed
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^[-=_*]{3,}$/.test(l));

    // Regex patterns
    const questionStartRe = /^(?:(?:\*\*|#+)?\s*(?:Q(?:uestion)?|س(?:ؤال)?)\s*[\d١-٩]+\s*[:.)\-]?|(?:\*\*|#+)?\s*[\d١-٩]+\s*[.):\-])\s*(.+)$/i;
    const optionLineRe = /^(?:\*\*|\*)?\s*(?:[\[(]?([A-Da-dأبجد])[\]).:\-]|([A-Da-dأبجد])\s+-\s+)\s*(.+)$/;
    const answerLineRe = /^(?:\*\*|\*)?\s*(?:Correct\s*Answer|Right\s*Answer|Answer|Correct|Ans|Solution|الإجابة\s*الصحيحة|الإجابة|الجواب)\s*[:=\-]\s*(.+)$/i;
    const explanationLineRe = /^(?:\*\*|\*)?\s*(?:Explanation|Rationale|Reason|الشرح|التفسير)\s*[:=\-]\s*(.+)$/i;
    const correctMarkerRe = /(?:✅|✓|✔|\(\s*correct\s*\)|\[\s*correct\s*\]|\(\s*right\s*answer\s*\)|\(\s*الإجابة\s*الصحيحة\s*\)|\(\s*صحيح\s*\)|\*\*\s*correct\s*\*\*)/i;

    const results: Array<{ text: string; opts: string[]; a: number; explanation?: string }> = [];
    let currentQ: { text: string; opts: string[]; a: number; hasExplicitAns: boolean; explanation: string } | null = null;

    const flushCurrent = () => {
      if (currentQ && currentQ.text.trim()) {
        // Only keep if it has at least 2 options OR looks like a real question
        if (currentQ.opts.length >= 2) {
          const padded = [...currentQ.opts];
          while (padded.length < 4) {
            padded.push(`Option ${'ABCD'[padded.length]}`);
          }
          results.push({
            text: currentQ.text.replace(/^\*\*|\*\*$/g, '').trim(),
            opts: padded.slice(0, 4),
            a: Math.max(0, Math.min(3, currentQ.a)),
            explanation: currentQ.explanation.trim(),
          });
        }
      }
      currentQ = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const cleanLine = rawLine.replace(/^>\s*/, '').trim();

      // Check if it's an Answer line
      const ansMatch = cleanLine.match(answerLineRe);
      if (ansMatch && currentQ) {
        const ansVal = ansMatch[1].replace(/\*\*/g, '').trim();
        // Check if starts with letter A/B/C/D or أ/ب/ج/د
        const letterMatch = ansVal.match(/^(?:Option\s*)?[\[(]?([A-Da-dأبجد])(?:[\]).:\-\s]|$)/i);
        if (letterMatch) {
          const idx = letterToIndex(letterMatch[1]);
          if (idx >= 0) {
            currentQ.a = idx;
            currentQ.hasExplicitAns = true;
          }
        } else {
          // Match by option text
          const normAns = ansVal.toLowerCase();
          const matchIdx = currentQ.opts.findIndex(
            o => o.toLowerCase() === normAns || o.toLowerCase().includes(normAns) || normAns.includes(o.toLowerCase())
          );
          if (matchIdx >= 0) {
            currentQ.a = matchIdx;
            currentQ.hasExplicitAns = true;
          }
        }
        continue;
      }

      // Check if it's an Explanation line
      const expMatch = cleanLine.match(explanationLineRe);
      if (expMatch && currentQ) {
        currentQ.explanation = expMatch[1].replace(/\*\*/g, '').trim();
        continue;
      }

      // Check if it's an Option line (A) ... B) ... C) ... D) ...)
      const optMatch = cleanLine.match(optionLineRe);
      if (optMatch) {
        const letter = optMatch[1] || optMatch[2];
        let optBody = optMatch[3].trim();
        const optIdx = letterToIndex(letter);

        if (!currentQ) {
          // If options started without a numbered question header, check previous line
          currentQ = {
            text: i > 0 ? lines[i - 1].replace(/\*\*/g, '').trim() : 'Question',
            opts: [],
            a: 0,
            hasExplicitAns: false,
            explanation: '',
          };
        }

        // If we already have 4 options and see 'A' again, flush and start a new question
        if (currentQ.opts.length >= 4 && optIdx === 0) {
          flushCurrent();
          currentQ = {
            text: i > 0 ? lines[i - 1].replace(/\*\*/g, '').trim() : 'Question',
            opts: [],
            a: 0,
            hasExplicitAns: false,
            explanation: '',
          };
        }

        // Detect inline correct marker (✅, ✓, (Correct), * prefix, etc.)
        const hasCorrectMarker =
          correctMarkerRe.test(optBody) ||
          /^\*\s*\[?[A-Da-dأبجد]/.test(cleanLine) ||
          (/^(\*\*)[\[(]?[A-Da-dأبجد][\]).:\-].*(\*\*)$/.test(cleanLine) && !currentQ.hasExplicitAns);

        optBody = optBody
          .replace(correctMarkerRe, '')
          .replace(/^\*\*|\*\*$/g, '')
          .trim();

        const targetPos = currentQ.opts.length;
        currentQ.opts.push(optBody);
        if (hasCorrectMarker && !currentQ.hasExplicitAns) {
          currentQ.a = optIdx >= 0 && optIdx < 4 ? optIdx : targetPos;
          currentQ.hasExplicitAns = true;
        }
        continue;
      }

      // Check if it's a numbered/prefixed Question start
      const qMatch = cleanLine.match(questionStartRe);
      if (qMatch) {
        // Check if this is actually an answer key line like "1. B"
        const shortAnsKey = qMatch[1].trim().match(/^([A-Da-dأبجد])$/i);
        if (shortAnsKey) {
          const qNumMatch = cleanLine.match(/(\d+)/);
          if (qNumMatch) {
            globalAnswerKey[Number(qNumMatch[1]) - 1] = letterToIndex(shortAnsKey[1]);
          }
          continue;
        }
        flushCurrent();
        currentQ = {
          text: qMatch[1].replace(/^\*\*|\*\*$/g, '').trim(),
          opts: [],
          a: 0,
          hasExplicitAns: false,
          explanation: '',
        };
        continue;
      }

      // Check if unnumbered question line (e.g. ends with '?' or '؟' or ':') before options
      if (!currentQ || currentQ.opts.length >= 2) {
        if (/[?؟:]$/.test(cleanLine) || (i + 1 < lines.length && optionLineRe.test(lines[i + 1]))) {
          flushCurrent();
          currentQ = {
            text: cleanLine.replace(/^\*\*|\*\*$/g, '').trim(),
            opts: [],
            a: 0,
            hasExplicitAns: false,
            explanation: '',
          };
          continue;
        }
      }

      // Otherwise, if we are inside a question before any options were added, append to question stem
      if (currentQ && currentQ.opts.length === 0) {
        currentQ.text += ' ' + cleanLine.replace(/^\*\*|\*\*$/g, '').trim();
      }
    }

    flushCurrent();

    // Apply global answer key if any question didn't have an inline answer
    results.forEach((q, idx) => {
      if (globalAnswerKey[idx] !== undefined && globalAnswerKey[idx] >= 0) {
        q.a = globalAnswerKey[idx];
      }
    });

    return results;
  }

  // Students state
  const [sSearch, setSSearch] = useState<string>('');
  const [sPlanFilter, setSPlanFilter] = useState<string>('All');
  const [ssel, setSsel] = useState<number>(0);

  // Research review state
  const [revFilter, setRevFilter] = useState<string>('all');
  const [revSel, setRevSel] = useState<number>(0);
  const [revComment, setRevComment] = useState<string>('');
  const [previewPdfOpen, setPreviewPdfOpen] = useState<boolean>(true);
  const [previewModalFile, setPreviewModalFile] = useState<{
    title: string;
    url: string;
    ext?: string;
    meta?: string;
  } | null>(null);

  // Payments & Coupons state
  const [showNewCoupon, setShowNewCoupon] = useState<boolean>(false);
  const [cpCode, setCpCode] = useState<string>('');
  const [cpDesc, setCpDesc] = useState<string>('');
  const [cpPct, setCpPct] = useState<string>('25');
  const [cpFixed, setCpFixed] = useState<string>('0');
  const [cpMaxUses, setCpMaxUses] = useState<string>('100');
  const [cpType, setCpType] = useState<'pct' | 'fixed'>('pct');
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [editCpDraft, setEditCpDraft] = useState<any | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewPayment, setReceiptPreviewPayment] = useState<any | null>(null);

  // Payment Gateways & Receiving Accounts editor state
  const defaultGateways = {
    paymob: {
      enabled: true,
      mode: 'Live',
      merchantId: 'PMB-884210',
      integrationId: '4419023',
      iframeId: '782910',
      apiKey: 'egy_pk_live_sri_epnu_99281a',
      hmacSecret: '9981273abc81723',
    },
    wallet: {
      enabled: true,
      provider: 'Vodafone Cash',
      walletNumber: '0101 234 5678',
      walletOwnerName: 'SRI — East Port Said National University',
      qrCodeUrl: '',
      instructions:
        'Transfer the total to our Vodafone Cash number above, then upload your transfer screenshot. Access unlocks once Co-Admin / Admin approves the screenshot.',
    },
    fawry: {
      enabled: true,
      merchantCode: '770000014291',
      securityKey: 'fawry_sec_sri_2026',
      expiryHours: 48,
    },
    instapay: {
      enabled: true,
      handle: 'sri.epnu@instapay',
      phoneNumber: '0101 234 5678',
      paymentLink: 'https://ipn.eg/S/sri.epnu/instapay/012345',
      qrCodeUrl: '/assets/instapay-qr.svg',
      accountHolder: 'Student Research Initiative (SRI - EPNU)',
      bankName: 'National Bank of Egypt (NBE)',
      accountNumber: '1043009928172601',
      iban: 'EG380003010430099281726010001',
      instructions:
        'Scan the InstaPay QR code, click Open InstaPay Link, or transfer to our InstaPay number/IPA handle, then upload your transfer screenshot for Co-Admin / Admin approval.',
    },
    subscriptions: {
      enabled: true,
      monthlyPrice: 199,
      currency: 'EGP',
      plans: [
        {
          id: 'plan-monthly',
          name: 'SRI Monthly Membership',
          nameAr: 'عضوية SRI الشهرية',
          badge: 'MOST POPULAR',
          price: 199,
          currency: 'EGP',
          period: 'month',
          periodAr: 'شهرياً',
          description: 'Every course, live mentorship sessions and priority manuscript review. Cancel anytime.',
          descriptionAr: 'وصول كامل لجميع الدورات، جلسات الإرشاد المباشرة، وأولوية مراجعة وتحكيم الأبحاث.',
          accessType: 'all',
          courseIds: ['course-1', 'course-2', 'course-3', 'course-4', 'course-5', 'course-6'],
          enabled: true,
        },
        {
          id: 'plan-term',
          name: 'Academic Term Bundle (4 Months)',
          nameAr: 'باقة الفصل الدراسي (4 أشهر)',
          badge: 'SAVE 25%',
          price: 599,
          currency: 'EGP',
          period: 'term',
          periodAr: 'فصل دراسي',
          description: 'Full semester access to core research methodology, biostatistics, and academic writing tracks.',
          descriptionAr: 'وصول طوال الفصل الدراسي لدورات منهجيات البحث والإحصاء الحيوي والكتابة العلمية.',
          accessType: 'selected',
          courseIds: ['course-1', 'course-2', 'course-3', 'course-4'],
          enabled: true,
        },
        {
          id: 'plan-annual',
          name: 'Annual Scholar Pass (12 Months)',
          nameAr: 'العضوية السنوية للباحثين (12 شهراً)',
          badge: 'BEST VALUE',
          price: 1499,
          currency: 'EGP',
          period: 'year',
          periodAr: 'سنوياً',
          description: '12 months unlimited access to all courses, 1-on-1 statistical consultation, and fast-track review.',
          descriptionAr: 'وصول غير محدود لمدة 12 شهراً لجميع الدورات مع استشارات إحصائية فردية وتحكيم سريع.',
          accessType: 'all',
          courseIds: ['course-1', 'course-2', 'course-3', 'course-4', 'course-5', 'course-6'],
          enabled: true,
        },
      ],
    },
  };

  const [gwForm, setGwForm] = useState<any>(() => {
    const rawSubs = state.settings?.payment_gateways?.subscriptions || {};
    return {
      paymob: { ...defaultGateways.paymob, ...(state.settings?.payment_gateways?.paymob || {}) },
      wallet: { ...defaultGateways.wallet, ...(state.settings?.payment_gateways?.wallet || {}) },
      fawry: { ...defaultGateways.fawry, ...(state.settings?.payment_gateways?.fawry || {}) },
      instapay: { ...defaultGateways.instapay, ...(state.settings?.payment_gateways?.instapay || {}) },
      subscriptions: {
        ...defaultGateways.subscriptions,
        ...rawSubs,
        plans: Array.isArray(rawSubs.plans) ? rawSubs.plans : defaultGateways.subscriptions.plans,
      },
    };
  });
  const [activeGwTab, setActiveGwTab] = useState<'instapay' | 'wallet' | 'paymob' | 'fawry' | 'subscriptions'>('instapay');
  const [gwSavedMsg, setGwSavedMsg] = useState<string>('');
  const [uploadingQr, setUploadingQr] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  // Student course enrollment management state
  const [enrollCourseId, setEnrollCourseId] = useState<string>('course-1');
  const [enrollPlanId, setEnrollPlanId] = useState<string>('plan-monthly');
  const [studentCourseMsg, setStudentCourseMsg] = useState<string>('');
  const [builderStudentId, setBuilderStudentId] = useState<string>('');
  const [quickStudentId, setQuickStudentId] = useState<string>('u-mariam');

  async function saveGatewayAndPlans(nextGw: any, msg = '✓ Saved Plans & Pricing!') {
    setGwForm(nextGw);
    await onAction('update_gateway_settings', { gateways: nextGw });
    setGwSavedMsg(msg);
    setTimeout(() => setGwSavedMsg(''), 3000);
  }

  async function handleUploadGatewayQr(file: File, target: 'instapay' | 'wallet') {
    setUploadingQr(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data?.url) {
        setGwForm((prev: any) => ({
          ...prev,
          [target]: { ...prev[target], qrCodeUrl: data.url },
        }));
        setUploadingQr(false);
        return;
      }
    } catch {
      // Fallback to data URL below
    }
    const reader = new FileReader();
    reader.onload = ev => {
      if (typeof ev.target?.result === 'string') {
        setGwForm((prev: any) => ({
          ...prev,
          [target]: { ...prev[target], qrCodeUrl: ev.target!.result },
        }));
      }
      setUploadingQr(false);
    };
    reader.readAsDataURL(file);
  }

  // Admin User Accounts management state
  const [showNewUserForm, setShowNewUserForm] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('student');
  const [newUserPlan, setNewUserPlan] = useState<string>('Free');
  const [newUserFaculty, setNewUserFaculty] = useState<string>('Faculty of Medicine');
  const [newUserStudentId, setNewUserStudentId] = useState<string>('2026-0500');
  const [resetPwdUserId, setResetPwdUserId] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState<string>('');
  const [userMgmtMsg, setUserMgmtMsg] = useState<string>('');

  useEffect(() => {
    const pg = state.settings?.payment_gateways;
    if (pg) {
      const rawSubs = pg.subscriptions || {};
      setGwForm({
        paymob: { ...defaultGateways.paymob, ...(pg.paymob || {}) },
        wallet: { ...defaultGateways.wallet, ...(pg.wallet || {}) },
        fawry: { ...defaultGateways.fawry, ...(pg.fawry || {}) },
        instapay: { ...defaultGateways.instapay, ...(pg.instapay || {}) },
        subscriptions: {
          ...defaultGateways.subscriptions,
          ...rawSubs,
          plans: Array.isArray(rawSubs.plans) ? rawSubs.plans : defaultGateways.subscriptions.plans,
        },
      });
    }
  }, [state.settings?.payment_gateways]);

  useEffect(() => {
    if (initialSubRoute) setRoute(initialSubRoute);
  }, [initialSubRoute]);

  useEffect(() => {
    if (isStrictCoAdmin) {
      setRole('co');
    } else if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole, isStrictCoAdmin]);

  const isRtl = lang === 'ar';
  const admin = currentUser?.role === 'admin';
  const perms = {
    courses: true,
    review: true,
    students: true,
    payments: true,
    settings: false,
    del: false,
    ...(state.settings?.coadmin_perms || {}),
  };
  const canDelete = admin || !!perms.del;

  const courses = state.courses || [];
  const activeCourse = courses.find((c: any) => c.id === selectedCourseId) || courses[0];
  const mods = activeCourse?.modules || [];
  const safeTi = Math.max(0, Math.min(ti, Math.max(0, mods.length - 1)));
  const currentTopic = mods[safeTi] || { id: '', t: 'Untitled topic', desc: '', items: [] };
  const topicItems = currentTopic.items || [];
  const safeLi = Math.max(0, Math.min(li, Math.max(0, topicItems.length - 1)));
  const currentLesson = topicItems[safeLi];

  // Research review queue calculations
  const STAGE: Record<string, [string, string, string]> = {
    co: ['Co-admin review', '#1446A0', '#E3ECFB'],
    ad: ['Admin approval', '#B07A08', '#FCF1D6'],
    ok: ['Approved', '#1E8A5A', '#E3F3EA'],
    ch: ['Changes requested', '#C2412D', '#FBE7E3'],
  };

  const submissions = state.researchSubmissions || [];
  const myStage = admin ? 'ad' : 'co';
  const countByStage = (stKey: string) =>
    submissions.filter((x: any) => stKey === 'all' || x.st === stKey).length;
  const filteredSubs = submissions
    .map((x: any, idx: number) => ({ ...x, idx }))
    .filter((x: any) => revFilter === 'all' || x.st === revFilter);
  const curSub = submissions[revSel] || submissions[0] || {
    id: 'sub-1',
    t: 'No submission selected',
    a: '',
    sup: '',
    type: '',
    when: '',
    st: 'co',
    file: 'manuscript.pdf',
    fileUrl: '/files/protocol-template.pdf',
    abs: '',
    notes: [],
  };
  const [curStageLabel, curSc, curSb] = STAGE[curSub.st] || STAGE.co;
  const canActOnReview = curSub.st === myStage;

  // Navigation items (obeys Co-Admin permissions!)
  const navAll = [
    ['dashboard', 'space_dashboard', 'Overview', 'Home', true],
    ['courses', 'auto_stories', 'Courses & categories', 'Courses', !!perms.courses],
    ['plans', 'workspace_premium', 'Plans & pricing (EGP)', 'Plans', !!perms.payments || !!perms.courses],
    ['students', 'group', 'Students & enrollments', 'Students', !!perms.students],
    ['library', 'video_library', 'Media library', 'Media', !!perms.courses],
    ['quizzes', 'quiz', 'Quizzes', 'Quizzes', !!perms.courses],
    ['review', 'rate_review', 'Research review', 'Review', !!perms.review],
    ['payments', 'payments', 'Payments & gateways', 'Payments', !!perms.payments],
    ['contact', 'contact_mail', 'Contact Us messages', 'Contact', true],
    ['settings', 'admin_panel_settings', 'Roles & settings', 'Settings', !!perms.settings],
  ] as const;

  const navFiltered = navAll.filter(n => admin || n[4]);
  const navKey = ['builder', 'topic'].includes(route) ? 'courses' : route;

  // All quizzes across all courses
  const quizList: Array<{ l: any; mi: number; m: any; c: any }> = [];
  courses.forEach((c: any) => {
    (c.modules || []).forEach((m: any, mi: number) => {
      (m.items || []).forEach((l: any) => {
        if (l.type === 'quiz') quizList.push({ l, mi, m, c });
      });
    });
  });
  const activeQuizEntry = quizList.find(x => x.l.id === qkey) || quizList[0];
  const activeQuizQuestions = activeQuizEntry?.l?.questions || [];

  // All media items across courses
  const mediaAll: Array<{ l: any; mi: number; m: any; c: any }> = [];
  courses.forEach((c: any) => {
    (c.modules || []).forEach((m: any, mi: number) => {
      (m.items || []).forEach((l: any) => {
        if (l.type !== 'quiz') mediaAll.push({ l, mi, m, c });
      });
    });
  });
  const mediaFiltered = mediaAll.filter(x => x.l.type === mediaTab);
  const selectedMedia = mediaFiltered.find(x => x.l.id === msel) || mediaFiltered[0];

  // Students data enriched from DB
  const dbStudents = (state.users || []).filter((u: any) => u.role === 'student' || u.role === 'coadmin');
  const enrichedStudents = dbStudents.map((u: any) => {
    const enrs = (state.enrollments || []).filter((e: any) => e.user_id === u.id);
    const qAtts = (state.quizAttempts || []).filter((a: any) => a.user_id === u.id);
    const subs = submissions.filter((s: any) => s.userId === u.id || s.a === u.name);
    const pays = (state.payments || []).filter((p: any) => p.user_id === u.id || p.user_name === u.name);
    const avgProg = enrs.length
      ? `${Math.round(enrs.reduce((acc: number, e: any) => acc + (e.progress_pct || 0), 0) / enrs.length)}%`
      : '—';
    return {
      ...u,
      ini: u.avatar_initials || u.name.split(' ').map((w: string) => w[0]).join(''),
      avgProg,
      enrs: enrs.map((e: any) => {
        const cObj = courses.find((c: any) => c.id === e.course_id);
        return {
          id: e.id,
          courseId: e.course_id,
          t: cObj?.title || 'Course',
          p: e.progress_pct || 0,
          planType: e.plan_type || 'Course',
          enrolledAt: e.enrolled_at || '',
        };
      }),
      qAtts,
      subs,
      pays,
    };
  });

  const filteredStudents = enrichedStudents
    .map((u: any, idx: number) => ({ u, idx }))
    .filter(({ u }: any) => {
      const matchPlan = sPlanFilter === 'All' || u.plan === sPlanFilter;
      const q = (sSearch || globalSearch).trim().toLowerCase();
      const matchQ =
        !q ||
        `${u.name} ${u.student_id_code} ${u.faculty} ${u.email}`.toLowerCase().includes(q);
      return matchPlan && matchQ;
    });

  const curStudent = enrichedStudents[ssel] || enrichedStudents[0];

  // Lesson upload handler in Topic Editor
  const handleLessonFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'video' | 'pdf' | 'slides' | 'subtitles') => {
    const file = e.target.files?.[0];
    if (!file || !currentLesson) return;
    setUploadingMedia(true);
    const up = await onUploadFile(file);
    setUploadingMedia(false);
    if (up) {
      if (field === 'video') {
        await onAction('update_lesson', {
          id: currentLesson.id,
          isUploaded: true,
          videoUrl: up.url,
          durationOrMeta: '14:20',
        });
      } else if (field === 'pdf') {
        await onAction('update_lesson', {
          id: currentLesson.id,
          isUploaded: true,
          fileUrl: up.url,
          durationOrMeta: up.sizeLabel,
        });
      } else if (field === 'slides') {
        await onAction('add_lesson_resource', {
          lessonId: currentLesson.id,
          ext: 'PDF',
          title: up.fileName,
          sizeMeta: up.sizeLabel,
          fileUrl: up.url,
        });
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCourse) return;
    const up = await onUploadFile(file);
    if (up) {
      await onAction('update_course', {
        id: activeCourse.id,
        coverImage: up.url,
      });
    }
  };

  const handleExportStudentsCsv = () => {
    const headers = ['Name,Student ID,Faculty,Year,Plan,Avg Progress,Email'];
    const rows = enrichedStudents.map(
      (s: any) =>
        `"${s.name}","${s.student_id_code}","${s.faculty}","${s.year_level}","${s.plan}","${s.avgProg}","${s.email}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sri-epnu-students.csv';
    a.click();
  };

  const LT: Record<string, [string, string, string]> = {
    video: ['play_circle', '#E3ECFB', '#1446A0'],
    pdf: ['description', '#FBE7E3', '#C2412D'],
    quiz: ['quiz', '#FCF1D6', '#8C6206'],
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const lessonMetaDesc = (l: any) =>
    l.type === 'quiz'
      ? `${l.questions?.length || 0} questions · pass ${l.passMark || 70}%`
      : !l.up
      ? l.type === 'video'
        ? 'Video · not uploaded'
        : 'File · not uploaded'
      : l.type === 'video'
      ? `Video · ${l.d} · 1080p`
      : `PDF · ${l.d}`;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#F3F1EB',
        fontFamily: isRtl ? "'Cairo', 'Montserrat', sans-serif" : "'Montserrat', sans-serif",
        color: '#0E1736',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {/* DESKTOP SIDEBAR */}
      {!mobile && (
        <aside
          style={{
            width: 244,
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
              padding: '0 8px 24px',
              color: '#fff',
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
                  color: '#F2B22E',
                }}
              >
                {admin ? 'Admin' : 'Co-admin'}
              </span>
            </span>
          </a>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navFiltered.map(([k, icon, label]) => {
              const active = navKey === k;
              const badgeCount = countByStage(myStage);
              const unreadContactCount = (state.contactMessages || state.settings?.contact_messages || []).filter(
                (m: any) => m.status === 'Unread'
              ).length;
              return (
                <a
                  key={k}
                  href={`#${k}`}
                  onClick={e => {
                    e.preventDefault();
                    setRoute(k);
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
                  <span style={{ flex: 1 }}>{label}</span>
                  {k === 'review' && badgeCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#F2B22E',
                        color: '#071A44',
                        borderRadius: 999,
                        padding: '0 7px',
                        lineHeight: '18px',
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                  {k === 'contact' && unreadContactCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#F2B22E',
                        color: '#071A44',
                        borderRadius: 999,
                        padding: '0 7px',
                        lineHeight: '18px',
                      }}
                    >
                      {unreadContactCount}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onNavigatePortal('public', 'landing')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.18)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 12,
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
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 8px 0',
                borderTop: '1px solid rgba(255,255,255,.1)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#F2B22E',
                  color: '#071A44',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {currentUser?.avatar_initials || (admin ? 'TE' : 'YA')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {currentUser?.name || (admin ? 'Dr. Toka Essam Samir' : 'Youssef Adel')}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{admin ? 'Admin' : 'Co-admin'}</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0, paddingBottom: mobile ? 84 : 0 }}>
        {/* STICKY TOP BAR */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'rgba(243,241,235,.92)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid #E4DFD3',
          }}
        >
          <div
            style={{
              maxWidth: 1320,
              margin: '0 auto',
              padding: '12px clamp(16px,3vw,32px)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {mobile && (
              <img
                src="/assets/sri-logo.png"
                alt="SRI"
                onClick={() => onNavigatePortal('public', 'landing')}
                style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer' }}
              />
            )}
            {!mobile && (
              <div
                style={{
                  flex: 1,
                  maxWidth: 420,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: '#8A90A6',
                }}
              >
                <span className="material-icon" style={{ fontSize: 20 }}>
                  search
                </span>
                <input
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && globalSearch.trim()) {
                      setRoute('students');
                    }
                  }}
                  placeholder="Search students, courses, submissions"
                  style={{
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    flex: 1,
                    fontSize: 13,
                    color: '#0E1736',
                  }}
                />
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                style={{
                  border: '1px solid #D3CDBF',
                  background: '#fff',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {lang === 'en' ? 'عربي' : 'EN'}
              </button>
              <span
                style={{
                  background: admin ? '#071A44' : '#E3ECFB',
                  color: admin ? '#F2B22E' : '#1446A0',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '6px 14px',
                  borderRadius: 999,
                }}
              >
                {admin ? 'Admin' : 'Co-Admin'}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    border: '1px solid #E4DFD3',
                    background: '#fff',
                    color: '#C2412D',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1320, margin: '0 auto', padding: 'clamp(18px,3vw,32px)' }}>
          {/* SCREEN 3A & 4A: OVERVIEW (ADMIN & CO-ADMIN) */}
          {route === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h1
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,3.6vw,40px)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    {admin ? 'Overview' : 'Co-Admin Overview'}
                  </h1>
                  <div style={{ color: '#5A6280' }}>
                    October 2026 · {admin ? 'Full Administrator Access' : 'Restricted Co-Admin View (Financials & Settings Hidden)'}
                  </div>
                </div>
                {(admin || perms.courses) && (
                  <button
                    onClick={() => setShowNewCourseModal(true)}
                    style={{
                      background: '#071A44',
                      color: '#fff',
                      border: 0,
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 19 }}>
                      add
                    </span>
                    New course
                  </button>
                )}
              </div>

              {/* KPI CARDS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))',
                  gap: 14,
                }}
              >
                {[
                  { t: 'Active students', v: '1,284', d: '+86 this month', dark: false },
                  { t: 'Course completions', v: '312', d: '74% quiz pass rate', dark: false },
                  {
                    t: admin ? 'Awaiting your approval' : 'Awaiting your review',
                    v: String(countByStage(myStage)),
                    d: 'Research submissions',
                    dark: false,
                  },
                  admin
                    ? { t: 'Revenue this month', v: 'EGP 34.6k', d: '+20% vs September', dark: true }
                    : { t: 'Live sessions', v: String((state.liveSessions || []).length), d: 'Scheduled this month', dark: false },
                ].map((k, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: k.dark ? '#071A44' : '#fff',
                      color: k.dark ? '#fff' : '#0E1736',
                      border: `1px solid ${k.dark ? '#071A44' : '#E4DFD3'}`,
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.75 }}>
                      {k.t}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>{k.v}</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{k.d}</span>
                  </div>
                ))}
              </div>

              {/* REVENUE CHART (ADMIN ONLY) & REVIEW QUEUE PREVIEW */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
                {admin && (
                  <div
                    style={{
                      flex: '2 1 460px',
                      minWidth: 0,
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 18,
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Revenue, last 8 weeks</span>
                      <a
                        href="#payments"
                        onClick={e => {
                          e.preventDefault();
                          setRoute('payments');
                        }}
                        style={{ fontSize: 13, fontWeight: 700 }}
                      >
                        Payments
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180 }}>
                      {[18.2, 21.5, 19.8, 26.4, 24.1, 31.7, 28.9, 34.6].map((v, i, arr) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            height: '100%',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span style={{ fontSize: 11, color: '#5A6280', fontWeight: 600 }}>{v}k</span>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 44,
                              height: `${Math.round((v / 36) * 130)}px`,
                              background: i === arr.length - 1 ? '#F2B22E' : '#1446A0',
                              borderRadius: '6px 6px 2px 2px',
                            }}
                          />
                          <span style={{ fontSize: 11, color: '#8A90A6' }}>W{35 + i}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    flex: '1 1 320px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>
                      {admin ? 'Ready for final approval' : 'Needs first review'}
                    </span>
                    <a
                      href="#review"
                      onClick={e => {
                        e.preventDefault();
                        setRoute('review');
                      }}
                      style={{ fontSize: 13, fontWeight: 700 }}
                    >
                      Open queue
                    </a>
                  </div>
                  {submissions
                    .filter((x: any) => x.st === myStage)
                    .map((q: any, idx: number) => (
                      <a
                        key={q.id || idx}
                        href="#review"
                        onClick={e => {
                          e.preventDefault();
                          const realIdx = submissions.findIndex((s: any) => s.id === q.id);
                          if (realIdx >= 0) setRevSel(realIdx);
                          setRoute('review');
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          padding: 12,
                          borderRadius: 12,
                          background: '#F6F3EC',
                          color: '#0E1736',
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{q.t}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>
                          {q.a} · {q.when}
                        </span>
                      </a>
                    ))}
                </div>
              </div>

              {/* PENDING TRANSFER SCREENSHOTS QUEUE (VISIBLE TO BOTH CO-ADMIN & ADMIN) */}
              <div style={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 18, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '16px 22px',
                    borderBottom: '1px solid #EEEAE0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                      Pending Transfer Screenshots (InstaPay &amp; Vodafone Cash)
                    </div>
                    <div style={{ fontSize: 12, color: '#5A6280' }}>
                      Review uploaded transfer screenshots and manually approve to unlock student course access.
                    </div>
                  </div>
                  <button
                    onClick={() => setRoute('payments')}
                    style={{
                      border: '1px solid #D8D3C6',
                      background: '#F6F3EC',
                      color: '#0A2160',
                      borderRadius: 999,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    All Payments &amp; Gateways →
                  </button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(state.payments || []).filter((t: any) => t.status === 'Pending' || t.status === 'Verify').length ===
                  0 ? (
                    <div style={{ fontSize: 13, color: '#5A6280', padding: '8px 6px' }}>
                      No pending transfer screenshots awaiting verification right now.
                    </div>
                  ) : (
                    (state.payments || [])
                      .filter((t: any) => t.status === 'Pending' || t.status === 'Verify')
                      .map((t: any) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: '#F6F3EC',
                            border: '1px solid #E4DFD3',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {t.receipt_url ? (
                              <img
                                src={t.receipt_url}
                                alt="Transfer screenshot"
                                onClick={() => {
                                  setReceiptPreviewUrl(t.receipt_url);
                                  setReceiptPreviewPayment(t);
                                }}
                                style={{
                                  width: 52,
                                  height: 52,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  border: '1.5px solid #1446A0',
                                  cursor: 'pointer',
                                  background: '#fff',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 8,
                                  background: '#E3ECFB',
                                  display: 'grid',
                                  placeItems: 'center',
                                  color: '#1446A0',
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                No img
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>
                                {t.user_name} · <span style={{ color: '#1446A0' }}>{t.method}</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#5A6280' }}>
                                {t.item_title} · <b>EGP {t.amount}</b> · Ref: {t.reference_code}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {t.receipt_url && (
                              <button
                                onClick={() => {
                                  setReceiptPreviewUrl(t.receipt_url);
                                  setReceiptPreviewPayment(t);
                                }}
                                style={{
                                  border: '1px solid #1446A0',
                                  background: '#fff',
                                  color: '#1446A0',
                                  borderRadius: 999,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                View Screenshot
                              </button>
                            )}
                            <button
                              onClick={() => onAction('verify_payment', { paymentId: t.id })}
                              style={{
                                border: 0,
                                background: '#1E8A5A',
                                color: '#fff',
                                borderRadius: 999,
                                padding: '7px 14px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ✓ Approve &amp; Unlock
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* LIVE STUDENT COURSE ENROLLMENTS & PLAN ACCESS MANAGER ON DASHBOARD */}
              <div style={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 18, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '18px 22px',
                    borderBottom: '1px solid #EEEAE0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                      Student Course Enrollments (Add, Change &amp; Delete Student in Course)
                    </div>
                    <div style={{ fontSize: 12, color: '#5A6280' }}>
                      Enroll any student into a course or membership plan, switch their course, or remove them from a course.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {studentCourseMsg && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          background: '#E3F3EA',
                          color: '#1E8A5A',
                          padding: '5px 12px',
                          borderRadius: 999,
                        }}
                      >
                        {studentCourseMsg}
                      </span>
                    )}
                    <button
                      onClick={() => setRoute('plans')}
                      style={{
                        border: 0,
                        background: '#071A44',
                        color: '#F2B22E',
                        borderRadius: 999,
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ★ Manage Multiple Plans &amp; Pricing (EGP) →
                    </button>
                  </div>
                </div>

                {/* Quick Add Student to Course or Plan bar */}
                <div
                  style={{
                    padding: '14px 22px',
                    background: '#F6F3EC',
                    borderBottom: '1px solid #EEEAE0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={quickStudentId || enrichedStudents[0]?.id || ''}
                    onChange={e => setQuickStudentId(e.target.value)}
                    style={{
                      flex: '1 1 180px',
                      border: '1px solid #D8D3C6',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 13,
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {enrichedStudents.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.faculty})
                      </option>
                    ))}
                  </select>
                  <select
                    value={enrollCourseId}
                    onChange={e => setEnrollCourseId(e.target.value)}
                    style={{
                      flex: '1 1 200px',
                      border: '1px solid #D8D3C6',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 13,
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {courses.map((co: any) => (
                      <option key={co.id} value={co.id}>
                        {co.title} (EGP {co.price})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const targetUser = quickStudentId || enrichedStudents[0]?.id;
                      if (!targetUser) return;
                      const res = await onAction('admin_enroll_student', {
                        userId: targetUser,
                        courseId: enrollCourseId,
                        progressPct: 0,
                        planType: 'Course',
                      });
                      if (res?.ok) {
                        setStudentCourseMsg('✓ Added student to course!');
                        setTimeout(() => setStudentCourseMsg(''), 3000);
                      }
                    }}
                    style={{
                      border: 0,
                      background: '#1E8A5A',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '9px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Student to Course
                  </button>
                  <select
                    value={enrollPlanId}
                    onChange={e => setEnrollPlanId(e.target.value)}
                    style={{
                      flex: '1 1 180px',
                      border: '1px solid #D8D3C6',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 13,
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {(gwForm.subscriptions?.plans || []).map((pl: any) => (
                      <option key={pl.id} value={pl.id}>
                        Plan: {pl.name} (EGP {pl.price})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const targetUser = quickStudentId || enrichedStudents[0]?.id;
                      if (!targetUser) return;
                      const res = await onAction('admin_enroll_student', {
                        userId: targetUser,
                        planId: enrollPlanId,
                      });
                      if (res?.ok) {
                        setStudentCourseMsg('✓ Enrolled student in plan courses!');
                        setTimeout(() => setStudentCourseMsg(''), 3000);
                      }
                    }}
                    style={{
                      border: 0,
                      background: '#1446A0',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '9px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Apply Plan Access
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 680 }}>
                    {(state.enrollments || []).slice(0, 10).map((en: any) => {
                      const stu = enrichedStudents.find((u: any) => u.id === en.user_id) || {
                        name: en.user_id,
                        ini: 'ST',
                      };
                      return (
                        <div
                          key={en.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.3fr 1.8fr .9fr .8fr .7fr',
                            gap: 10,
                            padding: '10px 22px',
                            borderTop: '1px solid #F0ECE2',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: '#DCE7F8',
                                color: '#0A2160',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {stu.ini}
                            </span>
                            {stu.name}
                          </span>
                          <select
                            value={en.course_id}
                            onChange={async e => {
                              const res = await onAction('admin_update_enrollment', {
                                enrollmentId: en.id,
                                userId: en.user_id,
                                courseId: en.course_id,
                                newCourseId: e.target.value,
                                progressPct: en.progress_pct,
                                planType: en.plan_type,
                              });
                              if (res?.ok) {
                                setStudentCourseMsg('✓ Changed student course!');
                                setTimeout(() => setStudentCourseMsg(''), 2500);
                              }
                            }}
                            style={{
                              border: '1px solid #D8D3C6',
                              borderRadius: 8,
                              padding: '6px 8px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              background: '#fff',
                            }}
                          >
                            {courses.map((co: any) => (
                              <option key={co.id} value={co.id}>
                                {co.title} (EGP {co.price})
                              </option>
                            ))}
                          </select>
                          <select
                            value={en.plan_type || 'Course'}
                            onChange={async e => {
                              await onAction('admin_update_enrollment', {
                                enrollmentId: en.id,
                                userId: en.user_id,
                                courseId: en.course_id,
                                progressPct: en.progress_pct,
                                planType: e.target.value,
                              });
                            }}
                            style={{
                              border: '1px solid #D8D3C6',
                              borderRadius: 8,
                              padding: '6px 8px',
                              fontSize: 12,
                              fontWeight: 700,
                              background: '#F6F3EC',
                            }}
                          >
                            <option value="Course">Course</option>
                            <option value="Membership">Membership</option>
                            <option value="Free">Free</option>
                          </select>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            {en.progress_pct || 0}% done
                          </span>
                          <button
                            onClick={async () => {
                              const res = await onAction('admin_remove_enrollment', {
                                enrollmentId: en.id,
                                userId: en.user_id,
                                courseId: en.course_id,
                              });
                              if (res?.ok) {
                                setStudentCourseMsg('✓ Removed student from course!');
                                setTimeout(() => setStudentCourseMsg(''), 2500);
                              }
                            }}
                            style={{
                              border: 0,
                              background: '#FBE7E3',
                              color: '#C2412D',
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3B-PLANS: DEDICATED MULTIPLE PLANS, EGP PRICING, COURSE ACCESS & STUDENT COURSE ENROLLMENTS */}
          {route === 'plans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h1
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,3.6vw,40px)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    Plans, Pricing (EGP) &amp; Course Access
                  </h1>
                  <div style={{ color: '#5A6280' }}>
                    Add multiple membership/bundle plans, change EGP prices, choose which courses each plan unlocks, and add/change/delete students in courses.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {gwSavedMsg && (
                    <span
                      style={{
                        background: '#E3F3EA',
                        color: '#1E8A5A',
                        padding: '6px 14px',
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {gwSavedMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const currentPlans = Array.isArray(gwForm.subscriptions?.plans)
                        ? gwForm.subscriptions.plans
                        : [];
                      const newPlan = {
                        id: 'plan-' + Date.now(),
                        name: `SRI Research Bundle #${currentPlans.length + 1}`,
                        nameAr: `باقة بحثية #${currentPlans.length + 1}`,
                        badge: 'NEW PLAN',
                        price: 399,
                        currency: 'EGP',
                        period: 'month',
                        periodAr: 'شهرياً',
                        description: 'Full access to selected research methodology courses, templates, and quizzes.',
                        descriptionAr: 'وصول كامل للدورات المختارة في منهجيات البحث العلمي والقوالب والاختبارات.',
                        accessType: 'selected',
                        courseIds: courses.slice(0, 3).map((c: any) => c.id),
                        enabled: true,
                      };
                      const nextGw = {
                        ...gwForm,
                        subscriptions: {
                          ...gwForm.subscriptions,
                          plans: [...currentPlans, newPlan],
                        },
                      };
                      saveGatewayAndPlans(nextGw, '✓ Added new plan!');
                    }}
                    style={{
                      border: 0,
                      background: '#071A44',
                      color: '#F2B22E',
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    + Add New Pricing Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => saveGatewayAndPlans(gwForm, '✓ All plans & course access saved!')}
                    style={{
                      border: 0,
                      background: '#1E8A5A',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Save All Plans &amp; Prices
                  </button>
                </div>
              </div>

              {/* MULTIPLE PLANS LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(gwForm.subscriptions?.plans || []).map((plan: any, pIdx: number) => {
                  const updatePlan = (patch: Record<string, any>, autoPersist = false) => {
                    const nextPlans = [...(gwForm.subscriptions?.plans || [])];
                    nextPlans[pIdx] = { ...nextPlans[pIdx], ...patch };
                    const firstEnabled = nextPlans.find((x: any) => x.enabled !== false) || nextPlans[0];
                    const nextGw = {
                      ...gwForm,
                      subscriptions: {
                        ...gwForm.subscriptions,
                        monthlyPrice: firstEnabled ? Number(firstEnabled.price) || 199 : gwForm.subscriptions.monthlyPrice,
                        plans: nextPlans,
                      },
                    };
                    if (autoPersist) {
                      saveGatewayAndPlans(nextGw, '✓ Plan updated!');
                    } else {
                      setGwForm(nextGw);
                    }
                  };
                  const removePlan = () => {
                    const nextPlans = (gwForm.subscriptions?.plans || []).filter((_: any, i: number) => i !== pIdx);
                    const nextGw = {
                      ...gwForm,
                      subscriptions: {
                        ...gwForm.subscriptions,
                        plans: nextPlans,
                      },
                    };
                    saveGatewayAndPlans(nextGw, '✓ Plan deleted!');
                  };
                  const isAll = plan.accessType !== 'selected';
                  const selectedIds: string[] = Array.isArray(plan.courseIds) ? plan.courseIds : [];

                  return (
                    <div
                      key={plan.id || pIdx}
                      style={{
                        background: '#fff',
                        border: plan.enabled !== false ? '2px solid #0A2160' : '1.5px dashed #C7BFA9',
                        borderRadius: 18,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              background: '#071A44',
                              color: '#F2B22E',
                              fontWeight: 800,
                              fontSize: 11,
                              padding: '4px 10px',
                              borderRadius: 999,
                            }}
                          >
                            PLAN #{pIdx + 1}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>
                            {plan.name || 'Unnamed Plan'} — EGP {plan.price} / {plan.period || 'month'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => updatePlan({ enabled: !(plan.enabled !== false) }, true)}
                            style={{
                              border: 0,
                              borderRadius: 999,
                              padding: '6px 14px',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: plan.enabled !== false ? '#1E8A5A' : '#8A90A6',
                              color: '#fff',
                            }}
                          >
                            {plan.enabled !== false ? '✓ Active on Website & Checkout' : 'Hidden'}
                          </button>
                          <button
                            type="button"
                            onClick={removePlan}
                            style={{
                              border: 0,
                              borderRadius: 999,
                              padding: '6px 14px',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: '#FBE7E3',
                              color: '#C2412D',
                            }}
                          >
                            Delete Plan
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 10 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                          Plan Name (EN)
                          <input
                            value={plan.name || ''}
                            onChange={e => updatePlan({ name: e.target.value })}
                            onBlur={() => saveGatewayAndPlans(gwForm)}
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                          Price in EGP
                          <input
                            type="number"
                            value={plan.price ?? 199}
                            onChange={e => updatePlan({ price: Number(e.target.value) || 0 })}
                            onBlur={() => saveGatewayAndPlans(gwForm)}
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 14, fontWeight: 800, color: '#0A2160' }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                          Billing Period
                          <select
                            value={plan.period || 'month'}
                            onChange={e => {
                              const val = e.target.value;
                              const arMap: Record<string, string> = {
                                month: 'شهرياً',
                                term: 'فصل دراسي',
                                year: 'سنوياً',
                                'one-time': 'دفعة واحدة',
                              };
                              updatePlan({ period: val, periodAr: arMap[val] || val }, true);
                            }}
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13, background: '#fff' }}
                          >
                            <option value="month">Monthly (/ month)</option>
                            <option value="term">Academic Term (/ term)</option>
                            <option value="year">Annual (/ year)</option>
                            <option value="one-time">One-Time Bundle</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                          Badge Label
                          <input
                            value={plan.badge || ''}
                            onChange={e => updatePlan({ badge: e.target.value })}
                            onBlur={() => saveGatewayAndPlans(gwForm)}
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                          />
                        </label>
                        <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                          Description
                          <input
                            value={plan.description || ''}
                            onChange={e => updatePlan({ description: e.target.value })}
                            onBlur={() => saveGatewayAndPlans(gwForm)}
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                          />
                        </label>
                      </div>

                      {/* COURSE ACCESS CHECKBOXES FOR THIS PLAN */}
                      <div
                        style={{
                          background: '#F6F3EC',
                          border: '1px solid #E4DFD3',
                          borderRadius: 12,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: '#0A2160' }}>
                            Courses Unlocked by This Plan ({isAll ? `All ${courses.length} Courses` : `${selectedIds.length} Selected Courses`}):
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() =>
                                updatePlan(
                                  {
                                    accessType: 'all',
                                    courseIds: courses.map((c: any) => c.id),
                                  },
                                  true
                                )
                              }
                              style={{
                                border: isAll ? '1.5px solid #071A44' : '1px solid #D8D3C6',
                                background: isAll ? '#071A44' : '#fff',
                                color: isAll ? '#fff' : '#0E1736',
                                borderRadius: 999,
                                padding: '5px 12px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              All Courses ({courses.length})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePlan(
                                  {
                                    accessType: 'selected',
                                    courseIds: selectedIds.length > 0 ? selectedIds : [courses[0]?.id].filter(Boolean),
                                  },
                                  true
                                )
                              }
                              style={{
                                border: !isAll ? '1.5px solid #071A44' : '1px solid #D8D3C6',
                                background: !isAll ? '#071A44' : '#fff',
                                color: !isAll ? '#fff' : '#0E1736',
                                borderRadius: 999,
                                padding: '5px 12px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Selected Courses Only ({selectedIds.length})
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 8 }}>
                          {courses.map((co: any) => {
                            const checked = isAll || selectedIds.includes(co.id);
                            return (
                              <label
                                key={co.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: checked ? '1.5px solid #1446A0' : '1px solid #E4DFD3',
                                  background: checked ? '#F1F5FD' : '#fff',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    const nextChecked = e.target.checked;
                                    const baseList = isAll ? courses.map((x: any) => x.id) : selectedIds;
                                    const nextIds = nextChecked
                                      ? Array.from(new Set([...baseList, co.id]))
                                      : baseList.filter((id: string) => id !== co.id);
                                    updatePlan(
                                      {
                                        accessType: nextIds.length === courses.length ? 'all' : 'selected',
                                        courseIds: nextIds,
                                      },
                                      true
                                    );
                                  }}
                                />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {co.title}
                                </span>
                                <span style={{ fontSize: 11, color: '#5A6280', fontWeight: 700 }}>EGP {co.price}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* INDIVIDUAL COURSE PRICES (EGP) QUICK EDITOR */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 18,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>
                  Individual Course Prices in Egyptian Pounds (EGP)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
                  {courses.map((co: any) => (
                    <div
                      key={co.id}
                      style={{
                        border: '1px solid #E4DFD3',
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: '#FAF8F3',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {co.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#5A6280' }}>{co.studentsCount} students enrolled</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: '#0A2160' }}>
                        EGP
                        <input
                          type="number"
                          defaultValue={co.price}
                          onBlur={e =>
                            onAction('update_course', {
                              id: co.id,
                              price: Number(e.target.value) || 0,
                            })
                          }
                          style={{
                            width: 78,
                            border: '1px solid #D8D3C6',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 13,
                            fontWeight: 800,
                            background: '#fff',
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3B: COURSES & CATEGORIES */}
          {route === 'courses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Courses &amp; categories
                </h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setRoute('plans')}
                    style={{
                      background: '#F2B22E',
                      color: '#071A44',
                      border: 0,
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 19 }}>
                      workspace_premium
                    </span>
                    Plans &amp; Pricing (EGP)
                  </button>
                  <button
                    onClick={() => setShowNewCourseModal(true)}
                    style={{
                      background: '#071A44',
                      color: '#fff',
                      border: 0,
                      borderRadius: 999,
                      padding: '11px 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 19 }}>
                      add
                    </span>
                    New course
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div
                  style={{
                    flex: '2 1 520px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    overflow: 'hidden',
                  }}
                >
                  {courses.map((c: any, idx: number) => {
                    const totalLes = (c.modules || []).reduce((a: number, m: any) => a + (m.items?.length || 0), 0);
                    return (
                      <a
                        key={c.id}
                        href="#builder"
                        onClick={e => {
                          e.preventDefault();
                          setSelectedCourseId(c.id);
                          setTi(0);
                          setLi(0);
                          setRoute('builder');
                        }}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '12px 16px',
                          padding: '14px 18px',
                          borderTop: idx === 0 ? 'none' : '1px solid #F0ECE2',
                          color: '#0E1736',
                          textDecoration: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 72,
                            height: 44,
                            flex: 'none',
                            borderRadius: 8,
                            background: 'repeating-linear-gradient(135deg,#E9EEF7 0 6px,#DDE5F2 6px 12px)',
                            overflow: 'hidden',
                          }}
                        >
                          {c.coverImage && (
                            <img
                              src={c.coverImage}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            flex: '1 1 220px',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            lineHeight: 1.3,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{c.title}</span>
                          <span style={{ fontSize: 12, color: '#5A6280' }}>
                            {c.cat} · {totalLes || c.videos} lessons · {c.studentsCount} students
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 999,
                            background: c.status === 'Published' ? '#E3F3EA' : '#EEEAE0',
                            color: c.status === 'Published' ? '#1E8A5A' : '#5A6280',
                          }}
                        >
                          {c.status}
                        </span>
                        <span className="material-icon" style={{ fontSize: 20, color: '#8A90A6' }}>
                          chevron_right
                        </span>
                      </a>
                    );
                  })}
                </div>

                {/* CATEGORIES MANAGER */}
                <div
                  style={{
                    flex: '1 1 300px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Categories</div>
                  <div style={{ fontSize: 12, color: '#5A6280', marginTop: -6 }}>Click a name to rename it.</div>
                  {(state.categories || []).map((k: any) => {
                    const count = courses.filter((c: any) => c.categoryId === k.id).length;
                    return (
                      <div
                        key={k.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          border: '1px solid #E4DFD3',
                          borderRadius: 10,
                          padding: '4px 6px 4px 10px',
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 18, color: '#1446A0' }}>
                          label
                        </span>
                        <input
                          defaultValue={k.name}
                          onBlur={e => {
                            if (e.target.value.trim() && e.target.value !== k.name) {
                              onAction('rename_category', { id: k.id, name: e.target.value.trim() });
                            }
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: 0,
                            padding: '8px 4px',
                            fontSize: 14,
                            fontWeight: 600,
                            background: 'transparent',
                            color: '#0E1736',
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#5A6280', whiteSpace: 'nowrap' }}>{count} courses</span>
                        {canDelete && (
                          <button
                            onClick={() => onAction('delete_category', { id: k.id })}
                            style={{
                              border: 0,
                              background: 'none',
                              width: 32,
                              height: 32,
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              color: '#C2412D',
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 19 }}>
                              delete
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #D8D3C6',
                        borderRadius: 10,
                        padding: 11,
                        fontSize: 14,
                      }}
                    />
                    <button
                      onClick={async () => {
                        if (newCategoryName.trim()) {
                          await onAction('add_category', { name: newCategoryName.trim() });
                          setNewCategoryName('');
                        }
                      }}
                      style={{
                        border: 0,
                        background: '#F2B22E',
                        color: '#071A44',
                        borderRadius: 10,
                        padding: '0 16px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3C: COURSE BUILDER */}
          {route === 'builder' && activeCourse && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#5A6280', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a
                      href="#courses"
                      onClick={e => {
                        e.preventDefault();
                        setRoute('courses');
                      }}
                    >
                      Courses
                    </a>
                    <span>/</span>
                    <span>Edit · click a topic to open it</span>
                    <select
                      value={activeCourse.id}
                      onChange={e => {
                        setSelectedCourseId(e.target.value);
                        setTi(0);
                        setLi(0);
                      }}
                      style={{
                        border: '1px solid #D8D3C6',
                        borderRadius: 8,
                        padding: '4px 8px',
                        fontSize: 12,
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
                  <h1
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(26px,3.4vw,38px)',
                      margin: '2px 0 0',
                      lineHeight: 1.1,
                    }}
                  >
                    {activeCourse.title}
                  </h1>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {canDelete && (
                    <button
                      onClick={async () => {
                        await onAction('delete_course', { id: activeCourse.id });
                        setRoute('courses');
                      }}
                      style={{
                        border: '1.5px solid #E8C4BC',
                        background: '#fff',
                        color: '#C2412D',
                        borderRadius: 999,
                        padding: '10px 16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 18 }}>
                        delete
                      </span>
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onNavigatePortal('student', 'player', {
                        courseId: activeCourse.id,
                      })
                    }
                    style={{
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0E1736',
                    }}
                  >
                    Preview in Player
                  </button>
                  <button
                    onClick={() =>
                      onAction('update_course', {
                        id: activeCourse.id,
                        status: activeCourse.status === 'Published' ? 'Draft' : 'Published',
                      })
                    }
                    style={{
                      border: 0,
                      background: '#F2B22E',
                      color: '#071A44',
                      borderRadius: 999,
                      padding: '11px 20px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {activeCourse.status === 'Published' ? 'Published ✓' : 'Publish changes'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: '2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {mods.map((m: any, mIdx: number) => (
                    <div
                      key={m.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 16,
                        overflow: 'hidden',
                      }}
                    >
                      <a
                        href={`#topic/${mIdx}`}
                        onClick={e => {
                          e.preventDefault();
                          setTi(mIdx);
                          setLi(0);
                          setRoute('topic');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '14px 16px',
                          background: '#FAF8F3',
                          borderBottom: '1px solid #EEEAE0',
                          color: '#0E1736',
                          textDecoration: 'none',
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 20, color: '#B5B0A2' }}>
                          drag_indicator
                        </span>
                        <span style={{ fontWeight: 800, color: '#F2B22E' }}>{pad(mIdx + 1)}</span>
                        <span style={{ flex: 1, fontWeight: 700 }}>{m.t}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>{(m.items || []).length} items</span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#1446A0',
                          }}
                        >
                          Open
                          <span className="material-icon" style={{ fontSize: 18 }}>
                            chevron_right
                          </span>
                        </span>
                      </a>

                      {(m.items || []).map((l: any, lIdx: number) => {
                        const [icon, bg, fg] = LT[l.type] || LT.video;
                        return (
                          <a
                            key={l.id}
                            href={`#topic/${mIdx}`}
                            onClick={e => {
                              e.preventDefault();
                              setTi(mIdx);
                              setLi(lIdx);
                              setRoute('topic');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '11px 16px',
                              borderTop: '1px solid #F3F0E8',
                              color: '#0E1736',
                              textDecoration: 'none',
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 18, color: '#C9C4B6' }}>
                              drag_indicator
                            </span>
                            <span
                              className="material-icon"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: bg,
                                color: fg,
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 18,
                              }}
                            >
                              {icon}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                lineHeight: 1.3,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{l.t}</span>
                              <span style={{ fontSize: 12, color: '#8A90A6' }}>{lessonMetaDesc(l)}</span>
                            </span>
                            {l.free && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#1E8A5A' }}>Free preview</span>
                            )}
                            {l.type !== 'quiz' && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPreviewModalFile({
                                    title: l.t,
                                    url:
                                      l.type === 'video'
                                        ? l.videoUrl || '/files/sample-lecture.mp4'
                                        : l.fileUrl || '/files/pico-worksheet.pdf',
                                    ext: l.type === 'video' ? 'VIDEO' : 'PDF',
                                    meta: `${m.t} · ${l.d || 'Course File'}`,
                                  });
                                }}
                                style={{
                                  border: '1px solid #D3CDBF',
                                  background: '#F6F3EC',
                                  color: '#071A44',
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 14 }}>
                                  visibility
                                </span>
                                Preview
                              </button>
                            )}
                            <span className="material-icon" style={{ fontSize: 20, color: '#8A90A6' }}>
                              edit
                            </span>
                          </a>
                        );
                      })}

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          padding: '12px 16px',
                          borderTop: '1px solid #F3F0E8',
                        }}
                      >
                        <button
                          onClick={() =>
                            onAction('add_lesson', {
                              moduleId: m.id,
                              courseId: activeCourse.id,
                              type: 'video',
                            })
                          }
                          style={{
                            border: '1px dashed #B9C6E2',
                            background: '#F4F7FD',
                            borderRadius: 999,
                            padding: '7px 12px',
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#1446A0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            add
                          </span>
                          Video
                        </button>
                        <button
                          onClick={() =>
                            onAction('add_lesson', {
                              moduleId: m.id,
                              courseId: activeCourse.id,
                              type: 'pdf',
                            })
                          }
                          style={{
                            border: '1px dashed #E8C4BC',
                            background: '#FDF5F3',
                            borderRadius: 999,
                            padding: '7px 12px',
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#C2412D',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            add
                          </span>
                          PDF / file
                        </button>
                        <button
                          onClick={() =>
                            onAction('add_lesson', {
                              moduleId: m.id,
                              courseId: activeCourse.id,
                              type: 'quiz',
                            })
                          }
                          style={{
                            border: '1px dashed #E5CF95',
                            background: '#FDF8EA',
                            borderRadius: 999,
                            padding: '7px 12px',
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#8C6206',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            add
                          </span>
                          Quiz
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      onAction('add_module', {
                        courseId: activeCourse.id,
                        title: 'Untitled topic',
                      })
                    }
                    style={{
                      border: '2px dashed #D3CDBF',
                      background: 'transparent',
                      borderRadius: 16,
                      padding: 16,
                      fontWeight: 700,
                      color: '#5A6280',
                      cursor: 'pointer',
                    }}
                  >
                    + Add module
                  </button>
                </div>

                {/* COURSE DETAILS & PRICING SIDEBAR */}
                <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Details</div>
                    <label
                      style={{
                        aspectRatio: '16/9',
                        borderRadius: 10,
                        background: 'repeating-linear-gradient(135deg,#E9EEF7 0 10px,#DDE5F2 10px 20px)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
                      {activeCourse.coverImage ? (
                        <img
                          src={activeCourse.coverImage}
                          alt="Cover"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          background: 'rgba(7,26,68,.75)',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        click to upload cover image
                      </span>
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
                      Category
                      <select
                        value={activeCourse.categoryId}
                        onChange={e =>
                          onAction('update_course', {
                            id: activeCourse.id,
                            categoryId: e.target.value,
                          })
                        }
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 14,
                          background: '#fff',
                        }}
                      >
                        {(state.categories || []).map((o: any) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <a
                        href="#courses"
                        onClick={e => {
                          e.preventDefault();
                          setRoute('courses');
                        }}
                        style={{ fontSize: 12, fontWeight: 700 }}
                      >
                        Manage categories
                      </a>
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
                      Instructor
                      <input
                        key={activeCourse.id + '-mentor'}
                        defaultValue={activeCourse.mentor}
                        onBlur={e =>
                          onAction('update_course', {
                            id: activeCourse.id,
                            mentor: e.target.value,
                          })
                        }
                        style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14 }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Pricing</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                        One-time (EGP)
                        <input
                          key={activeCourse.id + '-price'}
                          defaultValue={activeCourse.price}
                          onBlur={e =>
                            onAction('update_course', {
                              id: activeCourse.id,
                              price: Number(e.target.value) || 0,
                            })
                          }
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: 10,
                            fontSize: 14,
                            minWidth: 0,
                          }}
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
                        Access
                        <select
                          value={activeCourse.accessDuration}
                          onChange={e =>
                            onAction('update_course', {
                              id: activeCourse.id,
                              accessDuration: e.target.value,
                            })
                          }
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: 10,
                            fontSize: 14,
                            background: '#fff',
                            minWidth: 0,
                          }}
                        >
                          <option>Lifetime</option>
                          <option>12 months</option>
                        </select>
                      </label>
                    </div>
                    <button
                      onClick={() =>
                        onAction('update_course', {
                          id: activeCourse.id,
                          includedInMembership: !activeCourse.includedInMembership,
                        })
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'none',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        color: '#0E1736',
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 99,
                          background: activeCourse.includedInMembership ? '#1446A0' : '#D3CDBF',
                          position: 'relative',
                          flex: 'none',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 3,
                            left: activeCourse.includedInMembership ? 19 : 3,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      </span>
                      Included in SRI Membership
                    </button>
                    <div style={{ fontSize: 12, color: '#5A6280' }}>
                      Pass mark for certificate: 70% on every quiz
                    </div>
                  </div>

                  {/* ENROLLED STUDENTS IN THIS COURSE (ADD / CHANGE / REMOVE) */}
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 16,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, color: '#0A2160' }}>Students in This Course</div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          background: '#E3ECFB',
                          color: '#1446A0',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {(state.enrollments || []).filter((e: any) => e.course_id === activeCourse.id).length} enrolled
                      </span>
                    </div>

                    {/* Add student to this course */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={builderStudentId || dbStudents[0]?.id || ''}
                        onChange={e => setBuilderStudentId(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: '1px solid #D8D3C6',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                          background: '#fff',
                        }}
                      >
                        {dbStudents.map((stu: any) => (
                          <option key={stu.id} value={stu.id}>
                            {stu.name} ({stu.email})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          const targetUid = builderStudentId || dbStudents[0]?.id;
                          if (!targetUid) return;
                          await onAction('admin_enroll_student', {
                            userId: targetUid,
                            courseId: activeCourse.id,
                            progressPct: 0,
                            planType: 'Course',
                          });
                        }}
                        style={{
                          border: 0,
                          background: '#071A44',
                          color: '#F2B22E',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        + Add Student
                      </button>
                    </div>

                    {/* List enrolled students in this course */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                      {(state.enrollments || [])
                        .filter((e: any) => e.course_id === activeCourse.id)
                        .map((enr: any) => {
                          const stu = (state.users || []).find((u: any) => u.id === enr.user_id);
                          return (
                            <div
                              key={enr.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                padding: '8px 10px',
                                background: '#F6F3EC',
                                borderRadius: 10,
                                fontSize: 12,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, color: '#0E1736', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stu?.name || enr.user_id}
                                </div>
                                <div style={{ fontSize: 11, color: '#5A6280' }}>{enr.progress_pct || 0}% progress</div>
                              </div>
                              <select
                                value={enr.progress_pct || 0}
                                onChange={e =>
                                  onAction('admin_update_enrollment', {
                                    enrollmentId: enr.id,
                                    progressPct: Number(e.target.value),
                                  })
                                }
                                style={{
                                  border: '1px solid #D8D3C6',
                                  borderRadius: 6,
                                  padding: '3px 6px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#fff',
                                }}
                              >
                                {[0, 25, 50, 75, 100].map(pct => (
                                  <option key={pct} value={pct}>
                                    {pct}%
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() =>
                                  onAction('admin_remove_enrollment', {
                                    enrollmentId: enr.id,
                                  })
                                }
                                title="Remove student from this course"
                                style={{
                                  border: 0,
                                  background: '#FBE7E3',
                                  color: '#C2412D',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      {(state.enrollments || []).filter((e: any) => e.course_id === activeCourse.id).length === 0 && (
                        <div style={{ fontSize: 12, color: '#8A90A6', textAlign: 'center', padding: '8px 0' }}>
                          No students enrolled yet. Select a student above to add them.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3D: TOPIC EDITOR */}
          {route === 'topic' && activeCourse && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#5A6280', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <a
                    href="#courses"
                    onClick={e => {
                      e.preventDefault();
                      setRoute('courses');
                    }}
                  >
                    Courses
                  </a>
                  <span>/</span>
                  <a
                    href="#builder"
                    onClick={e => {
                      e.preventDefault();
                      setRoute('builder');
                    }}
                  >
                    {activeCourse.title}
                  </a>
                  <span>/</span>
                  <span>Topic {pad(safeTi + 1)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setTi(Math.max(0, safeTi - 1));
                      setLi(0);
                    }}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 20 }}>
                      chevron_left
                    </span>
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                    Topic {safeTi + 1} of {mods.length}
                  </span>
                  <button
                    onClick={() => {
                      setTi(Math.min(mods.length - 1, safeTi + 1));
                      setLi(0);
                    }}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: '1.5px solid #D3CDBF',
                      background: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-icon" style={{ fontSize: 20 }}>
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#071A44',
                  color: '#fff',
                  borderRadius: 18,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 900, fontSize: 28, color: '#F2B22E' }}>{pad(safeTi + 1)}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: '#4BB4EC',
                    }}
                  >
                    Topic · {topicItems.length} lessons
                  </span>
                </div>
                <input
                  key={currentTopic.id + '-title'}
                  defaultValue={currentTopic.t}
                  onBlur={e =>
                    onAction('update_module', {
                      id: currentTopic.id,
                      title: e.target.value,
                    })
                  }
                  placeholder="Topic title"
                  style={{
                    border: 0,
                    borderBottom: '1.5px solid rgba(255,255,255,.2)',
                    background: 'transparent',
                    color: '#fff',
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 'clamp(24px,3vw,34px)',
                    padding: '4px 0 8px',
                    width: '100%',
                  }}
                />
                <textarea
                  key={currentTopic.id + '-desc'}
                  rows={2}
                  defaultValue={currentTopic.desc}
                  onBlur={e =>
                    onAction('update_module', {
                      id: currentTopic.id,
                      description: e.target.value,
                    })
                  }
                  placeholder="What will students learn in this topic?"
                  style={{
                    border: 0,
                    background: 'rgba(255,255,255,.06)',
                    borderRadius: 10,
                    color: 'rgba(255,255,255,.85)',
                    fontSize: 14,
                    padding: '10px 12px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Lessons</div>
                  {topicItems.map((l: any, j: number) => {
                    const [icon, ibg, fg] = LT[l.type] || LT.video;
                    const active = j === safeLi;
                    return (
                      <div
                        key={l.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: active ? '#F4F7FD' : '#fff',
                          border: `2px solid ${active ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 12,
                          padding: '8px 8px 8px 12px',
                        }}
                      >
                        <button
                          onClick={() => setLi(j)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: 0,
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: '#0E1736',
                          }}
                        >
                          <span
                            className="material-icon"
                            style={{
                              width: 32,
                              height: 32,
                              flex: 'none',
                              borderRadius: 8,
                              background: ibg,
                              color: fg,
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 18,
                            }}
                          >
                            {icon}
                          </span>
                          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{l.t}</span>
                            <span style={{ fontSize: 12, color: '#8A90A6' }}>{lessonMetaDesc(l)}</span>
                          </span>
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            onClick={() => {
                              if (j > 0) {
                                onAction('reorder_lesson', {
                                  moduleId: currentTopic.id,
                                  lessonId: l.id,
                                  direction: 'up',
                                });
                                setLi(j - 1);
                              }
                            }}
                            style={{
                              border: 0,
                              background: 'none',
                              width: 28,
                              height: 20,
                              cursor: 'pointer',
                              color: '#8A90A6',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 18 }}>
                              expand_less
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              if (j < topicItems.length - 1) {
                                onAction('reorder_lesson', {
                                  moduleId: currentTopic.id,
                                  lessonId: l.id,
                                  direction: 'down',
                                });
                                setLi(j + 1);
                              }
                            }}
                            style={{
                              border: 0,
                              background: 'none',
                              width: 28,
                              height: 20,
                              cursor: 'pointer',
                              color: '#8A90A6',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <span className="material-icon" style={{ fontSize: 18 }}>
                              expand_more
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={async () => {
                        await onAction('add_lesson', {
                          moduleId: currentTopic.id,
                          courseId: activeCourse.id,
                          type: 'video',
                        });
                        setLi(topicItems.length);
                      }}
                      style={{
                        border: '1px dashed #B9C6E2',
                        background: '#F4F7FD',
                        borderRadius: 999,
                        padding: '9px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#1446A0',
                        cursor: 'pointer',
                      }}
                    >
                      + Video
                    </button>
                    <button
                      onClick={async () => {
                        await onAction('add_lesson', {
                          moduleId: currentTopic.id,
                          courseId: activeCourse.id,
                          type: 'pdf',
                        });
                        setLi(topicItems.length);
                      }}
                      style={{
                        border: '1px dashed #E8C4BC',
                        background: '#FDF5F3',
                        borderRadius: 999,
                        padding: '9px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#C2412D',
                        cursor: 'pointer',
                      }}
                    >
                      + PDF / file
                    </button>
                    <button
                      onClick={async () => {
                        await onAction('add_lesson', {
                          moduleId: currentTopic.id,
                          courseId: activeCourse.id,
                          type: 'quiz',
                        });
                        setLi(topicItems.length);
                      }}
                      style={{
                        border: '1px dashed #E5CF95',
                        background: '#FDF8EA',
                        borderRadius: 999,
                        padding: '9px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#8C6206',
                        cursor: 'pointer',
                      }}
                    >
                      + Quiz
                    </button>
                  </div>

                  {canDelete && (
                    <button
                      onClick={async () => {
                        await onAction('delete_module', { id: currentTopic.id });
                        setRoute('builder');
                      }}
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 12,
                        border: 0,
                        background: 'none',
                        color: '#C2412D',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 0,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 18 }}>
                        delete
                      </span>
                      Delete this topic
                    </button>
                  )}
                </div>

                {/* LESSON DETAIL EDITOR */}
                <div
                  style={{
                    flex: '2 1 460px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {!currentLesson ? (
                    <div style={{ padding: '40px 10px', textAlign: 'center', color: '#5A6280' }}>
                      This topic is empty. Add a video, a PDF or a quiz to start.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          className="material-icon"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            background: LT[currentLesson.type][1],
                            color: LT[currentLesson.type][2],
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 20,
                          }}
                        >
                          {LT[currentLesson.type][0]}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            color: '#5A6280',
                          }}
                        >
                          {currentLesson.type === 'video'
                            ? 'Video lesson'
                            : currentLesson.type === 'pdf'
                            ? 'PDF / file'
                            : 'Quiz'}
                        </span>
                        <button
                          onClick={async () => {
                            await onAction('delete_lesson', { id: currentLesson.id });
                            setLi(Math.max(0, safeLi - 1));
                          }}
                          style={{
                            marginLeft: 'auto',
                            border: '1.5px solid #E8C4BC',
                            background: '#fff',
                            color: '#C2412D',
                            borderRadius: 999,
                            padding: '7px 12px',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
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
                          key={currentLesson.id + '-title'}
                          defaultValue={currentLesson.t}
                          onBlur={e =>
                            onAction('update_lesson', {
                              id: currentLesson.id,
                              title: e.target.value,
                            })
                          }
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 15,
                            color: '#0E1736',
                          }}
                        />
                      </label>

                      {currentLesson.type === 'video' && currentLesson.up && (
                        <>
                          <div
                            style={{
                              aspectRatio: '16/9',
                              background: '#050F2A',
                              borderRadius: 14,
                              overflow: 'hidden',
                              position: 'relative',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <video
                              src={currentLesson.videoUrl || '/files/sample-lecture.mp4'}
                              controls
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <label
                              style={{
                                border: '1.5px solid #D3CDBF',
                                background: '#fff',
                                borderRadius: 999,
                                padding: '9px 14px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                color: '#0E1736',
                              }}
                            >
                              <input
                                type="file"
                                accept="video/*"
                                onChange={e => handleLessonFileUpload(e, 'video')}
                                style={{ display: 'none' }}
                              />
                              {uploadingMedia ? 'Uploading...' : 'Replace video'}
                            </label>
                            <label
                              style={{
                                border: '1.5px solid #D3CDBF',
                                background: '#fff',
                                borderRadius: 999,
                                padding: '9px 14px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                color: '#0E1736',
                              }}
                            >
                              <input
                                type="file"
                                accept=".pdf,.ppt,.pptx,.doc,.docx"
                                onChange={e => handleLessonFileUpload(e, 'slides')}
                                style={{ display: 'none' }}
                              />
                              Attach slides PDF
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModalFile({
                                  title: `${currentLesson.t} — Attached Slides PDF`,
                                  url: currentLesson.slidesUrl || '/files/observational-slides.pdf',
                                  ext: 'PDF',
                                  meta: 'Lecture Slides & Handout PDF',
                                })
                              }
                              style={{
                                border: '1.5px solid #1446A0',
                                background: '#F4F7FD',
                                borderRadius: 999,
                                padding: '9px 14px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                color: '#1446A0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <span className="material-icon" style={{ fontSize: 16 }}>
                                visibility
                              </span>
                              Preview Slides PDF
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModalFile({
                                  title: currentLesson.t,
                                  url: currentLesson.videoUrl || '/files/sample-lecture.mp4',
                                  ext: 'VIDEO',
                                  meta: `${currentLesson.d || 'Video Lesson'}`,
                                })
                              }
                              style={{
                                border: 0,
                                background: '#071A44',
                                color: '#fff',
                                borderRadius: 999,
                                padding: '9px 14px',
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
                              Full Video Preview
                            </button>
                          </div>
                        </>
                      )}

                      {currentLesson.type === 'video' && !currentLesson.up && (
                        <>
                          <label
                            style={{
                              aspectRatio: '16/9',
                              border: '2px dashed #B9C6E2',
                              background: '#F4F7FD',
                              borderRadius: 14,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              color: '#0E1736',
                              width: '100%',
                            }}
                          >
                            <input
                              type="file"
                              accept="video/*"
                              onChange={e => handleLessonFileUpload(e, 'video')}
                              style={{ display: 'none' }}
                            />
                            <span className="material-icon" style={{ fontSize: 40, color: '#1446A0' }}>
                              upload
                            </span>
                            <span style={{ fontWeight: 700 }}>{uploadingMedia ? 'Uploading...' : 'Upload video'}</span>
                            <span style={{ fontSize: 12, color: '#5A6280' }}>MP4 or MOV, up to 2 GB</span>
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Default Video Preview (shown until custom video is uploaded):
                            </div>
                            <video
                              src={currentLesson.videoUrl || '/files/sample-lecture.mp4'}
                              controls
                              style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, background: '#050F2A' }}
                            />
                          </div>
                        </>
                      )}

                      {currentLesson.type === 'pdf' && (
                        <>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              background: '#F6F3EC',
                              borderRadius: 12,
                              padding: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 10,
                                background: '#FBE7E3',
                                color: '#C2412D',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              PDF
                            </span>
                            <span style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{currentLesson.t}.pdf</span>
                              <span style={{ fontSize: 12, color: '#5A6280' }}>
                                {currentLesson.d} · students can preview &amp; download
                              </span>
                            </span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewModalFile({
                                    title: currentLesson.t,
                                    url: currentLesson.fileUrl || '/files/pico-worksheet.pdf',
                                    ext: 'PDF',
                                    meta: `${currentLesson.d} · Topic PDF Document`,
                                  })
                                }
                                style={{
                                  border: 0,
                                  background: '#071A44',
                                  color: '#fff',
                                  borderRadius: 999,
                                  padding: '8px 14px',
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
                              <a
                                href={currentLesson.fileUrl || '/files/pico-worksheet.pdf'}
                                download
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  border: '1.5px solid #D3CDBF',
                                  background: '#fff',
                                  borderRadius: 999,
                                  padding: '8px 12px',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  color: '#0E1736',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 16 }}>
                                  download
                                </span>
                                Download
                              </a>
                              <label
                                style={{
                                  border: '1.5px solid #1446A0',
                                  background: '#F4F7FD',
                                  borderRadius: 999,
                                  padding: '8px 12px',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  color: '#1446A0',
                                }}
                              >
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                                  onChange={e => handleLessonFileUpload(e, 'pdf')}
                                  style={{ display: 'none' }}
                                />
                                {uploadingMedia ? 'Uploading...' : currentLesson.up ? 'Replace PDF' : 'Upload PDF'}
                              </label>
                            </div>
                          </div>
                          <iframe
                            src={currentLesson.fileUrl || '/files/pico-worksheet.pdf'}
                            title={currentLesson.t}
                            style={{
                              width: '100%',
                              height: 360,
                              border: '1px solid #E4DFD3',
                              borderRadius: 12,
                              background: '#fff',
                            }}
                          />
                        </>
                      )}

                      {currentLesson.type === 'quiz' && (
                        <div
                          style={{
                            background: '#FDF8EA',
                            border: '1px solid #F1E2B8',
                            borderRadius: 14,
                            padding: 18,
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 800, fontSize: 18 }}>
                              {(currentLesson.questions || []).length} questions
                            </span>
                            <span style={{ fontSize: 13, color: '#5A6280' }}>
                              Pass mark {currentLesson.passMark || 70}% · {currentLesson.timeLimitMin || 15} min ·{' '}
                              {currentLesson.attemptsAllowed || 'unlimited'} attempts
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setQkey(currentLesson.id);
                              setRoute('quizzes');
                            }}
                            style={{
                              border: 0,
                              background: '#071A44',
                              color: '#fff',
                              borderRadius: 999,
                              padding: '11px 18px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Edit questions
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() =>
                          onAction('update_lesson', {
                            id: currentLesson.id,
                            isFreePreview: !currentLesson.free,
                          })
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: 'none',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          color: '#0E1736',
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            width: 38,
                            height: 22,
                            borderRadius: 99,
                            background: currentLesson.free ? '#1446A0' : '#D3CDBF',
                            position: 'relative',
                            flex: 'none',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 3,
                              left: currentLesson.free ? 19 : 3,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: '#fff',
                            }}
                          />
                        </span>
                        Free preview: visitors can watch this without buying
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3E: MEDIA LIBRARY */}
          {route === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Media library
                </h1>
                <div style={{ color: '#5A6280' }}>
                  Every video and file across your courses. Add new ones from inside a topic.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(
                  [
                    ['video', 'Videos'],
                    ['pdf', 'PDFs & files'],
                  ] as const
                ).map(([k, label]) => {
                  const active = mediaTab === k;
                  const count = mediaAll.filter(x => x.l.type === k).length;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        setMediaTab(k);
                        setMsel(null);
                      }}
                      style={{
                        border: `1.5px solid ${active ? '#071A44' : '#E4DFD3'}`,
                        background: active ? '#071A44' : '#fff',
                        color: active ? '#fff' : '#0E1736',
                        borderRadius: 999,
                        padding: '8px 16px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {label} · {count}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 20, alignItems: 'flex-start' }}>
                <div
                  style={{
                    flex: '1.4 1 420px',
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,200px),1fr))',
                    gap: 12,
                  }}
                >
                  {mediaFiltered.map(x => {
                    const isSelected = selectedMedia && x.l.id === selectedMedia.l.id;
                    return (
                      <button
                        key={x.l.id}
                        onClick={() => setMsel(x.l.id)}
                        style={{
                          textAlign: 'left',
                          background: '#fff',
                          border: `2px solid ${isSelected ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 14,
                          overflow: 'hidden',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#0E1736',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: '16/9',
                            width: '100%',
                            background: x.l.type === 'video' ? '#071A44' : '#FBE7E3',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <span
                            className="material-icon"
                            style={{
                              fontSize: 32,
                              color: x.l.type === 'video' ? 'rgba(255,255,255,.75)' : '#C2412D',
                            }}
                          >
                            {x.l.type === 'video' ? 'play_circle' : 'description'}
                          </span>
                        </div>
                        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{x.l.t}</span>
                          <span style={{ fontSize: 11, color: '#5A6280' }}>
                            Topic {pad(x.mi + 1)} · {x.m.t}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: x.l.up ? '#5A6280' : '#C2412D' }}>
                            {x.l.up ? x.l.d : 'Not uploaded'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedMedia && (
                  <div
                    style={{
                      flex: '1 1 340px',
                      minWidth: 0,
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 18,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      position: 'sticky',
                      top: 80,
                    }}
                  >
                    {selectedMedia.l.type === 'video' ? (
                      <video
                        src={selectedMedia.l.videoUrl || '/files/sample-lecture.mp4'}
                        controls
                        style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, background: '#050F2A' }}
                      />
                    ) : (
                      <iframe
                        src={selectedMedia.l.fileUrl || '/files/pico-worksheet.pdf'}
                        title={selectedMedia.l.t}
                        style={{
                          width: '100%',
                          aspectRatio: '4/3',
                          border: '1px solid #E4DFD3',
                          borderRadius: 12,
                        }}
                      />
                    )}
                    <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{selectedMedia.l.t}</div>
                    <div style={{ fontSize: 13, color: '#5A6280' }}>
                      {selectedMedia.c.title} · Topic {pad(selectedMedia.mi + 1)} · {selectedMedia.l.d}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        onClick={() =>
                          setPreviewModalFile({
                            title: selectedMedia.l.t,
                            url:
                              selectedMedia.l.type === 'video'
                                ? selectedMedia.l.videoUrl || '/files/sample-lecture.mp4'
                                : selectedMedia.l.fileUrl || '/files/pico-worksheet.pdf',
                            ext: selectedMedia.l.type === 'video' ? 'VIDEO' : 'PDF',
                            meta: `${selectedMedia.c.title} · Topic ${pad(selectedMedia.mi + 1)} · ${selectedMedia.l.d}`,
                          })
                        }
                        style={{
                          background: '#1446A0',
                          color: '#fff',
                          border: 0,
                          borderRadius: 999,
                          padding: '9px 14px',
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
                        Full Screen Preview
                      </button>
                      <a
                        href={
                          selectedMedia.l.type === 'video'
                            ? selectedMedia.l.videoUrl || '/files/sample-lecture.mp4'
                            : selectedMedia.l.fileUrl || '/files/pico-worksheet.pdf'
                        }
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          border: '1.5px solid #D3CDBF',
                          background: '#fff',
                          color: '#0E1736',
                          borderRadius: 999,
                          padding: '9px 14px',
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 16 }}>
                          download
                        </span>
                        Download
                      </a>
                      <button
                        onClick={() => {
                          setSelectedCourseId(selectedMedia.c.id);
                          setTi(selectedMedia.mi);
                          setRoute('topic');
                        }}
                        style={{
                          background: '#071A44',
                          color: '#fff',
                          border: 0,
                          borderRadius: 999,
                          padding: '9px 14px',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Open topic to edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 3F: QUIZZES EDITOR & RESULTS */}
          {route === 'quizzes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Quizzes
                </h1>
                <div style={{ color: '#5A6280' }}>
                  Write questions, mark the right answer, and see how students scored.
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quizList.map(x => {
                    const active = activeQuizEntry && x.l.id === activeQuizEntry.l.id;
                    return (
                      <button
                        key={x.l.id}
                        onClick={() => setQkey(x.l.id)}
                        style={{
                          textAlign: 'left',
                          background: '#fff',
                          border: `2px solid ${active ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                          cursor: 'pointer',
                          color: '#0E1736',
                        }}
                      >
                        <span
                          className="material-icon"
                          style={{
                            width: 36,
                            height: 36,
                            flex: 'none',
                            borderRadius: 9,
                            background: '#FCF1D6',
                            color: '#8C6206',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 20,
                          }}
                        >
                          quiz
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{x.l.t}</span>
                          <span style={{ fontSize: 12, color: '#5A6280' }}>
                            Topic {pad(x.mi + 1)} · {x.m.t}
                          </span>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6280', whiteSpace: 'nowrap' }}>
                          {(x.l.questions || []).length} questions
                        </span>
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 12, color: '#5A6280', padding: 4 }}>
                    To add a quiz, open a topic and press &quot;+ Quiz&quot;.
                  </div>
                </div>

                {activeQuizEntry && (
                  <div
                    style={{
                      flex: '2.2 1 480px',
                      minWidth: 0,
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 18,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        key={activeQuizEntry.l.id + '-qztitle'}
                        defaultValue={activeQuizEntry.l.t}
                        onBlur={e =>
                          onAction('update_lesson', {
                            id: activeQuizEntry.l.id,
                            title: e.target.value,
                          })
                        }
                        style={{
                          border: 0,
                          fontWeight: 800,
                          fontSize: 20,
                          padding: 0,
                          color: '#0E1736',
                          background: 'transparent',
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#5A6280' }}>
                        <a
                          href="#topic"
                          onClick={e => {
                            e.preventDefault();
                            setSelectedCourseId(activeQuizEntry.c.id);
                            setTi(activeQuizEntry.mi);
                            setRoute('topic');
                          }}
                        >
                          {activeQuizEntry.c.title} · Topic {pad(activeQuizEntry.mi + 1)} · {activeQuizEntry.m.t}
                        </a>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '10px 0 4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                          Pass mark
                          <select
                            value={activeQuizEntry.l.passMark || 70}
                            onChange={e =>
                              onAction('update_lesson', {
                                id: activeQuizEntry.l.id,
                                passMark: Number(e.target.value),
                              })
                            }
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 7, fontSize: 13, background: '#fff' }}
                          >
                            <option value={70}>70%</option>
                            <option value={60}>60%</option>
                            <option value={80}>80%</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                          Time limit
                          <select
                            value={activeQuizEntry.l.timeLimitMin || 15}
                            onChange={e =>
                              onAction('update_lesson', {
                                id: activeQuizEntry.l.id,
                                timeLimitMin: Number(e.target.value),
                              })
                            }
                            style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 7, fontSize: 13, background: '#fff' }}
                          >
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                          </select>
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4DFD3', margin: '0 -20px', padding: '0 20px' }}>
                        {(
                          [
                            ['q', `Questions · ${activeQuizQuestions.length}`],
                            ['r', 'Results'],
                          ] as const
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => setQtab(k)}
                            style={{
                              background: 'none',
                              border: 0,
                              borderBottom: `2.5px solid ${qtab === k ? '#1446A0' : 'transparent'}`,
                              padding: '12px 12px',
                              fontWeight: 700,
                              fontSize: 13,
                              color: qtab === k ? '#0E1736' : '#5A6280',
                              cursor: 'pointer',
                              marginBottom: -1,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {qtab === 'q' ? (
                      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* PASTE FROM CHATGPT — SMART AI QUIZ IMPORTER */}
                        <div
                          style={{
                            border: '2px solid #1446A0',
                            borderRadius: 16,
                            background: 'linear-gradient(180deg, #F4F7FD 0%, #FFFFFF 100%)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            onClick={() => setShowChatGptBox(!showChatGptBox)}
                            style={{
                              padding: '14px 18px',
                              background: '#071A44',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              cursor: 'pointer',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                className="material-icon"
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  background: '#F2B22E',
                                  color: '#071A44',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 20,
                                }}
                              >
                                auto_awesome
                              </span>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  Paste Questions from ChatGPT (Smart AI Quiz Importer)
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      background: '#1E8A5A',
                                      color: '#fff',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Auto-Detect
                                  </span>
                                </div>
                                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.76)' }}>
                                  Paste any multiple-choice questions from ChatGPT (English or Arabic) — automatically extracts questions, choices (A–D), and the right answer!
                                </div>
                              </div>
                            </div>
                            <span className="material-icon" style={{ fontSize: 22, color: '#F2B22E' }}>
                              {showChatGptBox ? 'expand_less' : 'expand_more'}
                            </span>
                          </div>

                          {showChatGptBox && (
                            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const promptText = `Write 5 multiple-choice quiz questions about "${activeQuizEntry.m.t}" (${activeQuizEntry.c.title}). For each question, provide 4 choices (A, B, C, D) and indicate the correct answer on a line starting with "Answer: X" and a short "Explanation: ...".`;
                                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                        navigator.clipboard.writeText(promptText);
                                        setPromptCopiedMsg('✓ ChatGPT prompt copied! Paste it into ChatGPT, then paste the reply below.');
                                        setTimeout(() => setPromptCopiedMsg(''), 4000);
                                      }
                                    }}
                                    style={{
                                      border: '1.5px solid #1446A0',
                                      background: '#fff',
                                      color: '#1446A0',
                                      borderRadius: 999,
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5,
                                    }}
                                  >
                                    <span className="material-icon" style={{ fontSize: 15 }}>
                                      content_copy
                                    </span>
                                    Copy Prompt for ChatGPT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sample = `1. Which study design starts with an outcome (disease) and looks backward in time for exposures?
A) Prospective cohort study
B) Case-control study
C) Randomized controlled trial
D) Cross-sectional survey
Answer: B
Explanation: Case-control studies select cases with the outcome and controls without it, then look retrospectively at prior exposures.

2. In the PICO framework for clinical research questions, what does the letter "C" stand for?
A) Clinical setting
B) Cohort size
C) Comparison or Control group
D) Confidence interval
Answer: C
Explanation: PICO stands for Population/Patient, Intervention, Comparison/Control, and Outcome.

3. Which statistical measure of association is primarily calculated in a Case-Control study?
A) Odds Ratio (OR) ✅
B) Relative Risk (RR)
C) Hazard Ratio (HR)
D) Number Needed to Treat (NNT)`;
                                      setChatGptRawText(sample);
                                      setParsedChatGptQuestions(parseChatGptQuizText(sample));
                                    }}
                                    style={{
                                      border: '1.5px solid #D3CDBF',
                                      background: '#FAF8F3',
                                      color: '#0E1736',
                                      borderRadius: 999,
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5,
                                    }}
                                  >
                                    <span className="material-icon" style={{ fontSize: 15 }}>
                                      science
                                    </span>
                                    Load Sample ChatGPT Text
                                  </button>
                                  {chatGptRawText && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setChatGptRawText('');
                                        setParsedChatGptQuestions([]);
                                      }}
                                      style={{
                                        border: 0,
                                        background: '#FBE7E3',
                                        color: '#C2412D',
                                        borderRadius: 999,
                                        padding: '6px 12px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                {promptCopiedMsg && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E8A5A' }}>{promptCopiedMsg}</span>
                                )}
                                {quizImportMsg && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 800,
                                      background: '#E3F3EA',
                                      color: '#1E8A5A',
                                      padding: '4px 12px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    {quizImportMsg}
                                  </span>
                                )}
                              </div>

                              <textarea
                                rows={7}
                                value={chatGptRawText}
                                onChange={e => {
                                  const val = e.target.value;
                                  setChatGptRawText(val);
                                  setParsedChatGptQuestions(parseChatGptQuizText(val));
                                }}
                                placeholder={`Paste questions directly from ChatGPT here...\n\nExample formats supported automatically:\n1. What is the gold standard design for evaluating a new drug?\nA) Case series\nB) Cross-sectional study\nC) Randomized Controlled Trial (RCT)\nD) Ecological study\nAnswer: C\n\n(Also supports ✅, ✓, (Correct), *B), Arabic أ/ب/ج/د + الإجابة الصحيحة, or JSON)`}
                                style={{
                                  width: '100%',
                                  border: '1.5px solid #B9C6E2',
                                  borderRadius: 12,
                                  padding: 12,
                                  fontSize: 13,
                                  fontFamily: "'Montserrat', sans-serif",
                                  lineHeight: 1.5,
                                  background: '#fff',
                                  color: '#0E1736',
                                  resize: 'vertical',
                                }}
                              />

                              {/* PARSED PREVIEW & TRANSFER ACTIONS */}
                              {parsedChatGptQuestions.length > 0 ? (
                                <div
                                  style={{
                                    background: '#fff',
                                    border: '1.5px solid #A8D9BF',
                                    borderRadius: 14,
                                    padding: 14,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span
                                        style={{
                                          background: '#E3F3EA',
                                          color: '#1E8A5A',
                                          fontWeight: 800,
                                          fontSize: 12,
                                          padding: '4px 10px',
                                          borderRadius: 999,
                                        }}
                                      >
                                        ✓ {parsedChatGptQuestions.length}{' '}
                                        {parsedChatGptQuestions.length === 1 ? 'Question' : 'Questions'} Understood
                                      </span>
                                      <span style={{ fontSize: 12, color: '#5A6280' }}>
                                        Review detected choices &amp; right answers below (click A–D to adjust if needed):
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const newItems = parsedChatGptQuestions.map((pq, idx) => ({
                                            id: `q-gpt-${Date.now()}-${idx}`,
                                            text: pq.text,
                                            opts: pq.opts,
                                            a: pq.a,
                                            explanation: pq.explanation || '',
                                          }));
                                          const combined = [...activeQuizQuestions, ...newItems];
                                          await onAction('save_quiz_questions', {
                                            lessonId: activeQuizEntry.l.id,
                                            questions: combined,
                                          });
                                          setQuizImportMsg(`✓ Added ${newItems.length} questions to "${activeQuizEntry.l.t}"!`);
                                          setChatGptRawText('');
                                          setParsedChatGptQuestions([]);
                                          setTimeout(() => setQuizImportMsg(''), 4500);
                                        }}
                                        style={{
                                          border: 0,
                                          background: '#1E8A5A',
                                          color: '#fff',
                                          borderRadius: 999,
                                          padding: '9px 16px',
                                          fontWeight: 800,
                                          fontSize: 12.5,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                        }}
                                      >
                                        <span className="material-icon" style={{ fontSize: 17 }}>
                                          add_task
                                        </span>
                                        Transfer &amp; Add to Quiz (+{parsedChatGptQuestions.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const newItems = parsedChatGptQuestions.map((pq, idx) => ({
                                            id: `q-gpt-${Date.now()}-${idx}`,
                                            text: pq.text,
                                            opts: pq.opts,
                                            a: pq.a,
                                            explanation: pq.explanation || '',
                                          }));
                                          await onAction('save_quiz_questions', {
                                            lessonId: activeQuizEntry.l.id,
                                            questions: newItems,
                                          });
                                          setQuizImportMsg(`✓ Replaced quiz with ${newItems.length} ChatGPT questions!`);
                                          setChatGptRawText('');
                                          setParsedChatGptQuestions([]);
                                          setTimeout(() => setQuizImportMsg(''), 4500);
                                        }}
                                        style={{
                                          border: '1.5px solid #071A44',
                                          background: '#071A44',
                                          color: '#F2B22E',
                                          borderRadius: 999,
                                          padding: '9px 16px',
                                          fontWeight: 800,
                                          fontSize: 12.5,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                        }}
                                      >
                                        <span className="material-icon" style={{ fontSize: 17 }}>
                                          swap_horiz
                                        </span>
                                        Replace All Quiz Questions ({parsedChatGptQuestions.length})
                                      </button>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 8,
                                      maxHeight: 300,
                                      overflowY: 'auto',
                                      paddingRight: 4,
                                    }}
                                  >
                                    {parsedChatGptQuestions.map((pq, pIdx) => (
                                      <div
                                        key={pIdx}
                                        style={{
                                          background: '#FAF8F3',
                                          border: '1px solid #E4DFD3',
                                          borderRadius: 10,
                                          padding: '10px 12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 6,
                                        }}
                                      >
                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0E1736' }}>
                                          <span style={{ color: '#1446A0', fontWeight: 800, marginRight: 6 }}>
                                            Q{pIdx + 1}.
                                          </span>
                                          {pq.text}
                                        </div>
                                        <div
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                            gap: 6,
                                          }}
                                        >
                                          {pq.opts.map((opt, oIdx) => {
                                            const isRight = pq.a === oIdx;
                                            return (
                                              <button
                                                key={oIdx}
                                                type="button"
                                                onClick={() => {
                                                  setParsedChatGptQuestions(prev =>
                                                    prev.map((item, ii) => (ii === pIdx ? { ...item, a: oIdx } : item))
                                                  );
                                                }}
                                                style={{
                                                  textAlign: 'left',
                                                  border: `1.5px solid ${isRight ? '#1E8A5A' : '#E4DFD3'}`,
                                                  background: isRight ? '#E3F3EA' : '#fff',
                                                  color: isRight ? '#145E3D' : '#3A4260',
                                                  borderRadius: 8,
                                                  padding: '5px 8px',
                                                  fontSize: 12,
                                                  fontWeight: isRight ? 700 : 500,
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 6,
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: '50%',
                                                    background: isRight ? '#1E8A5A' : '#EEEAE0',
                                                    color: isRight ? '#fff' : '#5A6280',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    fontSize: 10,
                                                    fontWeight: 800,
                                                    flex: 'none',
                                                  }}
                                                >
                                                  {'ABCD'[oIdx]}
                                                </span>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {opt}
                                                </span>
                                                {isRight && (
                                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1E8A5A' }}>✓</span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                chatGptRawText.trim().length > 0 && (
                                  <div style={{ fontSize: 12, color: '#C2412D', fontWeight: 600 }}>
                                    Keep typing or paste questions with choices (A, B, C, D) and an Answer line so they can be parsed automatically.
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {activeQuizQuestions.length === 0 && (
                          <div style={{ padding: 24, textAlign: 'center', color: '#5A6280' }}>No questions yet.</div>
                        )}
                        {activeQuizQuestions.map((q: any, qIdx: number) => (
                          <div
                            key={`${q.id || qIdx}-${q.text?.slice(0, 20)}`}
                            style={{
                              border: '1px solid #E4DFD3',
                              borderRadius: 14,
                              padding: 14,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ fontWeight: 900, color: '#F2B22E', fontSize: 16, paddingTop: 8, minWidth: 22 }}>
                                {qIdx + 1}
                              </span>
                              <textarea
                                key={`${q.id || qIdx}-text-${q.text}`}
                                rows={2}
                                defaultValue={q.text}
                                onBlur={e => {
                                  const next = activeQuizQuestions.map((item: any, idx: number) =>
                                    idx === qIdx ? { ...item, text: e.target.value } : item
                                  );
                                  onAction('save_quiz_questions', {
                                    lessonId: activeQuizEntry.l.id,
                                    questions: next,
                                  });
                                }}
                                placeholder="Type the question"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  border: '1px solid #D8D3C6',
                                  borderRadius: 10,
                                  padding: 10,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  resize: 'vertical',
                                  color: '#0E1736',
                                }}
                              />
                              <button
                                onClick={() => {
                                  const next = activeQuizQuestions.filter((_: any, idx: number) => idx !== qIdx);
                                  onAction('save_quiz_questions', {
                                    lessonId: activeQuizEntry.l.id,
                                    questions: next,
                                  });
                                }}
                                style={{
                                  border: 0,
                                  background: 'none',
                                  width: 34,
                                  height: 34,
                                  display: 'grid',
                                  placeItems: 'center',
                                  cursor: 'pointer',
                                  color: '#C2412D',
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 20 }}>
                                  delete
                                </span>
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                                gap: 8,
                                paddingLeft: 32,
                              }}
                            >
                              {(q.opts || []).map((optText: string, oIdx: number) => {
                                const isCorrect = q.a === oIdx;
                                return (
                                  <div
                                    key={`${q.id || qIdx}-opt-${oIdx}-${optText}`}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      border: `1.5px solid ${isCorrect ? '#A8D9BF' : '#E4DFD3'}`,
                                      borderRadius: 10,
                                      padding: '4px 4px 4px 6px',
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        const next = activeQuizQuestions.map((item: any, idx: number) =>
                                          idx === qIdx ? { ...item, a: oIdx } : item
                                        );
                                        onAction('save_quiz_questions', {
                                          lessonId: activeQuizEntry.l.id,
                                          questions: next,
                                        });
                                      }}
                                      title="Mark as correct"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        flex: 'none',
                                        borderRadius: '50%',
                                        border: `2px solid ${isCorrect ? '#1E8A5A' : '#D8D3C6'}`,
                                        background: isCorrect ? '#1E8A5A' : '#fff',
                                        color: isCorrect ? '#fff' : '#5A6280',
                                        fontWeight: 800,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        display: 'grid',
                                        placeItems: 'center',
                                      }}
                                    >
                                      {'ABCD'[oIdx]}
                                    </button>
                                    <input
                                      defaultValue={optText}
                                      onBlur={e => {
                                        const next = activeQuizQuestions.map((item: any, idx: number) => {
                                          if (idx !== qIdx) return item;
                                          const newOpts = [...(item.opts || [])];
                                          newOpts[oIdx] = e.target.value;
                                          return { ...item, opts: newOpts };
                                        });
                                        onAction('save_quiz_questions', {
                                          lessonId: activeQuizEntry.l.id,
                                          questions: next,
                                        });
                                      }}
                                      placeholder="Answer option"
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        border: 0,
                                        padding: '8px 4px',
                                        fontSize: 13,
                                        background: 'transparent',
                                        color: '#0E1736',
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              const next = [
                                ...activeQuizQuestions,
                                { text: 'New research question?', opts: ['Option A', 'Option B', 'Option C', 'Option D'], a: 0 },
                              ];
                              onAction('save_quiz_questions', {
                                lessonId: activeQuizEntry.l.id,
                                questions: next,
                              });
                            }}
                            style={{
                              border: '2px dashed #D3CDBF',
                              background: 'transparent',
                              borderRadius: 12,
                              padding: '12px 18px',
                              fontWeight: 700,
                              color: '#5A6280',
                              cursor: 'pointer',
                            }}
                          >
                            + Add question
                          </button>
                          <span style={{ fontSize: 12, color: '#5A6280' }}>
                            Click a letter to mark the correct answer.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <div style={{ minWidth: 480 }}>
                          {(state.quizAttempts || []).map((x: any, idx: number) => (
                            <div
                              key={x.id || idx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.6fr .7fr 1fr 1fr',
                                gap: 10,
                                alignItems: 'center',
                                padding: '12px 20px',
                                borderTop: '1px solid #F0ECE2',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{x.user_name}</span>
                              <span style={{ fontWeight: 800 }}>{x.score_pct}%</span>
                              <span style={{ color: '#5A6280', fontSize: 13 }}>
                                {x.attempt_num} {x.attempt_num > 1 ? 'attempts' : 'attempt'}
                              </span>
                              <span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '3px 9px',
                                    borderRadius: 999,
                                    background: x.passed ? '#E3F3EA' : '#FBE7E3',
                                    color: x.passed ? '#1E8A5A' : '#C2412D',
                                  }}
                                >
                                  {x.passed ? 'Passed' : 'Not passed'}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 3G: STUDENTS */}
          {route === 'students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h1
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,3.6vw,40px)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    Students
                  </h1>
                  <div style={{ color: '#5A6280' }}>
                    {filteredStudents.length} of {enrichedStudents.length} students
                  </div>
                </div>
                <button
                  onClick={handleExportStudentsCsv}
                  style={{
                    border: '1.5px solid #D3CDBF',
                    background: '#fff',
                    borderRadius: 999,
                    padding: '10px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#0E1736',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 18 }}>
                    download
                  </span>
                  Export CSV
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div
                  style={{
                    flex: '1 1 260px',
                    maxWidth: 420,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 10,
                    padding: '0 12px',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 20, color: '#8A90A6' }}>
                    search
                  </span>
                  <input
                    value={sSearch}
                    onChange={e => setSSearch(e.target.value)}
                    placeholder="Name, student ID or faculty"
                    style={{ flex: 1, minWidth: 0, border: 0, padding: '11px 0', fontSize: 14, background: 'transparent' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['All', 'Membership', 'Course', 'Free'].map(p => {
                    const active = sPlanFilter === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setSPlanFilter(p)}
                        style={{
                          border: `1.5px solid ${active ? '#071A44' : '#E4DFD3'}`,
                          background: active ? '#071A44' : '#fff',
                          color: active ? '#fff' : '#0E1736',
                          borderRadius: 999,
                          padding: '7px 14px',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div
                  style={{
                    flex: '1 1 380px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    overflow: 'hidden',
                  }}
                >
                  {filteredStudents.map(({ u, idx }: any) => {
                    const active = ssel === idx;
                    const pb = u.plan === 'Membership' ? '#FCF1D6' : u.plan === 'Course' ? '#E3ECFB' : '#EEEAE0';
                    const pf = u.plan === 'Membership' ? '#8C6206' : u.plan === 'Course' ? '#1446A0' : '#5A6280';
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSsel(idx)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 16px',
                          border: 0,
                          borderTop: '1px solid #F0ECE2',
                          borderLeft: `3px solid ${active ? '#1446A0' : 'transparent'}`,
                          background: active ? '#F4F7FD' : '#fff',
                          cursor: 'pointer',
                          color: '#0E1736',
                        }}
                      >
                        <span
                          style={{
                            width: 38,
                            height: 38,
                            flex: 'none',
                            borderRadius: '50%',
                            background: '#DCE7F8',
                            color: '#0A2160',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {u.ini}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                          <span style={{ fontWeight: 700 }}>{u.name}</span>
                          <span style={{ fontSize: 12, color: '#5A6280' }}>
                            {u.faculty} · Year {u.year_level} · {u.student_id_code}
                          </span>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: pb,
                              color: pf,
                            }}
                          >
                            {u.plan}
                          </span>
                          <span style={{ fontSize: 11, color: '#8A90A6' }}>
                            {u.avgProg} avg · {u.last_active}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {curStudent && (
                  <div style={{ flex: '1.5 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        background: '#071A44',
                        color: '#fff',
                        borderRadius: 18,
                        padding: 22,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: '#4BB4EC',
                          color: '#071A44',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: 22,
                        }}
                      >
                        {curStudent.ini}
                      </span>
                      <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 20 }}>{curStudent.name}</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
                          {curStudent.faculty} · Year {curStudent.year_level} · ID {curStudent.student_id_code}
                        </span>
                        <span style={{ fontSize: 13, color: '#4BB4EC' }}>{curStudent.email}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: '#FCF1D6',
                            color: '#8C6206',
                          }}
                        >
                          {curStudent.plan}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                          Last active {curStudent.last_active}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: 24, color: '#0A2160' }}>{curStudent.enrs.length}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>Courses</span>
                      </div>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: 24, color: '#0A2160' }}>{curStudent.qAtts.length}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>Quizzes taken</span>
                      </div>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: 24, color: '#0A2160' }}>{curStudent.subs.length}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>Research</span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 16,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                            Course Access &amp; Enrollments (Add, Change, Delete)
                          </div>
                          <div style={{ fontSize: 12, color: '#5A6280' }}>
                            Add {curStudent.name.split(' ')[0]} to any course, apply a pricing plan&apos;s courses, switch courses, or remove course access.
                          </div>
                        </div>
                        {studentCourseMsg && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#E3F3EA',
                              color: '#1E8A5A',
                              padding: '4px 10px',
                              borderRadius: 999,
                            }}
                          >
                            {studentCourseMsg}
                          </span>
                        )}
                      </div>

                      {/* Add Student to a Course OR Apply a Plan */}
                      <div
                        style={{
                          background: '#F6F3EC',
                          borderRadius: 12,
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <select
                            value={enrollCourseId}
                            onChange={e => setEnrollCourseId(e.target.value)}
                            style={{
                              flex: '1 1 200px',
                              border: '1px solid #D8D3C6',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 13,
                              background: '#fff',
                              color: '#0E1736',
                              fontWeight: 600,
                            }}
                          >
                            {courses.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.title} (EGP {c.price})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={async () => {
                              const res = await onAction('admin_enroll_student', {
                                userId: curStudent.id,
                                courseId: enrollCourseId,
                                progressPct: 0,
                                planType: 'Course',
                              });
                              if (res?.ok) {
                                setStudentCourseMsg('✓ Student added to course!');
                                setTimeout(() => setStudentCourseMsg(''), 3000);
                              }
                            }}
                            style={{
                              border: 0,
                              background: '#071A44',
                              color: '#F2B22E',
                              borderRadius: 8,
                              padding: '9px 14px',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Add to Course
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', borderTop: '1px solid #E4DFD3', paddingTop: 10 }}>
                          <select
                            value={enrollPlanId}
                            onChange={e => setEnrollPlanId(e.target.value)}
                            style={{
                              flex: '1 1 200px',
                              border: '1px solid #D8D3C6',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 12,
                              background: '#fff',
                              color: '#0E1736',
                              fontWeight: 600,
                            }}
                          >
                            {(gwForm.subscriptions?.plans || []).map((pl: any) => (
                              <option key={pl.id} value={pl.id}>
                                Plan: {pl.name} ({pl.currency || 'EGP'} {pl.price} ·{' '}
                                {pl.accessType === 'selected' ? `${(pl.courseIds || []).length} courses` : 'All courses'})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={async () => {
                              const res = await onAction('admin_enroll_student', {
                                userId: curStudent.id,
                                planId: enrollPlanId,
                              });
                              if (res?.ok) {
                                setStudentCourseMsg('✓ Plan assigned & courses unlocked!');
                                setTimeout(() => setStudentCourseMsg(''), 3000);
                              }
                            }}
                            style={{
                              border: '1px solid #0A2160',
                              background: '#fff',
                              color: '#0A2160',
                              borderRadius: 8,
                              padding: '8px 14px',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Grant Plan Courses
                          </button>
                        </div>
                      </div>

                      {/* Enrolled Courses List with Change Course, Change Progress & Remove */}
                      {curStudent.enrs.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#8A90A6', padding: '8px 0' }}>
                          No courses enrolled yet. Use &ldquo;+ Add to Course&rdquo; above to enroll this student.
                        </div>
                      ) : (
                        curStudent.enrs.map((c: any, idx: number) => (
                          <div
                            key={c.id || idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              padding: 12,
                              border: '1px solid #EEEAE0',
                              borderRadius: 12,
                              background: '#FBF9F4',
                            }}
                          >
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                              {/* Change Course dropdown */}
                              <select
                                value={c.courseId}
                                onChange={async e => {
                                  const res = await onAction('admin_update_enrollment', {
                                    enrollmentId: c.id,
                                    userId: curStudent.id,
                                    courseId: c.courseId,
                                    newCourseId: e.target.value,
                                  });
                                  if (res?.ok) {
                                    setStudentCourseMsg('✓ Course changed!');
                                    setTimeout(() => setStudentCourseMsg(''), 2500);
                                  }
                                }}
                                style={{
                                  flex: '1 1 200px',
                                  border: '1px solid #D8D3C6',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: '#0A2160',
                                  background: '#fff',
                                }}
                              >
                                {courses.map((co: any) => (
                                  <option key={co.id} value={co.id}>
                                    {co.title}
                                  </option>
                                ))}
                              </select>

                              {/* Change Progress % */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#5A6280', fontWeight: 700 }}>Progress:</span>
                                <select
                                  value={c.p}
                                  onChange={async e => {
                                    await onAction('admin_update_enrollment', {
                                      enrollmentId: c.id,
                                      userId: curStudent.id,
                                      courseId: c.courseId,
                                      progressPct: Number(e.target.value),
                                    });
                                  }}
                                  style={{
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '5px 8px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: '#fff',
                                  }}
                                >
                                  {[0, 10, 25, 50, 75, 90, 100].map(pct => (
                                    <option key={pct} value={pct}>
                                      {pct}%
                                    </option>
                                  ))}
                                </select>

                                {/* Delete / Remove student from course */}
                                <button
                                  onClick={async () => {
                                    const res = await onAction('admin_remove_enrollment', {
                                      enrollmentId: c.id,
                                      userId: curStudent.id,
                                      courseId: c.courseId,
                                    });
                                    if (res?.ok) {
                                      setStudentCourseMsg('✓ Removed from course');
                                      setTimeout(() => setStudentCourseMsg(''), 2500);
                                    }
                                  }}
                                  style={{
                                    border: 0,
                                    background: '#FBE7E3',
                                    color: '#C2412D',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div style={{ height: 6, borderRadius: 99, background: '#EEEAE0', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${c.p}%`,
                                  height: '100%',
                                  background: c.p === 100 ? '#1E8A5A' : '#1446A0',
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* PAYMENTS CARD IS SHOWN ONLY FOR ADMIN */}
                    {admin && (
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 16,
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>Payments</div>
                        {curStudent.pays.length === 0 ? (
                          <span style={{ fontSize: 13, color: '#8A90A6' }}>Free plan, no payments</span>
                        ) : (
                          curStudent.pays.map((p: any) => (
                            <div
                              key={p.id}
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                gap: 6,
                                fontSize: 13,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{p.item_title}</span>
                              <span style={{ color: '#5A6280' }}>
                                {p.method} · {p.created_at}
                              </span>
                              <span style={{ fontWeight: 800 }}>EGP {p.amount}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 3H & 4B: RESEARCH REVIEW QUEUE (2-STAGE CO-ADMIN -> ADMIN) */}
          {route === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Research review
                </h1>
                <div style={{ color: '#5A6280' }}>
                  {admin
                    ? 'Final approval. Co-admins forward submissions to you.'
                    : 'First-stage review. Forward strong submissions to an admin.'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  ['all', 'All'],
                  ['co', 'Co-admin review'],
                  ['ad', 'Admin approval'],
                  ['ch', 'Changes requested'],
                  ['ok', 'Approved'],
                ].map(([k, label]) => {
                  const active = revFilter === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setRevFilter(k)}
                      style={{
                        border: `1.5px solid ${active ? '#071A44' : '#E4DFD3'}`,
                        background: active ? '#071A44' : '#fff',
                        color: active ? '#fff' : '#0E1736',
                        borderRadius: 999,
                        padding: '7px 14px',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {label} · {countByStage(k)}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredSubs.map((q: any) => {
                    const [st2, c2, b2] = STAGE[q.st] || STAGE.co;
                    const active = q.idx === revSel;
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setRevSel(q.idx);
                          setPreviewPdfOpen(true);
                        }}
                        style={{
                          textAlign: 'left',
                          background: '#fff',
                          border: `2px solid ${active ? '#1446A0' : '#E4DFD3'}`,
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          cursor: 'pointer',
                          color: '#0E1736',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{q.t}</span>
                          <span
                            style={{
                              flex: 'none',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: 999,
                              background: b2,
                              color: c2,
                            }}
                          >
                            {st2}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>
                          {q.a} · {q.type} · {q.when}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* SUBMISSION DETAIL & DECISION PANE */}
                <div
                  style={{
                    flex: '1.6 1 440px',
                    minWidth: 0,
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      padding: '20px 22px',
                      borderBottom: '1px solid #EEEAE0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: curSb,
                        color: curSc,
                      }}
                    >
                      {curStageLabel}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.3 }}>{curSub.t}</div>
                    <div style={{ fontSize: 13, color: '#5A6280' }}>
                      {curSub.a} · Supervisor: {curSub.sup} · {curSub.type}
                    </div>
                  </div>

                  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: '#F6F3EC',
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: '#FBE7E3',
                          color: '#C2412D',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        PDF
                      </span>
                      <span style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{curSub.file}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>
                          {curSub.pagesCount || 14} pages · uploaded {curSub.when}
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setPreviewPdfOpen(!previewPdfOpen)}
                          style={{
                            border: '1.5px solid #D3CDBF',
                            background: previewPdfOpen ? '#071A44' : '#fff',
                            color: previewPdfOpen ? '#fff' : '#0E1736',
                            borderRadius: 999,
                            padding: '8px 14px',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {previewPdfOpen ? 'Hide Inline PDF' : 'Inline Preview'}
                        </button>
                        <button
                          onClick={() =>
                            setPreviewModalFile({
                              title: `${curSub.t} (${curSub.file})`,
                              url: curSub.fileUrl || '/files/protocol-template.pdf',
                              ext: 'PDF',
                              meta: `${curSub.a} · Supervisor: ${curSub.sup} · ${curSub.type}`,
                            })
                          }
                          style={{
                            border: 0,
                            background: '#1446A0',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '8px 14px',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 15 }}>
                            open_in_full
                          </span>
                          Full Screen Preview
                        </button>
                        <a
                          href={curSub.fileUrl || '/files/protocol-template.pdf'}
                          download
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            border: '1.5px solid #D3CDBF',
                            background: '#fff',
                            color: '#0E1736',
                            borderRadius: 999,
                            padding: '8px 14px',
                            fontWeight: 700,
                            fontSize: 12,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 15 }}>
                            download
                          </span>
                          Download
                        </a>
                      </div>
                    </div>

                    {previewPdfOpen ? (
                      <iframe
                        src={curSub.fileUrl || '/files/protocol-template.pdf'}
                        title={curSub.t}
                        style={{
                          width: '100%',
                          height: 400,
                          border: '1px solid #E4DFD3',
                          borderRadius: 12,
                          background: '#fff',
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => setPreviewPdfOpen(true)}
                        style={{
                          aspectRatio: '4/3',
                          maxHeight: 220,
                          width: '100%',
                          border: '1px solid #E4DFD3',
                          borderRadius: 12,
                          background: 'repeating-linear-gradient(0deg,#fff 0 18px,#F3F1EB 18px 19px)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A90A6' }}>
                          click to preview manuscript ({curSub.file})
                        </span>
                      </div>
                    )}

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: '#8A90A6',
                          marginBottom: 6,
                        }}
                      >
                        Abstract
                      </div>
                      <div style={{ color: '#3A4260', fontSize: 14 }}>{curSub.abs}</div>
                    </div>

                    {(curSub.notes || []).map((n: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #CFE6D9',
                          background: '#F1F9F4',
                          borderRadius: 12,
                          padding: 12,
                          fontSize: 13,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{n.who}</span>
                        <span style={{ color: '#3A4260' }}>{n.text}</span>
                      </div>
                    ))}

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
                      Comments for the student
                      <textarea
                        rows={3}
                        value={revComment}
                        onChange={e => setRevComment(e.target.value)}
                        placeholder="What should they change, or why is it approved?"
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 14,
                          resize: 'vertical',
                        }}
                      />
                    </label>

                    {canActOnReview ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          onClick={async () => {
                            await onAction('review_research', {
                              id: curSub.id,
                              newStage: 'ch',
                              reviewerName: admin ? 'Toka Essam' : 'Youssef A.',
                              reviewerRole: role,
                              comment: revComment,
                            });
                            setRevComment('');
                          }}
                          style={{
                            border: '1.5px solid #E8C4BC',
                            background: '#fff',
                            color: '#C2412D',
                            borderRadius: 999,
                            padding: '11px 18px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Request changes
                        </button>
                        <button
                          onClick={async () => {
                            await onAction('review_research', {
                              id: curSub.id,
                              newStage: admin ? 'ok' : 'ad',
                              reviewerName: admin ? 'Toka Essam' : 'Youssef A.',
                              reviewerRole: role,
                              comment: revComment,
                            });
                            setRevComment('');
                          }}
                          style={{
                            border: 0,
                            background: admin ? '#1E8A5A' : '#071A44',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '12px 20px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            marginLeft: 'auto',
                          }}
                        >
                          {admin ? 'Approve' : 'Forward to admin'}
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          fontSize: 13,
                          color: '#5A6280',
                          background: '#F6F3EC',
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 18 }}>
                          info
                        </span>
                        {curSub.st === 'ok'
                          ? 'Approved. The student has been notified.'
                          : curSub.st === 'ch'
                          ? 'Waiting for the student to upload a revised version.'
                          : admin
                          ? 'Waiting for a co-admin to finish the first review.'
                          : 'Forwarded. An admin will make the final decision.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3I: PAYMENTS & COUPONS (RESTRICTED FOR CO-ADMIN UNLESS PERMITTED) */}
          {route === 'payments' && (
            <>
              {!admin && !perms.payments ? (
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: '48px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'center',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 40, color: '#8A90A6' }}>
                    lock
                  </span>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Admins only</div>
                  <div style={{ color: '#5A6280', maxWidth: 360 }}>
                    Revenue and payments aren&apos;t shared with co-admins.
                  </div>
                  <a
                    href="#dashboard"
                    onClick={e => {
                      e.preventDefault();
                      setRoute('dashboard');
                    }}
                    style={{ fontWeight: 700, marginTop: 6 }}
                  >
                    Back to overview
                  </a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <h1
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,3.6vw,40px)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    Payments &amp; coupons
                  </h1>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))',
                      gap: 14,
                    }}
                  >
                    {[
                      { t: 'Revenue (Oct)', v: 'EGP 34,620', d: '186 payments' },
                      { t: 'Active members', v: '142', d: 'EGP 28.3k MRR' },
                      {
                        t: 'Pending approval',
                        v: String((state.payments || []).filter((p: any) => p.status === 'Verify' || p.status === 'Pending').length),
                        d: 'InstaPay & Vodafone Cash',
                      },
                      { t: 'Coupon savings', v: 'EGP 4,180', d: '61 redemptions' },
                    ].map((k, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 16,
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            color: '#5A6280',
                          }}
                        >
                          {k.t}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 26, color: '#0A2160' }}>{k.v}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>{k.d}</span>
                      </div>
                    ))}
                  </div>

                  {/* ADMIN PAYMENT DETAILS & RECEIVING ACCOUNTS CONTROL PANEL (AT TOP OF PAYMENTS SECTION) */}
                  <div
                    style={{
                      background: '#fff',
                      border: '2px solid #0A2160',
                      borderRadius: 18,
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      boxShadow: '0 10px 28px rgba(7,26,68,.06)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: '#071A44',
                              color: '#F2B22E',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: 999,
                              letterSpacing: '.06em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Payment Details Control
                          </span>
                          <span style={{ fontWeight: 800, fontSize: 19, color: '#0A2160' }}>
                            InstaPay &amp; Vodafone Cash Payment Details
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#5A6280', marginTop: 4 }}>
                          Control the exact InstaPay QR code, Open InstaPay link, InstaPay number, IPA handle, and Vodafone Cash number shown to students on Checkout.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {gwSavedMsg && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#1E8A5A',
                              background: '#E3F3EA',
                              padding: '6px 12px',
                              borderRadius: 999,
                            }}
                          >
                            {gwSavedMsg}
                          </span>
                        )}
                        <button
                          onClick={async () => {
                            const res = await onAction('update_gateway_settings', { gateways: gwForm });
                            if (res?.ok) {
                              setGwSavedMsg('✓ Payment details saved & updated on Checkout!');
                              setTimeout(() => setGwSavedMsg(''), 3500);
                            }
                          }}
                          style={{
                            border: 0,
                            background: '#F2B22E',
                            color: '#071A44',
                            borderRadius: 999,
                            padding: '11px 22px',
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(242,178,46,.3)',
                          }}
                        >
                          Save Payment Details
                        </button>
                      </div>
                    </div>

                    {/* Gateway Tabs with Checkout ON/OFF Switch next to each name */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #EEEAE0', paddingBottom: 14 }}>
                      {[
                        { k: 'instapay', label: 'InstaPay Details (QR, Link & Number)', enabled: gwForm.instapay?.enabled !== false },
                        { k: 'wallet', label: 'Vodafone Cash Details (Number & QR)', enabled: gwForm.wallet?.enabled !== false },
                        { k: 'paymob', label: 'Paymob Card Gateway', enabled: gwForm.paymob?.enabled !== false },
                        { k: 'fawry', label: 'Fawry ReferencePay', enabled: gwForm.fawry?.enabled !== false },
                        { k: 'subscriptions', label: 'Membership Pricing', enabled: gwForm.subscriptions?.enabled !== false },
                      ].map(tab => {
                        const active = activeGwTab === tab.k;
                        const isEnabled = tab.enabled;
                        return (
                          <div
                            key={tab.k}
                            onClick={() => setActiveGwTab(tab.k as any)}
                            style={{
                              border: active ? '2px solid #071A44' : '1px solid #D8D3C6',
                              background: active ? '#071A44' : '#F6F3EC',
                              color: active ? '#fff' : '#0E1736',
                              borderRadius: 999,
                              padding: '7px 12px 7px 14px',
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 10,
                              userSelect: 'none',
                            }}
                          >
                            <span>{tab.label}</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isEnabled}
                              title={isEnabled ? 'Enabled on Checkout (click to turn OFF)' : 'Disabled on Checkout (click to turn ON)'}
                              onClick={async e => {
                                e.stopPropagation();
                                const nextGw = {
                                  ...gwForm,
                                  [tab.k]: { ...gwForm[tab.k], enabled: !isEnabled },
                                };
                                setGwForm(nextGw);
                                const res = await onAction('update_gateway_settings', { gateways: nextGw });
                                if (res?.ok) {
                                  setGwSavedMsg(`✓ ${tab.label.split(' ')[0]} ${!isEnabled ? 'enabled' : 'disabled'} on Checkout!`);
                                  setTimeout(() => setGwSavedMsg(''), 3000);
                                }
                              }}
                              style={{
                                width: 38,
                                height: 22,
                                borderRadius: 999,
                                border: 0,
                                padding: 2,
                                background: isEnabled ? '#1E8A5A' : '#B8BECB',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: isEnabled ? 'flex-end' : 'flex-start',
                                transition: 'background .18s ease',
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: '#fff',
                                  boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                                  display: 'block',
                                }}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* INDIVIDUAL INSTAPAY & VODAFONE CASH CARDS */}
                    <div
                      style={{
                        display: activeGwTab === 'instapay' || activeGwTab === 'wallet' ? 'grid' : 'none',
                        gridTemplateColumns: '1fr',
                        gap: 18,
                      }}
                    >
                      {/* INSTAPAY DETAILS CARD */}
                      {activeGwTab === 'instapay' && (
                        <div
                          style={{
                            background: '#FBF9F4',
                            border: '1px solid #E4DFD3',
                            borderRadius: 16,
                            padding: 18,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                                1. InstaPay Payment Details
                              </div>
                              <div style={{ fontSize: 12, color: '#5A6280' }}>
                                QR Code, Open InstaPay Link, InstaPay Number, IPA Handle &amp; Bank IBAN
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setGwForm({
                                  ...gwForm,
                                  instapay: { ...gwForm.instapay, enabled: !gwForm.instapay.enabled },
                                })
                              }
                              style={{
                                border: 0,
                                borderRadius: 999,
                                padding: '6px 14px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                background: gwForm.instapay?.enabled ? '#1E8A5A' : '#C2412D',
                                color: '#fff',
                              }}
                            >
                              {gwForm.instapay?.enabled ? 'Enabled on Checkout' : 'Disabled'}
                            </button>
                          </div>

                          {/* QR Code Preview + Upload */}
                          <div
                            style={{
                              background: '#fff',
                              border: '1px dashed #C7BFA9',
                              borderRadius: 12,
                              padding: 12,
                              display: 'flex',
                              gap: 14,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: 10,
                                border: '1px solid #E4DFD3',
                                background: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                                padding: 6,
                              }}
                            >
                              {gwForm.instapay?.qrCodeUrl ? (
                                <img
                                  src={gwForm.instapay.qrCodeUrl}
                                  alt="InstaPay QR Code"
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: 11, color: '#8A90A6', textAlign: 'center' }}>No QR</span>
                              )}
                            </div>
                            <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontWeight: 800, fontSize: 12, color: '#0A2160' }}>
                                InstaPay QR Code (Shown on Checkout)
                              </div>
                              <input
                                value={gwForm.instapay?.qrCodeUrl || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, qrCodeUrl: e.target.value },
                                  })
                                }
                                placeholder="/assets/instapay-qr.svg or image URL"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#0E1736' }}
                              />
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <label
                                  style={{
                                    background: '#071A44',
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '7px 12px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {uploadingQr ? 'Uploading...' : 'Upload QR Image'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadGatewayQr(file, 'instapay');
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGwForm({
                                      ...gwForm,
                                      instapay: { ...gwForm.instapay, qrCodeUrl: '/assets/instapay-qr.svg' },
                                    })
                                  }
                                  style={{
                                    background: '#EFE6CF',
                                    color: '#0A2160',
                                    border: 0,
                                    borderRadius: 8,
                                    padding: '7px 12px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reset Default QR
                                </button>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 10 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                              InstaPay Phone Number
                              <input
                                value={gwForm.instapay?.phoneNumber || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, phoneNumber: e.target.value },
                                  })
                                }
                                placeholder="0101 234 5678"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                              InstaPay IPA Handle
                              <input
                                value={gwForm.instapay?.handle || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, handle: e.target.value },
                                  })
                                }
                                placeholder="sri.epnu@instapay"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                              Open InstaPay Link (Direct Payment URL)
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  value={gwForm.instapay?.paymentLink || ''}
                                  onChange={e =>
                                    setGwForm({
                                      ...gwForm,
                                      instapay: { ...gwForm.instapay, paymentLink: e.target.value },
                                    })
                                  }
                                  placeholder="https://ipn.eg/S/sri.epnu/instapay/012345"
                                  style={{ flex: 1, border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 13, background: '#fff', color: '#0E1736' }}
                                />
                                {gwForm.instapay?.paymentLink && (
                                  <a
                                    href={gwForm.instapay.paymentLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      background: '#071A44',
                                      color: '#F2B22E',
                                      borderRadius: 10,
                                      padding: '0 12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Test Link ↗
                                  </a>
                                )}
                              </div>
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Beneficiary / Account Holder
                              <input
                                value={gwForm.instapay?.accountHolder || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, accountHolder: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Bank Name
                              <input
                                value={gwForm.instapay?.bankName || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, bankName: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Bank Account Number
                              <input
                                value={gwForm.instapay?.accountNumber || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, accountNumber: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              IBAN Number
                              <input
                                value={gwForm.instapay?.iban || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, iban: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              InstaPay Checkout Instructions
                              <input
                                value={gwForm.instapay?.instructions || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    instapay: { ...gwForm.instapay, instructions: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* VODAFONE CASH DETAILS CARD */}
                      {activeGwTab === 'wallet' && (
                        <div
                          style={{
                            background: '#FBF9F4',
                            border: '1px solid #E4DFD3',
                            borderRadius: 16,
                            padding: 18,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: '#8A1C1C' }}>
                                2. Vodafone Cash Payment Details
                              </div>
                              <div style={{ fontSize: 12, color: '#5A6280' }}>
                                Official Vodafone Cash Receiving Number, Owner Name &amp; QR Code
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setGwForm({
                                  ...gwForm,
                                  wallet: { ...gwForm.wallet, enabled: !gwForm.wallet.enabled },
                                })
                              }
                              style={{
                                border: 0,
                                borderRadius: 999,
                                padding: '6px 14px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                background: gwForm.wallet?.enabled ? '#1E8A5A' : '#C2412D',
                                color: '#fff',
                              }}
                            >
                              {gwForm.wallet?.enabled ? 'Enabled on Checkout' : 'Disabled'}
                            </button>
                          </div>

                          {/* Vodafone Cash QR Code Preview + Upload */}
                          <div
                            style={{
                              background: '#fff',
                              border: '1px dashed #C7BFA9',
                              borderRadius: 12,
                              padding: 12,
                              display: 'flex',
                              gap: 14,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: 10,
                                border: '1px solid #E4DFD3',
                                background: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                                padding: 6,
                              }}
                            >
                              {gwForm.wallet?.qrCodeUrl ? (
                                <img
                                  src={gwForm.wallet.qrCodeUrl}
                                  alt="Vodafone Cash QR"
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: 11, color: '#8A90A6', textAlign: 'center' }}>Optional QR</span>
                              )}
                            </div>
                            <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontWeight: 800, fontSize: 12, color: '#8A1C1C' }}>
                                Vodafone Cash QR Code (Optional on Checkout)
                              </div>
                              <input
                                value={gwForm.wallet?.qrCodeUrl || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    wallet: { ...gwForm.wallet, qrCodeUrl: e.target.value },
                                  })
                                }
                                placeholder="Paste QR image URL or upload below"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#0E1736' }}
                              />
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <label
                                  style={{
                                    background: '#071A44',
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '7px 12px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {uploadingQr ? 'Uploading...' : 'Upload Wallet QR'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadGatewayQr(file, 'wallet');
                                    }}
                                  />
                                </label>
                                {gwForm.wallet?.qrCodeUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGwForm({
                                        ...gwForm,
                                        wallet: { ...gwForm.wallet, qrCodeUrl: '' },
                                      })
                                    }
                                    style={{
                                      background: '#FBE7E3',
                                      color: '#C2412D',
                                      border: 0,
                                      borderRadius: 8,
                                      padding: '7px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Clear QR
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 10 }}>
                            <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#8A1C1C' }}>
                              Vodafone Cash Number (Receiving Wallet Number)
                              <input
                                value={gwForm.wallet?.walletNumber || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    wallet: { ...gwForm.wallet, walletNumber: e.target.value },
                                  })
                                }
                                placeholder="0101 234 5678"
                                style={{ border: '1.5px solid #E5B8B8', borderRadius: 10, padding: 10, fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", background: '#fff', color: '#8A1C1C' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Wallet Owner / Account Name
                              <input
                                value={gwForm.wallet?.walletOwnerName || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    wallet: { ...gwForm.wallet, walletOwnerName: e.target.value },
                                  })
                                }
                                placeholder="SRI — East Port Said National University"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Provider Label
                              <input
                                value={gwForm.wallet?.provider || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    wallet: { ...gwForm.wallet, provider: e.target.value },
                                  })
                                }
                                placeholder="Vodafone Cash"
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                            <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                              Vodafone Cash Checkout Instructions
                              <input
                                value={gwForm.wallet?.instructions || ''}
                                onChange={e =>
                                  setGwForm({
                                    ...gwForm,
                                    wallet: { ...gwForm.wallet, instructions: e.target.value },
                                  })
                                }
                                style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff', color: '#0E1736' }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TAB 3: PAYMOB CARD GATEWAY */}
                    {activeGwTab === 'paymob' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F6F3EC', padding: '12px 16px', borderRadius: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>Enable Paymob Card Checkout (Visa / Mastercard / Meeza)</div>
                            <div style={{ fontSize: 12, color: '#5A6280' }}>Direct card processing via Paymob Egypt iframe integration</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select
                              value={gwForm.paymob?.mode || 'Live'}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, mode: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
                            >
                              <option value="Live">Live Mode</option>
                              <option value="Sandbox">Sandbox / Test</option>
                            </select>
                            <button
                              onClick={() =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, enabled: !gwForm.paymob.enabled },
                                })
                              }
                              style={{
                                border: 0,
                                borderRadius: 999,
                                padding: '6px 16px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                background: gwForm.paymob?.enabled ? '#1E8A5A' : '#C2412D',
                                color: '#fff',
                              }}
                            >
                              {gwForm.paymob?.enabled ? 'Enabled on Checkout' : 'Disabled'}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Paymob Merchant ID
                            <input
                              value={gwForm.paymob?.merchantId || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, merchantId: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Card Integration ID
                            <input
                              value={gwForm.paymob?.integrationId || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, integrationId: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Paymob Iframe ID
                            <input
                              value={gwForm.paymob?.iframeId || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, iframeId: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            API Key (Secret — Admin Only)
                            <input
                              type="password"
                              value={gwForm.paymob?.apiKey || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, apiKey: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            HMAC Secret
                            <input
                              type="password"
                              value={gwForm.paymob?.hmacSecret || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  paymob: { ...gwForm.paymob, hmacSecret: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: FAWRY */}
                    {activeGwTab === 'fawry' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F6F3EC', padding: '12px 16px', borderRadius: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>Enable Fawry Reference Code Payments</div>
                            <div style={{ fontSize: 12, color: '#5A6280' }}>Generates a Fawry PayAtFawry reference code for cash payment at any outlet</div>
                          </div>
                          <button
                            onClick={() =>
                              setGwForm({
                                ...gwForm,
                                fawry: { ...gwForm.fawry, enabled: !gwForm.fawry.enabled },
                              })
                            }
                            style={{
                              border: 0,
                              borderRadius: 999,
                              padding: '6px 16px',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                              background: gwForm.fawry?.enabled ? '#1E8A5A' : '#C2412D',
                              color: '#fff',
                            }}
                          >
                            {gwForm.fawry?.enabled ? 'Enabled on Checkout' : 'Disabled'}
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Fawry Merchant Code
                            <input
                              value={gwForm.fawry?.merchantCode || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  fawry: { ...gwForm.fawry, merchantCode: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Fawry Security Key (Admin Only)
                            <input
                              type="password"
                              value={gwForm.fawry?.securityKey || ''}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  fawry: { ...gwForm.fawry, securityKey: e.target.value },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                            Reference Expiry (Hours)
                            <input
                              type="number"
                              value={gwForm.fawry?.expiryHours ?? 48}
                              onChange={e =>
                                setGwForm({
                                  ...gwForm,
                                  fawry: { ...gwForm.fawry, expiryHours: Number(e.target.value) || 48 },
                                })
                              }
                              style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: SUBSCRIPTIONS / MULTIPLE PLANS, PRICING & COURSE ACCESS */}
                    {activeGwTab === 'subscriptions' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: '#F6F3EC', padding: '14px 16px', borderRadius: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                              Multiple Plans, Pricing (EGP) &amp; Course Access Control
                            </div>
                            <div style={{ fontSize: 12, color: '#5A6280' }}>
                              Add multiple membership/bundle plans, change their EGP prices &amp; billing periods, and choose which courses each plan unlocks.
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const currentPlans = Array.isArray(gwForm.subscriptions?.plans)
                                  ? gwForm.subscriptions.plans
                                  : [];
                                const newPlan = {
                                  id: 'plan-' + Date.now(),
                                  name: `Custom Research Plan #${currentPlans.length + 1}`,
                                  nameAr: `باقة بحثية #${currentPlans.length + 1}`,
                                  badge: 'NEW PLAN',
                                  price: 399,
                                  currency: 'EGP',
                                  period: 'month',
                                  periodAr: 'شهرياً',
                                  description: 'Full access to selected research methodology courses, templates, and quizzes.',
                                  descriptionAr: 'وصول كامل للدورات المختارة في منهجيات البحث العلمي والقوالب والاختبارات.',
                                  accessType: 'selected',
                                  courseIds: courses.slice(0, 3).map((c: any) => c.id),
                                  enabled: true,
                                };
                                setGwForm({
                                  ...gwForm,
                                  subscriptions: {
                                    ...gwForm.subscriptions,
                                    plans: [...currentPlans, newPlan],
                                  },
                                });
                              }}
                              style={{
                                border: 0,
                                background: '#071A44',
                                color: '#F2B22E',
                                borderRadius: 999,
                                padding: '8px 16px',
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              + Add New Plan
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setGwForm({
                                  ...gwForm,
                                  subscriptions: { ...gwForm.subscriptions, enabled: !gwForm.subscriptions.enabled },
                                })
                              }
                              style={{
                                border: 0,
                                borderRadius: 999,
                                padding: '8px 16px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                background: gwForm.subscriptions?.enabled ? '#1E8A5A' : '#C2412D',
                                color: '#fff',
                              }}
                            >
                              {gwForm.subscriptions?.enabled ? 'Plans Section Active' : 'Plans Disabled'}
                            </button>
                          </div>
                        </div>

                        {/* List of All Configurable Plans */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {(gwForm.subscriptions?.plans || []).map((plan: any, pIdx: number) => {
                            const updatePlan = (patch: Record<string, any>) => {
                              const nextPlans = [...(gwForm.subscriptions?.plans || [])];
                              nextPlans[pIdx] = { ...nextPlans[pIdx], ...patch };
                              const firstEnabled = nextPlans.find((x: any) => x.enabled !== false) || nextPlans[0];
                              setGwForm({
                                ...gwForm,
                                subscriptions: {
                                  ...gwForm.subscriptions,
                                  monthlyPrice: firstEnabled ? Number(firstEnabled.price) || 199 : gwForm.subscriptions.monthlyPrice,
                                  plans: nextPlans,
                                },
                              });
                            };
                            const removePlan = () => {
                              const nextPlans = (gwForm.subscriptions?.plans || []).filter((_: any, i: number) => i !== pIdx);
                              setGwForm({
                                ...gwForm,
                                subscriptions: {
                                  ...gwForm.subscriptions,
                                  plans: nextPlans,
                                },
                              });
                            };
                            const isAll = plan.accessType !== 'selected';
                            const selectedIds: string[] = Array.isArray(plan.courseIds) ? plan.courseIds : [];

                            return (
                              <div
                                key={plan.id || pIdx}
                                style={{
                                  background: '#FBF9F4',
                                  border: plan.enabled !== false ? '1.5px solid #0A2160' : '1px dashed #C7BFA9',
                                  borderRadius: 16,
                                  padding: 18,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 14,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span
                                      style={{
                                        background: '#071A44',
                                        color: '#F2B22E',
                                        fontWeight: 800,
                                        fontSize: 11,
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                      }}
                                    >
                                      PLAN #{pIdx + 1}
                                    </span>
                                    <span style={{ fontWeight: 800, fontSize: 16, color: '#0A2160' }}>
                                      {plan.name || 'Unnamed Plan'} — EGP {plan.price} / {plan.period || 'month'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => updatePlan({ enabled: !(plan.enabled !== false) })}
                                      style={{
                                        border: 0,
                                        borderRadius: 999,
                                        padding: '5px 12px',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: plan.enabled !== false ? '#1E8A5A' : '#8A90A6',
                                        color: '#fff',
                                      }}
                                    >
                                      {plan.enabled !== false ? '✓ Active on Checkout' : 'Hidden'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={removePlan}
                                      style={{
                                        border: 0,
                                        borderRadius: 999,
                                        padding: '5px 12px',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        background: '#FBE7E3',
                                        color: '#C2412D',
                                      }}
                                    >
                                      Delete Plan
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 10 }}>
                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                                    Plan Name (EN)
                                    <input
                                      value={plan.name || ''}
                                      onChange={e => updatePlan({ name: e.target.value })}
                                      placeholder="e.g. SRI Monthly Membership"
                                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13, background: '#fff' }}
                                    />
                                  </label>
                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                                    Price in EGP
                                    <input
                                      type="number"
                                      value={plan.price ?? 199}
                                      onChange={e => updatePlan({ price: Number(e.target.value) || 0 })}
                                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 14, fontWeight: 800, background: '#fff', color: '#0A2160' }}
                                    />
                                  </label>
                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#0A2160' }}>
                                    Billing Period
                                    <select
                                      value={plan.period || 'month'}
                                      onChange={e => {
                                        const val = e.target.value;
                                        const arMap: Record<string, string> = {
                                          month: 'شهرياً',
                                          term: 'فصل دراسي',
                                          year: 'سنوياً',
                                          'one-time': 'دفعة واحدة',
                                        };
                                        updatePlan({ period: val, periodAr: arMap[val] || val });
                                      }}
                                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13, background: '#fff' }}
                                    >
                                      <option value="month">Monthly (/ month)</option>
                                      <option value="term">Academic Term (/ term)</option>
                                      <option value="year">Annual (/ year)</option>
                                      <option value="one-time">One-Time Bundle</option>
                                    </select>
                                  </label>
                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                                    Highlight Badge
                                    <input
                                      value={plan.badge || ''}
                                      onChange={e => updatePlan({ badge: e.target.value })}
                                      placeholder="e.g. MOST POPULAR / SAVE 25%"
                                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13, background: '#fff' }}
                                    />
                                  </label>
                                  <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                                    Plan Description &amp; Benefits
                                    <input
                                      value={plan.description || ''}
                                      onChange={e => updatePlan({ description: e.target.value })}
                                      placeholder="Describe what this plan includes..."
                                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13, background: '#fff' }}
                                    />
                                  </label>
                                </div>

                                {/* COURSE ACCESS CONTROL FOR THIS PLAN */}
                                <div
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #E4DFD3',
                                    borderRadius: 12,
                                    padding: 14,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ fontWeight: 800, fontSize: 13, color: '#0A2160' }}>
                                      Course Access Granted by This Plan:
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updatePlan({
                                            accessType: 'all',
                                            courseIds: courses.map((c: any) => c.id),
                                          })
                                        }
                                        style={{
                                          border: isAll ? '1.5px solid #071A44' : '1px solid #D8D3C6',
                                          background: isAll ? '#071A44' : '#F6F3EC',
                                          color: isAll ? '#fff' : '#0E1736',
                                          borderRadius: 999,
                                          padding: '5px 12px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        All Courses ({courses.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updatePlan({
                                            accessType: 'selected',
                                            courseIds: selectedIds.length > 0 ? selectedIds : [courses[0]?.id].filter(Boolean),
                                          })
                                        }
                                        style={{
                                          border: !isAll ? '1.5px solid #071A44' : '1px solid #D8D3C6',
                                          background: !isAll ? '#071A44' : '#F6F3EC',
                                          color: !isAll ? '#fff' : '#0E1736',
                                          borderRadius: 999,
                                          padding: '5px 12px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Selected Courses Only ({selectedIds.length})
                                      </button>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 8 }}>
                                    {courses.map((co: any) => {
                                      const checked = isAll || selectedIds.includes(co.id);
                                      return (
                                        <label
                                          key={co.id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: checked ? '1px solid #1446A0' : '1px solid #E4DFD3',
                                            background: checked ? '#F1F5FD' : '#FAFAFA',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            color: '#0E1736',
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={e => {
                                              const nextChecked = e.target.checked;
                                              const baseList = isAll ? courses.map((x: any) => x.id) : selectedIds;
                                              const nextIds = nextChecked
                                                ? Array.from(new Set([...baseList, co.id]))
                                                : baseList.filter((id: string) => id !== co.id);
                                              updatePlan({
                                                accessType: nextIds.length === courses.length ? 'all' : 'selected',
                                                courseIds: nextIds,
                                              });
                                            }}
                                          />
                                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {co.title}
                                          </span>
                                          <span style={{ fontSize: 11, color: '#5A6280', fontWeight: 700 }}>EGP {co.price}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TRANSACTIONS & COUPONS */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        flex: '2 1 540px',
                        minWidth: 0,
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 18,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '16px 20px',
                          fontWeight: 700,
                          fontSize: 16,
                          borderBottom: '1px solid #EEEAE0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Transactions &amp; Transfer Screenshots</span>
                        <span style={{ fontSize: 12, color: '#5A6280', fontWeight: 600 }}>
                          Click &ldquo;Details&rdquo; to inspect or edit any payment
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <div style={{ minWidth: 720 }}>
                          {(state.payments || []).map((t: any) => {
                            const isPendingOrVerify = t.status === 'Verify' || t.status === 'Pending';
                            const sb =
                              t.status === 'Paid'
                                ? '#E3F3EA'
                                : isPendingOrVerify
                                ? '#FCF1D6'
                                : '#EEEAE0';
                            const sc =
                              t.status === 'Paid'
                                ? '#1E8A5A'
                                : isPendingOrVerify
                                ? '#8C6206'
                                : '#5A6280';
                            return (
                              <div
                                key={t.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1.05fr 1.25fr 1fr .65fr 2.05fr',
                                  gap: 10,
                                  padding: '12px 20px',
                                  borderTop: '1px solid #F0ECE2',
                                  alignItems: 'center',
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{t.user_name}</span>
                                <span style={{ color: '#3A4260' }}>{t.item_title}</span>
                                <span style={{ color: '#5A6280', fontSize: 13 }}>{t.method}</span>
                                <span style={{ fontWeight: 700 }}>EGP {t.amount}</span>
                                <span
                                  style={{
                                    display: 'flex',
                                    gap: 6,
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {t.receipt_url && (
                                    <button
                                      onClick={() => {
                                        setReceiptPreviewUrl(t.receipt_url);
                                        setReceiptPreviewPayment(t);
                                      }}
                                      style={{
                                        border: '1px solid #D8D3C6',
                                        background: '#F6F3EC',
                                        color: '#0A2160',
                                        borderRadius: 999,
                                        padding: '3px 9px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                      }}
                                    >
                                      <img
                                        src={t.receipt_url}
                                        alt=""
                                        style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 4 }}
                                      />
                                      Screenshot
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setEditingPayment({ ...t })}
                                    style={{
                                      border: '1px solid #D8D3C6',
                                      background: '#fff',
                                      color: '#071A44',
                                      borderRadius: 999,
                                      padding: '4px 10px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Details
                                  </button>
                                  <select
                                    value={t.status}
                                    onChange={e =>
                                      onAction('update_payment_status', {
                                        paymentId: t.id,
                                        newStatus: e.target.value,
                                      })
                                    }
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '4px 8px',
                                      borderRadius: 999,
                                      border: '1px solid transparent',
                                      background: sb,
                                      color: sc,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <option value="Paid">Paid</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Verify">Verify</option>
                                    <option value="Refunded">Refunded</option>
                                  </select>
                                  {isPendingOrVerify && (
                                    <button
                                      onClick={() => onAction('verify_payment', { paymentId: t.id })}
                                      style={{
                                        border: 0,
                                        background: '#1E8A5A',
                                        color: '#fff',
                                        borderRadius: 999,
                                        padding: '5px 11px',
                                        fontWeight: 800,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ✓ Approve
                                    </button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 18,
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>Coupons</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setRoute('settings')}
                              style={{
                                border: '1px solid #D8D3C6',
                                background: '#fff',
                                color: '#0A2160',
                                borderRadius: 999,
                                padding: '6px 10px',
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              Manage in Settings
                            </button>
                            <button
                              onClick={() => setShowNewCoupon(!showNewCoupon)}
                              style={{
                                border: 0,
                                background: '#EFE6CF',
                                color: '#0A2160',
                                borderRadius: 999,
                                padding: '6px 12px',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              + New
                            </button>
                          </div>
                        </div>

                        {showNewCoupon && (
                          <div
                            style={{
                              background: '#F6F3EC',
                              borderRadius: 10,
                              padding: 10,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <input
                              value={cpCode}
                              onChange={e => setCpCode(e.target.value.toUpperCase())}
                              placeholder="CODE (e.g. EPNU30)"
                              style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 8, fontSize: 13 }}
                            />
                            <input
                              value={cpDesc}
                              onChange={e => setCpDesc(e.target.value)}
                              placeholder="Description (e.g. 30% off any course)"
                              style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 8, fontSize: 13 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                value={cpPct}
                                onChange={e => setCpPct(e.target.value)}
                                placeholder="Discount %"
                                style={{ flex: 1, border: '1px solid #D8D3C6', borderRadius: 8, padding: 8, fontSize: 13 }}
                              />
                              <button
                                onClick={async () => {
                                  if (cpCode.trim()) {
                                    await onAction('create_coupon', {
                                      code: cpCode,
                                      description: cpDesc || `${cpPct}% off`,
                                      discountPct: Number(cpPct) || 20,
                                    });
                                    setCpCode('');
                                    setCpDesc('');
                                    setShowNewCoupon(false);
                                  }
                                }}
                                style={{
                                  border: 0,
                                  background: '#071A44',
                                  color: '#fff',
                                  borderRadius: 8,
                                  padding: '0 14px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}

                        {(state.coupons || []).map((c: any) => {
                          const isActive = c.active !== 0 && c.active !== false;
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                border: '1px dashed #D3CDBF',
                                borderRadius: 10,
                                opacity: isActive ? 1 : 0.6,
                              }}
                            >
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0A2160' }}>
                                {c.code}
                              </span>
                              <span style={{ flex: 1, fontSize: 12, color: '#5A6280' }}>{c.description}</span>
                              <button
                                onClick={() => onAction('toggle_coupon', { id: c.id })}
                                style={{
                                  border: 0,
                                  background: isActive ? '#E3F3EA' : '#FBE7E3',
                                  color: isActive ? '#145E3D' : '#C2412D',
                                  borderRadius: 999,
                                  padding: '3px 8px',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                {isActive ? 'ACTIVE' : 'OFF'}
                              </button>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>
                                {c.used_count} / {c.max_uses}
                              </span>
                              <button
                                onClick={() => onAction('delete_coupon', { couponId: c.id })}
                                title="Delete coupon"
                                style={{
                                  border: 0,
                                  background: 'transparent',
                                  color: '#C2412D',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontWeight: 700,
                                  padding: '0 4px',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #E4DFD3',
                          borderRadius: 18,
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>Gateway Status Summary</div>
                        {[
                          {
                            t: `InstaPay (${gwForm.instapay?.phoneNumber || '0101 234 5678'} · ${gwForm.instapay?.handle || 'sri.epnu@instapay'})`,
                            on: gwForm.instapay?.enabled !== false,
                            s: gwForm.instapay?.enabled !== false ? 'Active (Screenshot required)' : 'Disabled',
                          },
                          {
                            t: `Vodafone Cash (${gwForm.wallet?.walletNumber || '0101 234 5678'})`,
                            on: gwForm.wallet?.enabled !== false,
                            s: gwForm.wallet?.enabled !== false ? 'Active (Screenshot required)' : 'Disabled',
                          },
                          {
                            t: `Paymob Cards (${gwForm.paymob?.mode || 'Live'})`,
                            on: gwForm.paymob?.enabled !== false,
                            s: gwForm.paymob?.enabled !== false ? 'Connected' : 'Disabled',
                          },
                          {
                            t: `Fawry (${gwForm.fawry?.merchantCode || '770000014291'})`,
                            on: gwForm.fawry?.enabled !== false,
                            s: gwForm.fawry?.enabled !== false ? 'Connected' : 'Disabled',
                          },
                          {
                            t: `Membership Plan (EGP ${gwForm.subscriptions?.monthlyPrice || 199}/mo)`,
                            on: gwForm.subscriptions?.enabled !== false,
                            s: gwForm.subscriptions?.enabled !== false ? 'Active' : 'Disabled',
                          },
                        ].map((g, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: g.on ? '#1E8A5A' : '#C2412D',
                              }}
                            />
                            <span style={{ flex: 1, fontWeight: 600 }}>{g.t}</span>
                            <span style={{ color: g.on ? '#1E8A5A' : '#C2412D', fontSize: 12, fontWeight: 700 }}>
                              {g.s}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SCREEN 3I-CONTACT: CONTACT US MESSAGES INBOX (ALONE) */}
          {route === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 960 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Contact Us Messages &amp; Support Inbox
                </h1>
                <div style={{ color: '#5A6280' }}>
                  View, reply to, and manage all inquiries and messages submitted by visitors and students on the Contact Us page.
                </div>
              </div>

              {/* CONTACT US MESSAGES INBOX */}
              {(() => {
                const contactMessages: any[] = state.contactMessages || state.settings?.contact_messages || [];
                const unreadCount = contactMessages.filter((m: any) => m.status === 'Unread').length;

                return (
                  <div
                    style={{
                      background: '#fff',
                      border: '2px solid #071A44',
                      borderRadius: 18,
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(7,26,68,.06)',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px 20px',
                        background: '#071A44',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          className="material-icon"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: '#F2B22E',
                            color: '#071A44',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 22,
                          }}
                        >
                          mark_email_unread
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: 16 }}>
                              Contact Us Messages (Written by Visitors &amp; Students)
                            </span>
                            <span
                              style={{
                                background: unreadCount > 0 ? '#F2B22E' : 'rgba(255,255,255,.16)',
                                color: unreadCount > 0 ? '#071A44' : '#fff',
                                padding: '2px 10px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 800,
                              }}
                            >
                              {unreadCount} Unread · {contactMessages.length} Total
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.78)' }}>
                            Every message submitted on the public Contact Us page (/contact) appears here automatically with sender phone, email, subject, and message text.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigatePortal('public', 'contact')}
                        style={{
                          border: '1px solid rgba(255,255,255,.3)',
                          background: 'rgba(255,255,255,.12)',
                          color: '#fff',
                          borderRadius: 999,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span className="material-icon" style={{ fontSize: 15 }}>
                          open_in_new
                        </span>
                        View Public Contact Us Page
                      </button>
                    </div>

                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {contactMessages.length === 0 ? (
                        <div
                          style={{
                            padding: 32,
                            textAlign: 'center',
                            color: '#5A6280',
                            background: '#FAF8F3',
                            borderRadius: 12,
                            border: '1px dashed #D8D3C6',
                          }}
                        >
                          No Contact Us messages received yet. Messages sent from the Contact Us page will appear here immediately.
                        </div>
                      ) : (
                        contactMessages.map((msg: any) => {
                          const isUnread = msg.status === 'Unread';
                          const isReplied = msg.status === 'Replied';
                          return (
                            <div
                              key={msg.id}
                              style={{
                                border: isUnread ? '2px solid #F2B22E' : '1px solid #E4DFD3',
                                background: isUnread ? '#FFFDF7' : '#FAF8F3',
                                borderRadius: 14,
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: 12,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, fontSize: 15, color: '#0A2160' }}>
                                      {msg.subject || 'Contact Us Inquiry'}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        padding: '3px 10px',
                                        borderRadius: 999,
                                        background: isUnread ? '#FCF1D6' : isReplied ? '#E3F3EA' : '#E3ECFB',
                                        color: isUnread ? '#8C6206' : isReplied ? '#1E8A5A' : '#1446A0',
                                      }}
                                    >
                                      {msg.status || 'Unread'}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#5A6280' }}>
                                      · {msg.createdAt || 'Just now'}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 14,
                                      flexWrap: 'wrap',
                                      fontSize: 12.5,
                                      color: '#3A4260',
                                    }}
                                  >
                                    <span>
                                      <strong>From:</strong> {msg.name}
                                    </span>
                                    <span>
                                      <strong>Email:</strong>{' '}
                                      <a
                                        href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || 'SRI Inquiry')}`}
                                        style={{ color: '#1446A0', fontWeight: 700 }}
                                      >
                                        {msg.email}
                                      </a>
                                    </span>
                                    {msg.phone && (
                                      <span>
                                        <strong>Phone:</strong>{' '}
                                        <a href={`tel:${msg.phone}`} style={{ color: '#071A44', fontWeight: 700 }}>
                                          {msg.phone}
                                        </a>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <select
                                    value={msg.status || 'Unread'}
                                    onChange={e =>
                                      onAction('update_contact_message', {
                                        id: msg.id,
                                        status: e.target.value,
                                      })
                                    }
                                    style={{
                                      border: '1px solid #D8D3C6',
                                      borderRadius: 8,
                                      padding: '6px 10px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      background: '#fff',
                                      color: '#0E1736',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <option value="Unread">Unread</option>
                                    <option value="Read">Read</option>
                                    <option value="Replied">Replied</option>
                                  </select>
                                  <a
                                    href={`mailto:${msg.email}?subject=${encodeURIComponent('Re: ' + (msg.subject || 'Your SRI Contact Inquiry'))}`}
                                    onClick={() =>
                                      onAction('update_contact_message', {
                                        id: msg.id,
                                        status: 'Replied',
                                      })
                                    }
                                    style={{
                                      background: '#1446A0',
                                      color: '#fff',
                                      borderRadius: 8,
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span className="material-icon" style={{ fontSize: 15 }}>
                                      reply
                                    </span>
                                    Reply via Email
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => onAction('delete_contact_message', { id: msg.id })}
                                    style={{
                                      border: 0,
                                      background: '#FBE7E3',
                                      color: '#C2412D',
                                      borderRadius: 8,
                                      padding: '6px 10px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              <div
                                style={{
                                  background: '#fff',
                                  border: '1px solid #E4DFD3',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  fontSize: 13.5,
                                  lineHeight: 1.55,
                                  color: '#0E1736',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {msg.message}
                              </div>

                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                  defaultValue={msg.adminNote || ''}
                                  placeholder="Add an internal admin note or record your reply..."
                                  onBlur={e => {
                                    if (e.target.value !== (msg.adminNote || '')) {
                                      onAction('update_contact_message', {
                                        id: msg.id,
                                        adminNote: e.target.value,
                                      });
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    minWidth: 220,
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '7px 11px',
                                    fontSize: 12.5,
                                    background: '#fff',
                                  }}
                                />
                                <span style={{ fontSize: 11, color: '#5A6280' }}>
                                  Auto-saves note on blur
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* SCREEN 3J: ROLES, PERMISSIONS & USER ACCOUNTS (ALONE) */}
          {route === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 960 }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(28px,3.6vw,40px)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Accounts, Roles &amp; Permissions
                </h1>
                <div style={{ color: '#5A6280' }}>
                  Manage all platform accounts (Admins, Co-Admins, Students), reset passwords, assign plans, control PDF download settings, and configure Co-Admin permissions.
                </div>
              </div>

              {/* USER ACCOUNTS CONTROL PANEL */}
              <div
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>Platform User Accounts</div>
                    <div style={{ fontSize: 12, color: '#5A6280' }}>
                      Create accounts, switch user roles (Admin / Co-Admin / Student), update subscription plans, or reset passwords.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {userMgmtMsg && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#1E8A5A',
                          background: '#E3F3EA',
                          padding: '5px 12px',
                          borderRadius: 999,
                        }}
                      >
                        {userMgmtMsg}
                      </span>
                    )}
                    {admin && (
                      <button
                        onClick={() => setShowNewUserForm(!showNewUserForm)}
                        style={{
                          border: 0,
                          background: '#071A44',
                          color: '#fff',
                          borderRadius: 999,
                          padding: '8px 16px',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {showNewUserForm ? 'Close' : '+ New Account'}
                      </button>
                    )}
                  </div>
                </div>

                {showNewUserForm && admin && (
                  <div
                    style={{
                      background: '#F6F3EC',
                      borderRadius: 14,
                      padding: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                      gap: 10,
                    }}
                  >
                    <input
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      placeholder="Full Name"
                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                    />
                    <input
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      placeholder="Email (e.g. user@epnu.edu.eg)"
                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                    />
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                    />
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value)}
                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                    >
                      <option value="student">Student</option>
                      <option value="coadmin">Co-Admin</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={newUserPlan}
                      onChange={e => setNewUserPlan(e.target.value)}
                      style={{ border: '1px solid #D8D3C6', borderRadius: 8, padding: 9, fontSize: 13 }}
                    >
                      <option value="Free">Free Plan</option>
                      <option value="Course">Course Plan</option>
                      <option value="Membership">Membership Plan</option>
                    </select>
                    <button
                      onClick={async () => {
                        if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;
                        const res = await onAction('admin_create_user', {
                          name: newUserName,
                          email: newUserEmail,
                          password: newUserPassword,
                          role: newUserRole,
                          plan: newUserPlan,
                          faculty: newUserFaculty,
                          studentIdCode: newUserStudentId,
                        });
                        if (res?.ok) {
                          setNewUserName('');
                          setNewUserEmail('');
                          setNewUserPassword('');
                          setShowNewUserForm(false);
                          setUserMgmtMsg('✓ Account created!');
                          setTimeout(() => setUserMgmtMsg(''), 3000);
                        } else if (res?.error) {
                          setUserMgmtMsg(`⚠ ${res.error}`);
                        }
                      }}
                      style={{
                        border: 0,
                        background: '#F2B22E',
                        color: '#071A44',
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Create User
                    </button>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 680, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(state.users || []).map((u: any) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 1.5fr .9fr .9fr 1.4fr',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 14px',
                          border: '1px solid #EEEAE0',
                          borderRadius: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#5A6280' }}>{u.faculty || 'EPNU'}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#3A4260', fontFamily: "'JetBrains Mono', monospace" }}>
                          {u.email}
                        </div>
                        <select
                          disabled={!admin}
                          value={u.role}
                          onChange={async e => {
                            await onAction('admin_update_user', {
                              targetUserId: u.id,
                              role: e.target.value,
                            });
                            setUserMgmtMsg(`✓ Updated ${u.name}'s role`);
                            setTimeout(() => setUserMgmtMsg(''), 2500);
                          }}
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            background: u.role === 'admin' ? '#FCF1D6' : u.role === 'coadmin' ? '#E3ECFB' : '#F6F3EC',
                            color: '#0E1736',
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="coadmin">Co-Admin</option>
                          <option value="student">Student</option>
                        </select>
                        <select
                          disabled={!admin}
                          value={u.plan || 'Free'}
                          onChange={async e => {
                            await onAction('admin_update_user', {
                              targetUserId: u.id,
                              plan: e.target.value,
                            });
                            setUserMgmtMsg(`✓ Updated ${u.name}'s plan`);
                            setTimeout(() => setUserMgmtMsg(''), 2500);
                          }}
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          <option value="Free">Free</option>
                          <option value="Course">Course</option>
                          <option value="Membership">Membership</option>
                        </select>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {resetPwdUserId === u.id ? (
                            <>
                              <input
                                type="password"
                                value={resetPwdValue}
                                onChange={e => setResetPwdValue(e.target.value)}
                                placeholder="New password"
                                style={{ width: 110, border: '1px solid #D8D3C6', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                              />
                              <button
                                onClick={async () => {
                                  if (resetPwdValue.trim().length >= 6) {
                                    await onAction('admin_update_user', {
                                      targetUserId: u.id,
                                      newPassword: resetPwdValue.trim(),
                                    });
                                    setResetPwdUserId(null);
                                    setResetPwdValue('');
                                    setUserMgmtMsg(`✓ Password updated for ${u.name}`);
                                    setTimeout(() => setUserMgmtMsg(''), 3000);
                                  }
                                }}
                                style={{
                                  border: 0,
                                  background: '#1E8A5A',
                                  color: '#fff',
                                  borderRadius: 6,
                                  padding: '5px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Save
                              </button>
                            </>
                          ) : (
                            admin && (
                              <button
                                onClick={() => {
                                  setResetPwdUserId(u.id);
                                  setResetPwdValue('');
                                }}
                                style={{
                                  border: '1px solid #D8D3C6',
                                  background: '#fff',
                                  color: '#0A2160',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Reset Password
                              </button>
                            )
                          )}
                          {admin && u.id !== currentUser?.id && (
                            <button
                              onClick={() => onAction('admin_delete_user', { targetUserId: u.id })}
                              style={{
                                border: 0,
                                background: '#FBE7E3',
                                color: '#C2412D',
                                borderRadius: 6,
                                padding: '5px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FILES & PDFs DOWNLOAD VS. VIEW-ONLY CONTROL */}
              {(() => {
                const fa = {
                  allowLessonPdfDownload: true,
                  allowResourceDownload: true,
                  allowResearchDownload: true,
                  allowPublicPreviewDownload: true,
                  ...(state.fileAccess || state.settings?.file_access_settings || {}),
                };
                const allDownloadsEnabled =
                  fa.allowLessonPdfDownload &&
                  fa.allowResourceDownload &&
                  fa.allowResearchDownload &&
                  fa.allowPublicPreviewDownload;

                return (
                  <div
                    style={{
                      background: '#fff',
                      border: '2px solid #071A44',
                      borderRadius: 18,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px 20px',
                        background: '#071A44',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          className="material-icon"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: '#F2B22E',
                            color: '#071A44',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 22,
                          }}
                        >
                          picture_as_pdf
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>
                            PDFs &amp; Course Files Access Policy (Download vs. View Only)
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.76)' }}>
                            Control whether students and visitors can download PDFs/files or only view them inline inside the platform.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            onAction('update_file_access_settings', {
                              allowLessonPdfDownload: true,
                              allowResourceDownload: true,
                              allowResearchDownload: true,
                              allowPublicPreviewDownload: true,
                            })
                          }
                          style={{
                            border: allDownloadsEnabled ? '2px solid #F2B22E' : '1px solid rgba(255,255,255,.3)',
                            background: allDownloadsEnabled ? '#1E8A5A' : 'rgba(255,255,255,.1)',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '7px 14px',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            download
                          </span>
                          Allow All Downloads
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAction('update_file_access_settings', {
                              allowLessonPdfDownload: false,
                              allowResourceDownload: false,
                              allowResearchDownload: false,
                              allowPublicPreviewDownload: false,
                            })
                          }
                          style={{
                            border: !allDownloadsEnabled ? '2px solid #F2B22E' : '1px solid rgba(255,255,255,.3)',
                            background: !allDownloadsEnabled ? '#C2412D' : 'rgba(255,255,255,.1)',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '7px 14px',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 16 }}>
                            visibility
                          </span>
                          View Only Mode (Disable All Downloads)
                        </button>
                      </div>
                    </div>

                    <div>
                      {(
                        [
                          [
                            'allowLessonPdfDownload',
                            'description',
                            'Course Lesson PDFs & Lecture Slides',
                            'Controls whether students can download PDF lessons and attached lecture slide decks, or only view them inside the course player.',
                          ],
                          [
                            'allowResourceDownload',
                            'folder_open',
                            'Lesson Resources & Attachments (Worksheets, Templates, Charts)',
                            'Controls whether files in the "Resources & Files" tab can be downloaded or only viewed inline/fullscreen.',
                          ],
                          [
                            'allowResearchDownload',
                            'science',
                            'Research Manuscripts & Submissions',
                            'Controls whether submitted research manuscripts in the Student Research portal can be downloaded or only viewed.',
                          ],
                          [
                            'allowPublicPreviewDownload',
                            'public',
                            'Public Course Curriculum Preview Files',
                            'Controls whether visitors previewing course PDFs on the public Course Detail page can download them or only view them.',
                          ],
                        ] as const
                      ).map(([fieldKey, icon, title, desc], idx) => {
                        const canDownload = !!fa[fieldKey];
                        return (
                          <div
                            key={fieldKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 14,
                              padding: '16px 20px',
                              borderTop: idx === 0 ? 'none' : '1px solid #F0ECE2',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 320px' }}>
                              <span
                                className="material-icon"
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 10,
                                  background: canDownload ? '#E3F3EA' : '#FCF1D6',
                                  color: canDownload ? '#1E8A5A' : '#8C6206',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 20,
                                  flex: 'none',
                                }}
                              >
                                {icon}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#0E1736' }}>{title}</span>
                                <span style={{ fontSize: 12, color: '#5A6280' }}>{desc}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  onAction('update_file_access_settings', {
                                    [fieldKey]: true,
                                  })
                                }
                                style={{
                                  border: `1.5px solid ${canDownload ? '#1E8A5A' : '#D8D3C6'}`,
                                  background: canDownload ? '#E3F3EA' : '#fff',
                                  color: canDownload ? '#145E3D' : '#5A6280',
                                  borderRadius: 999,
                                  padding: '7px 14px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 15 }}>
                                  download
                                </span>
                                Download &amp; View
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onAction('update_file_access_settings', {
                                    [fieldKey]: false,
                                  })
                                }
                                style={{
                                  border: `1.5px solid ${!canDownload ? '#C2412D' : '#D8D3C6'}`,
                                  background: !canDownload ? '#FBE7E3' : '#fff',
                                  color: !canDownload ? '#C2412D' : '#5A6280',
                                  borderRadius: 999,
                                  padding: '7px 14px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 15 }}>
                                  visibility
                                </span>
                                View Only (No Download)
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* DISCOUNT COUPONS & PROMO CODES CONTROL PANEL */}
              <div
                style={{
                  background: '#fff',
                  border: '2px solid #071A44',
                  borderRadius: 18,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    background: '#071A44',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      className="material-icon"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: '#F2B22E',
                        color: '#071A44',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 22,
                      }}
                    >
                      confirmation_number
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        Discount Coupons &amp; Promo Codes Control
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.76)' }}>
                        Create, edit, activate/deactivate, set usage limits, and delete checkout promo codes (% off or fixed EGP discount).
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowNewCoupon(!showNewCoupon)}
                      style={{
                        border: '2px solid #F2B22E',
                        background: '#F2B22E',
                        color: '#071A44',
                        borderRadius: 999,
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 16 }}>
                        {showNewCoupon ? 'close' : 'add'}
                      </span>
                      {showNewCoupon ? 'Close New Coupon Form' : '+ Add New Coupon'}
                    </button>
                  </div>
                </div>

                {showNewCoupon && (
                  <div
                    style={{
                      padding: '18px 20px',
                      background: '#F6F3EC',
                      borderBottom: '1px solid #E4DFD3',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0A2160' }}>
                      Create New Discount Coupon
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: 10,
                      }}
                    >
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>COUPON CODE *</span>
                        <input
                          value={cpCode}
                          onChange={e => setCpCode(e.target.value.toUpperCase())}
                          placeholder="e.g. EPNU30"
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: '9px 12px',
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: '#fff',
                          }}
                        />
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>DISCOUNT TYPE</span>
                        <select
                          value={cpType}
                          onChange={e => setCpType(e.target.value as 'pct' | 'fixed')}
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: '9px 12px',
                            fontSize: 13,
                            fontWeight: 700,
                            background: '#fff',
                          }}
                        >
                          <option value="pct">Percentage (% Off)</option>
                          <option value="fixed">Fixed Amount (EGP Off)</option>
                        </select>
                      </label>

                      {cpType === 'pct' ? (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>PERCENTAGE OFF (%)</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={cpPct}
                            onChange={e => setCpPct(e.target.value)}
                            placeholder="25"
                            style={{
                              border: '1px solid #D8D3C6',
                              borderRadius: 10,
                              padding: '9px 12px',
                              fontSize: 13,
                              fontWeight: 700,
                              background: '#fff',
                            }}
                          />
                        </label>
                      ) : (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>FIXED DISCOUNT (EGP)</span>
                          <input
                            type="number"
                            min={1}
                            value={cpFixed}
                            onChange={e => setCpFixed(e.target.value)}
                            placeholder="50"
                            style={{
                              border: '1px solid #D8D3C6',
                              borderRadius: 10,
                              padding: '9px 12px',
                              fontSize: 13,
                              fontWeight: 700,
                              background: '#fff',
                            }}
                          />
                        </label>
                      )}

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>MAX USES LIMIT</span>
                        <input
                          type="number"
                          min={1}
                          value={cpMaxUses}
                          onChange={e => setCpMaxUses(e.target.value)}
                          placeholder="100"
                          style={{
                            border: '1px solid #D8D3C6',
                            borderRadius: 10,
                            padding: '9px 12px',
                            fontSize: 13,
                            fontWeight: 700,
                            background: '#fff',
                          }}
                        />
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>DESCRIPTION</span>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <input
                            value={cpDesc}
                            onChange={e => setCpDesc(e.target.value)}
                            placeholder={
                              cpType === 'pct'
                                ? `${cpPct || 25}% off any course or membership`
                                : `EGP ${cpFixed || 50} off any course or membership`
                            }
                            style={{
                              flex: '1 1 260px',
                              border: '1px solid #D8D3C6',
                              borderRadius: 10,
                              padding: '9px 12px',
                              fontSize: 13,
                              background: '#fff',
                            }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!cpCode.trim()) return;
                              const isPct = cpType === 'pct';
                              const pctVal = isPct ? Math.min(100, Math.max(1, Number(cpPct) || 25)) : 0;
                              const fixedVal = !isPct ? Math.max(1, Number(cpFixed) || 50) : 0;
                              await onAction('create_coupon', {
                                code: cpCode.trim().toUpperCase(),
                                description:
                                  cpDesc.trim() ||
                                  (isPct ? `${pctVal}% off any course` : `EGP ${fixedVal} off any course`),
                                discountPct: pctVal,
                                discountFixed: fixedVal,
                                maxUses: Math.max(1, Number(cpMaxUses) || 100),
                                active: 1,
                              });
                              setCpCode('');
                              setCpDesc('');
                              setCpPct('25');
                              setCpFixed('0');
                              setCpMaxUses('100');
                              setShowNewCoupon(false);
                            }}
                            style={{
                              border: 0,
                              background: '#071A44',
                              color: '#fff',
                              borderRadius: 10,
                              padding: '10px 20px',
                              fontWeight: 800,
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            Save &amp; Activate Coupon
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  {(state.coupons || []).length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#5A6280', fontSize: 13 }}>
                      No discount coupons configured yet. Click &ldquo;+ Add New Coupon&rdquo; above to create one.
                    </div>
                  ) : (
                    (state.coupons || []).map((c: any, idx: number) => {
                      const isActive = c.active !== 0 && c.active !== false;
                      const isEditing = editingCouponId === c.id && editCpDraft;
                      const isFixed = Number(c.discount_fixed) > 0 && Number(c.discount_pct) === 0;

                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: '16px 20px',
                            borderTop: idx === 0 ? 'none' : '1px solid #F0ECE2',
                            background: isEditing ? '#FAF8F3' : '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 14,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 300px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 800,
                                  fontSize: 15,
                                  color: '#071A44',
                                  background: '#EFE6CF',
                                  border: '1px dashed #B59E6B',
                                  borderRadius: 8,
                                  padding: '6px 12px',
                                }}
                              >
                                {c.code}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: '#EAF0FB',
                                  color: '#1446A0',
                                }}
                              >
                                {isFixed ? `EGP ${c.discount_fixed} OFF` : `${c.discount_pct}% OFF`}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: isActive ? '#E3F3EA' : '#FBE7E3',
                                  color: isActive ? '#145E3D' : '#C2412D',
                                }}
                              >
                                {isActive ? 'ACTIVE ON CHECKOUT' : 'DISABLED'}
                              </span>
                              <span style={{ fontSize: 13, color: '#3A4260', fontWeight: 600 }}>
                                {c.description}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#5A6280',
                                  background: '#F6F3EC',
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                }}
                              >
                                Uses: <strong style={{ color: '#0E1736' }}>{c.used_count}</strong> / {c.max_uses}
                              </span>

                              <button
                                type="button"
                                onClick={() => onAction('toggle_coupon', { id: c.id })}
                                style={{
                                  border: `1.5px solid ${isActive ? '#1E8A5A' : '#D8D3C6'}`,
                                  background: isActive ? '#E3F3EA' : '#fff',
                                  color: isActive ? '#145E3D' : '#5A6280',
                                  borderRadius: 999,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                {isActive ? 'Disable' : 'Enable'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingCouponId(null);
                                    setEditCpDraft(null);
                                  } else {
                                    setEditingCouponId(c.id);
                                    setEditCpDraft({
                                      code: c.code,
                                      description: c.description,
                                      type: Number(c.discount_fixed) > 0 && Number(c.discount_pct) === 0 ? 'fixed' : 'pct',
                                      discountPct: String(c.discount_pct ?? 0),
                                      discountFixed: String(c.discount_fixed ?? 0),
                                      maxUses: String(c.max_uses ?? 100),
                                      usedCount: String(c.used_count ?? 0),
                                      active: isActive,
                                    });
                                  }
                                }}
                                style={{
                                  border: '1px solid #D8D3C6',
                                  background: isEditing ? '#071A44' : '#fff',
                                  color: isEditing ? '#fff' : '#0A2160',
                                  borderRadius: 999,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {isEditing ? 'Close Edit' : 'Edit Coupon'}
                              </button>

                              <button
                                type="button"
                                onClick={() => onAction('delete_coupon', { id: c.id })}
                                style={{
                                  border: '1px solid #F3C4BC',
                                  background: '#FBE7E3',
                                  color: '#C2412D',
                                  borderRadius: 999,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {isEditing && editCpDraft && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: 14,
                                background: '#fff',
                                border: '1px solid #D8D3C6',
                                borderRadius: 12,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: 10,
                                alignItems: 'end',
                              }}
                            >
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>COUPON CODE</span>
                                <input
                                  value={editCpDraft.code}
                                  onChange={e =>
                                    setEditCpDraft({ ...editCpDraft, code: e.target.value.toUpperCase() })
                                  }
                                  style={{
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontFamily: "'JetBrains Mono', monospace",
                                  }}
                                />
                              </label>

                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>DISCOUNT TYPE</span>
                                <select
                                  value={editCpDraft.type}
                                  onChange={e => setEditCpDraft({ ...editCpDraft, type: e.target.value })}
                                  style={{
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    background: '#fff',
                                  }}
                                >
                                  <option value="pct">Percentage (% Off)</option>
                                  <option value="fixed">Fixed Amount (EGP Off)</option>
                                </select>
                              </label>

                              {editCpDraft.type === 'pct' ? (
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>DISCOUNT (%)</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={editCpDraft.discountPct}
                                    onChange={e =>
                                      setEditCpDraft({ ...editCpDraft, discountPct: e.target.value, discountFixed: '0' })
                                    }
                                    style={{
                                      border: '1px solid #D8D3C6',
                                      borderRadius: 8,
                                      padding: '8px 10px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}
                                  />
                                </label>
                              ) : (
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>FIXED EGP OFF</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={editCpDraft.discountFixed}
                                    onChange={e =>
                                      setEditCpDraft({ ...editCpDraft, discountFixed: e.target.value, discountPct: '0' })
                                    }
                                    style={{
                                      border: '1px solid #D8D3C6',
                                      borderRadius: 8,
                                      padding: '8px 10px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                    }}
                                  />
                                </label>
                              )}

                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>MAX USES</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={editCpDraft.maxUses}
                                  onChange={e => setEditCpDraft({ ...editCpDraft, maxUses: e.target.value })}
                                  style={{
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                  }}
                                />
                              </label>

                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>USED COUNT</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={editCpDraft.usedCount}
                                  onChange={e => setEditCpDraft({ ...editCpDraft, usedCount: e.target.value })}
                                  style={{
                                    border: '1px solid #D8D3C6',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                  }}
                                />
                              </label>

                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280' }}>DESCRIPTION</span>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <input
                                    value={editCpDraft.description}
                                    onChange={e =>
                                      setEditCpDraft({ ...editCpDraft, description: e.target.value })
                                    }
                                    style={{
                                      flex: '1 1 240px',
                                      border: '1px solid #D8D3C6',
                                      borderRadius: 8,
                                      padding: '8px 10px',
                                      fontSize: 13,
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const isPct = editCpDraft.type === 'pct';
                                      await onAction('update_coupon', {
                                        id: c.id,
                                        code: editCpDraft.code,
                                        description: editCpDraft.description,
                                        discountPct: isPct ? Number(editCpDraft.discountPct) || 0 : 0,
                                        discountFixed: !isPct ? Number(editCpDraft.discountFixed) || 0 : 0,
                                        maxUses: Number(editCpDraft.maxUses) || 100,
                                        usedCount: Number(editCpDraft.usedCount) || 0,
                                        active: editCpDraft.active ? 1 : 0,
                                      });
                                      setEditingCouponId(null);
                                      setEditCpDraft(null);
                                    }}
                                    style={{
                                      border: 0,
                                      background: '#1E8A5A',
                                      color: '#fff',
                                      borderRadius: 8,
                                      padding: '8px 16px',
                                      fontWeight: 800,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>Co-Admin Feature Permissions</div>
              <div style={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 18, overflow: 'hidden' }}>
                {[
                  ['courses', 'auto_stories', 'Create and edit courses', 'Upload videos, PDFs and quizzes'],
                  ['review', 'rate_review', 'First-stage research review', 'Forward or request changes'],
                  ['students', 'group', 'View students', 'Names, progress and quiz scores'],
                  ['payments', 'payments', 'Revenue & payments', 'Transactions, coupons, gateways'],
                  ['settings', 'settings', 'Platform settings', 'Branding, gateways, integrations'],
                  ['del', 'delete', 'Delete courses', 'Permanently remove a course or topic'],
                ].map(([k, icon, t, d], idx) => {
                  const on = !!perms[k];
                  return (
                    <button
                      key={k}
                      onClick={() => onAction('toggle_coadmin_perm', { key: k })}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '16px 20px',
                        border: 0,
                        borderTop: idx === 0 ? 'none' : '1px solid #F0ECE2',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#0E1736',
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 22, color: '#1446A0' }}>
                        {icon}
                      </span>
                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700 }}>{t}</span>
                        <span style={{ fontSize: 12, color: '#5A6280' }}>{d}</span>
                      </span>
                      <span
                        style={{
                          width: 40,
                          height: 24,
                          borderRadius: 99,
                          background: on ? '#1446A0' : '#D3CDBF',
                          position: 'relative',
                          flex: 'none',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 3,
                            left: on ? 19 : 3,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* NEW COURSE MODAL */}
        {showNewCourseModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,26,68,.65)',
              zIndex: 50,
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 24,
                maxWidth: 440,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 20 }}>Create New SRI Course</div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                Course title
                <input
                  value={newCourseTitle}
                  onChange={e => setNewCourseTitle(e.target.value)}
                  placeholder="e.g. Clinical Trial Design & CONSORT"
                  style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 11, fontSize: 14 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                Instructor
                <input
                  value={newCourseMentor}
                  onChange={e => setNewCourseMentor(e.target.value)}
                  style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 11, fontSize: 14 }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                  Category
                  <select
                    value={newCourseCat}
                    onChange={e => setNewCourseCat(e.target.value)}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 11, fontSize: 14, background: '#fff' }}
                  >
                    {(state.categories || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#5A6280' }}>
                  Price (EGP)
                  <input
                    value={newCoursePrice}
                    onChange={e => setNewCoursePrice(e.target.value)}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 11, fontSize: 14 }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => setShowNewCourseModal(false)}
                  style={{
                    border: '1.5px solid #D3CDBF',
                    background: '#fff',
                    borderRadius: 999,
                    padding: '10px 18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const res = await onAction('create_course', {
                      title: newCourseTitle || 'Clinical Trial Design',
                      mentor: newCourseMentor,
                      categoryId: newCourseCat,
                      price: Number(newCoursePrice) || 450,
                    });
                    setShowNewCourseModal(false);
                    setNewCourseTitle('');
                    if (res?.createdCourseId) {
                      setSelectedCourseId(res.createdCourseId);
                      setRoute('builder');
                    }
                  }}
                  style={{
                    border: 0,
                    background: '#F2B22E',
                    color: '#071A44',
                    borderRadius: 999,
                    padding: '10px 20px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Create &amp; Open Builder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL TRANSFER SCREENSHOT PREVIEW & APPROVAL MODAL */}
        {receiptPreviewUrl && (
          <div
            onClick={() => {
              setReceiptPreviewUrl(null);
              setReceiptPreviewPayment(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,26,68,.75)',
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 22,
                maxWidth: 520,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: '0 24px 60px rgba(7,26,68,.35)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>
                    Transfer Screenshot Verification
                  </div>
                  {receiptPreviewPayment && (
                    <div style={{ fontSize: 12, color: '#5A6280' }}>
                      {receiptPreviewPayment.user_name} · {receiptPreviewPayment.item_title} ·{' '}
                      <strong>EGP {receiptPreviewPayment.amount}</strong> ({receiptPreviewPayment.method})
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background:
                      receiptPreviewPayment?.status === 'Paid'
                        ? '#E3F3EA'
                        : '#FCF1D6',
                    color:
                      receiptPreviewPayment?.status === 'Paid'
                        ? '#1E8A5A'
                        : '#8C6206',
                  }}
                >
                  {receiptPreviewPayment?.status || 'Pending'}
                </span>
              </div>

              <div
                style={{
                  background: '#FBF9F4',
                  border: '1px solid #E4DFD3',
                  borderRadius: 12,
                  padding: 10,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <img
                  src={receiptPreviewUrl}
                  alt="Transfer Receipt Screenshot"
                  style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setReceiptPreviewUrl(null);
                    setReceiptPreviewPayment(null);
                  }}
                  style={{
                    background: '#F6F3EC',
                    color: '#071A44',
                    border: '1px solid #D8D3C6',
                    borderRadius: 999,
                    padding: '10px 18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                {receiptPreviewPayment &&
                  (receiptPreviewPayment.status === 'Pending' || receiptPreviewPayment.status === 'Verify') && (
                    <button
                      onClick={async () => {
                        await onAction('verify_payment', { paymentId: receiptPreviewPayment.id });
                        setReceiptPreviewUrl(null);
                        setReceiptPreviewPayment(null);
                      }}
                      style={{
                        background: '#1E8A5A',
                        color: '#fff',
                        border: 0,
                        borderRadius: 999,
                        padding: '10px 20px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Approve &amp; Unlock Access
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT TRANSACTION DETAILS & ADMIN EDIT MODAL */}
        {editingPayment && (
          <div
            onClick={() => setEditingPayment(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,26,68,.75)',
              zIndex: 60,
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 22,
                maxWidth: 520,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: '0 24px 60px rgba(7,26,68,.35)',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#0A2160' }}>
                    Payment Details &amp; Control
                  </div>
                  <div style={{ fontSize: 12, color: '#5A6280' }}>
                    {editingPayment.user_name} ({editingPayment.user_email}) · {editingPayment.created_at}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#F6F3EC',
                    padding: '4px 8px',
                    borderRadius: 6,
                    color: '#5A6280',
                  }}
                >
                  {editingPayment.id}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                  Course / Item Title
                  <input
                    value={editingPayment.item_title || ''}
                    onChange={e => setEditingPayment({ ...editingPayment, item_title: e.target.value })}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                  Payment Method &amp; Sender Number
                  <input
                    value={editingPayment.method || ''}
                    onChange={e => setEditingPayment({ ...editingPayment, method: e.target.value })}
                    placeholder="e.g. InstaPay (01012345678)"
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                  Amount (EGP)
                  <input
                    type="number"
                    value={editingPayment.amount ?? 0}
                    onChange={e => setEditingPayment({ ...editingPayment, amount: Number(e.target.value) || 0 })}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, color: '#0E1736' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                  Reference Code
                  <input
                    value={editingPayment.reference_code || ''}
                    onChange={e => setEditingPayment({ ...editingPayment, reference_code: e.target.value })}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#0E1736' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: '#5A6280' }}>
                  Payment Status
                  <select
                    value={editingPayment.status || 'Pending'}
                    onChange={e => setEditingPayment({ ...editingPayment, status: e.target.value })}
                    style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 10, fontSize: 14, background: '#fff', color: '#0E1736' }}
                  >
                    <option value="Paid">Paid (Unlocked)</option>
                    <option value="Pending">Pending (Awaiting Approval)</option>
                    <option value="Verify">Verify</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </label>
              </div>

              {editingPayment.receipt_url && (
                <div
                  style={{
                    background: '#FBF9F4',
                    border: '1px solid #E4DFD3',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0A2160' }}>Uploaded Transfer Screenshot</div>
                  <img
                    src={editingPayment.receipt_url}
                    alt="Transfer Screenshot"
                    style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8 }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {admin ? (
                  <button
                    onClick={async () => {
                      await onAction('admin_delete_payment', { paymentId: editingPayment.id });
                      setEditingPayment(null);
                    }}
                    style={{
                      background: '#FBE7E3',
                      color: '#C2412D',
                      border: 0,
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Delete Payment
                  </button>
                ) : (
                  <span />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setEditingPayment(null)}
                    style={{
                      background: '#F6F3EC',
                      color: '#071A44',
                      border: '1px solid #D8D3C6',
                      borderRadius: 999,
                      padding: '10px 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await onAction('admin_update_payment', {
                        paymentId: editingPayment.id,
                        itemTitle: editingPayment.item_title,
                        method: editingPayment.method,
                        amount: editingPayment.amount,
                        referenceCode: editingPayment.reference_code,
                        status: editingPayment.status,
                        receiptUrl: editingPayment.receipt_url,
                      });
                      setEditingPayment(null);
                    }}
                    style={{
                      background: '#F2B22E',
                      color: '#071A44',
                      border: 0,
                      borderRadius: 999,
                      padding: '10px 20px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Save Payment Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UNIVERSAL PDF & FILE PREVIEW MODAL */}
        {previewModalFile && (
          <div
            onClick={() => setPreviewModalFile(null)}
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
                      background: previewModalFile.ext === 'VIDEO' ? '#1446A0' : '#FBE7E3',
                      color: previewModalFile.ext === 'VIDEO' ? '#fff' : '#C2412D',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 10,
                      flex: 'none',
                    }}
                  >
                    {previewModalFile.ext || 'PDF'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {previewModalFile.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                      {previewModalFile.meta || 'Official SRI Course & Research File Preview'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href={previewModalFile.url}
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
                    href={previewModalFile.url}
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
                  <button
                    onClick={() => setPreviewModalFile(null)}
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
                {/\.(mp4|webm|mov)$/i.test(previewModalFile.url) || previewModalFile.ext === 'VIDEO' ? (
                  <video
                    src={previewModalFile.url}
                    controls
                    autoPlay
                    style={{ width: '100%', height: '100%', background: '#050F2A' }}
                  />
                ) : (
                  <iframe
                    src={previewModalFile.url}
                    title={previewModalFile.title}
                    style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* OFFICIAL MERCHANT APPROVAL & POLICIES FOOTER */}
        <footer
          style={{
            marginTop: 'auto',
            borderTop: '1px solid #E4DFD3',
            background: '#EFE6CF',
            padding: '20px clamp(16px,3.6vw,36px)',
            fontSize: 12.5,
            color: '#3A4260',
          }}
        >
          <div
            style={{
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
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            background: '#071A44',
            display: 'flex',
            overflowX: 'auto',
            padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
          }}
        >
          {navFiltered.map(([k, icon, , short]) => {
            const active = navKey === k;
            return (
              <a
                key={k}
                href={`#${k}`}
                onClick={e => {
                  e.preventDefault();
                  setRoute(k);
                }}
                style={{
                  flex: '1 0 68px',
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
