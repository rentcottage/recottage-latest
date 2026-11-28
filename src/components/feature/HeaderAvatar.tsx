import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

/** Up to two initials from the user's name, else their email. */
export function initialsFor(user: Pick<User, 'email' | 'user_metadata'> | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const full = str(meta.full_name) || str(meta.name) || [str(meta.first_name), str(meta.last_name)].filter(Boolean).join(' ');
  const source = full || str(user?.email).split('@')[0];
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters = (words.length >= 2 ? [words[0], words[words.length - 1]] : words.slice(0, 1)).map((w) => [...w][0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

/**
 * Logged-in user's avatar for the header: their uploaded profile photo, else
 * their Google/Facebook picture, else initials. The profile photo URL is read
 * once per session (cached in sessionStorage) so the header doesn't query on
 * every page; any failure — query or image — falls back to initials.
 */
export default function HeaderAvatar({ user, size = 32 }: { user: User; size?: number }) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const oauthPhoto = typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : '';
  const cacheKey = `rc_avatar_${user.id}`;
  const [photo, setPhoto] = useState<string>(() => sessionStorage.getItem(cacheKey) ?? oauthPhoto);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(cacheKey) !== null) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const url = (data?.avatar_url as string | null) || oauthPhoto;
        sessionStorage.setItem(cacheKey, url);
        if (!cancelled) setPhoto(url);
      }, () => { /* keep the OAuth photo / initials */ });
    return () => { cancelled = true; };
  }, [cacheKey, oauthPhoto, user.id]);

  const box = { width: size, height: size };
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        style={box}
        className="rounded-full object-cover flex-shrink-0 bg-gray-200"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      style={box}
      className="rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0 text-[12px] font-bold leading-none select-none"
      aria-hidden="true"
    >
      {initialsFor(user)}
    </span>
  );
}
