import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SRI Learning Platform · East Port Said National University',
  description:
    'Student Research Initiative (SRI) at East Port Said National University (EPNU) — Courses, Video Lectures, PDFs, Quizzes, Mentorship, and Manuscript Peer-Review.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;600&family=Cairo:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,0,0"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
