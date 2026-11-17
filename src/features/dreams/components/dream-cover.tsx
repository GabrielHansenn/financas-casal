import { cn } from "@/lib/utils";
import { categoryInfo, type DreamCategory } from "../labels";

/**
 * Dream image, or a soft gradient with the category icon when there is none.
 * Uses a plain <img>: images come from signed URLs of a private bucket, and the Next image
 * optimizer would keep server-side copies outside the bucket's access rules.
 */
export function DreamCover({
  url,
  category,
  alt,
  className,
  placeholderClassName,
  loading = "lazy",
}: {
  url: string | null;
  category: DreamCategory;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  loading?: "lazy" | "eager";
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket (see above)
      <img src={url} alt={alt} loading={loading} decoding="async" className={cn("block w-full object-cover", className)} />
    );
  }
  const { icon: Icon, color } = categoryInfo(category);
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("flex aspect-[4/3] w-full items-center justify-center", placeholderClassName, className)}
      style={{ background: `linear-gradient(135deg, ${color}33, ${color}0d)` }}
    >
      <Icon className="size-10" style={{ color }} aria-hidden />
    </div>
  );
}
