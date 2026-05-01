import { useEffect, useRef, useState } from 'react';

type ExpandableDescriptionProps = {
  id: string;
  text?: string | null;
  fallback?: string;
  clampLines?: number;
  className?: string;
  paragraphClassName?: string;
  textClassName?: string;
  buttonClassName?: string;
  fadeClassName?: string;
  wrapperClassName?: string;
};

const clampText = (lines: number) => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: lines,
  overflow: 'hidden',
});

export function ExpandableDescription({
  id,
  text,
  fallback = 'No description.',
  clampLines = 3,
  className = '',
  paragraphClassName = 'text-justify',
  textClassName = '',
  buttonClassName = '',
  fadeClassName = '',
  wrapperClassName = '',
}: ExpandableDescriptionProps) {
  const content = (text ?? '').trim() || fallback;
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [id, content]);

  useEffect(() => {
    if (expanded) return;

    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      setCanExpand(el.scrollHeight > el.clientHeight + 2);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && textRef.current
        ? new ResizeObserver(measure)
        : null;

    if (resizeObserver && textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [content, clampLines, expanded]);

  return (
    <div className={`relative min-h-[4.75rem] ${wrapperClassName}`.trim()}>
      <div className={`relative ${className}`.trim()}>
        <p
          ref={textRef}
          className={`${paragraphClassName} leading-relaxed hyphens-auto ${textClassName}`.trim()}
          style={expanded ? undefined : clampText(clampLines)}
        >
          {content}
        </p>

        {!expanded && canExpand && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-7 ${fadeClassName}`.trim()} />
        )}
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`mt-2 inline-flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors hover:underline ${buttonClassName}`.trim()}
          aria-expanded={expanded}
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}