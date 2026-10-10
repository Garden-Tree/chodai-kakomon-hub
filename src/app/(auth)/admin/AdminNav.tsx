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
    <nav aria-label="管理メニュー" className="flex gap-2 border-b border-slate-200 pb-3">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
