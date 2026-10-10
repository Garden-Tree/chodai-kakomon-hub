'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-11 font-bold cursor-pointer"
      disabled={pending}
    >
      {pending ? '確認中...' : '閲覧する'}
    </Button>
  );
}
