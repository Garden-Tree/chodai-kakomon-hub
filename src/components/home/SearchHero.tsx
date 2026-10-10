import { Search } from 'lucide-react';

type Props = {
  query: string;
};

// トップページのヒーロー（科目名検索フォーム）
export function SearchHero({ query }: Props) {
  return (
    <section className="rounded-2xl bg-primary p-4 text-primary-foreground sm:p-6 md:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight [word-break:auto-phrase] sm:text-3xl md:text-4xl">
        どの科目の過去問を探す？
      </h1>
      <p className="mt-2 text-base text-primary-foreground/85 [word-break:auto-phrase]">
        科目名で検索、または学部から選べます
      </p>

      <form action="/" method="get" role="search" className="relative mt-5 max-w-2xl">
        <label htmlFor="subject-search" className="sr-only">
          科目名で検索
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="subject-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="科目名を入力（例: 線形代数）"
          className="edge-pop h-14 w-full min-w-0 rounded-xl bg-white pl-11 pr-16 text-base text-foreground outline-none placeholder:text-sm placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-highlight sm:pr-20 sm:placeholder:text-base"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 inline-flex h-11 -translate-y-1/2 items-center justify-center rounded-lg border-2 border-ink bg-highlight px-2.5 text-sm font-bold text-highlight-foreground transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-4"
        >
          検索
        </button>
      </form>
    </section>
  );
}
