import { getDb } from '@/lib/db';
import { SessionUser } from '@/lib/auth';

export const DEFAULT_PAYMENT_GATEWAYS = {
  paymob: {
    enabled: true,
    status: 'Connected',
    mode: 'Live',
    merchantId: '104892',
    integrationId: '4410928',
    iframeId: '819204',
    apiKey: 'pk_live_sri_epnu_paymob_99x',
    hmacSecret: 'hmac_sri_epnu_8821',
  },
  wallet: {
    enabled: true,
    status: 'Manual check',
    provider: 'Vodafone Cash',
    walletNumber: '0101 234 5678',
    walletOwnerName: 'SRI EPNU Treasury (Dr. Toka Essam)',
    qrCodeUrl: '',
    instructions:
      'Transfer the total to our Vodafone Cash number above, then upload your transfer screenshot. Access unlocks once Co-Admin / Admin approves the screenshot.',
  },
  fawry: {
    enabled: true,
    status: 'Connected',
    merchantCode: 'FWRY-EPNU-2026',
    securityKey: 'fwy_sec_sri_epnu_2026',
    expiryHours: 48,
  },
  instapay: {
    enabled: true,
    status: 'Manual check',
    handle: 'sri.epnu@instapay',
    phoneNumber: '0101 234 5678',
    paymentLink: 'https://ipn.eg/S/sri.epnu/instapay/012345',
    qrCodeUrl: '/assets/instapay-qr.svg',
    accountHolder: 'Student Research Initiative - EPNU',
    bankName: 'National Bank of Egypt (NBE) - Port Said Branch',
    accountNumber: '14200019283746',
    iban: 'EG380003014200019283746000192',
    instructions:
      'Scan the InstaPay QR code, click Open InstaPay Link, or transfer to our InstaPay number/IPA handle, then upload your transfer screenshot for Co-Admin / Admin approval.',
  },
  subscriptions: {
    enabled: true,
    status: 'Paymob subscriptions',
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

export const DEFAULT_CONTACT_MESSAGES = [
  {
    id: 'msg-1',
    name: 'Dr. Omar El-Shenawy',
    email: 'omar.elshenawy@med.cu.edu.eg',
    phone: '+20 109 842 1190',
    subject: 'Group Enrollment Inquiry for 15 Medical Interns',
    message:
      'Hello SRI Team, we would like to enroll 15 house officers from Cairo University Hospitals into the Systematic Reviews & PRISMA Mastery and Biostatistics courses. Can we pay via InstaPay in EGP and receive an official invoice?',
    status: 'Unread',
    adminNote: '',
    createdAt: 'Oct 27, 2026 · 2:15 PM',
  },
  {
    id: 'msg-2',
    name: 'Nourhan Abdelrahman',
    email: 'nourhan.abdelrahman@epnu.edu.eg',
    phone: '+20 101 553 7821',
    subject: 'InstaPay Transfer Verification & Course Access',
    message:
      'Good afternoon, I transferred EGP 599 via InstaPay for the Academic Term Bundle (4 Months) 20 minutes ago. Kindly confirm receipt and activate my access. Thank you!',
    status: 'Read',
    adminNote: 'Verified InstaPay receipt and unlocked Academic Term Bundle.',
    createdAt: 'Oct 26, 2026 · 5:40 PM',
  },
];

export function getMergedPaymentGateways(raw?: any) {
  const mergedSubs = {
    ...DEFAULT_PAYMENT_GATEWAYS.subscriptions,
    ...(raw?.subscriptions || {}),
  };
  if (!Array.isArray(raw?.subscriptions?.plans)) {
    mergedSubs.plans = DEFAULT_PAYMENT_GATEWAYS.subscriptions.plans;
  }
  return {
    paymob: { ...DEFAULT_PAYMENT_GATEWAYS.paymob, ...(raw?.paymob || {}) },
    wallet: { ...DEFAULT_PAYMENT_GATEWAYS.wallet, ...(raw?.wallet || {}) },
    fawry: { ...DEFAULT_PAYMENT_GATEWAYS.fawry, ...(raw?.fawry || {}) },
    instapay: { ...DEFAULT_PAYMENT_GATEWAYS.instapay, ...(raw?.instapay || {}) },
    subscriptions: mergedSubs,
  };
}

export function buildFullState(sessionUser?: SessionUser | null) {
  const db = getDb();
  const role = sessionUser?.role || null;
  const isAdmin = role === 'admin';
  const isCoAdmin = role === 'coadmin';
  const isStaff = isAdmin || isCoAdmin;

  const rawSettings = db.prepare('SELECT * FROM platform_settings').all() as any[];
  const allSettings: Record<string, any> = {};
  for (const row of rawSettings) {
    allSettings[row.key] = JSON.parse(row.value_json);
  }
  const coadminPerms = {
    courses: true,
    review: true,
    students: true,
    payments: true,
    settings: false,
    del: false,
    ...(allSettings.coadmin_perms || {}),
  };
  const fileAccessSettings = {
    allowLessonPdfDownload: true,
    allowResourceDownload: true,
    allowResearchDownload: true,
    allowPublicPreviewDownload: true,
    ...(allSettings.file_access_settings || {}),
  };
  const contactMessages: any[] = Array.isArray(allSettings.contact_messages)
    ? allSettings.contact_messages
    : DEFAULT_CONTACT_MESSAGES;
  const mergedGateways = getMergedPaymentGateways(allSettings.payment_gateways);

  const categories = db.prepare('SELECT * FROM categories ORDER BY rowid ASC').all() as any[];
  const rawCourses = db.prepare('SELECT * FROM courses ORDER BY rowid ASC').all() as any[];
  const rawModules = db.prepare('SELECT * FROM modules ORDER BY course_id ASC, position ASC, rowid ASC').all() as any[];
  const rawLessons = db.prepare('SELECT * FROM lessons ORDER BY module_id ASC, position ASC, rowid ASC').all() as any[];
  const rawResources = db.prepare('SELECT * FROM lesson_resources ORDER BY rowid ASC').all() as any[];
  const rawQuestions = db.prepare('SELECT * FROM quiz_questions ORDER BY lesson_id ASC, position ASC, rowid ASC').all() as any[];

  const questionsByLesson: Record<string, any[]> = {};
  for (const q of rawQuestions) {
    if (!questionsByLesson[q.lesson_id]) questionsByLesson[q.lesson_id] = [];
    questionsByLesson[q.lesson_id].push({
      id: q.id,
      lessonId: q.lesson_id,
      position: q.position,
      text: q.question_text,
      opts: JSON.parse(q.options_json || '["","","",""]'),
      a: sessionUser ? q.correct_index : undefined,
      explanation: sessionUser ? q.explanation || '' : '',
    });
  }

  const fallbackPdfFiles = [
    '/files/protocol-template.pdf',
    '/files/pico-worksheet.pdf',
    '/files/study-design-chart.pdf',
    '/files/search-templates.pdf',
    '/files/observational-slides.pdf',
  ];

  const resourcesByLesson: Record<string, any[]> = {};
  for (let i = 0; i < rawResources.length; i++) {
    const r = rawResources[i];
    if (!resourcesByLesson[r.lesson_id]) resourcesByLesson[r.lesson_id] = [];
    resourcesByLesson[r.lesson_id].push({
      id: r.id,
      lessonId: r.lesson_id,
      ext: r.ext || 'PDF',
      t: r.title,
      s: r.size_meta,
      url: r.file_url || fallbackPdfFiles[i % fallbackPdfFiles.length],
    });
  }

  const lessonsByModule: Record<string, any[]> = {};
  for (let i = 0; i < rawLessons.length; i++) {
    const l = rawLessons[i];
    if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
    const defaultPdf = fallbackPdfFiles[i % fallbackPdfFiles.length];
    lessonsByModule[l.module_id].push({
      id: l.id,
      moduleId: l.module_id,
      courseId: l.course_id,
      position: l.position,
      type: l.type,
      t: l.title,
      tAr: l.title_ar || l.title,
      d: l.duration_or_meta,
      free: !!l.is_free_preview,
      up: !!l.is_uploaded,
      fileUrl: l.file_url || defaultPdf,
      videoUrl: l.video_url || '/files/sample-lecture.mp4',
      subtitlesUrl: l.subtitles_url || '',
      slidesUrl: l.slides_url || '/files/observational-slides.pdf',
      overview: l.overview_text || '',
      passMark: l.pass_mark || 70,
      timeLimitMin: l.time_limit_min || 15,
      attemptsAllowed: l.attempts_allowed || 'Unlimited',
      questionOrder: l.question_order || 'Shuffle',
      resources: resourcesByLesson[l.id] || [],
      questions: questionsByLesson[l.id] || [],
    });
  }

  const modulesByCourse: Record<string, any[]> = {};
  for (const m of rawModules) {
    if (!modulesByCourse[m.course_id]) modulesByCourse[m.course_id] = [];
    modulesByCourse[m.course_id].push({
      id: m.id,
      courseId: m.course_id,
      position: m.position,
      t: m.title,
      tAr: m.title_ar || m.title,
      desc: m.description || '',
      items: lessonsByModule[m.id] || [],
    });
  }

  const catMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));

  const courses = rawCourses
    .filter((c: any) => isStaff || c.status === 'Published')
    .map((c: any) => {
      const mods = modulesByCourse[c.id] || [];
      const allItems = mods.flatMap((m: any) => m.items);
      const videosCount = allItems.filter((i: any) => i.type === 'video').length;
      const pdfsCount = allItems.filter((i: any) => i.type === 'pdf').length;
      const quizzesCount = allItems.filter((i: any) => i.type === 'quiz').length;

      return {
        id: c.id,
        title: c.title,
        titleAr: c.title_ar || c.title,
        description: c.description,
        descriptionAr: c.description_ar || c.description,
        mentor: c.mentor,
        categoryId: c.category_id,
        cat: catMap[c.category_id]?.name || 'Research methods',
        catAr: catMap[c.category_id]?.name_ar || 'مناهج البحث العلمي',
        price: c.price > 0 ? c.price : 250,
        priceLabel: `EGP ${c.price > 0 ? c.price : 250}`,
        level: c.level,
        language: c.language,
        status: c.status,
        includedInMembership: !!c.included_in_membership,
        accessDuration: c.access_duration,
        coverImage: c.cover_image || '',
        previewVideoUrl: c.preview_video_url || '/files/sample-lecture.mp4',
        studentsCount: c.students_count,
        videos:
          videosCount ||
          (c.id === 'course-1' ? 18 : c.id === 'course-2' ? 24 : c.id === 'course-3' ? 14 : c.id === 'course-4' ? 20 : c.id === 'course-5' ? 9 : 6),
        pdfs:
          pdfsCount ||
          (c.id === 'course-1' ? 6 : c.id === 'course-2' ? 8 : c.id === 'course-3' ? 10 : c.id === 'course-4' ? 7 : c.id === 'course-5' ? 4 : 3),
        quizzes:
          quizzesCount ||
          (c.id === 'course-1' ? 5 : c.id === 'course-2' ? 6 : c.id === 'course-3' ? 3 : c.id === 'course-4' ? 4 : c.id === 'course-5' ? 2 : 1),
        modules: mods,
      };
    });

  // Never select the password column from users
  const allSafeUsers = isStaff
    ? (db
        .prepare(
          `SELECT id, name, email, role, student_id_code, faculty, year_level, plan, membership_renews, last_active, avatar_initials
           FROM users ORDER BY rowid ASC`
        )
        .all() as any[])
    : sessionUser
    ? [sessionUser]
    : [];

  const enrollments = sessionUser
    ? (
        (isStaff
          ? db.prepare('SELECT * FROM enrollments ORDER BY rowid DESC').all()
          : db.prepare('SELECT * FROM enrollments WHERE user_id = ? ORDER BY rowid DESC').all(sessionUser.id)) as any[]
      ).map(e => ({
        ...e,
        completedLessons: JSON.parse(e.completed_lessons_json || '[]'),
      }))
    : [];

  const quizAttempts = sessionUser
    ? (
        (isStaff
          ? db.prepare('SELECT * FROM quiz_attempts ORDER BY rowid DESC').all()
          : db.prepare('SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY rowid DESC').all(sessionUser.id)) as any[]
      ).map(a => ({
        ...a,
        passed: !!a.passed,
        answers: JSON.parse(a.answers_json || '{}'),
      }))
    : [];

  const lessonNotes = sessionUser
    ? (db
        .prepare('SELECT * FROM lesson_notes WHERE user_id = ? ORDER BY timestamp_sec ASC, rowid DESC')
        .all(sessionUser.id) as any[])
    : [];

  const lessonDiscussions = sessionUser
    ? (db.prepare('SELECT * FROM lesson_discussions ORDER BY rowid ASC').all() as any[])
    : [];

  const rawSubs = !sessionUser
    ? []
    : isStaff
    ? (db.prepare('SELECT * FROM research_submissions ORDER BY rowid ASC').all() as any[])
    : (db.prepare('SELECT * FROM research_submissions WHERE user_id = ? ORDER BY rowid ASC').all(sessionUser.id) as any[]);

  const researchSubmissions = rawSubs.map(r => ({
    id: r.id,
    userId: r.user_id,
    a: r.author_name,
    t: r.title,
    type: r.type,
    sup: r.supervisor,
    coAuthors: r.co_authors || '',
    abs: r.abstract_text,
    file: r.file_name,
    fileUrl: r.file_url,
    fileSize: r.file_size,
    pagesCount: r.pages_count,
    st: r.stage,
    when: r.submitted_date,
    notes: JSON.parse(r.notes_json || '[]'),
    timeline: JSON.parse(r.timeline_json || '[]'),
  }));

  const canSeePayments = isStaff;
  const payments = canSeePayments
    ? (db.prepare('SELECT * FROM payments ORDER BY rowid DESC').all() as any[])
    : sessionUser
    ? (db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY rowid DESC').all(sessionUser.id) as any[])
    : [];

  const coupons = db.prepare('SELECT * FROM coupons ORDER BY rowid ASC').all() as any[];

  const liveSessions = (db.prepare('SELECT * FROM live_sessions ORDER BY rowid ASC').all() as any[]).map(s => ({
    ...s,
    meeting_link: sessionUser ? s.meeting_link : '',
    bookedUsers: sessionUser ? JSON.parse(s.booked_users_json || '[]') : [],
  }));

  const certificates = sessionUser
    ? ((isStaff
        ? db.prepare('SELECT * FROM certificates ORDER BY rowid DESC').all()
        : db.prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY rowid DESC').all(sessionUser.id)) as any[])
    : [];

  const scopedSettings: Record<string, any> = {
    file_access_settings: fileAccessSettings,
  };
  if (isStaff) {
    scopedSettings.coadmin_perms = coadminPerms;
    scopedSettings.contact_messages = contactMessages;
  }
  if (isAdmin || (isCoAdmin && (!!coadminPerms.settings || !!coadminPerms.payments))) {
    scopedSettings.payment_gateways = mergedGateways;
  }

  // Safe non-secret public checkout display configuration (no API keys or HMAC secrets)
  const publicGateways = {
    paymob: {
      enabled: !!mergedGateways.paymob.enabled,
      mode: mergedGateways.paymob.mode,
    },
    wallet: {
      enabled: !!mergedGateways.wallet.enabled,
      provider: mergedGateways.wallet.provider,
      walletNumber: mergedGateways.wallet.walletNumber,
      walletOwnerName: mergedGateways.wallet.walletOwnerName,
      qrCodeUrl: mergedGateways.wallet.qrCodeUrl || '',
      instructions: mergedGateways.wallet.instructions,
    },
    fawry: {
      enabled: !!mergedGateways.fawry.enabled,
      merchantCode: mergedGateways.fawry.merchantCode,
      expiryHours: mergedGateways.fawry.expiryHours,
    },
    instapay: {
      enabled: !!mergedGateways.instapay.enabled,
      handle: mergedGateways.instapay.handle,
      phoneNumber: mergedGateways.instapay.phoneNumber || '0101 234 5678',
      paymentLink: mergedGateways.instapay.paymentLink || 'https://ipn.eg/S/sri.epnu/instapay/012345',
      qrCodeUrl: mergedGateways.instapay.qrCodeUrl || '/assets/instapay-qr.svg',
      accountHolder: mergedGateways.instapay.accountHolder,
      bankName: mergedGateways.instapay.bankName,
      accountNumber: mergedGateways.instapay.accountNumber,
      iban: mergedGateways.instapay.iban,
      instructions: mergedGateways.instapay.instructions,
    },
    subscriptions: {
      enabled: !!mergedGateways.subscriptions.enabled,
      monthlyPrice: Number(mergedGateways.subscriptions.monthlyPrice) || 199,
      currency: mergedGateways.subscriptions.currency || 'EGP',
      plans: mergedGateways.subscriptions.plans || [],
    },
  };

  return JSON.parse(
    JSON.stringify({
      authenticatedUser: sessionUser || null,
      categories,
      courses,
      users: allSafeUsers,
      enrollments,
      quizAttempts,
      lessonNotes,
      lessonDiscussions,
      researchSubmissions,
      payments,
      coupons,
      liveSessions,
      certificates,
      contactMessages: isStaff ? contactMessages : [],
      settings: scopedSettings,
      fileAccess: fileAccessSettings,
      publicGateways,
    })
  );
}
