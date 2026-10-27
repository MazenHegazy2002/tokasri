'use client';

import React, { useState, useEffect } from 'react';

interface PublicPortalProps {
  state: any;
  currentUser: any;
  lang: 'en' | 'ar';
  setLang: (l: 'en' | 'ar') => void;
  mobile: boolean;
  onAction: (action: string, payload?: any) => Promise<any>;
  onUploadFile: (file: File) => Promise<{ url: string; fileName: string; sizeLabel: string } | null>;
  onNavigatePortal: (portal: 'public' | 'student' | 'admin', subRoute?: string, extra?: any) => void;
  onSelectUser: (user: any) => void;
  onLogout?: () => void;
  initialSubRoute?: string;
  selectedCourseId: string;
  setSelectedCourseId: (id: string) => void;
}

export default function PublicPortal({
  state,
  currentUser,
  lang,
  setLang,
  mobile,
  onAction,
  onUploadFile,
  onNavigatePortal,
  onSelectUser,
  onLogout,
  initialSubRoute = 'landing',
  selectedCourseId,
  setSelectedCourseId,
}: PublicPortalProps) {
  const [route, setRoute] = useState<string>(initialSubRoute || 'landing');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openMods, setOpenMods] = useState<Record<number, boolean>>({ 0: true });
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [previewPlaying, setPreviewPlaying] = useState<boolean>(false);
  const [publicPreviewFile, setPublicPreviewFile] = useState<{
    title: string;
    url: string;
    ext?: string;
    meta?: string;
  } | null>(null);

  // Contact Us form state
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactSubject, setContactSubject] = useState<string>('Course Enrollment & Payment Inquiry');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactSent, setContactSent] = useState<boolean>(false);

  useEffect(() => {
    if (initialSubRoute) setRoute(initialSubRoute);
  }, [initialSubRoute]);

  // Checkout state
  const [checkoutPlan, setCheckoutPlan] = useState<'Course' | 'Membership'>('Course');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-monthly');
  const [pm, setPm] = useState<'card' | 'wallet' | 'fawry' | 'insta'>('card');
  const [couponInput, setCouponInput] = useState<string>('SRI25');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('SRI25');
  const [paidState, setPaidState] = useState<{ paid: boolean; refCode?: string; status?: string }>({ paid: false });
  const [checkoutName, setCheckoutName] = useState<string>(currentUser?.name || '');
  const [checkoutEmail, setCheckoutEmail] = useState<string>(currentUser?.email || '');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');
  const [walletPhone, setWalletPhone] = useState<string>('');
  const [instaReceiptUrl, setInstaReceiptUrl] = useState<string>('');
  const [instaReceiptName, setInstaReceiptName] = useState<string>('');
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [copiedLabel, setCopiedLabel] = useState<string>('');

  const copyText = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(''), 2000);
    }
  };

  // Auth state
  const [signup, setSignup] = useState<boolean>(false);
  const [authName, setAuthName] = useState<string>('');
  const [authStudentId, setAuthStudentId] = useState<string>('');
  const [authFaculty, setAuthFaculty] = useState<string>('Medicine');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const isRtl = lang === 'ar';
  const publishedCourses = (state.courses || []).filter((c: any) => c.status === 'Published' || state.courses.length > 0);
  const currentCourse =
    (state.courses || []).find((c: any) => c.id === selectedCourseId) ||
    publishedCourses[0] ||
    state.courses?.[0];

  const catNames = ['All', ...(state.categories || []).map((c: any) => c.name)];
  const filteredCourses = publishedCourses.filter((c: any) => {
    const matchCat = catFilter === 'All' || c.cat === catFilter;
    const matchQ =
      !searchQuery.trim() ||
      (c.title + ' ' + c.titleAr + ' ' + c.mentor + ' ' + c.cat)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchCat && matchQ;
  });

  // Coupon & Total calculation
  const pg = state.publicGateways || state.settings?.payment_gateways || {};
  const rawPlans: any[] = Array.isArray(pg.subscriptions?.plans) && pg.subscriptions.plans.length > 0
    ? pg.subscriptions.plans
    : [
        {
          id: 'plan-monthly',
          name: 'SRI Monthly Membership',
          nameAr: 'عضوية SRI الشهرية',
          badge: 'MOST POPULAR',
          price: Number(pg.subscriptions?.monthlyPrice) || 199,
          currency: pg.subscriptions?.currency || 'EGP',
          period: 'month',
          periodAr: 'شهرياً',
          description: 'Every course, live mentorship sessions and priority manuscript review. Cancel anytime.',
          descriptionAr: 'وصول كامل لجميع الدورات، جلسات الإرشاد المباشرة، وأولوية مراجعة وتحكيم الأبحاث.',
          accessType: 'all',
          courseIds: publishedCourses.map((c: any) => c.id),
          enabled: true,
        },
      ];
  const availablePlans = rawPlans.filter((p: any) => p.enabled !== false);
  const activePlanObj =
    availablePlans.find((p: any) => p.id === selectedPlanId) ||
    availablePlans[0] ||
    rawPlans[0];
  const membershipMonthlyPrice = Number(activePlanObj?.price || pg.subscriptions?.monthlyPrice) || 199;
  const baseSubtotal = checkoutPlan === 'Membership' ? membershipMonthlyPrice : (currentCourse?.price ?? 450);
  const matchedCoupon = (state.coupons || []).find(
    (cp: any) => cp.code.toUpperCase() === appliedCoupon.trim().toUpperCase() && cp.active
  );
  const discountAmount = matchedCoupon
    ? matchedCoupon.discount_pct > 0
      ? Math.round((baseSubtotal * matchedCoupon.discount_pct) / 100)
      : matchedCoupon.discount_fixed
    : 0;
  const finalTotal = Math.max(0, baseSubtotal - discountAmount);

  const handlePay = async () => {
    setCheckoutError('');
    if (!currentUser) {
      setAuthError('Please sign in or create an account to complete checkout.');
      setRoute('login');
      return;
    }
    if ((pm === 'insta' || pm === 'wallet') && !instaReceiptUrl) {
      setCheckoutError(
        pm === 'insta'
          ? 'Please upload the screenshot of your InstaPay transfer receipt before submitting.'
          : 'Please upload the screenshot of your Vodafone Cash transfer receipt before submitting.'
      );
      return;
    }
    const res = await onAction('checkout_pay', {
      courseId: checkoutPlan === 'Course' ? currentCourse?.id : '',
      planType: checkoutPlan,
      planId: checkoutPlan === 'Membership' ? activePlanObj?.id : '',
      method: pm,
      couponCode: matchedCoupon ? matchedCoupon.code : '',
      receiptUrl: instaReceiptUrl,
      senderPhone: walletPhone,
    });
    if (res?.error) {
      setCheckoutError(res.error);
      return;
    }
    if (res?.ok) {
      setPaidState({ paid: true, refCode: res.referenceCode, status: res.status });
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheckoutError('');
    setUploadingReceipt(true);
    const uploaded = await onUploadFile(file);
    setUploadingReceipt(false);
    if (uploaded) {
      setInstaReceiptUrl(uploaded.url);
      setInstaReceiptName(`${uploaded.fileName} (${uploaded.sizeLabel})`);
    }
  };

  const handleAuthSubmit = async () => {
    setAuthError('');
    if (signup) {
      if (!authName.trim() || !authEmail.trim() || !authPassword.trim()) {
        setAuthError('Please enter your full name, university email, and password.');
        return;
      }
      const res = await onAction('signup', {
        name: authName,
        email: authEmail,
        password: authPassword,
        studentIdCode: authStudentId || '2026-0412',
        faculty: authFaculty,
        yearLevel: 2,
      });
      if (res?.error) {
        setAuthError(res.error);
        return;
      }
      if (res?.user) {
        onSelectUser(res.user);
        onNavigatePortal('student', 'dashboard', { authenticatedUser: res.user });
      }
    } else {
      if (!authEmail.trim() || !authPassword.trim()) {
        setAuthError('Please enter your email and password.');
        return;
      }
      const res = await onAction('login', { email: authEmail, password: authPassword });
      if (res?.error) {
        setAuthError(res.error);
        return;
      }
      if (res?.user) {
        onSelectUser(res.user);
        if (res.user.role === 'admin' || res.user.role === 'coadmin') {
          onNavigatePortal('admin', 'dashboard', {
            authenticatedUser: res.user,
            role: res.user.role === 'coadmin' ? 'co' : 'admin',
          });
        } else {
          onNavigatePortal('student', 'dashboard', { authenticatedUser: res.user });
        }
      }
    }
  };

  const steps = [
    {
      n: '01',
      t: isRtl ? 'ارفع مسودة بحثك' : 'Upload your manuscript',
      d: isRtl ? 'ملف PDF أو DOCX مع العنوان والملخص والباحثين المشاركين.' : 'PDF or DOCX with title, abstract and co-authors.',
    },
    {
      n: '02',
      t: isRtl ? 'المراجعة الأولية (مساعد المشرف)' : 'Co-admin first review',
      d: isRtl ? 'فحص الهيكلة والمنهجية العلمية وإضافة ملاحظات التحسين.' : 'Checks structure and methods and leaves comments.',
    },
    {
      n: '03',
      t: isRtl ? 'الاعتماد النهائي (إدارة SRI)' : 'Admin final approval',
      d: isRtl ? 'الاعتماد النهائي أو طلب تعديلات محددة قبل النشر.' : 'Signs off or sends it back with requested changes.',
    },
    {
      n: '04',
      t: isRtl ? 'جاهز للمؤتمرات العلمية' : 'Conference-ready',
      d: isRtl ? 'ترشيح الأبحاث المعتمدة للمشاركة في المؤتمرات الطلابية.' : 'Approved work is put forward to research conferences.',
    },
  ];

  const includes = [
    { icon: 'play_circle', t: `${currentCourse?.videos || 18} ${isRtl ? 'محاضرة فيديو' : 'video lessons'}` },
    { icon: 'description', t: `${currentCourse?.pdfs || 6} ${isRtl ? 'ملفات PDF وقوالب' : 'PDFs & templates'}` },
    { icon: 'quiz', t: `${currentCourse?.quizzes || 5} ${isRtl ? 'اختبارات تقييمية' : 'quizzes + final exam'}` },
    { icon: 'workspace_premium', t: isRtl ? 'شهادة معتمدة من SRI' : 'SRI certificate' },
  ];

  const allPaymentMethods = [
    {
      k: 'card' as const,
      enabled: pg.paymob?.enabled !== false,
      icon: 'credit_card',
      t: isRtl ? 'بطاقة بنكية' : 'Card',
      d: 'Visa, Mastercard, Meeza',
    },
    {
      k: 'wallet' as const,
      enabled: pg.wallet?.enabled !== false,
      icon: 'smartphone',
      t: isRtl ? 'محفظة إلكترونية' : 'Mobile wallet',
      d: pg.wallet?.provider || 'Vodafone Cash, etisalat, Orange',
    },
    {
      k: 'fawry' as const,
      enabled: pg.fawry?.enabled !== false,
      icon: 'storefront',
      t: isRtl ? 'فوري (Fawry)' : 'Fawry',
      d: isRtl ? 'ادفع نقداً من أي منفذ فوري' : 'Pay cash at an outlet',
    },
    {
      k: 'insta' as const,
      enabled: pg.instapay?.enabled !== false,
      icon: 'account_balance',
      t: 'InstaPay / Bank',
      d: isRtl ? 'تحويل بنكي ومراجعة الإيصال' : 'Bank transfer, manual check',
    },
  ];
  const paymentMethods = allPaymentMethods.filter(m => m.enabled);

  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.some(m => m.k === pm)) {
      setPm(paymentMethods[0].k);
    }
  }, [paymentMethods, pm]);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: '#F6F3EC',
        fontFamily: isRtl ? "'Cairo', 'Montserrat', sans-serif" : "'Montserrat', sans-serif",
        color: '#0E1736',
        fontSize: '15px',
        lineHeight: 1.5,
      }}
    >
      {/* STICKY HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: '#071A44',
          color: '#fff',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '12px clamp(16px,4vw,40px)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <a
            href="#landing"
            onClick={e => {
              e.preventDefault();
              setRoute('landing');
              setMenuOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', textDecoration: 'none' }}
          >
            <img src="/assets/sri-logo.png" alt="SRI" style={{ width: 42, height: 42, borderRadius: '50%' }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '.02em' }}>SRI</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: '#4BB4EC',
                }}
              >
                {isRtl ? 'مبادرة البحث الطلابي · EPNU' : 'Student Research Initiative'}
              </span>
            </span>
          </a>

          {!mobile && (
            <nav style={{ display: 'flex', gap: '16px', marginLeft: '12px', fontSize: 13.5, fontWeight: 600, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href="/#catalog"
                onClick={e => {
                  e.preventDefault();
                  setRoute('landing');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
                  setTimeout(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                style={{ color: route === 'landing' ? '#fff' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'الدورات (EGP)' : 'Courses (EGP)'}
              </a>
              <a
                href="/#pricing-section"
                onClick={e => {
                  e.preventDefault();
                  setRoute('landing');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
                  setTimeout(() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                style={{ color: 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'الباقات والأسعار' : 'Pricing & Plans'}
              </a>
              <a
                href="/about"
                onClick={e => {
                  e.preventDefault();
                  setRoute('about');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/about');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: route === 'about' ? '#F2B22E' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'من نحن' : 'About Us'}
              </a>
              <a
                href="/contact"
                onClick={e => {
                  e.preventDefault();
                  setRoute('contact');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/contact');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: route === 'contact' ? '#F2B22E' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'اتصل بنا' : 'Contact Us'}
              </a>
              <a
                href="/privacy-policy"
                onClick={e => {
                  e.preventDefault();
                  setRoute('privacy');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/privacy-policy');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: route === 'privacy' ? '#F2B22E' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'الخصوصية' : 'Privacy Policy'}
              </a>
              <a
                href="/refund-policy"
                onClick={e => {
                  e.preventDefault();
                  setRoute('refund');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/refund-policy');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: route === 'refund' ? '#F2B22E' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'الاسترداد والإلغاء' : 'Refund Policy'}
              </a>
              <a
                href="/delivery-policy"
                onClick={e => {
                  e.preventDefault();
                  setRoute('delivery');
                  if (typeof window !== 'undefined') window.history.pushState({}, '', '/delivery-policy');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: route === 'delivery' ? '#F2B22E' : 'rgba(255,255,255,.78)' }}
              >
                {isRtl ? 'سياسة التسليم' : 'Delivery Policy'}
              </a>
            </nav>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              style={{
                background: 'rgba(255,255,255,.1)',
                border: '1px solid rgba(255,255,255,.2)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '7px 12px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>

            {!mobile && (
              <>
                {currentUser ? (
                  <>
                    <button
                      onClick={() =>
                        onNavigatePortal(
                          currentUser.role === 'admin' || currentUser.role === 'coadmin' ? 'admin' : 'student',
                          'dashboard',
                          {
                            authenticatedUser: currentUser,
                            role: currentUser.role === 'coadmin' ? 'co' : 'admin',
                          }
                        )
                      }
                      style={{
                        background: 'rgba(75,180,236,.16)',
                        border: '1px solid rgba(75,180,236,.4)',
                        color: '#4BB4EC',
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '8px 16px',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      {isRtl ? 'لوحة التحكم' : 'My Dashboard'} ({currentUser.name.split(' ')[0]})
                    </button>
                    {onLogout && (
                      <button
                        onClick={onLogout}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,.25)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 13,
                          padding: '8px 14px',
                          borderRadius: 999,
                          cursor: 'pointer',
                        }}
                      >
                        {isRtl ? 'تسجيل الخروج' : 'Sign out'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <a
                      href="#login"
                      onClick={e => {
                        e.preventDefault();
                        setSignup(false);
                        setRoute('login');
                      }}
                      style={{ color: '#fff', fontWeight: 600, fontSize: 14, padding: '8px 10px' }}
                    >
                      {isRtl ? 'دخول' : 'Sign in'}
                    </a>
                    <a
                      href="#login"
                      onClick={e => {
                        e.preventDefault();
                        setSignup(true);
                        setRoute('login');
                      }}
                      style={{
                        background: '#F2B22E',
                        color: '#071A44',
                        fontWeight: 700,
                        fontSize: 14,
                        padding: '10px 18px',
                        borderRadius: 999,
                        textDecoration: 'none',
                      }}
                    >
                      {isRtl ? 'انضم إلى SRI' : 'Join SRI'}
                    </a>
                  </>
                )}
              </>
            )}

            {mobile && !currentUser && (
              <a
                href="#login"
                onClick={e => {
                  e.preventDefault();
                  setSignup(false);
                  setRoute('login');
                }}
                style={{
                  background: '#F2B22E',
                  color: '#071A44',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '8px 14px',
                  borderRadius: 999,
                  textDecoration: 'none',
                }}
              >
                {isRtl ? 'دخول' : 'Sign in'}
              </a>
            )}

            {mobile && (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  background: 'none',
                  border: 0,
                  color: '#fff',
                  width: 44,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span className="material-icon" style={{ fontSize: 26 }}>
                  {menuOpen ? 'close' : 'menu'}
                </span>
              </button>
            )}
          </div>
        </div>

        {mobile && menuOpen && (
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '8px 16px 16px',
              fontWeight: 600,
              gap: '6px',
              borderTop: '1px solid rgba(255,255,255,.1)',
            }}
          >
            <a
              href="#landing"
              onClick={e => {
                e.preventDefault();
                setRoute('landing');
                setMenuOpen(false);
              }}
              style={{ color: '#fff', padding: '10px 4px' }}
            >
              {isRtl ? 'الدورات التدريبية' : 'Courses'}
            </a>
            <a
              href="/about"
              onClick={e => {
                e.preventDefault();
                setRoute('about');
                setMenuOpen(false);
              }}
              style={{ color: '#fff', padding: '10px 4px' }}
            >
              {isRtl ? 'من نحن' : 'About Us'}
            </a>
            <a
              href="/contact"
              onClick={e => {
                e.preventDefault();
                setRoute('contact');
                setMenuOpen(false);
              }}
              style={{ color: '#fff', padding: '10px 4px' }}
            >
              {isRtl ? 'اتصل بنا' : 'Contact Us'}
            </a>
            <a
              href="/privacy-policy"
              onClick={e => {
                e.preventDefault();
                setRoute('privacy');
                setMenuOpen(false);
              }}
              style={{ color: 'rgba(255,255,255,.8)', padding: '10px 4px', fontSize: 13 }}
            >
              {isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </a>
            <a
              href="/refund-policy"
              onClick={e => {
                e.preventDefault();
                setRoute('refund');
                setMenuOpen(false);
              }}
              style={{ color: 'rgba(255,255,255,.8)', padding: '10px 4px', fontSize: 13 }}
            >
              {isRtl ? 'سياسة الاسترجاع والإلغاء' : 'Refund & Cancellation Policy'}
            </a>
            <a
              href="/delivery-policy"
              onClick={e => {
                e.preventDefault();
                setRoute('delivery');
                setMenuOpen(false);
              }}
              style={{ color: 'rgba(255,255,255,.8)', padding: '10px 4px', fontSize: 13 }}
            >
              {isRtl ? 'سياسة التسليم والشحن' : 'Delivery & Shipping Policy'}
            </a>
            {currentUser ? (
              <>
                <a
                  href="#dashboard"
                  onClick={e => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onNavigatePortal(
                      currentUser.role === 'admin' || currentUser.role === 'coadmin' ? 'admin' : 'student',
                      'dashboard',
                      {
                        authenticatedUser: currentUser,
                        role: currentUser.role === 'coadmin' ? 'co' : 'admin',
                      }
                    );
                  }}
                  style={{ color: '#4BB4EC', padding: '10px 4px' }}
                >
                  {isRtl ? 'لوحة التحكم' : 'My Dashboard'}
                </a>
                {onLogout && (
                  <a
                    href="#logout"
                    onClick={e => {
                      e.preventDefault();
                      setMenuOpen(false);
                      onLogout();
                    }}
                    style={{ color: '#FF9B8A', padding: '10px 4px' }}
                  >
                    {isRtl ? 'تسجيل الخروج' : 'Sign out'}
                  </a>
                )}
              </>
            ) : (
              <a
                href="#login"
                onClick={e => {
                  e.preventDefault();
                  setSignup(false);
                  setRoute('login');
                  setMenuOpen(false);
                }}
                style={{ color: '#F2B22E', padding: '10px 4px' }}
              >
                {isRtl ? 'تسجيل الدخول' : 'Sign in'}
              </a>
            )}
          </nav>
        )}
      </header>

      {/* SCREEN 1A: LANDING & COURSE CATALOG */}
      {route === 'landing' && (
        <>
          <section
            style={{
              background: '#071A44',
              backgroundImage: 'radial-gradient(rgba(255,255,255,.28) 1px,transparent 1.6px)',
              backgroundSize: '44px 44px',
              color: '#fff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                maxWidth: '1280px',
                margin: '0 auto',
                padding: 'clamp(40px,7vw,96px) clamp(16px,4vw,40px)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '56px',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: '1 1 440px', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: '#4BB4EC',
                  }}
                >
                  {isRtl
                    ? 'جامعة شرق بورسعيد الأهلية · تأسست ٢٠٢٥ · أسرة طلاب من أجل مصر'
                    : 'East Port Said National University · Founded 2025'}
                </div>
                <h1
                  style={{
                    fontWeight: 900,
                    fontSize: 'clamp(38px,6vw,74px)',
                    lineHeight: 1.02,
                    letterSpacing: '-.02em',
                    margin: '18px 0 22px',
                  }}
                >
                  {isRtl ? (
                    <>
                      تعلّم البحث العلمي <span style={{ color: '#F2B22E' }}>بالممارسة</span> والعمل.
                    </>
                  ) : (
                    <>
                      Learn research by <span style={{ color: '#F2B22E' }}>doing</span> research.
                    </>
                  )}
                </h1>
                <p
                  style={{
                    fontSize: 'clamp(16px,1.5vw,18px)',
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,.82)',
                    maxWidth: 540,
                    margin: '0 0 32px',
                  }}
                >
                  {isRtl
                    ? 'مجتمع طلابي أسسته د. تقى عصام منذ عام ٢٠٢٥ لنشر ثقافة البحث العلمي وتمكين الطلاب من اكتساب المهارات البحثية للمشاركة في المؤتمرات العلمية الدولية.'
                    : 'A student community founded by Toka Essam since 2025 that promotes a culture of scientific research and gives students the skills to take part in research conferences. Courses, mentorship and manuscript review in one place.'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <a
                    href="#catalog"
                    onClick={e => {
                      e.preventDefault();
                      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      background: '#F2B22E',
                      color: '#071A44',
                      fontWeight: 700,
                      padding: '15px 26px',
                      borderRadius: 999,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isRtl ? 'تصفح الدورات' : 'Browse courses'}{' '}
                    <span className="material-icon" style={{ fontSize: 20 }}>
                      arrow_forward
                    </span>
                  </a>
                  <button
                    onClick={() => onNavigatePortal('student', 'research')}
                    style={{
                      background: 'transparent',
                      border: '1.5px solid rgba(255,255,255,.5)',
                      color: '#fff',
                      fontWeight: 700,
                      padding: '14px 24px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isRtl ? 'ارفع ورقتك البحثية للمراجعة' : 'Submit your research'}
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 22px',
                    marginTop: '40px',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>{isRtl ? 'قيادة طلابية' : 'Student-led'}</span>
                  <span style={{ color: '#4BB4EC' }}>{isRtl ? 'مدفوع بالبحث العلمي' : 'Research-driven'}</span>
                  <span style={{ color: '#F2B22E' }}>{isRtl ? 'صناعة الأثر' : 'Impact-focused'}</span>
                </div>
              </div>

              <div style={{ flex: '1 1 380px', minWidth: 0, position: 'relative', minHeight: 420 }}>
                <div
                  style={{
                    position: 'absolute',
                    right: -30,
                    bottom: -20,
                    width: 260,
                    height: 260,
                    backgroundImage: 'radial-gradient(#4BB4EC 2.2px,transparent 2.6px)',
                    backgroundSize: '14px 14px',
                    opacity: 0.45,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 10,
                    width: '78%',
                    background: '#fff',
                    padding: '12px 12px 40px',
                    transform: 'rotate(-3deg)',
                    boxShadow: '0 20px 50px rgba(0,0,0,.35)',
                  }}
                >
                  <img
                    src="/assets/podium.png"
                    alt="SRI podium"
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 200,
                    width: '62%',
                    background: '#fff',
                    padding: '10px 10px 34px',
                    transform: 'rotate(4deg)',
                    boxShadow: '0 20px 50px rgba(0,0,0,.35)',
                  }}
                >
                  <img
                    src="/assets/award.png"
                    alt="SRI award ceremony"
                    style={{
                      width: '100%',
                      aspectRatio: '16/10',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* COURSE CATALOG */}
          <section
            id="catalog"
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: 'clamp(48px,6vw,88px) clamp(16px,4vw,40px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '20px',
                marginBottom: '28px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: '#1446A0',
                  }}
                >
                  {isRtl ? 'دليل الدورات التدريبية' : 'Course catalog'}
                </div>
                <h2
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: 'clamp(32px,4vw,48px)',
                    lineHeight: 1.05,
                    margin: '8px 0 0',
                  }}
                >
                  {isRtl ? 'من السؤال البحثي الأول إلى منصة المؤتمر' : 'From first question to conference stage'}
                </h2>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#fff',
                    border: '1.5px solid #D3CDBF',
                    borderRadius: 999,
                    padding: '6px 14px',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 18, color: '#5A6280' }}>
                    search
                  </span>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'ابحث عن دورة...' : 'Search courses...'}
                    style={{
                      border: 0,
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      width: 140,
                      color: '#0E1736',
                    }}
                  />
                </div>
                {catNames.map(c => {
                  const on = c === catFilter;
                  return (
                    <button
                      key={c}
                      onClick={() => setCatFilter(c)}
                      style={{
                        border: `1.5px solid ${on ? '#071A44' : '#D3CDBF'}`,
                        background: on ? '#071A44' : 'transparent',
                        color: on ? '#fff' : '#0E1736',
                        fontWeight: 600,
                        fontSize: 13,
                        padding: '9px 16px',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,290px),1fr))',
                gap: '22px',
              }}
            >
              {filteredCourses.map((k: any) => (
                <a
                  key={k.id}
                  href="#course"
                  onClick={e => {
                    e.preventDefault();
                    setSelectedCourseId(k.id);
                    setRoute('course');
                    window.scrollTo(0, 0);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 16,
                    overflow: 'hidden',
                    color: '#0E1736',
                    textDecoration: 'none',
                    transition: 'transform .15s ease, box-shadow .15s ease',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '16/9',
                      background: 'repeating-linear-gradient(135deg,#E9EEF7 0 10px,#DDE5F2 10px 20px)',
                      position: 'relative',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {k.coverImage ? (
                      <img
                        src={k.coverImage}
                        alt={k.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}
                      />
                    ) : (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5A6B90' }}>
                        course cover
                      </span>
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: 12,
                        background: '#071A44',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '5px 10px',
                        borderRadius: 999,
                      }}
                    >
                      {isRtl ? k.catAr : k.cat}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '18px 18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      flex: 1,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>
                      {isRtl ? k.titleAr : k.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#5A6280' }}>{k.mentor}</div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        fontSize: 12,
                        color: '#5A6280',
                        marginTop: '2px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icon" style={{ fontSize: 17 }}>
                          play_circle
                        </span>
                        {k.videos} {isRtl ? 'فيديو' : 'videos'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icon" style={{ fontSize: 17 }}>
                          description
                        </span>
                        {k.pdfs} {isRtl ? 'ملفات PDF' : 'PDFs'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icon" style={{ fontSize: 17 }}>
                          quiz
                        </span>
                        {k.quizzes} {isRtl ? 'اختبارات' : 'quizzes'}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #EEEAE0',
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 17, color: '#0A2160' }}>{k.priceLabel}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1446A0' }}>{k.level}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* PRICING / MEMBERSHIP SECTION */}
          <section id="pricing-section" style={{ background: '#EFE6CF' }}>
            <div
              style={{
                maxWidth: '1280px',
                margin: '0 auto',
                padding: 'clamp(48px,6vw,88px) clamp(16px,4vw,40px)',
              }}
            >
              <h2
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(30px,4vw,44px)',
                  margin: '0 0 28px',
                }}
              >
                {isRtl ? 'خطط الأسعار والعضويات في SRI (بالجنيه المصري)' : 'Flexible Plans & Pricing (EGP)'}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 18,
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    border: '1px solid #E4DFD3',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: '#5A6280',
                    }}
                  >
                    {isRtl ? 'دورة منفردة' : 'Single course'}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 32, color: '#0A2160' }}>
                    EGP 250
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#5A6280' }}>
                      {isRtl ? ' – EGP 650 دفعة واحدة' : ' – EGP 650 one-time'}
                    </span>
                  </div>
                  <div style={{ color: '#3A4260', fontSize: 14, lineHeight: 1.55 }}>
                    {isRtl
                      ? 'ادفع مرة واحدة واحتفظ بجميع محاضرات الفيديو وملفات PDF والاختبارات مدى الحياة مع شهادة إتمام معتمدة.'
                      : 'Pay once and keep the videos, PDFs and quizzes for that course, with a certificate when you finish.'}
                  </div>
                  <div style={{ fontSize: 12, color: '#1446A0', fontWeight: 700, background: '#F1F5FD', padding: '8px 12px', borderRadius: 10 }}>
                    ✓ {isRtl ? 'اختر أي دورة منفردة من القائمة' : 'Access to 1 selected course + Certificate'}
                  </div>
                  <a
                    href="#catalog"
                    onClick={e => {
                      e.preventDefault();
                      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      marginTop: 'auto',
                      alignSelf: 'flex-start',
                      border: '1.5px solid #0A2160',
                      color: '#0A2160',
                      fontWeight: 700,
                      padding: '12px 22px',
                      borderRadius: 999,
                      textDecoration: 'none',
                    }}
                  >
                    {isRtl ? 'اختر دورة تدريبية' : 'Pick a course'}
                  </a>
                </div>

                {pg.subscriptions?.enabled !== false &&
                  availablePlans.map((plan: any, pIdx: number) => {
                    const isAllCourses = plan.accessType !== 'selected';
                    const planCourses = isAllCourses
                      ? publishedCourses
                      : publishedCourses.filter((c: any) => (plan.courseIds || []).includes(c.id));
                    return (
                      <div
                        key={plan.id || pIdx}
                        style={{
                          background: pIdx === 0 ? '#071A44' : '#0E2963',
                          color: '#fff',
                          borderRadius: 18,
                          padding: 28,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          position: 'relative',
                          overflow: 'hidden',
                          border: pIdx === 0 ? '2px solid #F2B22E' : '1px solid rgba(255,255,255,.15)',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            right: -20,
                            top: -20,
                            width: 140,
                            height: 140,
                            backgroundImage: 'radial-gradient(#F2B22E 2px,transparent 2.4px)',
                            backgroundSize: '13px 13px',
                            opacity: 0.3,
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: '.12em',
                              textTransform: 'uppercase',
                              color: '#F2B22E',
                            }}
                          >
                            {isRtl ? plan.nameAr || plan.name : plan.name}
                          </div>
                          {plan.badge && (
                            <span
                              style={{
                                background: 'rgba(242,178,46,.2)',
                                color: '#F2B22E',
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: 999,
                              }}
                            >
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 32 }}>
                          {plan.currency || 'EGP'} {plan.price}
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>
                            {' / '}
                            {isRtl ? plan.periodAr || plan.period : plan.period || 'month'}
                          </span>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,.82)', fontSize: 14, lineHeight: 1.55 }}>
                          {isRtl ? plan.descriptionAr || plan.description : plan.description}
                        </div>
                        <div
                          style={{
                            background: 'rgba(255,255,255,.08)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            fontSize: 12,
                            color: '#4BB4EC',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ fontWeight: 800, color: '#fff' }}>
                            {isAllCourses
                              ? isRtl
                                ? `✓ يشمل جميع الدورات (${publishedCourses.length} دورات)`
                                : `✓ Unlocks All ${publishedCourses.length} Courses`
                              : isRtl
                              ? `✓ يشمل ${planCourses.length} دورات محددة:`
                              : `✓ Includes ${planCourses.length} Selected Course(s):`}
                          </div>
                          {!isAllCourses && planCourses.length > 0 && (
                            <div style={{ color: 'rgba(255,255,255,.78)', fontSize: 11.5, lineHeight: 1.4 }}>
                              {planCourses.map((c: any) => (isRtl ? c.titleAr : c.title)).join(' · ')}
                            </div>
                          )}
                        </div>
                        <a
                          href="#checkout"
                          onClick={e => {
                            e.preventDefault();
                            setSelectedPlanId(plan.id);
                            setCheckoutPlan('Membership');
                            setPaidState({ paid: false });
                            setRoute('checkout');
                            window.scrollTo(0, 0);
                          }}
                          style={{
                            marginTop: 'auto',
                            alignSelf: 'flex-start',
                            background: '#F2B22E',
                            color: '#071A44',
                            fontWeight: 800,
                            padding: '12px 22px',
                            borderRadius: 999,
                            textDecoration: 'none',
                          }}
                        >
                          {isRtl ? 'اشترك في هذه الباقة' : `Choose ${plan.name.split(' ')[0]} Plan`}
                        </a>
                      </div>
                    );
                  })}
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: '#5A6280' }}>
                {isRtl
                  ? 'هل لديك كود خصم (مثل SRI25 أو FRESHERS)؟ يمكنك استخدامه عند الدفع.'
                  : 'Have a coupon code (e.g. SRI25, FRESHERS, CONF50)? Apply it at checkout.'}
              </div>
            </div>
          </section>

          {/* RESEARCH REVIEW PIPELINE */}
          <section
            id="research-section"
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: 'clamp(48px,6vw,88px) clamp(16px,4vw,40px)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: '#1446A0',
              }}
            >
              {isRtl ? 'تحكيم ومراجعة الأبحاث' : 'Research review'}
            </div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
                fontSize: 'clamp(30px,4vw,44px)',
                margin: '8px 0 32px',
                maxWidth: 640,
              }}
            >
              {isRtl
                ? 'ارفع ورقتك البحثية. يراجعها اثنان من المحكمين قبل تمثيل الجامعة في المؤتمرات.'
                : 'Submit your manuscript. Two reviewers read it before it leaves SRI.'}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                gap: '2px',
                background: '#E4DFD3',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {steps.map(s => (
                <div
                  key={s.n}
                  style={{
                    background: '#fff',
                    padding: '26px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 40, color: '#F2B22E', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{s.t}</div>
                  <div style={{ fontSize: 14, color: '#5A6280' }}>{s.d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* INSTAGRAM @SRI.EPNU ARCHIVE & BRAND SHOWCASE */}
          <section
            id="instagram-section"
            style={{
              background: '#071A44',
              color: '#fff',
              padding: 'clamp(48px,6vw,80px) clamp(16px,4vw,40px)',
            }}
          >
            <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#4BB4EC' }}>
                    @sri.epnu · East Port Said National University
                  </div>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,4vw,42px)',
                      margin: '8px 0 0',
                    }}
                  >
                    {isRtl ? 'من أرشيف SRI خلال الفترة الماضية' : 'Inside the SRI EPNU Community'}
                  </h2>
                </div>
                <a
                  href="https://www.instagram.com/sri.epnu?xtok=MTN0YmVodXpvMnBlcg=="
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#F2B22E',
                    color: '#071A44',
                    fontWeight: 800,
                    padding: '12px 22px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <span>Follow @sri.epnu on Instagram</span>
                  <span className="material-icon" style={{ fontSize: 18 }}>
                    open_in_new
                  </span>
                </a>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                  gap: 16,
                }}
              >
                {[
                  {
                    img: '/uploads/brand_files-1793097079353-yh35.jpeg',
                    tag: 'WHAT IS SRI?',
                    caption: 'Student-led · Research-driven · Impact-focused (Founded 2025)',
                  },
                  {
                    img: '/uploads/brand_files-1793097079355-gp7z.jpeg',
                    tag: 'من أرشيف SRI',
                    caption: 'كل إنجاز كان وراه خطوة، وكل خطوة علمتنا حاجة جديدة',
                  },
                  {
                    img: '/uploads/brand_files-1793097079358-ocql.jpeg',
                    tag: 'WORLD ARTHRITIS DAY',
                    caption: 'How scientific research changed arthritis care',
                  },
                  {
                    img: '/uploads/brand_files-1793097079360-wfas.jpeg',
                    tag: 'FOUNDED BY TOKA ESSAM',
                    caption: 'Empowering EPNU students to participate in research conferences',
                  },
                ].map((item, idx) => (
                  <a
                    key={idx}
                    href="https://www.instagram.com/sri.epnu?xtok=MTN0YmVodXpvMnBlcg=="
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid rgba(255,255,255,.12)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      color: '#fff',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <img
                      src={item.img}
                      alt={item.tag}
                      style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#F2B22E', letterSpacing: '.08em' }}>
                        {item.tag}
                      </span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>{item.caption}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* MERCHANT APPROVAL & COMPLIANCE HUB ON LANDING PAGE: ABOUT US, CONTACT US (CAIRO, EGYPT) & LEGAL POLICIES */}
          <section
            id="official-info-section"
            style={{
              background: '#F6F3EC',
              padding: 'clamp(48px,6vw,76px) clamp(16px,4vw,40px)',
              borderTop: '1px solid #E4DFD3',
            }}
          >
            <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: '#1446A0',
                    }}
                  >
                    {isRtl ? 'المعلومات الرسمية والسياسات المعتمدة · مصر (EGP)' : 'Official Organization Info, Policies & Contact · Egypt (EGP)'}
                  </div>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: 'clamp(28px,3.8vw,42px)',
                      margin: '6px 0 0',
                      color: '#071A44',
                    }}
                  >
                    {isRtl
                      ? 'من نحن، بيانات التواصل في القاهرة، وسياسات المنصة'
                      : 'About Us, Contact Information (Cairo, Egypt) & Platform Policies'}
                  </h2>
                </div>
                <span
                  style={{
                    background: '#E3F3EA',
                    color: '#1E8A5A',
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  {isRtl
                    ? '✓ جميع أسعار الدورات والباقات بالجنيه المصري (EGP)'
                    : '✓ All Course & Membership Prices Displayed in Egyptian Pounds (EGP)'}
                </span>
              </div>

              {/* Row 1: About Us & Contact Us Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
                  gap: 20,
                }}
              >
                {/* About Us Summary Card */}
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: 26,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="material-icon"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: '#E3ECFB',
                        color: '#1446A0',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 22,
                      }}
                    >
                      school
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#071A44' }}>
                        {isRtl ? 'من نحن (About Us)' : 'About Us — Student Research Initiative (SRI)'}
                      </h3>
                      <div style={{ fontSize: 12, color: '#5A6280' }}>
                        East Port Said National University (EPNU) · Cairo &amp; Port Said, Egypt
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#3A4260', lineHeight: 1.65 }}>
                    {isRtl
                      ? 'مبادرة البحث الطلابي (SRI) هي منصة تعليمية وأكاديمية متخصصة في تدريب طلاب الطب والصيدلة والعلوم الصحية على منهجيات البحث العلمي، الإحصاء الحيوي، التحليل التلوي (Systematic Review & Meta-Analysis)، والكتابة الأكاديمية، مع نظام تحكيم علمي ومراجعة للأبحاث قبل المشاركة في المؤتمرات.'
                      : 'The Student Research Initiative (SRI) is an academic e-learning platform and scientific research training center in Egypt. We provide structured online courses, downloadable templates, quizzes, live mentorship, and 2-stage peer review for medical and health-sciences students, priced clearly in Egyptian Pounds (EGP 250 – EGP 650 per course, or EGP 199/month membership).'}
                  </p>
                  <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                    <a
                      href="/about"
                      onClick={e => {
                        e.preventDefault();
                        setRoute('about');
                        if (typeof window !== 'undefined') window.history.pushState({}, '', '/about');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#071A44',
                        color: '#fff',
                        padding: '10px 18px',
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      {isRtl ? 'قراءة صفحة من نحن بالكامل ←' : 'Read Full About Us Page →'}
                    </a>
                  </div>
                </div>

                {/* Contact Us Summary Card (Email, Phone, Business Location in Cairo, Egypt) */}
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 18,
                    padding: 26,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="material-icon"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: '#FCF1D6',
                        color: '#8C6206',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 22,
                      }}
                    >
                      contact_phone
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#071A44' }}>
                        {isRtl ? 'اتصل بنا (Contact Us)' : 'Contact Us — Email, Phone & Business Location'}
                      </h3>
                      <div style={{ fontSize: 12, color: '#5A6280' }}>
                        {isRtl ? 'خدمة العملاء والدعم الفني والأكاديمي في مصر' : 'Customer Support & Administrative Office in Cairo, Egypt'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: '#0E1736' }}>
                    <div>
                      <strong>{isRtl ? 'البريد الإلكتروني (Email):' : 'Email Address:'}</strong>{' '}
                      <a href="mailto:contact@sri-epnu.edu.eg" style={{ color: '#1446A0', fontWeight: 700 }}>
                        contact@sri-epnu.edu.eg
                      </a>{' '}
                      / <span style={{ color: '#5A6280' }}>support@sri-epnu.edu.eg</span>
                    </div>
                    <div>
                      <strong>{isRtl ? 'رقم الهاتف وواتساب (Phone):' : 'Phone / WhatsApp:'}</strong>{' '}
                      <a href="tel:+201012345678" style={{ color: '#071A44', fontWeight: 800 }}>
                        +20 101 234 5678
                      </a>{' '}
                      <span style={{ color: '#5A6280', fontSize: 12 }}>(0101 234 5678)</span>
                    </div>
                    <div>
                      <strong>{isRtl ? 'مقر العمل (القاهرة، مصر):' : 'Business Location (Cairo, Egypt):'}</strong>{' '}
                      Building 14, Academic District, New Cairo, Cairo, Egypt
                    </div>
                    <div>
                      <strong>{isRtl ? 'المقر الجامعي:' : 'University Campus:'}</strong>{' '}
                      East Port Said National University (EPNU), Salam City, Port Said, Egypt
                    </div>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                    <a
                      href="/contact"
                      onClick={e => {
                        e.preventDefault();
                        setRoute('contact');
                        if (typeof window !== 'undefined') window.history.pushState({}, '', '/contact');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#F2B22E',
                        color: '#071A44',
                        padding: '10px 18px',
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      {isRtl ? 'افتح صفحة اتصل بنا ونموذج المراسلة ←' : 'Open Full Contact Us Page →'}
                    </a>
                  </div>
                </div>
              </div>

              {/* Row 2: The 3 Required Legal & Merchant Policies */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                  gap: 16,
                }}
              >
                {[
                  {
                    routeKey: 'privacy',
                    href: '/privacy-policy',
                    icon: 'verified_user',
                    title: isRtl ? 'سياسة الخصوصية (Privacy Policy)' : 'Privacy Policy',
                    desc: isRtl
                      ? 'حماية البيانات الشخصية، تشفير المدفوعات الإلكترونية عبر بوابات الدفع المعتمدة في مصر، وحقوق المستخدمين.'
                      : 'How we collect, protect, and process student account data, research manuscripts, and encrypted EGP payment transactions.',
                  },
                  {
                    routeKey: 'refund',
                    href: '/refund-policy',
                    icon: 'currency_exchange',
                    title: isRtl ? 'سياسة الاسترداد والإلغاء (Refund & Cancellation)' : 'Refund & Cancellation Policy',
                    desc: isRtl
                      ? 'ضمان استرداد الأموال بالكامل بالـ EGP خلال 14 يوماً من الاشتراك، وإلغاء تجديد الباقات في أي وقت بدون رسوم.'
                      : '14-day full refund guarantee in Egyptian Pounds (EGP) if less than 25% of a course is viewed, plus anytime subscription cancellation.',
                  },
                  {
                    routeKey: 'delivery',
                    href: '/delivery-policy',
                    icon: 'bolt',
                    title: isRtl ? 'سياسة التسليم والشحن (Delivery & Shipping Policy)' : 'Delivery & Shipping Policy',
                    desc: isRtl
                      ? 'تسليم رقمي فوري (0 جنيه مصاريف شحن) لجميع الدورات والملفات فور الدفع بالبطاقات أو فوري أو اعتماد إيصال إنستا باي.'
                      : 'Instant digital delivery (EGP 0 shipping fees) for all online courses, PDFs, quizzes, and certificates upon payment confirmation.',
                  },
                ].map(pol => (
                  <a
                    key={pol.routeKey}
                    href={pol.href}
                    onClick={e => {
                      e.preventDefault();
                      setRoute(pol.routeKey);
                      if (typeof window !== 'undefined') window.history.pushState({}, '', pol.href);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      background: '#fff',
                      border: '1px solid #E4DFD3',
                      borderRadius: 16,
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      textDecoration: 'none',
                      color: '#0E1736',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="material-icon"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: '#E3F3EA',
                          color: '#1E8A5A',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 20,
                        }}
                      >
                        {pol.icon}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: '#071A44' }}>{pol.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#5A6280', lineHeight: 1.55 }}>{pol.desc}</p>
                    <span style={{ marginTop: 'auto', fontSize: 12.5, fontWeight: 800, color: '#1446A0' }}>
                      {isRtl ? 'عرض السياسة كاملة ←' : 'View Full Policy →'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* SCREEN 1B: COURSE DETAIL */}
      {route === 'course' && currentCourse && (
        <>
          <section style={{ background: '#EFE6CF' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px clamp(16px,4vw,40px) 44px' }}>
              <div style={{ fontSize: 13, color: '#5A6280', display: 'flex', gap: 6, alignItems: 'center' }}>
                <a
                  href="#landing"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('landing');
                  }}
                >
                  {isRtl ? 'الدورات' : 'Courses'}
                </a>
                <span>/</span>
                <span>{isRtl ? currentCourse.catAr : currentCourse.cat}</span>
              </div>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(34px,5vw,58px)',
                  lineHeight: 1.02,
                  margin: '16px 0 14px',
                  maxWidth: 820,
                }}
              >
                {isRtl ? currentCourse.titleAr : currentCourse.title}
              </h1>
              <p style={{ fontSize: 17, color: '#3A4260', maxWidth: 680, margin: '0 0 18px' }}>
                {isRtl ? currentCourse.descriptionAr : currentCourse.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, fontWeight: 600 }}>
                <span style={{ background: '#fff', padding: '7px 12px', borderRadius: 999 }}>{currentCourse.mentor}</span>
                <span style={{ background: '#fff', padding: '7px 12px', borderRadius: 999 }}>
                  {currentCourse.modules?.length || 1} modules · {currentCourse.videos} videos
                </span>
                <span style={{ background: '#fff', padding: '7px 12px', borderRadius: 999 }}>{currentCourse.level}</span>
                <span style={{ background: '#fff', padding: '7px 12px', borderRadius: 999 }}>
                  {currentCourse.language}
                </span>
              </div>
            </div>
          </section>

          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '36px clamp(16px,4vw,40px) 80px',
              display: 'flex',
              flexWrap: 'wrap-reverse',
              gap: '36px',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div>
                <h3 style={{ fontSize: 20, margin: '0 0 16px' }}>{isRtl ? 'تتضمن الدورة' : 'Included'}</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
                    gap: 12,
                  }}
                >
                  {includes.map((i, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#fff',
                        border: '1px solid #E4DFD3',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 24, color: '#1446A0' }}>
                        {i.icon}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{i.t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 20, margin: '0 0 16px' }}>{isRtl ? 'المنهج الدراسي' : 'Curriculum'}</h3>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #E4DFD3',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {(currentCourse.modules || []).map((m: any, idx: number) => {
                    const isOpen = !!openMods[idx];
                    return (
                      <div key={m.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #EEEAE0' }}>
                        <button
                          onClick={() => setOpenMods(st => ({ ...st, [idx]: !st[idx] }))}
                          style={{
                            width: '100%',
                            background: 'none',
                            border: 0,
                            padding: '18px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            cursor: 'pointer',
                            textAlign: isRtl ? 'right' : 'left',
                            color: '#0E1736',
                          }}
                        >
                          <span style={{ fontWeight: 800, color: '#F2B22E', fontSize: 14, width: 22 }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                            {isRtl ? m.tAr || m.t : m.t}
                          </span>
                          {!mobile && (
                            <span style={{ fontSize: 12, color: '#5A6280' }}>{m.items?.length || 0} items</span>
                          )}
                          <span className="material-icon" style={{ fontSize: 22, color: '#5A6280' }}>
                            {isOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 20px 14px 56px', display: 'flex', flexDirection: 'column' }}>
                            {(m.items || []).map((l: any) => {
                              const icon =
                                l.type === 'video' ? 'play_circle' : l.type === 'pdf' ? 'description' : 'quiz';
                              return (
                                <div
                                  key={l.id}
                                  onClick={() => {
                                    if (l.free || currentCourse.price === 0) {
                                      onNavigatePortal('student', 'player', {
                                        courseId: currentCourse.id,
                                        lessonId: l.id,
                                      });
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '9px 0',
                                    fontSize: 14,
                                    color: '#3A4260',
                                    cursor: l.free || currentCourse.price === 0 ? 'pointer' : 'default',
                                  }}
                                >
                                  <span className="material-icon" style={{ fontSize: 19, color: '#1446A0' }}>
                                    {icon}
                                  </span>
                                  <span style={{ flex: 1 }}>{isRtl ? l.tAr || l.t : l.t}</span>
                                  {l.type !== 'quiz' && (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setPublicPreviewFile({
                                          title: isRtl ? l.tAr || l.t : l.t,
                                          url:
                                            l.type === 'video'
                                              ? l.videoUrl || '/files/sample-lecture.mp4'
                                              : l.fileUrl || '/files/pico-worksheet.pdf',
                                          ext: l.type === 'video' ? 'VIDEO' : 'PDF',
                                          meta: `${currentCourse.title} · ${l.d || 'Course Material'}`,
                                        });
                                      }}
                                      style={{
                                        border: '1px solid #D3CDBF',
                                        background: l.type === 'pdf' ? '#FBE7E3' : '#E3ECFB',
                                        color: l.type === 'pdf' ? '#C2412D' : '#1446A0',
                                        borderRadius: 999,
                                        padding: '3px 10px',
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
                                      {l.type === 'pdf'
                                        ? isRtl
                                          ? 'معاينة PDF'
                                          : 'Preview PDF'
                                        : isRtl
                                        ? 'معاينة فيديو'
                                        : 'Preview Video'}
                                    </button>
                                  )}
                                  {l.free && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#1E8A5A',
                                        background: '#E3F3EA',
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                      }}
                                    >
                                      Free preview
                                    </span>
                                  )}
                                  <span style={{ fontSize: 12, color: '#8A90A6' }}>{l.d}</span>
                                  <span
                                    className="material-icon"
                                    style={{
                                      fontSize: 17,
                                      color: l.free || currentCourse.price === 0 ? '#1E8A5A' : '#B5B9C8',
                                    }}
                                  >
                                    {l.free || currentCourse.price === 0 ? 'lock_open' : 'lock'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STICKY PURCHASE CARD */}
            <aside
              style={{
                flex: '1 1 320px',
                maxWidth: 420,
                minWidth: 0,
                position: mobile ? 'static' : 'sticky',
                top: 84,
                background: '#fff',
                border: '1px solid #E4DFD3',
                borderRadius: 18,
                overflow: 'hidden',
                marginTop: mobile ? 0 : -90,
                boxShadow: '0 20px 40px rgba(7,26,68,.08)',
              }}
            >
              <div
                style={{
                  aspectRatio: '16/9',
                  background: '#071A44',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative',
                  backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 10px,transparent 10px 20px)',
                }}
              >
                {previewPlaying ? (
                  <video
                    src={currentCourse.previewVideoUrl || '/files/sample-lecture.mp4'}
                    controls
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => setPreviewPlaying(true)}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        border: 0,
                        background: '#F2B22E',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span className="material-icon" style={{ fontSize: 34, color: '#071A44' }}>
                        play_arrow
                      </span>
                    </button>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        color: 'rgba(255,255,255,.6)',
                      }}
                    >
                      preview video
                    </span>
                  </>
                )}
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 32, color: '#0A2160' }}>{currentCourse.priceLabel}</div>
                <div style={{ fontSize: 13, color: '#5A6280', marginTop: -10 }}>
                  {currentCourse.accessDuration} · {isRtl ? 'أو مجاناً مع عضوية SRI' : 'or free with Membership'}
                </div>

                {currentCourse.price === 0 ? (
                  <button
                    onClick={() =>
                      onNavigatePortal('student', 'player', {
                        courseId: currentCourse.id,
                      })
                    }
                    style={{
                      background: '#F2B22E',
                      color: '#071A44',
                      border: 0,
                      fontWeight: 800,
                      padding: 15,
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontSize: 15,
                    }}
                  >
                    {isRtl ? 'ابدأ التعلم مجاناً الآن' : 'Start free course now'}
                  </button>
                ) : (
                  <>
                    <a
                      href="#checkout"
                      onClick={e => {
                        e.preventDefault();
                        setCheckoutPlan('Course');
                        setPaidState({ paid: false });
                        setRoute('checkout');
                        window.scrollTo(0, 0);
                      }}
                      style={{
                        background: '#F2B22E',
                        color: '#071A44',
                        fontWeight: 700,
                        padding: 15,
                        borderRadius: 12,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {isRtl ? 'شراء الدورة' : 'Buy course'}
                    </a>
                    <a
                      href="#checkout"
                      onClick={e => {
                        e.preventDefault();
                        setCheckoutPlan('Membership');
                        setPaidState({ paid: false });
                        setRoute('checkout');
                        window.scrollTo(0, 0);
                      }}
                      style={{
                        border: '1.5px solid #0A2160',
                        color: '#0A2160',
                        fontWeight: 700,
                        padding: 13,
                        borderRadius: 12,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {isRtl
                        ? `اشترك في العضوية · ${membershipMonthlyPrice} ج.م/شهر`
                        : `Join Membership · ${pg.subscriptions?.currency || 'EGP'} ${membershipMonthlyPrice}/mo`}
                    </a>
                  </>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid #D8D3C6',
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                    }}
                  />
                  <button
                    onClick={() => {
                      setAppliedCoupon(couponInput);
                      setCheckoutPlan('Course');
                      setPaidState({ paid: false });
                      setRoute('checkout');
                    }}
                    style={{
                      background: '#EFE6CF',
                      border: 0,
                      borderRadius: 10,
                      padding: '0 16px',
                      fontWeight: 700,
                      color: '#0A2160',
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* SCREEN 1C: CHECKOUT & PAYMENT */}
      {route === 'checkout' && (
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '36px clamp(16px,4vw,40px) 80px' }}>
          <a
            href="#course"
            onClick={e => {
              e.preventDefault();
              setRoute('course');
            }}
            style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span className="material-icon" style={{ fontSize: 18 }}>
              arrow_back
            </span>
            {isRtl ? 'العودة إلى الدورة' : 'Back to course'}
          </a>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
              fontSize: 'clamp(32px,4vw,46px)',
              margin: '14px 0 28px',
            }}
          >
            {isRtl ? 'إتمام الدفع والاشتراك' : 'Checkout'}
          </h1>

          {paidState.paid ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #E4DFD3',
                borderRadius: 18,
                padding: 'clamp(28px,5vw,56px)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: pm === 'insta' || pm === 'wallet' || pm === 'fawry' ? '#FCF1D6' : '#E3F3EA',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <span
                  className="material-icon"
                  style={{
                    fontSize: 40,
                    color: pm === 'insta' || pm === 'wallet' || pm === 'fawry' ? '#B07A08' : '#1E8A5A',
                  }}
                >
                  {pm === 'insta' || pm === 'wallet' || pm === 'fawry' ? 'schedule' : 'check'}
                </span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '5px 14px',
                  borderRadius: 999,
                  background: pm === 'insta' || pm === 'wallet' || pm === 'fawry' ? '#FCF1D6' : '#E3F3EA',
                  color: pm === 'insta' || pm === 'wallet' || pm === 'fawry' ? '#8C6206' : '#1E8A5A',
                }}
              >
                Status: {paidState.status || (pm === 'insta' || pm === 'wallet' ? 'Pending Approval' : 'Paid')} · Ref:{' '}
                {paidState.refCode}
              </span>
              <h2 style={{ margin: 0, fontSize: 26 }}>
                {pm === 'fawry'
                  ? `Fawry Reference: ${paidState.refCode || '7841 2096 553'}`
                  : pm === 'insta'
                  ? 'InstaPay Screenshot Submitted (Pending Approval)'
                  : pm === 'wallet'
                  ? 'Vodafone Cash Screenshot Submitted (Pending Approval)'
                  : 'Payment Successful'}
              </h2>
              <p style={{ margin: 0, color: '#5A6280', maxWidth: 480 }}>
                {pm === 'fawry'
                  ? 'Pay at any Fawry outlet within 48 hours. Your course unlocks as soon as the payment clears.'
                  : pm === 'insta' || pm === 'wallet'
                  ? 'Your transfer screenshot is now Pending in the Co-Admin & Admin review queue. As soon as a Co-Admin or Admin approves your screenshot, your course access unlocks automatically.'
                  : `${checkoutPlan === 'Membership' ? 'SRI Membership' : currentCourse?.title} is now unlocked in your student dashboard.`}
              </p>
              {(pm === 'insta' || pm === 'wallet') && instaReceiptUrl && (
                <div
                  style={{
                    background: '#F6F3EC',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #E4DFD3',
                    maxWidth: 280,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5A6280', marginBottom: 6 }}>
                    Uploaded Transfer Screenshot
                  </div>
                  <img
                    src={instaReceiptUrl}
                    alt="Uploaded transfer receipt"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8 }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  onClick={() => onNavigatePortal('student', 'dashboard')}
                  style={{
                    background: '#F2B22E',
                    color: '#071A44',
                    border: 0,
                    fontWeight: 700,
                    padding: '14px 26px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 15,
                  }}
                >
                  {isRtl ? 'الذهاب إلى لوحة الطالب' : 'Go to Student Dashboard'}
                </button>
                {(currentUser?.role === 'admin' || currentUser?.role === 'coadmin') && (
                  <button
                    onClick={() => onNavigatePortal('admin', 'payments')}
                    style={{
                      background: '#071A44',
                      color: '#fff',
                      border: 0,
                      fontWeight: 700,
                      padding: '14px 22px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    Approve in Dashboard →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 28, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 16, padding: 22 }}>
                  <div style={{ fontWeight: 700, marginBottom: 14 }}>{isRtl ? 'بيانات الحساب' : 'Account'}</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
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
                      {isRtl ? 'الاسم الكامل' : 'Full name'}
                      <input
                        value={checkoutName}
                        onChange={e => setCheckoutName(e.target.value)}
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 15,
                          color: '#0E1736',
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
                      {isRtl ? 'البريد الجامعي' : 'Email'}
                      <input
                        value={checkoutEmail}
                        onChange={e => setCheckoutEmail(e.target.value)}
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 15,
                          color: '#0E1736',
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 16, padding: 22 }}>
                  <div style={{ fontWeight: 700, marginBottom: 14 }}>{isRtl ? 'وسيلة الدفع' : 'Payment method'}</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))',
                      gap: 10,
                    }}
                  >
                    {paymentMethods.map(p => {
                      const on = pm === p.k;
                      return (
                        <button
                          key={p.k}
                          onClick={() => {
                            setPm(p.k);
                            setCheckoutError('');
                          }}
                          style={{
                            textAlign: isRtl ? 'right' : 'left',
                            background: on ? '#F1F5FD' : '#fff',
                            border: `2px solid ${on ? '#1446A0' : '#E4DFD3'}`,
                            borderRadius: 12,
                            padding: 14,
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: '#0E1736',
                          }}
                        >
                          <span className="material-icon" style={{ fontSize: 24, color: '#1446A0' }}>
                            {p.icon}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{p.t}</span>
                            <span style={{ fontSize: 12, color: '#5A6280' }}>{p.d}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    {pm === 'card' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))',
                          gap: 12,
                        }}
                      >
                        <label
                          style={{
                            gridColumn: '1/-1',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#5A6280',
                          }}
                        >
                          Card number
                          <input
                            value={cardNumber}
                            onChange={e => setCardNumber(e.target.value)}
                            placeholder="1234 5678 9012 3456"
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
                          Expiry
                          <input
                            value={cardExpiry}
                            onChange={e => setCardExpiry(e.target.value)}
                            placeholder="MM / YY"
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
                          CVC
                          <input
                            value={cardCvc}
                            onChange={e => setCardCvc(e.target.value)}
                            placeholder="123"
                            style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15 }}
                          />
                        </label>
                      </div>
                    )}

                    {/* VODAFONE CASH / MOBILE WALLET WITH NUMBER + MANDATORY SCREENSHOT UPLOAD */}
                    {pm === 'wallet' && (
                      <div
                        style={{
                          background: '#F6F3EC',
                          borderRadius: 14,
                          padding: 16,
                          fontSize: 14,
                          color: '#3A4260',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            background: '#fff',
                            border: '1px solid #E4DFD3',
                            borderRadius: 12,
                            padding: 16,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 16,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 240px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: '.08em',
                                textTransform: 'uppercase',
                                color: '#C2412D',
                              }}
                            >
                              Vodafone Cash Official Number
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 800,
                                  fontSize: 22,
                                  color: '#071A44',
                                }}
                              >
                                {pg.wallet?.walletNumber || '0101 234 5678'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(pg.wallet?.walletNumber || '0101 234 5678', 'vfc')}
                                style={{
                                  border: '1px solid #D8D3C6',
                                  background: copiedLabel === 'vfc' ? '#E3F3EA' : '#F6F3EC',
                                  color: copiedLabel === 'vfc' ? '#1E8A5A' : '#0A2160',
                                  borderRadius: 999,
                                  padding: '4px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {copiedLabel === 'vfc' ? '✓ Copied' : 'Copy Number'}
                              </button>
                            </div>
                            <div style={{ fontSize: 13, color: '#0E1736' }}>
                              <b>Account Name:</b> {pg.wallet?.walletOwnerName || 'SRI — East Port Said National University'}
                            </div>
                            <div style={{ fontSize: 12, color: '#5A6280' }}>
                              Quick USSD Code:{' '}
                              <code style={{ background: '#F6F3EC', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                *9*7*{(pg.wallet?.walletNumber || '01012345678').replace(/\s+/g, '')}*{finalTotal}#
                              </code>
                            </div>
                          </div>
                          {pg.wallet?.qrCodeUrl && (
                            <div
                              style={{
                                background: '#fff',
                                border: '1px solid #E4DFD3',
                                borderRadius: 10,
                                padding: 8,
                                textAlign: 'center',
                              }}
                            >
                              <img
                                src={pg.wallet.qrCodeUrl}
                                alt="Vodafone Cash QR"
                                style={{ width: 104, height: 104, objectFit: 'contain' }}
                              />
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#5A6280' }}>Scan Wallet QR</div>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: 13, color: '#3A4260' }}>
                          {pg.wallet?.instructions ||
                            'Transfer the total to our Vodafone Cash number above, then upload your transfer screenshot below. Your order stays Pending until Co-Admin / Admin approves the screenshot.'}
                        </div>

                        <label
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#5A6280',
                          }}
                        >
                          Your Vodafone Cash number (Sender)
                          <input
                            value={walletPhone}
                            onChange={e => setWalletPhone(e.target.value)}
                            placeholder="010 XXXX XXXX"
                            style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15, background: '#fff' }}
                          />
                        </label>

                        <label
                          style={{
                            border: instaReceiptUrl ? '2px solid #1E8A5A' : '1.5px dashed #1446A0',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center',
                            fontWeight: 700,
                            color: instaReceiptUrl ? '#1E8A5A' : '#1446A0',
                            cursor: 'pointer',
                            background: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} style={{ display: 'none' }} />
                          <span className="material-icon" style={{ fontSize: 28 }}>
                            {instaReceiptUrl ? 'check_circle' : 'cloud_upload'}
                          </span>
                          <span>
                            {uploadingReceipt
                              ? 'Uploading transfer screenshot...'
                              : instaReceiptName
                              ? `✓ Screenshot Uploaded: ${instaReceiptName}`
                              : 'Upload Vodafone Cash Transfer Screenshot (Required)'}
                          </span>
                          {instaReceiptUrl && (
                            <img
                              src={instaReceiptUrl}
                              alt="Vodafone Cash receipt preview"
                              style={{ maxHeight: 130, borderRadius: 8, objectFit: 'contain', marginTop: 4 }}
                            />
                          )}
                        </label>
                      </div>
                    )}

                    {pm === 'fawry' && (
                      <div style={{ background: '#F6F3EC', borderRadius: 12, padding: 16, fontSize: 14, color: '#3A4260' }}>
                        We&apos;ll generate a Fawry reference number (Merchant: <b>{pg.fawry?.merchantCode || '770000014291'}</b>).
                        Pay at any Fawry outlet or in the Fawry app within <b>{pg.fawry?.expiryHours || 48} hours</b>, and your
                        access unlocks automatically.
                      </div>
                    )}

                    {/* INSTAPAY WITH QR CODE, OPEN INSTAPAY LINK, PHONE NUMBER, IPA HANDLE & MANDATORY SCREENSHOT */}
                    {pm === 'insta' && (
                      <div
                        style={{
                          background: '#F6F3EC',
                          borderRadius: 14,
                          padding: 16,
                          fontSize: 14,
                          color: '#3A4260',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 16,
                            background: '#fff',
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid #E4DFD3',
                            alignItems: 'center',
                          }}
                        >
                          {/* InstaPay QR Code Place */}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 6,
                              padding: 12,
                              borderRadius: 12,
                              border: '1.5px solid #071A44',
                              background: '#F6F3EC',
                              flex: '0 0 auto',
                              margin: '0 auto',
                            }}
                          >
                            <img
                              src={pg.instapay?.qrCodeUrl || '/assets/instapay-qr.svg'}
                              alt="InstaPay QR Code"
                              style={{ width: 136, height: 136, objectFit: 'contain', borderRadius: 8, background: '#fff' }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#071A44' }}>
                              Scan QR in InstaPay App
                            </span>
                          </div>

                          {/* InstaPay Number, Handle, Open InstaPay Link & Bank Details */}
                          <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <a
                                href={pg.instapay?.paymentLink || 'https://ipn.eg/S/sri.epnu/instapay/012345'}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: '#071A44',
                                  color: '#F2B22E',
                                  borderRadius: 999,
                                  padding: '8px 16px',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span className="material-icon" style={{ fontSize: 17 }}>
                                  open_in_new
                                </span>
                                Open InstaPay Link
                              </a>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <b>InstaPay Number:</b>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 800,
                                  fontSize: 16,
                                  color: '#0A2160',
                                }}
                              >
                                {pg.instapay?.phoneNumber || '0101 234 5678'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(pg.instapay?.phoneNumber || '0101 234 5678', 'instaPhone')}
                                style={{
                                  border: '1px solid #D8D3C6',
                                  background: copiedLabel === 'instaPhone' ? '#E3F3EA' : '#F6F3EC',
                                  color: copiedLabel === 'instaPhone' ? '#1E8A5A' : '#0A2160',
                                  borderRadius: 999,
                                  padding: '3px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {copiedLabel === 'instaPhone' ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <b>InstaPay IPA:</b>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 800,
                                  color: '#1446A0',
                                }}
                              >
                                {pg.instapay?.handle || 'sri.epnu@instapay'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(pg.instapay?.handle || 'sri.epnu@instapay', 'instaHandle')}
                                style={{
                                  border: '1px solid #D8D3C6',
                                  background: copiedLabel === 'instaHandle' ? '#E3F3EA' : '#F6F3EC',
                                  color: copiedLabel === 'instaHandle' ? '#1E8A5A' : '#0A2160',
                                  borderRadius: 999,
                                  padding: '3px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {copiedLabel === 'instaHandle' ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>

                            <div style={{ fontSize: 13 }}>
                              <b>Beneficiary:</b> {pg.instapay?.accountHolder || 'Student Research Initiative (SRI - EPNU)'}
                            </div>
                            <div style={{ fontSize: 13 }}>
                              <b>Bank:</b> {pg.instapay?.bankName || 'National Bank of Egypt (NBE)'}
                            </div>
                            {pg.instapay?.iban && (
                              <div style={{ fontSize: 12, color: '#5A6280' }}>
                                <b>IBAN:</b>{' '}
                                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pg.instapay.iban}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 13 }}>
                          {pg.instapay?.instructions ||
                            'Scan the QR code, click Open InstaPay Link, or transfer to our InstaPay number/IPA handle, then upload your transfer screenshot below. Your order stays Pending until Co-Admin / Admin approves the screenshot.'}
                        </div>

                        <label
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#5A6280',
                          }}
                        >
                          Your InstaPay phone number or IPA handle (Sender)
                          <input
                            value={walletPhone}
                            onChange={e => setWalletPhone(e.target.value)}
                            placeholder="01X XXXX XXXX or yourname@instapay"
                            style={{ border: '1px solid #D8D3C6', borderRadius: 10, padding: 12, fontSize: 15, background: '#fff' }}
                          />
                        </label>

                        <label
                          style={{
                            border: instaReceiptUrl ? '2px solid #1E8A5A' : '1.5px dashed #1446A0',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center',
                            fontWeight: 700,
                            color: instaReceiptUrl ? '#1E8A5A' : '#1446A0',
                            cursor: 'pointer',
                            background: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} style={{ display: 'none' }} />
                          <span className="material-icon" style={{ fontSize: 28 }}>
                            {instaReceiptUrl ? 'check_circle' : 'cloud_upload'}
                          </span>
                          <span>
                            {uploadingReceipt
                              ? 'Uploading transfer screenshot...'
                              : instaReceiptName
                              ? `✓ Screenshot Uploaded: ${instaReceiptName}`
                              : 'Upload InstaPay Transfer Screenshot (Required)'}
                          </span>
                          {instaReceiptUrl && (
                            <img
                              src={instaReceiptUrl}
                              alt="InstaPay receipt preview"
                              style={{ maxHeight: 130, borderRadius: 8, objectFit: 'contain', marginTop: 4 }}
                            />
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ORDER SUMMARY */}
              <aside
                style={{
                  flex: '1 1 320px',
                  maxWidth: 440,
                  minWidth: 0,
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 16,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{isRtl ? 'ملخص الطلب' : 'Order summary'}</span>
                  <div style={{ display: 'flex', background: '#EFE6CF', borderRadius: 999, padding: 3 }}>
                    <button
                      onClick={() => setCheckoutPlan('Course')}
                      style={{
                        border: 0,
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: checkoutPlan === 'Course' ? '#071A44' : 'transparent',
                        color: checkoutPlan === 'Course' ? '#fff' : '#0E1736',
                      }}
                    >
                      Course
                    </button>
                    <button
                      onClick={() => setCheckoutPlan('Membership')}
                      style={{
                        border: 0,
                        borderRadius: 999,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: checkoutPlan === 'Membership' ? '#071A44' : 'transparent',
                        color: checkoutPlan === 'Membership' ? '#fff' : '#0E1736',
                      }}
                    >
                      Membership
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 72,
                      height: 48,
                      borderRadius: 8,
                      background: 'repeating-linear-gradient(135deg,#E9EEF7 0 6px,#DDE5F2 6px 12px)',
                      overflow: 'hidden',
                    }}
                  >
                    {currentCourse?.coverImage && (
                      <img
                        src={currentCourse.coverImage}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
                    {checkoutPlan === 'Membership'
                      ? `${activePlanObj?.name || 'SRI Membership'} (${activePlanObj?.currency || 'EGP'} ${activePlanObj?.price || membershipMonthlyPrice} / ${activePlanObj?.period || 'month'})`
                      : isRtl
                      ? currentCourse?.titleAr
                      : currentCourse?.title}
                  </div>
                </div>

                {checkoutPlan === 'Membership' && availablePlans.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F6F3EC', padding: 10, borderRadius: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6280', textTransform: 'uppercase' }}>
                      {isRtl ? 'اختر باقة الاشتراك:' : 'Select Membership Plan:'}
                    </span>
                    <select
                      value={activePlanObj?.id || ''}
                      onChange={e => setSelectedPlanId(e.target.value)}
                      style={{
                        border: '1px solid #D8D3C6',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontWeight: 700,
                        background: '#fff',
                        color: '#0A2160',
                      }}
                    >
                      {availablePlans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.currency || 'EGP'} {p.price} / {p.period} (
                          {p.accessType === 'selected' ? `${(p.courseIds || []).length} courses` : 'All courses'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid #D8D3C6',
                      borderRadius: 10,
                      padding: 11,
                      fontSize: 14,
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    onClick={() => setAppliedCoupon(couponInput)}
                    style={{
                      background: '#EFE6CF',
                      border: 0,
                      borderRadius: 10,
                      padding: '0 16px',
                      fontWeight: 700,
                      color: '#0A2160',
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>

                {appliedCoupon && (
                  <div style={{ fontSize: 12, color: matchedCoupon ? '#1E8A5A' : '#C2412D', fontWeight: 600 }}>
                    {matchedCoupon
                      ? `${matchedCoupon.code} applied: ${matchedCoupon.description}`
                      : "That coupon code isn't valid"}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 14,
                    borderTop: '1px solid #EEEAE0',
                    paddingTop: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#5A6280' }}>Subtotal</span>
                    <span>EGP {baseSubtotal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#5A6280' }}>Discount</span>
                    <span style={{ color: '#1E8A5A' }}>
                      {discountAmount > 0 ? `− EGP ${discountAmount}` : 'EGP 0'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: 18,
                      color: '#0A2160',
                      marginTop: 4,
                    }}
                  >
                    <span>Total</span>
                    <span>EGP {finalTotal}</span>
                  </div>
                </div>

                {checkoutError && (
                  <div
                    style={{
                      background: '#FBE7E3',
                      color: '#C2412D',
                      border: '1px solid #F3C4BC',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ⚠ {checkoutError}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  style={{
                    background: '#F2B22E',
                    color: '#071A44',
                    border: 0,
                    fontWeight: 800,
                    fontSize: 15,
                    padding: 16,
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  {pm === 'fawry'
                    ? 'Get Fawry reference'
                    : pm === 'insta' || pm === 'wallet'
                    ? 'Submit Transfer Screenshot for Approval'
                    : `Pay EGP ${finalTotal}`}
                </button>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#5A6280',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-icon" style={{ fontSize: 16 }}>
                    lock
                  </span>
                  Payments processed by Paymob &amp; Fawry
                </div>
              </aside>
            </div>
          )}
        </div>
      )}

      {/* SCREEN 1D: SIGN IN / SIGN UP */}
      {route === 'login' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 'calc(100vh - 65px)' }}>
          {!mobile && (
            <div
              style={{
                flex: '1 1 440px',
                background: '#071A44',
                backgroundImage: 'radial-gradient(rgba(255,255,255,.25) 1px,transparent 1.6px)',
                backgroundSize: '40px 40px',
                color: '#fff',
                padding: 56,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 40,
              }}
            >
              <img src="/assets/sri-logo.png" alt="SRI" style={{ width: 120, height: 120, borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 56, lineHeight: 1, letterSpacing: '-.02em' }}>
                  Student-led.
                  <br />
                  <span style={{ color: '#4BB4EC' }}>Research-driven.</span>
                  <br />
                  <span style={{ color: '#F2B22E' }}>Impact-focused.</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                East Port Said National University · Student Family for Egypt Movement
              </div>
            </div>
          )}

          <div
            style={{
              flex: '1 1 440px',
              display: 'grid',
              placeItems: 'center',
              padding: '40px clamp(16px,4vw,40px)',
            }}
          >
            <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, fontSize: 40, margin: 0 }}>
                {signup ? (isRtl ? 'انضم إلى SRI' : 'Join SRI') : isRtl ? 'مرحباً بعودتك' : 'Welcome back'}
              </h1>

              <div style={{ display: 'flex', background: '#EAE5D8', borderRadius: 12, padding: 4 }}>
                <button
                  onClick={() => setSignup(false)}
                  style={{
                    flex: 1,
                    border: 0,
                    borderRadius: 9,
                    padding: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: signup ? 'transparent' : '#fff',
                    color: '#0E1736',
                  }}
                >
                  {isRtl ? 'تسجيل الدخول' : 'Sign in'}
                </button>
                <button
                  onClick={() => setSignup(true)}
                  style={{
                    flex: 1,
                    border: 0,
                    borderRadius: 9,
                    padding: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: signup ? '#fff' : 'transparent',
                    color: '#0E1736',
                  }}
                >
                  {isRtl ? 'إنشاء حساب' : 'Create account'}
                </button>
              </div>

              {signup && (
                <>
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
                    Full name
                    <input
                      value={authName}
                      onChange={e => setAuthName(e.target.value)}
                      placeholder="Mariam Hassan"
                      style={{
                        border: '1px solid #D8D3C6',
                        borderRadius: 10,
                        padding: 13,
                        fontSize: 15,
                        background: '#fff',
                      }}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                      Student ID
                      <input
                        value={authStudentId}
                        onChange={e => setAuthStudentId(e.target.value)}
                        placeholder="2024-0120"
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 13,
                          fontSize: 15,
                          background: '#fff',
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
                      Faculty
                      <select
                        value={authFaculty}
                        onChange={e => setAuthFaculty(e.target.value)}
                        style={{
                          border: '1px solid #D8D3C6',
                          borderRadius: 10,
                          padding: 13,
                          fontSize: 15,
                          background: '#fff',
                          minWidth: 0,
                        }}
                      >
                        <option>Medicine</option>
                        <option>Pharmacy</option>
                        <option>Dentistry</option>
                        <option>Nursing</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

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
                University email
                <input
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="name@epnu.edu.eg"
                  style={{
                    border: '1px solid #D8D3C6',
                    borderRadius: 10,
                    padding: 13,
                    fontSize: 15,
                    background: '#fff',
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
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAuthSubmit();
                  }}
                  placeholder="••••••••"
                  style={{
                    border: '1px solid #D8D3C6',
                    borderRadius: 10,
                    padding: 13,
                    fontSize: 15,
                    background: '#fff',
                  }}
                />
              </label>

              {authError && <div style={{ fontSize: 13, color: '#C2412D', fontWeight: 600 }}>{authError}</div>}

              <button
                onClick={handleAuthSubmit}
                style={{
                  background: '#F2B22E',
                  color: '#071A44',
                  border: 0,
                  fontWeight: 800,
                  padding: 15,
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                {signup ? (isRtl ? 'إنشاء حساب' : 'Create account') : isRtl ? 'تسجيل الدخول' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN: ABOUT US */}
      {route === 'about' && (
        <section style={{ maxWidth: 1060, margin: '0 auto', padding: '56px clamp(16px,4vw,40px) 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setRoute('landing')}
              style={{
                background: 'transparent',
                border: '1px solid #D8D3C6',
                borderRadius: 999,
                padding: '8px 16px',
                fontWeight: 700,
                color: '#0A2160',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← {isRtl ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>

          <div
            style={{
              background: '#071A44',
              color: '#fff',
              borderRadius: 24,
              padding: 'clamp(28px,5vw,48px)',
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(242,178,46,.18)',
                color: '#F2B22E',
                fontWeight: 800,
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 999,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              {isRtl ? 'من نحن · نبذة عن المؤسسة' : 'ABOUT US · OFFICIAL OVERVIEW'}
            </div>
            <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, margin: '0 0 14px', lineHeight: 1.15 }}>
              {isRtl
                ? 'مبادرة البحث الطلابي (SRI) – جامعة شرق بورسعيد الأهلية'
                : 'Student Research Initiative (SRI) – East Port Said National University'}
            </h1>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.82)', maxWidth: 780, lineHeight: 1.65, margin: 0 }}>
              {isRtl
                ? 'منصة تعليمية وبحثية رائدة في جمهورية مصر العربية تقدم دورات تدريبية متخصصة في منهجيات البحث العلمي، الإحصاء الحيوي، الكتابة الأكاديمية، والتحليل المنهجي لطلاب الجامعات والباحثين.'
                : 'A premier academic and research training platform in Egypt providing structured digital courses, statistical workshops, peer-reviewed research mentorship, and certified training programs for university students and early-career researchers.'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 20,
              marginBottom: 32,
            }}
          >
            {[
              {
                title: isRtl ? 'رسالتنا' : 'Our Mission',
                desc: isRtl
                  ? 'تمكين طلاب الجامعات والباحثين في مصر من إتقان أدوات البحث العلمي الحديث والنشر الدولي في المجلات المفهرسة عالمياً.'
                  : 'Empowering university students and researchers across Egypt with practical scientific research methodologies, biostatistics, and international academic publishing skills.',
              },
              {
                title: isRtl ? 'منتجاتنا وخدماتنا' : 'Products & Services',
                desc: isRtl
                  ? 'دورات تدريبية رقمية مسجلة وتفاعلية، تحكيم ومراجعة الأوراق البحثية، وعضويات سنوية وفصلية بأسعار واضحة بالجنيه المصري (EGP).'
                  : 'On-demand digital video courses, downloadable academic templates, structured research paper peer-review services, and student memberships priced transparently in Egyptian Pounds (EGP).',
              },
              {
                title: isRtl ? 'الاعتماد الأكاديمي' : 'Academic Excellence',
                desc: isRtl
                  ? 'إشراف نخبة من أعضاء هيئة التدريس والباحثين في جامعة شرق بورسعيد الأهلية (EPNU) والقاهرة مع شهادات إتمام موثقة برمز تحقق رقمي.'
                  : 'Led by faculty advisors and senior researchers in Cairo and East Port Said National University (EPNU), issuing verifiable digital completion certificates.',
              },
            ].map((box, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid #E4DFD3',
                  borderRadius: 18,
                  padding: 26,
                }}
              >
                <h3 style={{ margin: '0 0 10px', color: '#0A2160', fontSize: 19, fontWeight: 800 }}>{box.title}</h3>
                <p style={{ margin: 0, color: '#4A5270', lineHeight: 1.6, fontSize: 14.5 }}>{box.desc}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #E4DFD3',
              borderRadius: 20,
              padding: 'clamp(24px,4vw,36px)',
              lineHeight: 1.75,
              color: '#2C3454',
            }}
          >
            <h2 style={{ color: '#0A2160', marginTop: 0, fontSize: 22, fontWeight: 800 }}>
              {isRtl ? 'المعلومات القانونية والتجارية' : 'Institutional & Commercial Details'}
            </h2>
            <p>
              {isRtl
                ? 'تعمل منصة مبادرة البحث الطلابي (SRI LMS Platform) كمزود خدمات تعليمية وتدريبية رقمية مسجل في مصر، وتقدم خدماتها لجميع الطلاب والباحثين بالعملة المحلية الرسمية وهي الجنيه المصري (EGP).'
                : 'The Student Research Initiative (SRI LMS Platform) operates as an educational and academic training service provider in the Arab Republic of Egypt. All courses, research review services, and membership plans on our platform are offered with clear, upfront pricing in Egyptian Pounds (EGP).'}
            </p>
            <ul style={{ paddingLeft: 20, margin: '16px 0' }}>
              <li>
                <strong>{isRtl ? 'الاسم الرسمي:' : 'Entity Name:'}</strong> Student Research Initiative (SRI) – EPNU Educational Platform
              </li>
              <li>
                <strong>{isRtl ? 'المقر الرئيسي (القاهرة):' : 'Cairo Liaison Office:'}</strong> Building 14, Academic & Innovation District, New Cairo, Cairo Governorate, Egypt
              </li>
              <li>
                <strong>{isRtl ? 'المقر الجامعي (بورسعيد):' : 'University Campus Address:'}</strong> East Port Said National University (EPNU), Salam City, East Port Said, Port Said Governorate, Egypt
              </li>
              <li>
                <strong>{isRtl ? 'البريد الإلكتروني الرسمي:' : 'Official Support Email:'}</strong> contact@sri-epnu.edu.eg
              </li>
              <li>
                <strong>{isRtl ? 'رقم الهاتف وخدمة العملاء:' : 'Customer Service Phone:'}</strong> +20 101 234 5678
              </li>
              <li>
                <strong>{isRtl ? 'عملة التسعير والدفع:' : 'Pricing Currency:'}</strong> Egyptian Pound (EGP / ج.م)
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* SCREEN: CONTACT US */}
      {route === 'contact' && (
        <section style={{ maxWidth: 1060, margin: '0 auto', padding: '56px clamp(16px,4vw,40px) 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setRoute('landing')}
              style={{
                background: 'transparent',
                border: '1px solid #D8D3C6',
                borderRadius: 999,
                padding: '8px 16px',
                fontWeight: 700,
                color: '#0A2160',
                cursor: 'pointer',
              }}
            >
              ← {isRtl ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : '1fr 1.1fr',
              gap: 28,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                background: '#071A44',
                color: '#fff',
                borderRadius: 22,
                padding: 'clamp(26px,4vw,38px)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#F2B22E',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                {isRtl ? 'تواصل معنا' : 'CONTACT US'}
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 14px' }}>
                {isRtl ? 'نحن هنا لمساعدتك' : 'Get in Touch With Our Team'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,.78)', lineHeight: 1.6, marginBottom: 28 }}>
                {isRtl
                  ? 'يسعد فريق دعم مبادرة البحث الطلابي (SRI) الرد على كافة استفساراتكم بخصوص الدورات التدريبية، المدفوعات بالجنيه المصري، أو الدعم الفني.'
                  : 'Have questions about our courses, EGP payment verification, research mentorship, or technical support? Reach us directly via email, phone, or visit our offices in Cairo and East Port Said, Egypt.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ background: 'rgba(255,255,255,.07)', padding: 18, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: '#4BB4EC', fontWeight: 700, marginBottom: 4 }}>
                    {isRtl ? 'البريد الإلكتروني الرسمي' : 'Email Address'}
                  </div>
                  <a href="mailto:contact@sri-epnu.edu.eg" style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                    contact@sri-epnu.edu.eg
                  </a>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>
                    support@sri-epnu.edu.eg · billing@sri-epnu.edu.eg
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.07)', padding: 18, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: '#4BB4EC', fontWeight: 700, marginBottom: 4 }}>
                    {isRtl ? 'رقم الهاتف وواتساب' : 'Phone Number & WhatsApp Support'}
                  </div>
                  <a href="tel:+201012345678" style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                    +20 101 234 5678
                  </a>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>
                    {isRtl ? 'الأحد – الخميس: 9:00 صباحاً حتى 6:00 مساءً (توقيت القاهرة)' : 'Sunday – Thursday: 9:00 AM – 6:00 PM (Cairo Time, GMT+2)'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.07)', padding: 18, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: '#4BB4EC', fontWeight: 700, marginBottom: 4 }}>
                    {isRtl ? 'عنوان المقر (القاهرة وبورسعيد – مصر)' : 'Business Location (Cairo & Port Said, Egypt)'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 6 }}>
                    Cairo Office: Building 14, Academic & Innovation District, New Cairo, Cairo, Egypt
                  </div>
                  <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.8)' }}>
                    Campus HQ: Faculty of Medicine & Research Center, East Port Said National University (EPNU), Salam City, Port Said Governorate, Egypt
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #E4DFD3',
                borderRadius: 22,
                padding: 'clamp(24px,4vw,36px)',
              }}
            >
              <h2 style={{ margin: '0 0 8px', color: '#0A2160', fontSize: 22, fontWeight: 800 }}>
                {isRtl ? 'أرسل رسالة مباشرة' : 'Send Us a Message'}
              </h2>
              <p style={{ margin: '0 0 22px', color: '#5A6280', fontSize: 14 }}>
                {isRtl
                  ? 'املأ النموذج التالي وسيتواصل معك فريق خدمة العملاء خلال 24 ساعة عمل.'
                  : 'Fill out the form below and our support team in Cairo will respond within 24 business hours.'}
              </p>

              {contactSent ? (
                <div
                  style={{
                    background: '#EAF7F0',
                    border: '1px solid #237A4B',
                    color: '#195E38',
                    padding: 20,
                    borderRadius: 14,
                    fontWeight: 600,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    ✓{' '}
                    {isRtl
                      ? 'تم إرسال رسالتك بنجاح! ستظهر رسالتك فوراً لدى الإدارة وسيتواصل معك فريقنا عبر البريد الإلكتروني أو الهاتف قريباً.'
                      : 'Your message has been sent and received by the SRI Admin Team! Our support team at contact@sri-epnu.edu.eg will get back to you shortly.'}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setContactSent(false);
                        setContactMessage('');
                      }}
                      style={{
                        background: '#fff',
                        color: '#195E38',
                        border: '1px solid #237A4B',
                        borderRadius: 999,
                        padding: '8px 16px',
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: 'pointer',
                      }}
                    >
                      {isRtl ? '+ إرسال رسالة أخرى' : '+ Send Another Message'}
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    await onAction('submit_contact_message', {
                      name: contactName,
                      email: contactEmail,
                      phone: contactPhone,
                      subject: contactSubject,
                      message: contactMessage,
                    });
                    setContactSent(true);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                    {isRtl ? 'الاسم الكامل *' : 'Full Name *'}
                    <input
                      required
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder={isRtl ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                      style={{ padding: 12, borderRadius: 10, border: '1px solid #D8D3C6', fontSize: 14 }}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                      {isRtl ? 'البريد الإلكتروني *' : 'Email Address *'}
                      <input
                        required
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        placeholder="name@example.com"
                        style={{ padding: 12, borderRadius: 10, border: '1px solid #D8D3C6', fontSize: 14 }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                      {isRtl ? 'رقم الهاتف (مصر) *' : 'Phone Number (Egypt) *'}
                      <input
                        required
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        placeholder="+20 10X XXX XXXX"
                        style={{ padding: 12, borderRadius: 10, border: '1px solid #D8D3C6', fontSize: 14 }}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                    {isRtl ? 'الموضوع *' : 'Subject *'}
                    <input
                      required
                      value={contactSubject}
                      onChange={e => setContactSubject(e.target.value)}
                      placeholder={isRtl ? 'استفسار عن دورة / تفعيل اشتراك / دعم فني' : 'Course Inquiry / Payment Verification / Support'}
                      style={{ padding: 12, borderRadius: 10, border: '1px solid #D8D3C6', fontSize: 14 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                    {isRtl ? 'الرسالة *' : 'Message *'}
                    <textarea
                      required
                      rows={4}
                      value={contactMessage}
                      onChange={e => setContactMessage(e.target.value)}
                      placeholder={isRtl ? 'اكتب تفاصيل رسالتك هنا...' : 'Write your question or inquiry in detail...'}
                      style={{ padding: 12, borderRadius: 10, border: '1px solid #D8D3C6', fontSize: 14, resize: 'vertical' }}
                    />
                  </label>
                  <button
                    type="submit"
                    style={{
                      background: '#F2B22E',
                      color: '#071A44',
                      border: 0,
                      borderRadius: 12,
                      padding: '14px 20px',
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: 'pointer',
                      marginTop: 6,
                    }}
                  >
                    {isRtl ? 'إرسال الرسالة' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SCREEN: PRIVACY POLICY */}
      {route === 'privacy' && (
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px clamp(16px,4vw,40px) 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setRoute('landing')}
              style={{
                background: 'transparent',
                border: '1px solid #D8D3C6',
                borderRadius: 999,
                padding: '8px 16px',
                fontWeight: 700,
                color: '#0A2160',
                cursor: 'pointer',
              }}
            >
              ← {isRtl ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #E4DFD3',
              borderRadius: 22,
              padding: 'clamp(28px,5vw,48px)',
              lineHeight: 1.75,
              color: '#2C3454',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1F6FEB', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              LEGAL & COMPLIANCE · EGYPT DATA PROTECTION LAW NO. 151 OF 2020
            </div>
            <h1 style={{ color: '#0A2160', fontSize: 34, fontWeight: 900, margin: '8px 0 8px' }}>
              {isRtl ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
            </h1>
            <div style={{ fontSize: 13, color: '#6A7290', marginBottom: 24 }}>
              Effective Date: January 1, 2026 · Last Updated: October 2026
            </div>

            <h3 style={{ color: '#0A2160' }}>1. Introduction</h3>
            <p>
              Student Research Initiative – East Port Said National University (&quot;SRI&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operating from Cairo and East Port Said, Egypt, is committed to protecting the privacy and personal data of our students, researchers, instructors, and website visitors in accordance with the Egyptian Personal Data Protection Law No. 151 of 2020.
            </p>

            <h3 style={{ color: '#0A2160' }}>2. Information We Collect</h3>
            <ul>
              <li><strong>Account & Identity Information:</strong> Full name, academic email address, phone number, university affiliation, and academic year when you register for an account.</li>
              <li><strong>Payment & Transaction Data:</strong> Payment method selected, transaction reference numbers, payment transfer screenshots (for InstaPay / Vodafone Cash manual verification), and billing records in Egyptian Pounds (EGP). Card payments processed via Paymob or Fawry are handled on PCI-DSS compliant payment gateways; we never store raw credit/debit card numbers or CVV codes on our servers.</li>
              <li><strong>Learning & Academic Progress:</strong> Course enrollments, video lesson completion, quiz scores, issued certificates, and submitted research manuscripts.</li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>3. How We Use Your Information</h3>
            <ul>
              <li>To provide, activate, and maintain access to purchased digital courses and memberships.</li>
              <li>To verify payments in Egyptian Pounds (EGP) and issue official payment receipts and verifiable completion certificates.</li>
              <li>To communicate course updates, research peer-review feedback, and customer support responses.</li>
              <li>To comply with legal, regulatory, and financial auditing obligations in the Arab Republic of Egypt.</li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>4. Data Sharing & Third-Party Service Providers</h3>
            <p>
              We do not sell, rent, or trade your personal information to third parties. Data is shared strictly with authorized payment processors (Paymob, Fawry, InstaPay/Vodafone Cash verification administrators) solely for completing your requested transactions in EGP.
            </p>

            <h3 style={{ color: '#0A2160' }}>5. Data Security & Retention</h3>
            <p>
              We implement encrypted sessions, strict role-based access control, and secure database storage. You may request access to, correction of, or deletion of your personal data at any time by contacting our Data Protection Officer at <strong>contact@sri-epnu.edu.eg</strong> or calling <strong>+20 101 234 5678</strong>.
            </p>
          </div>
        </section>
      )}

      {/* SCREEN: REFUND & CANCELLATION POLICY */}
      {route === 'refund' && (
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px clamp(16px,4vw,40px) 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setRoute('landing')}
              style={{
                background: 'transparent',
                border: '1px solid #D8D3C6',
                borderRadius: 999,
                padding: '8px 16px',
                fontWeight: 700,
                color: '#0A2160',
                cursor: 'pointer',
              }}
            >
              ← {isRtl ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #E4DFD3',
              borderRadius: 22,
              padding: 'clamp(28px,5vw,48px)',
              lineHeight: 1.75,
              color: '#2C3454',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1F6FEB', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              MERCHANT POLICY · EGYPT CONSUMER PROTECTION LAW NO. 181 OF 2018
            </div>
            <h1 style={{ color: '#0A2160', fontSize: 34, fontWeight: 900, margin: '8px 0 8px' }}>
              {isRtl ? 'سياسة الاسترجاع والإلغاء' : 'Refund & Cancellation Policy'}
            </h1>
            <div style={{ fontSize: 13, color: '#6A7290', marginBottom: 24 }}>
              Effective Date: January 1, 2026 · All refunds are processed in Egyptian Pounds (EGP)
            </div>

            <h3 style={{ color: '#0A2160' }}>1. Overview</h3>
            <p>
              At the Student Research Initiative (SRI – EPNU), we strive to ensure every student and researcher is satisfied with our digital courses and academic memberships. All prices and refunds are denominated strictly in <strong>Egyptian Pounds (EGP)</strong> in compliance with Egyptian Consumer Protection Law No. 181 of 2018.
            </p>

            <h3 style={{ color: '#0A2160' }}>2. Single Course Refund Eligibility (14-Day Guarantee)</h3>
            <ul>
              <li>Students may request a <strong>full 100% refund in EGP</strong> within <strong>14 calendar days</strong> of purchasing any individual course, provided that less than <strong>25% of the course video content</strong> has been watched and no completion certificate has been generated.</li>
              <li>If a duplicate payment or accidental overcharge occurs via Paymob, Fawry, InstaPay, or Vodafone Cash, 100% of the excess amount is refunded immediately upon verification.</li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>3. Membership & Subscription Cancellation</h3>
            <ul>
              <li><strong>Term & Annual Memberships (EGP 750 / Term or EGP 1,200 / Year):</strong> May be cancelled within 14 days of activation for a full refund if no more than one (1) course has been accessed under the membership.</li>
              <li>You may cancel automatic renewal of your membership at any time from your Student Dashboard or by emailing <strong>contact@sri-epnu.edu.eg</strong>.</li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>4. Non-Refundable Items</h3>
            <ul>
              <li>Courses where more than 25% of the content has been completed or where an official SRI Certificate of Completion has already been issued.</li>
              <li>Research peer-review and manuscript editing services once the academic review report has been delivered to the author.</li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>5. Refund Processing Timeline & Method</h3>
            <p>
              To request a refund or cancellation, please contact us at <strong>contact@sri-epnu.edu.eg</strong> or call <strong>+20 101 234 5678</strong> with your Order Reference ID. Approved refunds are returned in <strong>Egyptian Pounds (EGP)</strong> via the original payment method (Bank Card, InstaPay, or Vodafone Cash wallet) within <strong>5 to 7 business days</strong>.
            </p>
          </div>
        </section>
      )}

      {/* SCREEN: DELIVERY & SHIPPING POLICY */}
      {route === 'delivery' && (
        <section style={{ maxWidth: 960, margin: '0 auto', padding: '56px clamp(16px,4vw,40px) 80px' }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setRoute('landing')}
              style={{
                background: 'transparent',
                border: '1px solid #D8D3C6',
                borderRadius: 999,
                padding: '8px 16px',
                fontWeight: 700,
                color: '#0A2160',
                cursor: 'pointer',
              }}
            >
              ← {isRtl ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #E4DFD3',
              borderRadius: 22,
              padding: 'clamp(28px,5vw,48px)',
              lineHeight: 1.75,
              color: '#2C3454',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1F6FEB', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              SERVICE FULFILLMENT · DIGITAL & EDUCATIONAL DELIVERY POLICY
            </div>
            <h1 style={{ color: '#0A2160', fontSize: 34, fontWeight: 900, margin: '8px 0 8px' }}>
              {isRtl ? 'سياسة التسليم والشحن وتقديم الخدمة' : 'Delivery & Shipping Policy'}
            </h1>
            <div style={{ fontSize: 13, color: '#6A7290', marginBottom: 24 }}>
              Effective Date: January 1, 2026 · Digital Course & Educational Service Delivery
            </div>

            <h3 style={{ color: '#0A2160' }}>1. Nature of Products & Services (100% Digital Delivery)</h3>
            <p>
              Student Research Initiative (SRI – EPNU) provides digital educational courses, downloadable academic templates, interactive quizzes, research peer-review services, and digital completion certificates. Because all products and services are delivered electronically through our online Learning Management System (LMS), <strong>no physical shipping or courier fees apply (EGP 0 shipping cost)</strong>.
            </p>

            <h3 style={{ color: '#0A2160' }}>2. Delivery Timelines by Payment Method</h3>
            <ul>
              <li>
                <strong>Online Card Payments (Paymob Visa / Mastercard / Meeza):</strong> Instant automated delivery. Course access and membership privileges are unlocked in your Student Dashboard immediately (within seconds) upon payment authorization.
              </li>
              <li>
                <strong>Fawry ReferencePay:</strong> Instant delivery as soon as the Fawry reference code is settled at any Fawry POS machine or banking app.
              </li>
              <li>
                <strong>InstaPay & Vodafone Cash Transfers (Manual Screenshot Verification):</strong> When paying via InstaPay or Vodafone Cash, you upload your transfer screenshot during checkout. Our Co-Admin and Admin finance team verifies the transfer and activates your course access within <strong>1 to 12 hours</strong> (maximum 24 hours on public holidays).
              </li>
            </ul>

            <h3 style={{ color: '#0A2160' }}>3. Confirmation of Delivery</h3>
            <p>
              Upon enrollment activation, you receive an immediate confirmation in your Student Dashboard under <em>My Courses</em> along with a payment receipt displaying the amount paid in <strong>Egyptian Pounds (EGP)</strong> and your unique transaction reference.
            </p>

            <h3 style={{ color: '#0A2160' }}>4. Support for Delayed Access</h3>
            <p>
              If you do not see your purchased course in your dashboard within the timeframe stated above, please contact our support desk immediately at <strong>contact@sri-epnu.edu.eg</strong> or call/WhatsApp <strong>+20 101 234 5678</strong> (Cairo & East Port Said, Egypt).
            </p>
          </div>
        </section>
      )}

      {/* MERCHANT COMPLIANCE FOOTER */}
      <footer style={{ background: '#071A44', color: 'rgba(255,255,255,.78)', fontSize: 13.5, borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '48px clamp(16px,4vw,40px) 28px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr 1fr 1.3fr',
              gap: 32,
              paddingBottom: 36,
              borderBottom: '1px solid rgba(255,255,255,.12)',
            }}
          >
            {/* Col 1: Brand & Currency Compliance */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src="/assets/sri-logo.png" alt="SRI Logo" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                  SRI · East Port Said National University
                </span>
              </div>
              <p style={{ margin: '0 0 14px', lineHeight: 1.6, color: 'rgba(255,255,255,.7)' }}>
                {isRtl
                  ? 'منصة التدريب الأكاديمي والبحث العلمي للطلاب والباحثين في مصر. جميع أسعار الدورات والعضويات معروضة بالجنيه المصري (EGP).'
                  : 'Official academic training and scientific research LMS platform. Offering accredited digital courses, biostatistics workshops, and peer-reviewed research mentorship.'}
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(242,178,46,.14)',
                  border: '1px solid rgba(242,178,46,.35)',
                  color: '#F2B22E',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>🇪🇬</span>
                <span>{isRtl ? 'جميع الأسعار بالجنيه المصري (EGP)' : 'All prices are displayed in Egyptian Pounds (EGP)'}</span>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {isRtl ? 'روابط سريعة' : 'Company & Pages'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <a
                  href="#catalog"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('landing');
                    setTimeout(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }), 50);
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'الدورات التدريبية (بالجنيه المصري)' : 'Courses & Pricing (EGP)'}
                </a>
                <a
                  href="/about"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('about');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'من نحن (About Us)' : 'About Us'}
                </a>
                <a
                  href="/contact"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('contact');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'اتصل بنا (Contact Us)' : 'Contact Us'}
                </a>
              </div>
            </div>

            {/* Col 3: Legal & Policies */}
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {isRtl ? 'السياسات والشروط' : 'Policies & Legal'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <a
                  href="/privacy-policy"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('privacy');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}
                </a>
                <a
                  href="/refund-policy"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('refund');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'سياسة الاسترجاع والإلغاء' : 'Refund & Cancellation Policy'}
                </a>
                <a
                  href="/delivery-policy"
                  onClick={e => {
                    e.preventDefault();
                    setRoute('delivery');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,.78)' }}
                >
                  {isRtl ? 'سياسة التسليم والشحن' : 'Delivery & Shipping Policy'}
                </a>
              </div>
            </div>

            {/* Col 4: Contact Information */}
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {isRtl ? 'بيانات التواصل والمقر' : 'Contact Information'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.5 }}>
                <div>
                  <strong style={{ color: '#fff' }}>Email:</strong>{' '}
                  <a href="mailto:contact@sri-epnu.edu.eg" style={{ color: '#4BB4EC' }}>
                    contact@sri-epnu.edu.eg
                  </a>
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Phone:</strong>{' '}
                  <a href="tel:+201012345678" style={{ color: '#fff' }}>
                    +20 101 234 5678
                  </a>
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Location (Cairo):</strong> Building 14, Academic District, New Cairo, Cairo, Egypt
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Campus Location:</strong> East Port Said National University (EPNU), Salam City, Port Said, Egypt
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 22,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12.5,
              color: 'rgba(255,255,255,.6)',
            }}
          >
            <div>
              © 2026 Student Research Initiative (SRI) · East Port Said National University (EPNU), Cairo & Port Said, Egypt. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <span>Accepted Payments: Visa · Mastercard · Meeza · Fawry · InstaPay · Vodafone Cash (EGP)</span>
              <a
                href="https://www.instagram.com/sri.epnu?xtok=MTN0YmVodXpvMnBlcg=="
                target="_blank"
                rel="noreferrer"
                style={{ color: '#4BB4EC', fontWeight: 700 }}
              >
                @sri.epnu
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* PUBLIC PORTAL PDF & VIDEO PREVIEW MODAL */}
      {publicPreviewFile && (
        <div
          onClick={() => setPublicPreviewFile(null)}
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
              maxWidth: 1060,
              height: 'min(88vh, 840px)',
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
                    background: publicPreviewFile.ext === 'VIDEO' ? '#1446A0' : '#FBE7E3',
                    color: publicPreviewFile.ext === 'VIDEO' ? '#fff' : '#C2412D',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 10,
                    flex: 'none',
                  }}
                >
                  {publicPreviewFile.ext || 'PDF'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {publicPreviewFile.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                    {publicPreviewFile.meta || 'Official SRI Course Material Preview'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {state.fileAccess?.allowPublicPreviewDownload !== false ? (
                  <>
                    <a
                      href={publicPreviewFile.url}
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
                      href={publicPreviewFile.url}
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
                  onClick={() => setPublicPreviewFile(null)}
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
              {/\.(mp4|webm|mov)$/i.test(publicPreviewFile.url) || publicPreviewFile.ext === 'VIDEO' ? (
                <video
                  src={publicPreviewFile.url}
                  controls
                  controlsList={state.fileAccess?.allowPublicPreviewDownload === false ? 'nodownload' : undefined}
                  autoPlay
                  style={{ width: '100%', height: '100%', background: '#050F2A' }}
                />
              ) : (
                <iframe
                  src={
                    state.fileAccess?.allowPublicPreviewDownload === false
                      ? publicPreviewFile.url.includes('#')
                        ? `${publicPreviewFile.url}&toolbar=0&navpanes=0`
                        : `${publicPreviewFile.url}#toolbar=0&navpanes=0`
                      : publicPreviewFile.url
                  }
                  title={publicPreviewFile.title}
                  style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
