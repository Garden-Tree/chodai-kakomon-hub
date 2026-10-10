export default function Loading() {
  return (
    <div
      className="flex-1 flex items-center justify-center p-12"
      role="status"
      aria-live="polite"
    >
      <div
        className="size-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">読み込み中...</span>
    </div>
  );
}
