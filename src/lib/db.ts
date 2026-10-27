import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

function hashPwd(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sri-lms.sqlite');

declare global {
  // eslint-disable-next-line no-var
  var __sriDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (!global.__sriDb) {
    const db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    initSchemaAndSeed(db);
    global.__sriDb = db;
  }
  return global.__sriDb;
}

function initSchemaAndSeed(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      description TEXT NOT NULL,
      description_ar TEXT NOT NULL,
      mentor TEXT NOT NULL,
      category_id TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      level TEXT NOT NULL DEFAULT 'Beginner',
      language TEXT NOT NULL DEFAULT 'Arabic & English',
      status TEXT NOT NULL DEFAULT 'Published',
      included_in_membership INTEGER NOT NULL DEFAULT 1,
      access_duration TEXT NOT NULL DEFAULT 'Lifetime',
      cover_image TEXT DEFAULT '',
      preview_video_url TEXT DEFAULT '',
      students_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      title_ar TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      title_ar TEXT NOT NULL DEFAULT '',
      duration_or_meta TEXT NOT NULL DEFAULT '',
      is_free_preview INTEGER NOT NULL DEFAULT 0,
      is_uploaded INTEGER NOT NULL DEFAULT 1,
      file_url TEXT DEFAULT '',
      video_url TEXT DEFAULT '',
      subtitles_url TEXT DEFAULT '',
      slides_url TEXT DEFAULT '',
      overview_text TEXT DEFAULT '',
      pass_mark INTEGER NOT NULL DEFAULT 70,
      time_limit_min INTEGER NOT NULL DEFAULT 15,
      attempts_allowed TEXT NOT NULL DEFAULT 'Unlimited',
      question_order TEXT NOT NULL DEFAULT 'Shuffle'
    );

    CREATE TABLE IF NOT EXISTS lesson_resources (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      ext TEXT NOT NULL,
      title TEXT NOT NULL,
      size_meta TEXT NOT NULL,
      file_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL DEFAULT 0,
      explanation TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      student_id_code TEXT DEFAULT '',
      faculty TEXT DEFAULT 'Medicine',
      year_level INTEGER DEFAULT 1,
      plan TEXT DEFAULT 'Free',
      membership_renews TEXT DEFAULT '',
      last_active TEXT DEFAULT 'Today',
      avatar_initials TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      completed_lessons_json TEXT NOT NULL DEFAULT '[]',
      enrolled_at TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'Course',
      amount_paid TEXT NOT NULL DEFAULT 'EGP 0'
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      score_pct INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      answers_json TEXT NOT NULL DEFAULT '{}',
      attempt_num INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      timestamp_sec INTEGER NOT NULL DEFAULT 0,
      timestamp_label TEXT NOT NULL DEFAULT '00:00',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_discussions (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      supervisor TEXT NOT NULL,
      co_authors TEXT DEFAULT '',
      abstract_text TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size TEXT NOT NULL DEFAULT '1.8 MB',
      pages_count INTEGER NOT NULL DEFAULT 14,
      stage TEXT NOT NULL DEFAULT 'co',
      submitted_date TEXT NOT NULL,
      notes_json TEXT NOT NULL DEFAULT '[]',
      timeline_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      item_title TEXT NOT NULL,
      course_id TEXT DEFAULT '',
      plan_type TEXT NOT NULL DEFAULT 'Course',
      method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      coupon_code TEXT DEFAULT '',
      discount_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Paid',
      reference_code TEXT DEFAULT '',
      receipt_url TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      discount_pct INTEGER NOT NULL DEFAULT 0,
      discount_fixed INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 100,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_ar TEXT NOT NULL DEFAULT '',
      mentor TEXT NOT NULL,
      date_label TEXT NOT NULL,
      time_label TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Zoom',
      meeting_link TEXT NOT NULL,
      category TEXT NOT NULL,
      booked_users_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      certificate_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_title TEXT NOT NULL,
      mentor TEXT NOT NULL,
      score_pct INTEGER NOT NULL DEFAULT 100,
      issued_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number };
  if (countRow.c > 0) {
    // Ensure all products/courses have clear pricing in EGP
    db.prepare('UPDATE courses SET price = 250 WHERE price <= 0').run();
    // Ensure any legacy plaintext user passwords are upgraded to scrypt hashes
    const unhashedUsers = db
      .prepare("SELECT id, password FROM users WHERE password NOT LIKE 'scrypt:%'")
      .all() as unknown as Array<{ id: string; password: string }>;
    if (unhashedUsers.length > 0) {
      const upd = db.prepare('UPDATE users SET password = ? WHERE id = ?');
      for (const u of unhashedUsers) {
        upd.run(hashPwd(u.password), u.id);
      }
    }
    return;
  }

  // Seed categories
  const insertCat = db.prepare('INSERT INTO categories (id, name, name_ar) VALUES (?, ?, ?)');
  insertCat.run('c1', 'Research methods', 'مناهج البحث العلمي');
  insertCat.run('c2', 'Biostatistics', 'الإحصاء الحيوي');
  insertCat.run('c3', 'Scientific writing', 'الكتابة العلمية');
  insertCat.run('c4', 'Conference prep', 'التحضير للمؤتمرات');

  // Seed courses
  const insertCourse = db.prepare(`
    INSERT INTO courses (
      id, title, title_ar, description, description_ar, mentor, category_id,
      price, level, language, status, included_in_membership, access_duration,
      cover_image, preview_video_url, students_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCourse.run(
    'course-1',
    'Research Methodology Foundations',
    'أساسيات منهجية البحث العلمي',
    'Formulate a research question, pick a study design, write a protocol and get ethics approval. Built for first- and second-year medical students at EPNU.',
    'صياغة السؤال البحثي، اختيار تصميم الدراسة، كتابة البروتوكول البحثي والحصول على موافقة لجنة الأخلاقيات.',
    'Dr. Toka Essam Samir',
    'c1',
    450,
    'Beginner',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/assets/podium.png',
    '/files/sample-lecture.mp4',
    412,
    '2026-09-01'
  );

  insertCourse.run(
    'course-2',
    'Biostatistics with SPSS & R',
    'الإحصاء الحيوي باستخدام SPSS و R',
    'Master descriptive and inferential statistics, hypothesis testing, regression models, and publication-ready charts using SPSS and R.',
    'إتقان الإحصاء الوصفي والاستدلالي واختبار الفروض والانحدار باستخدام برنامجي SPSS و R.',
    'Dr. Ahmed Fathy',
    'c2',
    650,
    'Intermediate',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/assets/award.png',
    '/files/sample-lecture.mp4',
    288,
    '2026-09-10'
  );

  insertCourse.run(
    'course-3',
    'Writing a Scientific Manuscript',
    'كتابة الورقة العلمية للنشر الدولي',
    'Structure IMRaD manuscripts, write compelling abstracts, respond to peer-reviewers, and select Q1/Q2 indexed journals.',
    'هيكلة الأوراق البحثية بنظام IMRaD، كتابة الملخصات، والرد على المحكمين واختيار المجلات العلمية.',
    'Dr. Nour El-Din Kamal',
    'c3',
    400,
    'Intermediate',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/uploads/brand_files-1793097079353-yh35.jpeg',
    '/files/sample-lecture.mp4',
    196,
    '2026-09-15'
  );

  insertCourse.run(
    'course-4',
    'Systematic Reviews & Meta-analysis',
    'المراجعات المنهجية والتحليل التلوي',
    'PRISMA guidelines, database search strings, title/abstract screening on Rayyan, risk of bias assessment, and forest plots.',
    'إرشادات PRISMA، استراتيجيات البحث في قواعد البيانات، الفحص المنهجي، وتقييم خطر التحيز.',
    'Dr. Salma Reda',
    'c1',
    600,
    'Advanced',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/uploads/brand_files-1793097079358-ocql.jpeg',
    '/files/sample-lecture.mp4',
    94,
    '2026-09-22'
  );

  insertCourse.run(
    'course-5',
    'Presenting at Research Conferences',
    'العرض والتقديم في المؤتمرات العلمية',
    'Design award-winning scientific posters, deliver confident oral presentations, and handle Q&A from conference judges.',
    'تصميم الملصقات العلمية المتميزة، مهارات الإلقاء الشفهي، والتعامل مع أسئلة لجان التحكيم.',
    'SRI Mentors',
    'c4',
    300,
    'All levels',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/uploads/brand_files-1793097079355-gp7z.jpeg',
    '/files/sample-lecture.mp4',
    154,
    '2026-10-01'
  );

  insertCourse.run(
    'course-6',
    'Intro to Research Ethics',
    'مقدمة في أخلاقيات البحث العلمي',
    'Declaration of Helsinki, informed consent, IRB submission protocols, data privacy, and avoiding plagiarism and scientific misconduct.',
    'إعلان هلسنكي، الموافقة المستنيرة، بروتوكولات لجان الأخلاقيات، وتجنب الانتحال العلمي.',
    'Dr. Hana Mostafa',
    'c1',
    250,
    'Beginner',
    'Arabic & English',
    'Published',
    1,
    'Lifetime',
    '/uploads/brand_files-1793097079360-wfas.jpeg',
    '/files/sample-lecture.mp4',
    523,
    '2026-08-15'
  );

  // Seed modules for course-1 (and some for other courses)
  const insertMod = db.prepare(`
    INSERT INTO modules (id, course_id, position, title, title_ar, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertMod.run('mod-1', 'course-1', 0, 'Asking a research question', 'صياغة السؤال البحثي', 'How to turn a clinical observation into a focused, answerable research question.');
  insertMod.run('mod-2', 'course-1', 1, 'Study designs', 'تصميمات الدراسات البحثية', 'Observational and experimental designs, and how to choose between them.');
  insertMod.run('mod-3', 'course-1', 2, 'Literature search', 'البحث في الأدبيات العلمية', 'Searching PubMed efficiently and managing references with Zotero.');
  insertMod.run('mod-4', 'course-1', 3, 'Writing the protocol', 'كتابة البروتوكول البحثي', 'Structuring background, objectives, methods, and sample size calculation.');
  insertMod.run('mod-5', 'course-1', 4, 'Ethics approval', 'موافقة لجنة الأخلاقيات', 'Informed consent forms and EPNU IRB submission checklist.');

  // Also add modules for course-2 & course-6 so every course can be played!
  insertMod.run('mod-c2-1', 'course-2', 0, 'Data Types & Descriptive Statistics', 'أنواع البيانات والإحصاء الوصفي', 'Continuous vs categorical variables, mean, SD, median, and IQR in SPSS.');
  insertMod.run('mod-c6-1', 'course-6', 0, 'Foundations of Bioethics & IRB', 'أسس الأخلاقيات الطبية ولجان المراجعة', 'Core principles of medical research ethics and informed consent.');

  // Seed lessons
  const insertLesson = db.prepare(`
    INSERT INTO lessons (
      id, module_id, course_id, position, type, title, title_ar, duration_or_meta,
      is_free_preview, is_uploaded, file_url, video_url, overview_text, pass_mark, time_limit_min
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Module 1 lessons
  insertLesson.run('l1', 'mod-1', 'course-1', 0, 'video', 'What makes a question researchable', 'ما الذي يجعل السؤال قابلاً للبحث؟', '12:04', 1, 1, '', '/files/sample-lecture.mp4', 'We explore how clinical curiosity becomes a structured scientific inquiry, and the common pitfalls of overly broad topics.', 70, 15);
  insertLesson.run('l2', 'mod-1', 'course-1', 1, 'video', 'PICO and FINER frameworks', 'إطاري العمل PICO و FINER', '18:30', 1, 1, '', '/files/sample-lecture.mp4', 'Step-by-step breakdown of Population, Intervention, Comparison, Outcome (PICO) and Feasible, Interesting, Novel, Ethical, Relevant (FINER).', 70, 15);
  insertLesson.run('l3', 'mod-1', 'course-1', 2, 'pdf', 'PICO worksheet (PDF)', 'ورقة عمل PICO (ملف PDF)', '4 pages', 0, 1, '/files/pico-worksheet.pdf', '', 'Download and complete this 4-page worksheet to draft 3 candidate PICO questions for your EPNU research project.', 70, 15);
  insertLesson.run('l4', 'mod-1', 'course-1', 3, 'quiz', 'Module 1 quiz: Research questions', 'اختبار الوحدة الأولى: الأسئلة البحثية', '3 questions', 0, 1, '', '', 'Test your understanding of PICO and FINER frameworks.', 70, 15);

  // Module 2 lessons
  insertLesson.run('l5', 'mod-2', 'course-1', 0, 'video', 'Observational vs experimental designs', 'الدراسات الرصدية مقابل التجريبية', '22:05', 0, 1, '', '/files/sample-lecture.mp4', 'This lesson compares cohort, case-control and cross-sectional studies with randomized controlled trials, and walks through when each one fits your research question.\n\nBefore the module quiz, download the design decision chart in Resources and try classifying the three example studies.', 70, 15);
  insertLesson.run('l6', 'mod-2', 'course-1', 1, 'video', 'Choosing the right design', 'اختيار التصميم البحثي المناسب', '16:12', 0, 1, '', '/files/sample-lecture.mp4', 'How feasibility, rare outcomes, rare exposures, and ethical constraints dictate your choice of study design.', 70, 15);
  insertLesson.run('l7', 'mod-2', 'course-1', 2, 'pdf', 'Design decision chart (PDF)', 'مخطط اختيار تصميم الدراسة (PDF)', '2 pages', 0, 1, '/files/study-design-chart.pdf', '', 'Visual flowchart for selecting between cross-sectional, case-control, cohort, and RCT designs.', 70, 15);
  insertLesson.run('l8', 'mod-2', 'course-1', 3, 'quiz', 'Module 2 quiz: Study designs', 'اختبار الوحدة الثانية: تصميمات الدراسات', '5 questions', 0, 1, '', '', 'Assess your ability to identify study designs and measures of association.', 70, 15);

  // Module 3 lessons
  insertLesson.run('l9', 'mod-3', 'course-1', 0, 'video', 'PubMed search strategies & MeSH terms', 'استراتيجيات البحث في PubMed', '25:40', 0, 1, '', '/files/sample-lecture.mp4', 'Using Boolean operators (AND, OR, NOT), Medical Subject Headings (MeSH), and filters to build reproducible PubMed queries.', 70, 15);
  insertLesson.run('l10', 'mod-3', 'course-1', 1, 'video', 'Managing references with Zotero', 'إدارة المراجع باستخدام Zotero', '14:18', 0, 1, '', '/files/sample-lecture.mp4', 'One-click citation capture, organizing collections, removing duplicates, and auto-generating Vancouver/APA bibliographies in Word.', 70, 15);
  insertLesson.run('l11', 'mod-3', 'course-1', 2, 'pdf', 'Search string templates', 'قوالب استراتيجيات البحث', '3 pages', 0, 1, '/files/search-templates.pdf', '', 'Copy-and-paste search query templates for PubMed, Scopus, and Web of Science.', 70, 15);

  // Module 4 & 5 lessons
  insertLesson.run('l12', 'mod-4', 'course-1', 0, 'video', 'Protocol structure & sample size', 'هيكلة البروتوكول وحجم العينة', '20:10', 0, 1, '', '/files/sample-lecture.mp4', 'Writing the methodology section and calculating minimum required sample size.', 70, 15);
  insertLesson.run('l13', 'mod-4', 'course-1', 1, 'pdf', 'EPNU Protocol template (PDF)', 'قالب بروتوكول جامعة شرق بورسعيد', '8 pages', 0, 1, '/files/protocol-template.pdf', '', 'Official SRI EPNU research protocol template.', 70, 15);
  insertLesson.run('l14', 'mod-5', 'course-1', 0, 'video', 'Informed consent & IRB checklist', 'الموافقة المستنيرة ولجنة الأخلاقيات', '15:00', 0, 1, '', '/files/sample-lecture.mp4', 'Preparing ethics documents for the Faculty of Medicine IRB.', 70, 15);

  // Course 2 & 6 lessons
  insertLesson.run('l-c2-1', 'mod-c2-1', 'course-2', 0, 'video', 'Getting started with SPSS interface', 'مقدمة في واجهة برنامج SPSS', '19:45', 1, 1, '', '/files/sample-lecture.mp4', 'Importing Excel datasets, coding variables, and running descriptive statistics in SPSS.', 70, 15);
  insertLesson.run('l-c6-1', 'mod-c6-1', 'course-6', 0, 'video', 'Declaration of Helsinki & Belmont Report', 'إعلان هلسنكي وتقرير بلمونت', '16:20', 1, 1, '', '/files/sample-lecture.mp4', 'Respect for persons, beneficence, and justice in student research.', 70, 15);

  // Seed lesson resources
  const insertRes = db.prepare(`
    INSERT INTO lesson_resources (id, lesson_id, ext, title, size_meta, file_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertRes.run('res-1', 'l5', 'PDF', 'Study design decision chart', '2 pages · 340 KB', '/files/study-design-chart.pdf');
  insertRes.run('res-2', 'l5', 'PDF', 'Lecture slides: Observational designs', '28 pages · 4.1 MB', '/files/observational-slides.pdf');
  insertRes.run('res-3', 'l5', 'DOC', 'Example study worksheet', 'DOCX · 96 KB', '/files/pico-worksheet.pdf');
  insertRes.run('res-4', 'l1', 'PDF', 'PICO & FINER quick reference card', '2 pages · 280 KB', '/files/pico-worksheet.pdf');

  // Seed quiz questions
  const insertQ = db.prepare(`
    INSERT INTO quiz_questions (id, lesson_id, position, question_text, options_json, correct_index, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Quiz l4 (Module 1 quiz)
  insertQ.run('q-l4-1', 'l4', 0, 'Which framework structures a clinical question into Population, Intervention, Comparison and Outcome?', JSON.stringify(['FINER', 'PICO', 'SPIDER', 'STROBE']), 1, 'PICO stands for Population, Intervention, Comparison, and Outcome.');
  insertQ.run('q-l4-2', 'l4', 1, 'In FINER criteria for evaluating a research question, what does the "N" stand for?', JSON.stringify(['Necessary', 'Novel', 'Numerical', 'Neutral']), 1, 'FINER stands for Feasible, Interesting, Novel, Ethical, and Relevant.');
  insertQ.run('q-l4-3', 'l4', 2, 'A good student research question should be…', JSON.stringify(['As broad as possible', 'Answerable with available time and resources', 'Already conclusively answered in the same population', 'Unrelated to clinical or public health practice']), 1, 'Feasibility within available time, funding, and clinical access is essential for student projects.');

  // Quiz l8 (Module 2 quiz)
  insertQ.run('q-l8-1', 'l8', 0, 'A researcher follows 500 smokers and 500 non-smokers for 10 years to compare lung cancer rates. Which study design is this?', JSON.stringify(['Case-control study', 'Prospective cohort study', 'Cross-sectional study', 'Randomized controlled trial']), 1, 'Participants are grouped by exposure status (smoking) and followed forward in time to measure incidence.');
  insertQ.run('q-l8-2', 'l8', 1, 'Which measure of association is calculated in a case-control study?', JSON.stringify(['Relative risk', 'Odds ratio', 'Incidence rate', 'Hazard ratio']), 1, 'Because case-control studies sample by outcome rather than population at risk, the Odds Ratio (OR) is used.');
  insertQ.run('q-l8-3', 'l8', 2, 'What is the main advantage of randomization in a clinical trial?', JSON.stringify(['It reduces cost', 'It removes the need for consent', 'It balances known and unknown confounders', 'It increases sample size']), 2, 'Randomization distributes both measured and unmeasured baseline confounders equally across treatment arms.');
  insertQ.run('q-l8-4', 'l8', 3, 'A survey measures diabetes prevalence among students at one point in time. This is a…', JSON.stringify(['Cross-sectional study', 'Cohort study', 'Ecological study', 'Case series']), 0, 'Cross-sectional studies assess exposure and outcome simultaneously at a single snapshot in time.');
  insertQ.run('q-l8-5', 'l8', 4, 'Which design is best for studying a rare disease?', JSON.stringify(['Cohort study', 'Case-control study', 'Cross-sectional study', 'Field trial']), 1, 'Case-control studies start by recruiting existing cases of the rare disease and matching them with controls.');

  // Seed the 3 users: Admin, Co-Admin, and Student
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, name, email, password, role, student_id_code, faculty, year_level,
      plan, membership_renews, last_active, avatar_initials
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('u-admin', 'Dr. Toka Essam Samir', 'admin@epnu.edu.eg', hashPwd('admin123'), 'admin', 'STAFF-001', 'Medicine', 4, 'Membership', 'Founder', 'Today', 'TE');
  insertUser.run('u-coadmin', 'Youssef Adel', 'coadmin@epnu.edu.eg', hashPwd('coadmin123'), 'coadmin', '2022-0310', 'Medicine', 3, 'Course', 'Active', 'Today', 'YA');
  insertUser.run('u-mariam', 'Mariam Hassan', 'student@epnu.edu.eg', hashPwd('student123'), 'student', '2023-0418', 'Medicine', 2, 'Membership', 'Nov 14, 2026', 'Today', 'MH');

  // Seed enrollments
  const insertEnroll = db.prepare(`
    INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertEnroll.run('en-1', 'u-mariam', 'course-1', 42, JSON.stringify(['l1', 'l2', 'l3', 'l4']), '2h ago', 'Course', 'EGP 337');
  insertEnroll.run('en-2', 'u-mariam', 'course-2', 15, JSON.stringify(['l-c2-1']), '4 days ago', 'Membership', 'EGP 199');
  insertEnroll.run('en-3', 'u-mariam', 'course-6', 100, JSON.stringify(['l-c6-1']), '2 weeks ago', 'Free', 'EGP 0');
  insertEnroll.run('en-9', 'u-coadmin', 'course-2', 35, JSON.stringify(['l-c2-1']), 'Today', 'Course', 'EGP 650');

  // Seed quiz attempts
  const insertAttempt = db.prepare(`
    INSERT INTO quiz_attempts (id, user_id, user_name, lesson_id, course_id, score_pct, passed, answers_json, attempt_num, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAttempt.run('qa-1', 'u-mariam', 'Mariam Hassan', 'l4', 'course-1', 100, 1, JSON.stringify({ 0: 1, 1: 1, 2: 1 }), 1, '2026-10-19');
  insertAttempt.run('qa-2', 'u-mariam', 'Mariam Hassan', 'l8', 'course-1', 80, 1, JSON.stringify({ 0: 1, 1: 1, 2: 2, 3: 0, 4: 0 }), 2, '2026-10-24');
  insertAttempt.run('qa-3', 'u-coadmin', 'Youssef Adel', 'l8', 'course-1', 100, 1, JSON.stringify({ 0: 1, 1: 1, 2: 2, 3: 0, 4: 1 }), 1, '2026-10-23');

  // Seed timestamped notes & discussions
  const insertNote = db.prepare(`
    INSERT INTO lesson_notes (id, user_id, lesson_id, timestamp_sec, timestamp_label, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertNote.run('note-1', 'u-mariam', 'l5', 254, '04:14', 'Cohort studies start from exposure → outcome; Case-control starts from outcome → exposure.', '2026-10-26 14:20');
  insertNote.run('note-2', 'u-mariam', 'l5', 554, '09:14', 'Important for our EPNU antibiotic awareness study: pre/post design is quasi-experimental.', '2026-10-26 14:32');

  const insertDisc = db.prepare(`
    INSERT INTO lesson_discussions (id, lesson_id, user_id, user_name, user_role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertDisc.run('disc-1', 'l5', 'u-mariam', 'Mariam Hassan', 'student', 'Dr. Toka, for a cross-sectional survey of 300 medical students at EPNU, should we report Prevalence Ratio or Odds Ratio?', '2 days ago');
  insertDisc.run('disc-2', 'l5', 'u-admin', 'Dr. Toka Essam Samir', 'admin', 'Great question Mariam! When the outcome prevalence is common (>10%), Prevalence Ratio (PR) is preferred because Odds Ratio can overestimate the strength of association.', '1 day ago');

  // Seed research submissions
  const insertSub = db.prepare(`
    INSERT INTO research_submissions (
      id, user_id, author_name, title, type, supervisor, co_authors,
      abstract_text, file_name, file_url, file_size, pages_count,
      stage, submitted_date, notes_json, timeline_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSub.run(
    'sub-1',
    'u-mariam',
    'Mariam Hassan',
    'Antibiotic resistance awareness among first-year medical students',
    'Original research',
    'Dr. Toka Essam Samir',
    'Omar Khaled, Habiba Samy',
    'A pre/post interventional study measuring knowledge of antibiotic resistance among 312 first-year students at East Port Said National University after a structured awareness program.',
    'manuscript_v2.pdf',
    '/files/protocol-template.pdf',
    '1.8 MB',
    14,
    'ad',
    '18 Oct',
    JSON.stringify([
      { who: 'Youssef A. · Co-admin', role: 'coadmin', text: 'Clear methods. Tighten the discussion before the conference.', date: '24 Oct' }
    ]),
    JSON.stringify([
      { t: 'Waiting for admin approval', d: 'Forwarded 24 Oct', c: '#F2B22E' },
      { t: 'Co-admin review passed', d: 'Youssef A.: "Clear methods. Tighten the discussion before the conference."', c: '#1E8A5A' },
      { t: 'Submitted', d: 'manuscript_v2.pdf', c: '#1E8A5A' }
    ])
  );

  insertSub.run(
    'sub-2',
    'u-omar',
    'Omar Khaled',
    'Smartphone use and neck pain in undergraduate students',
    'Original research',
    'Dr. Salma Reda',
    'Ali Mansour',
    'Cross-sectional survey of 240 students assessing daily screen time, posture and self-reported neck pain using the Neck Disability Index.',
    'neck_pain_study.pdf',
    '/files/protocol-template.pdf',
    '2.1 MB',
    11,
    'co',
    '25 Oct',
    JSON.stringify([]),
    JSON.stringify([
      { t: 'Awaiting co-admin first review', d: 'Submitted 25 Oct · neck_pain_study.pdf', c: '#1446A0' }
    ])
  );

  insertSub.run(
    'sub-3',
    'u-habiba',
    'Habiba Samy',
    'Burnout among clinical-year medical students: a scoping review',
    'Systematic review',
    'Dr. Hana Mostafa',
    'Mariam Hassan',
    'Scoping review of 41 studies published between 2015 and 2026 on burnout prevalence and contributing factors in clinical-year students.',
    'burnout_review.pdf',
    '/files/protocol-template.pdf',
    '3.4 MB',
    19,
    'co',
    '24 Oct',
    JSON.stringify([]),
    JSON.stringify([
      { t: 'Awaiting co-admin first review', d: 'Submitted 24 Oct · burnout_review.pdf', c: '#1446A0' }
    ])
  );

  insertSub.run(
    'sub-4',
    'u-ali',
    'Ali Mansour',
    'Hand hygiene compliance in teaching hospital wards',
    'Abstract / poster',
    'Dr. Ahmed Fathy',
    '',
    'Direct observation of 1,100 hand hygiene opportunities across six wards using the WHO five moments framework.',
    'hand_hygiene_abstract.pdf',
    '/files/protocol-template.pdf',
    '920 KB',
    6,
    'ad',
    '21 Oct',
    JSON.stringify([
      { who: 'Nada K. · Co-admin', role: 'coadmin', text: 'Strong data. Ready for admin.', date: '23 Oct' }
    ]),
    JSON.stringify([
      { t: 'Waiting for admin approval', d: 'Forwarded 23 Oct', c: '#F2B22E' },
      { t: 'Co-admin review passed', d: 'Nada K.: "Strong data. Ready for admin."', c: '#1E8A5A' },
      { t: 'Submitted', d: 'hand_hygiene_abstract.pdf', c: '#1E8A5A' }
    ])
  );

  insertSub.run(
    'sub-5',
    'u-mariam',
    'Mariam Hassan',
    'Sleep quality and exam performance: a cross-sectional survey',
    'Original research',
    'Dr. Toka Essam Samir',
    '',
    'Survey of 180 students correlating Pittsburgh Sleep Quality Index scores with end-of-term exam results.',
    'sleep_survey.pdf',
    '/files/protocol-template.pdf',
    '1.4 MB',
    12,
    'ch',
    '2 Oct',
    JSON.stringify([
      { who: 'Nada K. · Co-admin', role: 'coadmin', text: 'Sample size justification is missing. Please add a power calculation.', date: '5 Oct' }
    ]),
    JSON.stringify([
      { t: 'Changes requested', d: 'Nada K.: "Sample size justification is missing. Please add a power calculation."', c: '#C2412D' },
      { t: 'Submitted', d: 'sleep_survey.pdf', c: '#1E8A5A' }
    ])
  );

  insertSub.run(
    'sub-6',
    'u-mariam',
    'Mariam Hassan',
    'Vitamin D deficiency in young adults: a systematic review',
    'Systematic review',
    'Dr. Salma Reda',
    'Toka Essam',
    'Systematic review evaluating serum 25(OH)D levels and supplementation outcomes among university students in MENA.',
    'vitamin_d_sr.pdf',
    '/files/protocol-template.pdf',
    '2.6 MB',
    16,
    'ok',
    '12 Aug',
    JSON.stringify([
      { who: 'Toka Essam · Admin', role: 'admin', text: 'Approved and put forward to the EPNU Annual Research Day.', date: '18 Aug' }
    ]),
    JSON.stringify([
      { t: 'Approved by admin', d: 'Put forward to the EPNU Annual Research Day', c: '#1E8A5A' },
      { t: 'Submitted', d: 'vitamin_d_sr.pdf', c: '#1E8A5A' }
    ])
  );

  // Seed payments
  const insertPay = db.prepare(`
    INSERT INTO payments (
      id, user_id, user_name, user_email, item_title, course_id, plan_type,
      method, amount, coupon_code, discount_amount, status, reference_code, receipt_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPay.run('pay-1', 'u-mariam', 'Mariam Hassan', 'mariam.h@epnu.edu.eg', 'Research Methodology Foundations', 'course-1', 'Course', 'Card · Paymob', 337, 'SRI25', 113, 'Paid', 'PMB-982341', '', '18 Oct');
  insertPay.run('pay-2', 'u-omar', 'Omar Khaled', 'omar.k@epnu.edu.eg', 'Membership (monthly)', '', 'Membership', 'Vodafone Cash', 199, '', 0, 'Paid', 'WAL-441209', '', '20 Oct');
  insertPay.run('pay-3', 'u-coadmin', 'Youssef Adel', 'youssef.adel@epnu.edu.eg', 'Biostatistics with SPSS & R', 'course-2', 'Course', 'InstaPay', 650, '', 0, 'Verify', 'INSTA-7731', '/uploads/brand_files-1793097045359-9gwu.jpeg', '27 Oct');
  insertPay.run('pay-4', 'u-habiba', 'Habiba Samy', 'habiba.s@epnu.edu.eg', 'Biostatistics with SPSS & R', 'course-2', 'Course', 'Fawry', 650, '', 0, 'Pending', '7841 2096 553', '', '22 Oct');
  insertPay.run('pay-5', 'u-nour', 'Nour Ramadan', 'nour.r@epnu.edu.eg', 'Membership (monthly)', '', 'Membership', 'Card · Paymob', 199, '', 0, 'Paid', 'PMB-994120', '', '26 Oct');
  insertPay.run('pay-6', 'u-salma', 'Salma Wael', 'salma.w@epnu.edu.eg', 'Writing a Scientific Manuscript', 'course-3', 'Course', 'Card · Paymob', 400, '', 0, 'Refunded', 'PMB-812004', '', '9 Oct');
  insertPay.run('pay-7', 'u-mariam', 'Mariam Hassan', 'mariam.h@epnu.edu.eg', 'Membership (monthly)', '', 'Membership', 'Card · Paymob', 199, '', 0, 'Paid', 'PMB-951002', '', '14 Oct');

  // Seed coupons
  const insertCoupon = db.prepare(`
    INSERT INTO coupons (id, code, description, discount_pct, discount_fixed, used_count, max_uses, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCoupon.run('cp-1', 'SRI25', '25% off any course', 25, 0, 38, 100, 1);
  insertCoupon.run('cp-2', 'FRESHERS', '50% off for EPNU First-Year Students', 50, 0, 19, 100, 1);
  insertCoupon.run('cp-3', 'CONF50', 'EGP 50 off conference prep', 0, 50, 4, 50, 1);

  // Seed live sessions
  const insertSession = db.prepare(`
    INSERT INTO live_sessions (id, title, title_ar, mentor, date_label, time_label, platform, meeting_link, category, booked_users_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSession.run('ls-1', 'Live Session: PubMed & Rayyan Screening Clinic', 'ورشة عمل مباشرة: البحث في PubMed والفرز على Rayyan', 'Dr. Salma Reda', 'Sat, 31 Oct', '7:00 PM Cairo', 'Zoom', 'https://zoom.us/j/sri-epnu-pubmed', 'Research methods', JSON.stringify(['u-mariam', 'u-omar']));
  insertSession.run('ls-2', 'Manuscript Peer-Review Office Hours', 'ساعات الإرشاد لمراجعة الأبحاث', 'Dr. Toka Essam Samir', 'Tue, 3 Nov', '8:00 PM Cairo', 'Google Meet', 'https://meet.google.com/sri-epnu', 'Scientific writing', JSON.stringify(['u-mariam']));
  insertSession.run('ls-3', 'EPNU Research Conference Poster Rehearsal', 'بروفة عرض الملصقات البحثية لمؤتمر الجامعة', 'SRI Mentors', 'Thu, 5 Nov', '2:00 PM Cairo', 'EPNU Amphitheater B', 'https://instagram.com/sri.epnu', 'Conference prep', JSON.stringify([]));

  // Seed certificates
  const insertCert = db.prepare(`
    INSERT INTO certificates (id, certificate_code, user_id, user_name, course_id, course_title, mentor, score_pct, issued_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCert.run('cert-1', 'SRI-EPNU-2026-0841', 'u-mariam', 'Mariam Hassan', 'course-6', 'Intro to Research Ethics', 'Dr. Hana Mostafa', 90, '15 Oct 2026');

  // Seed platform settings (Co-Admin permissions + Gateways)
  const insertSetting = db.prepare('INSERT INTO platform_settings (key, value_json) VALUES (?, ?)');
  insertSetting.run('coadmin_perms', JSON.stringify({
    courses: true,
    review: true,
    students: true,
    payments: false,
    settings: false,
    del: false
  }));
  insertSetting.run('payment_gateways', JSON.stringify({
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
      status: 'Connected',
      provider: 'Vodafone Cash / Orange / Etisalat',
      walletNumber: '0101 234 5678',
      walletOwnerName: 'SRI EPNU Treasury (Dr. Toka Essam)',
      instructions: 'Enter your mobile wallet number for an instant prompt, or transfer directly to our official Vodafone Cash wallet.',
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
      accountHolder: 'Student Research Initiative - EPNU',
      bankName: 'National Bank of Egypt (NBE) - Port Said Branch',
      accountNumber: '14200019283746',
      iban: 'EG380003014200019283746000192',
      instructions: 'Send the total via InstaPay handle or bank IBAN below, then upload your transfer screenshot for Admin verification.',
    },
    subscriptions: {
      enabled: true,
      status: 'Paymob subscriptions',
      monthlyPrice: 199,
      currency: 'EGP',
    },
  }));
}
