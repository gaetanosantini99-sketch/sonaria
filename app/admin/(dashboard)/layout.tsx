import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { logout } from '@/app/admin/login/actions';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/eventi', label: 'Serate' },
  { href: '/admin/clienti', label: 'Clienti' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="font-semibold hover:text-accent">
              {item.label}
            </Link>
          ))}
          <form action={logout} className="ml-auto">
            <button className="text-sm text-muted hover:text-text">Esci</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
