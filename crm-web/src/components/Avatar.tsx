import { resolveAssetUrl } from '@/lib/api';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
}

export default function Avatar({ name, url, size = 40 }: AvatarProps) {
  const src = resolveAssetUrl(url);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2.8 }}
      className="flex items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700"
    >
      {initials}
    </div>
  );
}