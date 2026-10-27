import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpsPilot AI - Operations Intelligence Platform',
  description:
    'AI-powered enterprise operations intelligence platform providing autonomous incident triage, telemetry diagnostics, and infrastructure surveillance.',
  keywords: ['OpsPilot AI', 'Operations Intelligence', 'Observability', 'AI Triage', 'DevOps'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
