'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/reports', label: '通報' },
  { href: '/admin/subjects', label: '科目' },
] as const;

// 管理画面共通のタブ（通報 / 科目）
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="管理メニュー" className="flex gap-2 border-b border-border pb-3">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center justify-center min-h-11 px-5 rounded-full border-2 border-ink text-sm font-bold transition-colors ${
              active ? 'bg-ink text-white' : 'bg-card text-foreground hover:bg-muted'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
