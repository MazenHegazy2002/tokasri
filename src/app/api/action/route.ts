import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { buildFullState, DEFAULT_CONTACT_MESSAGES, getMergedPaymentGateways } from '@/lib/state';
import {
  checkAuthRateLimit,
  clearSessionCookie,
  getSessionUser,
  hashPassword,
  resetAuthRateLimit,
  setSessionCookie,
  verifyCsrfOrigin,
  verifyPassword,
} from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const csrfOk = await verifyCsrfOrigin(req);
    if (!csrfOk) {
      return NextResponse.json({ error: 'Cross-origin request forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, payload = {} } = body || {};
    const db = getDb();

    // Public authentication actions
    if (action === 'login') {
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
      }
      if (!checkAuthRateLimit(`login:${email}`)) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
          { status: 429 }
        );
      }

      const userRow = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as any;
      if (!userRow || !verifyPassword(password, userRow.password)) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      resetAuthRateLimit(`login:${email}`);
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run('Just now', userRow.id);
      await setSessionCookie(userRow.id, userRow.role);

      const { password: _pwd, ...safeUser } = JSON.parse(JSON.stringify(userRow));
      return NextResponse.json({ ok: true, user: safeUser, state: buildFullState(safeUser) });
    }

    if (action === 'signup') {
      const name = String(payload.name || '').trim();
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      const studentIdCode = String(payload.studentIdCode || '2026-0199').trim();
      const faculty = String(payload.faculty || 'Medicine').trim();
      const yearLevel = Math.min(7, Math.max(1, Number(payload.yearLevel) || 1));

      if (!name || !email || password.length < 6) {
        return NextResponse.json(
          { error: 'Full name, university email, and a password of at least 6 characters are required.' },
          { status: 400 }
        );
      }
      if (!checkAuthRateLimit(`signup:${email}`, 5)) {
        return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
      }

      const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email) as any;
      if (existing) {
        return NextResponse.json({ error: 'An account with this university email already exists.' }, { status: 400 });
      }

      const id = 'u-' + crypto.randomUUID().slice(0, 8);
      const initials =
        name
          .split(/\s+/)
          .map((w: string) => w[0]?.toUpperCase() || '')
          .slice(0, 2)
          .join('') || 'ST';

      db.prepare(`
        INSERT INTO users (id, name, email, password, role, student_id_code, faculty, year_level, plan, membership_renews, last_active, avatar_initials)
        VALUES (?, ?, ?, ?, 'student', ?, ?, ?, 'Free', '', 'Just now', ?)
      `).run(id, name, email, hashPassword(password), studentIdCode, faculty, yearLevel, initials);

      // Automatically enroll new student in Free course-6 (Intro to Research Ethics)
      db.prepare(`
        INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
        VALUES (?, ?, 'course-6', 0, '[]', 'Just now', 'Free', 'EGP 0')
      `).run('en-' + crypto.randomUUID().slice(0, 8), id);

      await setSessionCookie(id, 'student');
      const safeUser = db
        .prepare(
          `SELECT id, name, email, role, student_id_code, faculty, year_level, plan, membership_renews, last_active, avatar_initials
           FROM users WHERE id = ?`
        )
        .get(id) as any;
      const serializedUser = JSON.parse(JSON.stringify(safeUser));
      return NextResponse.json({ ok: true, user: serializedUser, state: buildFullState(serializedUser) });
    }

    if (action === 'logout') {
      await clearSessionCookie();
      return NextResponse.json({ ok: true, state: buildFullState(null) });
    }

    if (action === 'submit_contact_message') {
      const name = String(payload.name || '').trim();
      const email = String(payload.email || '').trim();
      const phone = String(payload.phone || '').trim();
      const subject = String(payload.subject || 'General Inquiry').trim();
      const message = String(payload.message || '').trim();
      if (!name || !email || !message) {
        return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
      }
      const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('contact_messages') as any;
      const existing: any[] = row ? JSON.parse(row.value_json) : [...DEFAULT_CONTACT_MESSAGES];
      const nowLabel = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      const newMsg = {
        id: 'msg-' + Date.now(),
        name,
        email,
        phone: phone || 'Not provided',
        subject: subject || 'Contact Us Inquiry',
        message,
        status: 'Unread',
        adminNote: '',
        createdAt: nowLabel,
      };
      const updated = [newMsg, ...existing];
      db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run(
        'contact_messages',
        JSON.stringify(updated)
      );
      const currentSession = await getSessionUser();
      return NextResponse.json({ ok: true, message: newMsg, state: buildFullState(currentSession) });
    }

    // All remaining actions require an authenticated session
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const isAdmin = sessionUser.role === 'admin';
    const isCoAdmin = sessionUser.role === 'coadmin';
    const permsRow = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('coadmin_perms') as any;
    const coadminPerms = permsRow
      ? JSON.parse(permsRow.value_json)
      : { courses: true, review: true, students: true, payments: false, settings: false, del: false };

    const canManageCourses = isAdmin || (isCoAdmin && !!coadminPerms.courses);
    const canDeleteItems = isAdmin || (isCoAdmin && !!coadminPerms.del);
    const canReviewResearch = isAdmin || (isCoAdmin && !!coadminPerms.review);
    const canManageStudents = isAdmin || (isCoAdmin && !!coadminPerms.students);
    const canManagePayments = isAdmin || (isCoAdmin && !!coadminPerms.payments);
    const canManageSettings = isAdmin;

    switch (action) {
      // CATEGORIES
      case 'add_category': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { name, nameAr } = payload;
        if (!name?.trim()) return NextResponse.json({ error: 'Category name required' }, { status: 400 });
        const id = 'cat-' + Date.now();
        db.prepare('INSERT INTO categories (id, name, name_ar) VALUES (?, ?, ?)').run(
          id,
          name.trim(),
          nameAr?.trim() || name.trim()
        );
        break;
      }
      case 'rename_category': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, name } = payload;
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(String(name || '').trim(), id);
        break;
      }
      case 'delete_category': {
        if (!canDeleteItems) return NextResponse.json({ error: 'Forbidden: Delete permission required' }, { status: 403 });
        const { id } = payload;
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        break;
      }

      // COURSES
      case 'create_course': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { title, mentor, categoryId, price, level, description } = payload;
        const id = 'course-' + Date.now();
        db.prepare(`
          INSERT INTO courses (id, title, title_ar, description, description_ar, mentor, category_id, price, level, language, status, included_in_membership, access_duration, cover_image, preview_video_url, students_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Arabic & English', 'Draft', 1, 'Lifetime', '/assets/podium.png', '/files/sample-lecture.mp4', 0, ?)
        `).run(
          id,
          title || 'Untitled SRI Course',
          title || 'دورة تدريبية جديدة',
          description || 'Hands-on research course developed by SRI EPNU.',
          description || 'دورة تدريبية بحثية من مبادرة البحث الطلابي بجامعة شرق بورسعيد الأهلية.',
          mentor || 'Dr. Toka Essam Samir',
          categoryId || 'c1',
          Math.max(0, Number(price) || 450),
          level || 'Beginner',
          new Date().toISOString().slice(0, 10)
        );
        const modId = 'mod-' + Date.now();
        db.prepare('INSERT INTO modules (id, course_id, position, title, title_ar, description) VALUES (?, ?, 0, ?, ?, ?)').run(
          modId,
          id,
          'Introduction & Foundations',
          'مقدمة وأساسيات',
          'Core concepts and foundational skills for this course.'
        );
        db.prepare(`
          INSERT INTO lessons (id, module_id, course_id, position, type, title, title_ar, duration_or_meta, is_free_preview, is_uploaded, file_url, video_url, overview_text)
          VALUES (?, ?, ?, 0, 'video', 'Welcome & Course Overview', 'مرحباً بكم ونظرة عامة', '10:00', 1, 1, '', '/files/sample-lecture.mp4', 'Introduction to the learning objectives and research milestones.')
        `).run('les-' + Date.now(), modId, id);
        return NextResponse.json({ ok: true, createdCourseId: id, state: buildFullState(sessionUser) });
      }

      case 'update_course': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, title, description, mentor, categoryId, price, level, status, includedInMembership, accessDuration, coverImage } = payload;
        const cur = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
        if (cur) {
          db.prepare(`
            UPDATE courses
            SET title = ?, description = ?, mentor = ?, category_id = ?, price = ?, level = ?, status = ?, included_in_membership = ?, access_duration = ?, cover_image = ?
            WHERE id = ?
          `).run(
            title ?? cur.title,
            description ?? cur.description,
            mentor ?? cur.mentor,
            categoryId ?? cur.category_id,
            price !== undefined ? Math.max(0, Number(price)) : cur.price,
            level ?? cur.level,
            status ?? cur.status,
            includedInMembership !== undefined ? (includedInMembership ? 1 : 0) : cur.included_in_membership,
            accessDuration ?? cur.access_duration,
            coverImage ?? cur.cover_image,
            id
          );
        }
        break;
      }

      case 'delete_course': {
        if (!canDeleteItems) return NextResponse.json({ error: 'Forbidden: Delete permission required' }, { status: 403 });
        const { id } = payload;
        db.prepare('DELETE FROM courses WHERE id = ?').run(id);
        db.prepare('DELETE FROM modules WHERE course_id = ?').run(id);
        db.prepare('DELETE FROM lessons WHERE course_id = ?').run(id);
        break;
      }

      // MODULES (TOPICS)
      case 'add_module': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { courseId, title, description } = payload;
        const countRow = db.prepare('SELECT COUNT(*) as c FROM modules WHERE course_id = ?').get(courseId) as { c: number };
        const id = 'mod-' + Date.now();
        db.prepare('INSERT INTO modules (id, course_id, position, title, title_ar, description) VALUES (?, ?, ?, ?, ?, ?)').run(
          id,
          courseId,
          countRow.c,
          title || 'Untitled topic',
          title || 'موضوع جديد',
          description || ''
        );
        return NextResponse.json({ ok: true, createdModuleId: id, state: buildFullState(sessionUser) });
      }

      case 'update_module': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, title, description } = payload;
        const cur = db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as any;
        if (cur) {
          db.prepare('UPDATE modules SET title = ?, description = ? WHERE id = ?').run(
            title ?? cur.title,
            description ?? cur.description,
            id
          );
        }
        break;
      }

      case 'delete_module': {
        if (!canDeleteItems) return NextResponse.json({ error: 'Forbidden: Delete permission required' }, { status: 403 });
        const { id } = payload;
        db.prepare('DELETE FROM modules WHERE id = ?').run(id);
        db.prepare('DELETE FROM lessons WHERE module_id = ?').run(id);
        break;
      }

      // LESSONS
      case 'add_lesson': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { moduleId, courseId, type, title } = payload;
        const safeType = ['video', 'pdf', 'quiz'].includes(type) ? type : 'video';
        const countRow = db.prepare('SELECT COUNT(*) as c FROM lessons WHERE module_id = ?').get(moduleId) as { c: number };
        const id = 'les-' + Date.now();
        const defaultTitle = safeType === 'video' ? 'New video lesson' : safeType === 'pdf' ? 'New PDF / file' : 'New module quiz';
        const defaultMeta = safeType === 'video' ? '15:00' : safeType === 'pdf' ? '5 pages' : '0 questions';
        db.prepare(`
          INSERT INTO lessons (id, module_id, course_id, position, type, title, title_ar, duration_or_meta, is_free_preview, is_uploaded, file_url, video_url, overview_text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `).run(
          id,
          moduleId,
          courseId,
          countRow.c,
          safeType,
          title || defaultTitle,
          title || defaultTitle,
          defaultMeta,
          safeType === 'quiz' ? 1 : 0,
          safeType === 'pdf' ? '/files/pico-worksheet.pdf' : '',
          safeType === 'video' ? '/files/sample-lecture.mp4' : '',
          'Lesson overview and instructions for students.'
        );
        return NextResponse.json({ ok: true, createdLessonId: id, state: buildFullState(sessionUser) });
      }

      case 'update_lesson': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, title, durationOrMeta, isFreePreview, isUploaded, fileUrl, videoUrl, subtitlesUrl, slidesUrl, overviewText, passMark, timeLimitMin, attemptsAllowed, questionOrder } = payload;
        const cur = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as any;
        if (cur) {
          db.prepare(`
            UPDATE lessons
            SET title = ?, duration_or_meta = ?, is_free_preview = ?, is_uploaded = ?, file_url = ?, video_url = ?, subtitles_url = ?, slides_url = ?, overview_text = ?, pass_mark = ?, time_limit_min = ?, attempts_allowed = ?, question_order = ?
            WHERE id = ?
          `).run(
            title ?? cur.title,
            durationOrMeta ?? cur.duration_or_meta,
            isFreePreview !== undefined ? (isFreePreview ? 1 : 0) : cur.is_free_preview,
            isUploaded !== undefined ? (isUploaded ? 1 : 0) : cur.is_uploaded,
            fileUrl ?? cur.file_url,
            videoUrl ?? cur.video_url,
            subtitlesUrl ?? cur.subtitles_url,
            slidesUrl ?? cur.slides_url,
            overviewText ?? cur.overview_text,
            passMark ?? cur.pass_mark,
            timeLimitMin ?? cur.time_limit_min,
            attemptsAllowed ?? cur.attempts_allowed,
            questionOrder ?? cur.question_order,
            id
          );
        }
        break;
      }

      case 'delete_lesson': {
        if (!canDeleteItems) return NextResponse.json({ error: 'Forbidden: Delete permission required' }, { status: 403 });
        const { id } = payload;
        db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
        db.prepare('DELETE FROM quiz_questions WHERE lesson_id = ?').run(id);
        break;
      }

      case 'reorder_lesson': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { moduleId, lessonId, direction } = payload;
        const items = db.prepare('SELECT * FROM lessons WHERE module_id = ? ORDER BY position ASC, rowid ASC').all(moduleId) as any[];
        const idx = items.findIndex(x => x.id === lessonId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (idx >= 0 && swapIdx >= 0 && swapIdx < items.length) {
          const temp = items[idx];
          items[idx] = items[swapIdx];
          items[swapIdx] = temp;
          const upd = db.prepare('UPDATE lessons SET position = ? WHERE id = ?');
          items.forEach((item, i) => upd.run(i, item.id));
        }
        break;
      }

      case 'add_lesson_resource': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { lessonId, ext, title, sizeMeta, fileUrl } = payload;
        db.prepare(`
          INSERT INTO lesson_resources (id, lesson_id, ext, title, size_meta, file_url)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('res-' + Date.now(), lessonId, ext || 'PDF', title, sizeMeta || '1.2 MB', fileUrl || '/files/pico-worksheet.pdf');
        break;
      }

      // QUIZZES
      case 'save_quiz_questions': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { lessonId, questions } = payload;
        db.prepare('DELETE FROM quiz_questions WHERE lesson_id = ?').run(lessonId);
        const ins = db.prepare(`
          INSERT INTO quiz_questions (id, lesson_id, position, question_text, options_json, correct_index, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        (questions || []).forEach((q: any, idx: number) => {
          ins.run(
            q.id || `q-${lessonId}-${Date.now()}-${idx}`,
            lessonId,
            idx,
            q.text || '',
            JSON.stringify(q.opts || ['', '', '', '']),
            Number(q.a) || 0,
            q.explanation || ''
          );
        });
        db.prepare('UPDATE lessons SET duration_or_meta = ? WHERE id = ?').run(`${(questions || []).length} questions`, lessonId);
        break;
      }

      case 'submit_quiz_attempt': {
        const { lessonId, courseId, answers } = payload;
        const userId = sessionUser.id;
        const userName = sessionUser.name;

        const lessonRow = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as any;
        const questions = db
          .prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY position ASC, rowid ASC')
          .all(lessonId) as any[];

        // Compute score strictly on the server from stored correct_index
        let correctCount = 0;
        const submittedAnswers = answers && typeof answers === 'object' ? answers : {};
        questions.forEach((q, idx) => {
          if (Number(submittedAnswers[idx]) === Number(q.correct_index)) {
            correctCount += 1;
          }
        });
        const scorePct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
        const passMark = lessonRow?.pass_mark || 70;
        const passed = scorePct >= passMark;

        const prevAttempts = db
          .prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id = ? AND lesson_id = ?')
          .get(userId, lessonId) as { c: number };
        const attemptNum = prevAttempts.c + 1;

        db.prepare(`
          INSERT INTO quiz_attempts (id, user_id, user_name, lesson_id, course_id, score_pct, passed, answers_json, attempt_num, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'qa-' + Date.now(),
          userId,
          userName,
          lessonId,
          courseId,
          scorePct,
          passed ? 1 : 0,
          JSON.stringify(submittedAnswers),
          attemptNum,
          new Date().toISOString().slice(0, 10)
        );

        if (passed) {
          const enroll = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any;
          if (enroll) {
            const comp: string[] = JSON.parse(enroll.completed_lessons_json || '[]');
            if (!comp.includes(lessonId)) comp.push(lessonId);
            const totalLessons = (db.prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?').get(courseId) as { c: number }).c || 1;
            const pct = Math.min(100, Math.round((comp.length / totalLessons) * 100));
            db.prepare('UPDATE enrollments SET completed_lessons_json = ?, progress_pct = ? WHERE id = ?').run(JSON.stringify(comp), pct, enroll.id);
          }

          const existingCert = db.prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any;
          const courseRow = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
          if (!existingCert && courseRow) {
            const code = `SRI-EPNU-2026-${crypto.randomInt(1000, 9999)}`;
            db.prepare(`
              INSERT INTO certificates (id, certificate_code, user_id, user_name, course_id, course_title, mentor, score_pct, issued_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run('cert-' + Date.now(), code, userId, userName, courseId, courseRow.title, courseRow.mentor, scorePct, '27 Oct 2026');
          }
        }
        break;
      }

      // PROGRESS, NOTES & DISCUSSIONS
      case 'toggle_lesson_complete': {
        const { courseId, lessonId } = payload;
        const userId = sessionUser.id;
        let enroll = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any;
        if (!enroll) {
          const courseRow = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
          if (!courseRow || (courseRow.price > 0 && sessionUser.plan !== 'Membership' && !isAdmin && !isCoAdmin)) {
            return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 });
          }
          const eid = 'en-' + Date.now();
          db.prepare(`
            INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
            VALUES (?, ?, ?, 0, '[]', 'Today', 'Membership', 'EGP 0')
          `).run(eid, userId, courseId);
          enroll = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(eid) as any;
        }
        const comp: string[] = JSON.parse(enroll.completed_lessons_json || '[]');
        if (!comp.includes(lessonId)) {
          comp.push(lessonId);
        }
        const totalLessons = (db.prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?').get(courseId) as { c: number }).c || 1;
        const pct = Math.min(100, Math.round((comp.length / totalLessons) * 100));
        db.prepare('UPDATE enrollments SET completed_lessons_json = ?, progress_pct = ? WHERE id = ?').run(JSON.stringify(comp), pct, enroll.id);
        break;
      }

      case 'add_lesson_note': {
        const { lessonId, timestampSec, timestampLabel, content } = payload;
        const safeContent = String(content || '').trim().slice(0, 2000);
        if (!safeContent) break;
        db.prepare(`
          INSERT INTO lesson_notes (id, user_id, lesson_id, timestamp_sec, timestamp_label, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('note-' + Date.now(), sessionUser.id, lessonId, Math.max(0, Number(timestampSec) || 0), timestampLabel || '00:00', safeContent, 'Just now');
        break;
      }

      case 'delete_lesson_note': {
        const { id } = payload;
        db.prepare('DELETE FROM lesson_notes WHERE id = ? AND user_id = ?').run(id, sessionUser.id);
        break;
      }

      case 'add_lesson_discussion': {
        const { lessonId, content } = payload;
        const safeContent = String(content || '').trim().slice(0, 2000);
        if (!safeContent) break;
        db.prepare(`
          INSERT INTO lesson_discussions (id, lesson_id, user_id, user_name, user_role, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'Just now')
        `).run('disc-' + Date.now(), lessonId, sessionUser.id, sessionUser.name, sessionUser.role, safeContent);
        break;
      }

      // RESEARCH SUBMISSIONS & 2-STAGE REVIEW
      case 'submit_research': {
        const { title, type, supervisor, coAuthors, abstractText, fileName, fileUrl, fileSize } = payload;
        const safeTitle = String(title || '').trim();
        if (!safeTitle) return NextResponse.json({ error: 'Manuscript title is required' }, { status: 400 });
        const id = 'sub-' + Date.now();
        const timeline = [
          { t: 'Awaiting co-admin first review', d: `Submitted 27 Oct · ${fileName || 'manuscript.pdf'}`, c: '#1446A0' },
          { t: 'Submitted', d: fileName || 'manuscript.pdf', c: '#1E8A5A' },
        ];
        db.prepare(`
          INSERT INTO research_submissions (
            id, user_id, author_name, title, type, supervisor, co_authors,
            abstract_text, file_name, file_url, file_size, pages_count,
            stage, submitted_date, notes_json, timeline_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 12, 'co', '27 Oct', '[]', ?)
        `).run(
          id,
          sessionUser.id,
          sessionUser.name,
          safeTitle,
          type || 'Original research',
          supervisor || 'Dr. Toka Essam Samir',
          coAuthors || '',
          abstractText || '',
          fileName || 'manuscript.pdf',
          fileUrl || '/files/protocol-template.pdf',
          fileSize || '1.8 MB',
          JSON.stringify(timeline)
        );
        break;
      }

      case 'review_research': {
        if (!canReviewResearch) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { id, newStage, comment } = payload;
        // Co-admin cannot directly set 'ok' (final admin approval)
        if (!isAdmin && newStage === 'ok') {
          return NextResponse.json({ error: 'Only Admin can grant final approval.' }, { status: 403 });
        }
        if (!['co', 'ad', 'ok', 'ch'].includes(newStage)) {
          return NextResponse.json({ error: 'Invalid review stage.' }, { status: 400 });
        }

        const row = db.prepare('SELECT * FROM research_submissions WHERE id = ?').get(id) as any;
        if (row) {
          const notes = JSON.parse(row.notes_json || '[]');
          const timeline = JSON.parse(row.timeline_json || '[]');
          const reviewerRole = isAdmin ? 'admin' : 'coadmin';
          const reviewerName = sessionUser.name;
          const roleBadge = isAdmin ? 'Admin' : 'Co-admin';
          const noteText =
            comment?.trim() ||
            (newStage === 'ad'
              ? 'Methods and structure verified. Forwarded to Admin for final approval.'
              : newStage === 'ok'
              ? 'Approved and selected for the EPNU Annual Research Conference.'
              : 'Please address the reviewer comments and upload a revised manuscript.');

          notes.unshift({
            who: `${reviewerName} · ${roleBadge}`,
            role: reviewerRole,
            text: noteText,
            date: '27 Oct',
          });

          if (newStage === 'ad') {
            timeline.unshift(
              { t: 'Waiting for admin approval', d: 'Forwarded 27 Oct', c: '#F2B22E' },
              { t: 'Co-admin review passed', d: `${reviewerName}: "${noteText}"`, c: '#1E8A5A' }
            );
          } else if (newStage === 'ok') {
            timeline.unshift({
              t: 'Approved by admin',
              d: `${reviewerName}: "${noteText}"`,
              c: '#1E8A5A',
            });
          } else if (newStage === 'ch') {
            timeline.unshift({
              t: 'Changes requested',
              d: `${reviewerName}: "${noteText}"`,
              c: '#C2412D',
            });
          }

          db.prepare(`
            UPDATE research_submissions
            SET stage = ?, notes_json = ?, timeline_json = ?
            WHERE id = ?
          `).run(newStage, JSON.stringify(notes), JSON.stringify(timeline), id);
        }
        break;
      }

      // PAYMENTS, CHECKOUT & COUPONS
      case 'checkout_pay': {
        const { courseId, planType, planId, method, couponCode, receiptUrl, senderPhone } = payload;
        const gwRow = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('payment_gateways') as any;
        const gateways = getMergedPaymentGateways(gwRow ? JSON.parse(gwRow.value_json) : undefined);

        // Verify selected payment method is enabled by Admin
        if (
          (method === 'card' && !gateways.paymob.enabled) ||
          (method === 'wallet' && !gateways.wallet.enabled) ||
          (method === 'fawry' && !gateways.fawry.enabled) ||
          (method === 'insta' && !gateways.instapay.enabled)
        ) {
          return NextResponse.json({ error: 'Selected payment method is currently disabled by administrator.' }, { status: 400 });
        }

        const isFawry = method === 'fawry';
        const isInsta = method === 'insta';
        const isWallet = method === 'wallet';
        const requiresScreenshot = isInsta || isWallet;

        // Require transfer screenshot for InstaPay and Vodafone Cash
        if (requiresScreenshot && (!receiptUrl || !String(receiptUrl).trim())) {
          return NextResponse.json(
            {
              error:
                isInsta
                  ? 'Please upload the screenshot of your InstaPay transfer before submitting.'
                  : 'Please upload the screenshot of your Vodafone Cash transfer before submitting.',
            },
            { status: 400 }
          );
        }

        const payId = 'pay-' + Date.now();
        const cleanSender = senderPhone ? String(senderPhone).trim() : '';
        const methodLabel =
          method === 'card'
            ? 'Card · Paymob'
            : isWallet
            ? cleanSender
              ? `Vodafone Cash (${cleanSender})`
              : 'Vodafone Cash'
            : isFawry
            ? 'Fawry'
            : cleanSender
            ? `InstaPay (${cleanSender})`
            : 'InstaPay';

        // InstaPay & Vodafone Cash transfers stay Pending until Co-Admin / Admin manually approves the screenshot
        const status = requiresScreenshot || isFawry ? 'Pending' : 'Paid';
        const refCode = isFawry
          ? '7841 2096 553'
          : isInsta
          ? `INSTA-${crypto.randomInt(1000, 9999)}`
          : isWallet
          ? `VFC-${crypto.randomInt(1000, 9999)}`
          : `PMB-${crypto.randomInt(100000, 999999)}`;

        const allPlans: any[] = Array.isArray(gateways.subscriptions?.plans) ? gateways.subscriptions.plans : [];
        const selectedPlanObj =
          planType === 'Membership'
            ? allPlans.find((p: any) => p.id === planId) || allPlans.find((p: any) => p.enabled !== false) || allPlans[0]
            : null;

        const membershipPrice = selectedPlanObj
          ? Number(selectedPlanObj.price) || 199
          : Number(gateways.subscriptions.monthlyPrice) || 199;
        const courseRow = courseId ? (db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any) : null;
        const baseSubtotal = planType === 'Membership' ? membershipPrice : courseRow ? Number(courseRow.price) : 450;
        const itemTitle =
          planType === 'Membership'
            ? selectedPlanObj?.name || 'SRI Membership (Monthly)'
            : courseRow?.title || 'Research Methodology Foundations';
        const storedCourseId =
          planType === 'Membership'
            ? `plan:${selectedPlanObj?.id || 'plan-monthly'}`
            : courseId || '';

        let discountAmount = 0;
        let validCouponCode = '';
        if (couponCode && String(couponCode).trim()) {
          const cp = db
            .prepare('SELECT * FROM coupons WHERE upper(code) = upper(?) AND active = 1 AND used_count < max_uses')
            .get(String(couponCode).trim()) as any;
          if (cp) {
            validCouponCode = cp.code;
            discountAmount =
              cp.discount_pct > 0
                ? Math.round((baseSubtotal * Number(cp.discount_pct)) / 100)
                : Number(cp.discount_fixed) || 0;
          }
        }
        const finalAmount = Math.max(0, baseSubtotal - discountAmount);

        db.prepare(`
          INSERT INTO payments (
            id, user_id, user_name, user_email, item_title, course_id, plan_type,
            method, amount, coupon_code, discount_amount, status, reference_code, receipt_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '27 Oct')
        `).run(
          payId,
          sessionUser.id,
          sessionUser.name,
          sessionUser.email,
          itemTitle,
          storedCourseId,
          planType === 'Membership' ? 'Membership' : 'Course',
          methodLabel,
          finalAmount,
          validCouponCode,
          discountAmount,
          status,
          refCode,
          receiptUrl || ''
        );

        if (validCouponCode) {
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(validCouponCode);
        }

        if (status === 'Paid') {
          if (planType === 'Membership') {
            db.prepare('UPDATE users SET plan = ?, membership_renews = ? WHERE id = ?').run(
              'Membership',
              'Nov 27, 2026',
              sessionUser.id
            );
            const targetCourseIds: string[] =
              selectedPlanObj?.accessType === 'selected' && Array.isArray(selectedPlanObj.courseIds)
                ? selectedPlanObj.courseIds
                : (db.prepare('SELECT id FROM courses').all() as any[]).map(c => c.id);
            for (const cid of targetCourseIds) {
              const existingEnroll = db
                .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
                .get(sessionUser.id, cid);
              if (!existingEnroll) {
                db.prepare(`
                  INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                  VALUES (?, ?, ?, 0, '[]', 'Just now', ?, ?)
                `).run('en-' + Date.now() + '-' + cid, sessionUser.id, cid, selectedPlanObj?.name || 'Membership', `EGP ${finalAmount}`);
                db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(cid);
              }
            }
          } else if (courseId && courseRow) {
            const existingEnroll = db
              .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
              .get(sessionUser.id, courseId);
            if (!existingEnroll) {
              db.prepare(`
                INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                VALUES (?, ?, ?, 0, '[]', 'Just now', ?, ?)
              `).run('en-' + Date.now(), sessionUser.id, courseId, planType || 'Course', `EGP ${finalAmount}`);
              db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(courseId);
            }
          }
        }

        const refreshedUser = await getSessionUser();
        return NextResponse.json({
          ok: true,
          referenceCode: refCode,
          status,
          state: buildFullState(refreshedUser),
        });
      }

      case 'verify_payment':
      case 'update_payment_status': {
        if (!isAdmin && !isCoAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { paymentId, newStatus } = payload;
        const targetStatus =
          action === 'verify_payment'
            ? 'Paid'
            : ['Paid', 'Verify', 'Pending', 'Refunded'].includes(newStatus)
            ? newStatus
            : 'Paid';
        const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
        if (pay) {
          db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(targetStatus, paymentId);
          if (targetStatus === 'Paid') {
            if (pay.plan_type === 'Membership' || String(pay.course_id || '').startsWith('plan:')) {
              db.prepare('UPDATE users SET plan = ?, membership_renews = ? WHERE id = ?').run(
                'Membership',
                'Nov 27, 2026',
                pay.user_id
              );
              const gwRow = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('payment_gateways') as any;
              const gateways = getMergedPaymentGateways(gwRow ? JSON.parse(gwRow.value_json) : undefined);
              const allPlans: any[] = Array.isArray(gateways.subscriptions?.plans) ? gateways.subscriptions.plans : [];
              const planKey = String(pay.course_id || '').replace(/^plan:/, '');
              const matchedPlan = allPlans.find((p: any) => p.id === planKey || p.name === pay.item_title);
              const targetCourseIds: string[] =
                matchedPlan?.accessType === 'selected' && Array.isArray(matchedPlan.courseIds)
                  ? matchedPlan.courseIds
                  : (db.prepare('SELECT id FROM courses').all() as any[]).map(c => c.id);
              for (const cid of targetCourseIds) {
                const existing = db
                  .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
                  .get(pay.user_id, cid);
                if (!existing) {
                  db.prepare(`
                    INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                    VALUES (?, ?, ?, 0, '[]', 'Approved by Staff', ?, ?)
                  `).run('en-' + Date.now() + '-' + cid, pay.user_id, cid, matchedPlan?.name || 'Membership', `EGP ${pay.amount}`);
                  db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(cid);
                }
              }
            } else {
              db.prepare("UPDATE users SET plan = CASE WHEN plan = 'Free' THEN 'Course' ELSE plan END WHERE id = ?").run(
                pay.user_id
              );
              if (pay.course_id) {
                const existing = db
                  .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
                  .get(pay.user_id, pay.course_id);
                if (!existing) {
                  db.prepare(`
                    INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                    VALUES (?, ?, ?, 0, '[]', 'Approved by Staff', ?, ?)
                  `).run('en-' + Date.now(), pay.user_id, pay.course_id, pay.plan_type || 'Course', `EGP ${pay.amount}`);
                  db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(pay.course_id);
                }
              }
            }
          }
        }
        break;
      }

      case 'admin_update_payment': {
        if (!isAdmin && !canManagePayments) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { paymentId, itemTitle, method, amount, referenceCode, status, receiptUrl } = payload;
        const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
        if (!pay) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        const nextStatus = ['Paid', 'Verify', 'Pending', 'Refunded'].includes(status) ? status : pay.status;
        const nextAmount = amount !== undefined ? Math.max(0, Number(amount) || 0) : pay.amount;
        db.prepare(`
          UPDATE payments
          SET item_title = ?, method = ?, amount = ?, reference_code = ?, status = ?, receipt_url = ?
          WHERE id = ?
        `).run(
          itemTitle !== undefined ? String(itemTitle).trim() : pay.item_title,
          method !== undefined ? String(method).trim() : pay.method,
          nextAmount,
          referenceCode !== undefined ? String(referenceCode).trim() : pay.reference_code,
          nextStatus,
          receiptUrl !== undefined ? String(receiptUrl).trim() : pay.receipt_url,
          paymentId
        );
        if (nextStatus === 'Paid') {
          if (pay.plan_type === 'Membership' || String(pay.course_id || '').startsWith('plan:')) {
            db.prepare('UPDATE users SET plan = ?, membership_renews = ? WHERE id = ?').run(
              'Membership',
              'Nov 27, 2026',
              pay.user_id
            );
            const gwRow = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('payment_gateways') as any;
            const gateways = getMergedPaymentGateways(gwRow ? JSON.parse(gwRow.value_json) : undefined);
            const allPlans: any[] = Array.isArray(gateways.subscriptions?.plans) ? gateways.subscriptions.plans : [];
            const planKey = String(pay.course_id || '').replace(/^plan:/, '');
            const matchedPlan = allPlans.find((p: any) => p.id === planKey || p.name === pay.item_title);
            const targetCourseIds: string[] =
              matchedPlan?.accessType === 'selected' && Array.isArray(matchedPlan.courseIds)
                ? matchedPlan.courseIds
                : (db.prepare('SELECT id FROM courses').all() as any[]).map(c => c.id);
            for (const cid of targetCourseIds) {
              const existing = db
                .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
                .get(pay.user_id, cid);
              if (!existing) {
                db.prepare(`
                  INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                  VALUES (?, ?, ?, 0, '[]', 'Approved by Staff', ?, ?)
                `).run('en-' + Date.now() + '-' + cid, pay.user_id, cid, matchedPlan?.name || 'Membership', `EGP ${nextAmount}`);
                db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(cid);
              }
            }
          } else {
            db.prepare("UPDATE users SET plan = CASE WHEN plan = 'Free' THEN 'Course' ELSE plan END WHERE id = ?").run(
              pay.user_id
            );
            if (pay.course_id) {
              const existing = db
                .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
                .get(pay.user_id, pay.course_id);
              if (!existing) {
                db.prepare(`
                  INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                  VALUES (?, ?, ?, 0, '[]', 'Approved by Staff', ?, ?)
                `).run('en-' + Date.now(), pay.user_id, pay.course_id, pay.plan_type || 'Course', `EGP ${nextAmount}`);
                db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(pay.course_id);
              }
            }
          }
        }
        break;
      }

      case 'admin_delete_payment': {
        if (!isAdmin) return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        const { paymentId } = payload;
        db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);
        break;
      }

      case 'create_coupon': {
        if (!canManagePayments) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { code, description, discountPct, discountFixed, maxUses } = payload;
        const safeCode = String(code || '').trim().toUpperCase();
        if (!safeCode) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });
        db.prepare(`
          INSERT OR REPLACE INTO coupons (id, code, description, discount_pct, discount_fixed, used_count, max_uses, active)
          VALUES (?, ?, ?, ?, ?, 0, ?, 1)
        `).run(
          'cp-' + Date.now(),
          safeCode,
          description || `${discountPct}% off`,
          Math.min(100, Math.max(0, Number(discountPct) || 0)),
          Math.max(0, Number(discountFixed) || 0),
          Math.max(1, Number(maxUses) || 100)
        );
        break;
      }

      case 'delete_coupon': {
        if (!canManagePayments) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const id = payload.id || payload.couponId;
        db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
        break;
      }

      // STUDENT COURSE ENROLLMENT MANAGEMENT (ADD, CHANGE, DELETE STUDENT TO/FROM COURSE)
      case 'admin_enroll_student': {
        if (!isAdmin && !canManageStudents && !canManageCourses) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { userId, courseId, planId, progressPct, planType } = payload;
        if (!userId) return NextResponse.json({ error: 'Student userId is required' }, { status: 400 });

        // If enrolling by a Plan ID, enroll in all courses of that plan
        if (planId) {
          const gwRow = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('payment_gateways') as any;
          const gateways = getMergedPaymentGateways(gwRow ? JSON.parse(gwRow.value_json) : undefined);
          const allPlans: any[] = Array.isArray(gateways.subscriptions?.plans) ? gateways.subscriptions.plans : [];
          const matchedPlan = allPlans.find((p: any) => p.id === planId);
          const targetCourseIds: string[] =
            matchedPlan?.accessType === 'selected' && Array.isArray(matchedPlan.courseIds)
              ? matchedPlan.courseIds
              : (db.prepare('SELECT id FROM courses').all() as any[]).map(c => c.id);
          db.prepare('UPDATE users SET plan = ?, membership_renews = ? WHERE id = ?').run(
            'Membership',
            'Nov 27, 2026',
            userId
          );
          for (const cid of targetCourseIds) {
            const existing = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, cid);
            if (!existing) {
              db.prepare(`
                INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
                VALUES (?, ?, ?, 0, '[]', 'Added by Admin', ?, ?)
              `).run('en-' + Date.now() + '-' + cid, userId, cid, matchedPlan?.name || 'Membership', `EGP ${matchedPlan?.price || 199}`);
              db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(cid);
            }
          }
          break;
        }

        if (!courseId) return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        const courseRow = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
        if (!courseRow) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

        const safeProg = Math.min(100, Math.max(0, Number(progressPct) || 0));
        const existing = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any;
        if (existing) {
          db.prepare('UPDATE enrollments SET progress_pct = ?, plan_type = ? WHERE id = ?').run(
            safeProg,
            planType || existing.plan_type || 'Course',
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO enrollments (id, user_id, course_id, progress_pct, completed_lessons_json, enrolled_at, plan_type, amount_paid)
            VALUES (?, ?, ?, ?, '[]', 'Added by Admin', ?, ?)
          `).run(
            'en-' + Date.now() + '-' + crypto.randomInt(100, 999),
            userId,
            courseId,
            safeProg,
            planType || 'Course',
            `EGP ${courseRow.price || 250}`
          );
          db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(courseId);
        }
        db.prepare("UPDATE users SET plan = CASE WHEN plan = 'Free' THEN 'Course' ELSE plan END WHERE id = ?").run(userId);
        break;
      }

      case 'admin_update_enrollment': {
        if (!isAdmin && !canManageStudents && !canManageCourses) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { enrollmentId, userId, courseId, newCourseId, progressPct, planType } = payload;
        const row = enrollmentId
          ? (db.prepare('SELECT * FROM enrollments WHERE id = ?').get(enrollmentId) as any)
          : (db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any);
        if (!row) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

        const targetCourseId = newCourseId && String(newCourseId).trim() ? String(newCourseId).trim() : row.course_id;
        const safeProg = progressPct !== undefined ? Math.min(100, Math.max(0, Number(progressPct) || 0)) : row.progress_pct;
        const nextPlanType = planType !== undefined ? String(planType) : row.plan_type;

        if (targetCourseId !== row.course_id) {
          // Check if already enrolled in targetCourseId
          const dup = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(row.user_id, targetCourseId) as any;
          if (dup && dup.id !== row.id) {
            db.prepare('DELETE FROM enrollments WHERE id = ?').run(row.id);
            db.prepare('UPDATE enrollments SET progress_pct = ?, plan_type = ? WHERE id = ?').run(safeProg, nextPlanType, dup.id);
          } else {
            db.prepare('UPDATE enrollments SET course_id = ?, progress_pct = ?, plan_type = ? WHERE id = ?').run(
              targetCourseId,
              safeProg,
              nextPlanType,
              row.id
            );
            db.prepare('UPDATE courses SET students_count = MAX(0, students_count - 1) WHERE id = ?').run(row.course_id);
            db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?').run(targetCourseId);
          }
        } else {
          db.prepare('UPDATE enrollments SET progress_pct = ?, plan_type = ? WHERE id = ?').run(
            safeProg,
            nextPlanType,
            row.id
          );
        }
        break;
      }

      case 'admin_remove_enrollment': {
        if (!isAdmin && !canManageStudents && !canManageCourses) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { enrollmentId, userId, courseId } = payload;
        const row = enrollmentId
          ? (db.prepare('SELECT * FROM enrollments WHERE id = ?').get(enrollmentId) as any)
          : (db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId) as any);
        if (row) {
          db.prepare('DELETE FROM enrollments WHERE id = ?').run(row.id);
          db.prepare('UPDATE courses SET students_count = MAX(0, students_count - 1) WHERE id = ?').run(row.course_id);
        }
        break;
      }

      // ROLES & PERMISSIONS + GATEWAYS + USER ACCOUNTS
      case 'toggle_coadmin_perm': {
        if (!canManageSettings) return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        const { key } = payload;
        const allowedKeys = ['courses', 'review', 'students', 'payments', 'settings', 'del'];
        if (!allowedKeys.includes(key)) {
          return NextResponse.json({ error: 'Invalid permission key' }, { status: 400 });
        }
        const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('coadmin_perms') as any;
        const perms = row ? JSON.parse(row.value_json) : {};
        perms[key] = !perms[key];
        db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run('coadmin_perms', JSON.stringify(perms));
        break;
      }

      case 'update_file_access_settings': {
        if (!canManageSettings && !canManageCourses) {
          return NextResponse.json({ error: 'Forbidden: Admin or Course Manager required' }, { status: 403 });
        }
        const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('file_access_settings') as any;
        const current = {
          allowLessonPdfDownload: true,
          allowResourceDownload: true,
          allowResearchDownload: true,
          allowPublicPreviewDownload: true,
          ...(row ? JSON.parse(row.value_json) : {}),
        };
        const next = {
          allowLessonPdfDownload:
            payload.allowLessonPdfDownload !== undefined
              ? !!payload.allowLessonPdfDownload
              : current.allowLessonPdfDownload,
          allowResourceDownload:
            payload.allowResourceDownload !== undefined
              ? !!payload.allowResourceDownload
              : current.allowResourceDownload,
          allowResearchDownload:
            payload.allowResearchDownload !== undefined
              ? !!payload.allowResearchDownload
              : current.allowResearchDownload,
          allowPublicPreviewDownload:
            payload.allowPublicPreviewDownload !== undefined
              ? !!payload.allowPublicPreviewDownload
              : current.allowPublicPreviewDownload,
        };
        db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run(
          'file_access_settings',
          JSON.stringify(next)
        );
        break;
      }

      case 'update_contact_message': {
        if (!isAdmin && !isCoAdmin) {
          return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
        }
        const { id, status, adminNote } = payload;
        const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('contact_messages') as any;
        const existing: any[] = row ? JSON.parse(row.value_json) : [...DEFAULT_CONTACT_MESSAGES];
        const updated = existing.map((m: any) =>
          m.id === id
            ? {
                ...m,
                status: status !== undefined ? status : m.status,
                adminNote: adminNote !== undefined ? adminNote : m.adminNote,
              }
            : m
        );
        db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run(
          'contact_messages',
          JSON.stringify(updated)
        );
        break;
      }

      case 'delete_contact_message': {
        if (!isAdmin && !isCoAdmin) {
          return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
        }
        const { id } = payload;
        const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('contact_messages') as any;
        const existing: any[] = row ? JSON.parse(row.value_json) : [...DEFAULT_CONTACT_MESSAGES];
        const updated = existing.filter((m: any) => m.id !== id);
        db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run(
          'contact_messages',
          JSON.stringify(updated)
        );
        break;
      }

      case 'update_gateway_settings': {
        if (!canManageSettings && !canManagePayments) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { gateways } = payload;
        const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('payment_gateways') as any;
        const current = getMergedPaymentGateways(row ? JSON.parse(row.value_json) : undefined);
        const nextSubs = { ...current.subscriptions, ...(gateways?.subscriptions || {}) };
        if (Array.isArray(gateways?.subscriptions?.plans)) {
          nextSubs.plans = gateways.subscriptions.plans.map((p: any, idx: number) => ({
            id: p.id || `plan-${Date.now()}-${idx}`,
            name: String(p.name || 'Membership Plan').trim(),
            nameAr: String(p.nameAr || p.name || 'باقة العضوية').trim(),
            badge: String(p.badge || '').trim(),
            price: Math.max(1, Number(p.price) || 199),
            currency: String(p.currency || 'EGP').trim(),
            period: String(p.period || 'month').trim(),
            periodAr: String(p.periodAr || 'شهرياً').trim(),
            description: String(p.description || '').trim(),
            descriptionAr: String(p.descriptionAr || p.description || '').trim(),
            accessType: p.accessType === 'selected' ? 'selected' : 'all',
            courseIds: Array.isArray(p.courseIds) ? p.courseIds : [],
            enabled: p.enabled !== false,
          }));
          const firstActive = nextSubs.plans.find((p: any) => p.enabled !== false) || nextSubs.plans[0];
          if (firstActive && gateways?.subscriptions?.monthlyPrice === undefined) {
            nextSubs.monthlyPrice = firstActive.price;
          }
        }
        const nextGateways = {
          paymob: { ...current.paymob, ...(gateways?.paymob || {}) },
          wallet: { ...current.wallet, ...(gateways?.wallet || {}) },
          fawry: { ...current.fawry, ...(gateways?.fawry || {}) },
          instapay: { ...current.instapay, ...(gateways?.instapay || {}) },
          subscriptions: nextSubs,
        };
        db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json) VALUES (?, ?)').run(
          'payment_gateways',
          JSON.stringify(nextGateways)
        );
        break;
      }

      case 'admin_create_user': {
        if (!isAdmin) return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        const name = String(payload.name || '').trim();
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || 'student123');
        const role = ['student', 'coadmin', 'admin'].includes(payload.role) ? payload.role : 'student';
        const plan = String(payload.plan || 'Free').trim() || 'Free';
        const faculty = String(payload.faculty || 'Medicine').trim();
        const studentIdCode = String(payload.studentIdCode || '2026-0500').trim();
        const yearLevel = Math.min(7, Math.max(1, Number(payload.yearLevel) || 2));

        if (!name || !email) {
          return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
        }
        const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email);
        if (exists) {
          return NextResponse.json({ error: 'Email already exists.' }, { status: 400 });
        }

        const id = 'u-' + crypto.randomUUID().slice(0, 8);
        const initials =
          name
            .split(/\s+/)
            .map((w: string) => w[0]?.toUpperCase() || '')
            .slice(0, 2)
            .join('') || 'US';

        db.prepare(`
          INSERT INTO users (id, name, email, password, role, student_id_code, faculty, year_level, plan, membership_renews, last_active, avatar_initials)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Just now', ?)
        `).run(
          id,
          name,
          email,
          hashPassword(password),
          role,
          studentIdCode,
          faculty,
          yearLevel,
          plan,
          plan !== 'Free' ? 'Nov 27, 2026' : 'Active',
          initials
        );
        break;
      }

      case 'admin_update_user': {
        if (!isAdmin && !canManageStudents) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const id = payload.id || payload.targetUserId;
        const { name, email, role, plan, faculty, studentIdCode, yearLevel, newPassword } = payload;
        const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
        if (!cur) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const nextRole = isAdmin && ['student', 'coadmin', 'admin'].includes(role) ? role : cur.role;
        const nextPlan = plan !== undefined && String(plan).trim() ? String(plan).trim() : cur.plan;
        const nextPwd =
          isAdmin && newPassword && String(newPassword).trim().length >= 4
            ? hashPassword(String(newPassword).trim())
            : cur.password;

        db.prepare(`
          UPDATE users
          SET name = ?, email = ?, password = ?, role = ?, plan = ?, faculty = ?, student_id_code = ?, year_level = ?, membership_renews = ?
          WHERE id = ?
        `).run(
          name?.trim() || cur.name,
          email?.trim().toLowerCase() || cur.email,
          nextPwd,
          nextRole,
          nextPlan,
          faculty?.trim() || cur.faculty,
          studentIdCode?.trim() || cur.student_id_code,
          yearLevel !== undefined ? Number(yearLevel) : cur.year_level,
          nextPlan !== 'Free' ? 'Nov 27, 2026' : cur.membership_renews,
          id
        );
        break;
      }

      case 'admin_delete_user': {
        if (!isAdmin) return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        const id = payload.id || payload.targetUserId;
        if (id === sessionUser.id) {
          return NextResponse.json({ error: 'Cannot delete your own active Admin account.' }, { status: 400 });
        }
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(id);
        break;
      }

      // LIVE SESSIONS
      case 'toggle_book_session': {
        const { sessionId } = payload;
        const userId = sessionUser.id;
        const row = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(sessionId) as any;
        if (row) {
          const list: string[] = JSON.parse(row.booked_users_json || '[]');
          const idx = list.indexOf(userId);
          if (idx >= 0) list.splice(idx, 1);
          else list.push(userId);
          db.prepare('UPDATE live_sessions SET booked_users_json = ? WHERE id = ?').run(JSON.stringify(list), sessionId);
        }
        break;
      }

      case 'create_live_session': {
        if (!canManageCourses) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { title, mentor, dateLabel, timeLabel, platform, meetingLink, category } = payload;
        db.prepare(`
          INSERT INTO live_sessions (id, title, title_ar, mentor, date_label, time_label, platform, meeting_link, category, booked_users_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
        `).run(
          'ls-' + Date.now(),
          title,
          title,
          mentor || 'Dr. Toka Essam Samir',
          dateLabel || 'Sat, 7 Nov',
          timeLabel || '7:00 PM Cairo',
          platform || 'Zoom',
          meetingLink || 'https://zoom.us/j/sri-epnu',
          category || 'Research methods'
        );
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const refreshedUser = await getSessionUser();
    return NextResponse.json({ ok: true, state: buildFullState(refreshedUser) });
  } catch {
    return NextResponse.json({ error: 'Request could not be processed' }, { status: 500 });
  }
}
