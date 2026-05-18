import { useEffect, useState } from 'react';
import { buildCourseCoverDataUri } from '@/src/lib/courseCover';
import { resolveCourseCoverUrl } from '@/src/lib/studentApi';

export function CourseCoverImage({
  coverUrl,
  title,
  category,
  alt,
  className,
}: {
  coverUrl?: string | null;
  title: string;
  category?: string | null;
  alt?: string;
  className?: string;
}) {
  const fallback = buildCourseCoverDataUri(title, category || undefined);
  const [src, setSrc] = useState(coverUrl ? resolveCourseCoverUrl(coverUrl) : fallback);

  useEffect(() => {
    setSrc(coverUrl ? resolveCourseCoverUrl(coverUrl) : fallback);
  }, [coverUrl, fallback]);

  return (
    <img
      src={src}
      alt={alt || title}
      className={className}
      onError={() => {
        if (src !== fallback) {
          setSrc(fallback);
        }
      }}
    />
  );
}
