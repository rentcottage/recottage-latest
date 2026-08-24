import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import Button from '../../components/base/Button';
import BookingCard from './components/BookingCard';
import PhoneVerifyModal from '../../components/feature/PhoneVerifyModal';
import { supabase } from '../../lib/supabase';
import { normalizeGeoPhone } from '../../lib/otp';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import type { Booking } from '../../lib/supabase';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  location: string;
  joinDate: string;
  avatar: string;
  verified: boolean;
}

interface StoredUser extends UserProfile {
  password: string;
}

// ─── Per-user storage helpers ────────────────────────────────────────────────
const getAllUsers = (): Record<string, StoredUser> => {
  try { return JSON.parse(localStorage.getItem('rc_users') || '{}'); } catch { return {}; }
};

const saveAllUsers = (users: Record<string, StoredUser>) => {
  localStorage.setItem('rc_users', JSON.stringify(users));
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  // Email changes go through Supabase Auth, which mails a confirmation link to
  // the new address; the change only lands once that link is clicked.
  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<{ kind: 'sent' | 'error'; text: string } | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);

  // Phone verification: changing the number requires re-verifying it by SMS.
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPhone, setVerifyPhone] = useState('');

  const defaultProfile: UserProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    joinDate: '',
    avatar: '',   // no auto-generated image
    verified: false,
  };

  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [editForm, setEditForm] = useState<UserProfile>(defaultProfile);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Load full profile from Supabase — this is the source of truth for phone, name, etc.
  const loadProfileFromSupabase = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, phone, phone_verified, first_name, last_name, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!data) return;

    if (data.avatar_url) {
      setAvatarUrl(data.avatar_url);
    }

    setPhoneVerified(!!data.phone_verified);

    // Always sync phone from Supabase — this is the authoritative source
    // regardless of what's in localStorage
    const phoneFromDb = data.phone ?? '';
    const firstNameFromDb = data.first_name ?? '';
    const lastNameFromDb = data.last_name ?? '';
    const emailFromDb = data.email ?? '';

    setUserProfile((prev) => ({
      ...prev,
      phone: phoneFromDb,
      ...(firstNameFromDb && { firstName: firstNameFromDb }),
      ...(lastNameFromDb && { lastName: lastNameFromDb }),
      ...(emailFromDb && { email: emailFromDb }),
    }));
    setEditForm((prev) => ({
      ...prev,
      phone: phoneFromDb,
      ...(firstNameFromDb && { firstName: firstNameFromDb }),
      ...(lastNameFromDb && { lastName: lastNameFromDb }),
      ...(emailFromDb && { email: emailFromDb }),
    }));
  };

  const loadBookings = async (email: string) => {
    setBookingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBookings(data as Booking[]);
      }
    } catch {
      // silently ignore
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/');
      return;
    }

    const email = user.email ?? '';
    const users = getAllUsers();

    if (users[email]) {
      // Existing local user — strip avatar from stored data (we use Supabase now)
      const { password: _pw, avatar: _av, ...profile } = users[email];
      setUserProfile({ ...defaultProfile, ...profile, avatar: '' });
      setEditForm({ ...defaultProfile, ...profile, avatar: '' });
    } else {
      // Social login user — build profile from Supabase metadata
      const meta = user.user_metadata ?? {};
      const fullName: string = meta.full_name ?? meta.name ?? '';
      const nameParts = fullName.split(' ');
      const socialProfile: UserProfile = {
        firstName: nameParts[0] ?? '',
        lastName: nameParts.slice(1).join(' '),
        email,
        phone: '',
        bio: '',
        location: '',
        joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        avatar: '',  // don't use meta.picture — user can upload their own
        verified: true,
      };
      // For social logins, use Google/OAuth picture only as initial avatar if the user
      // hasn't uploaded their own yet — handled in loadAvatarFromSupabase fallback below
      const oauthPicture: string = meta.avatar_url ?? meta.picture ?? '';
      if (oauthPicture) {
        // Only use OAuth picture as a display fallback (not stored in Supabase unless user uploads)
        setAvatarUrl(oauthPicture);
      }
      users[email] = { ...socialProfile, password: '' };
      saveAllUsers(users);
      setUserProfile(socialProfile);
      setEditForm(socialProfile);
    }

    setIsLoggedIn(true);
    loadBookings(email);
    // Load avatar + phone from Supabase (overrides OAuth picture if user has uploaded their own)
    loadProfileFromSupabase(user.id);
  }, [user, authLoading, navigate]);

  // Refresh bookings when switching to bookings tab
  useEffect(() => {
    if (activeTab === 'bookings' && user?.email) {
      loadBookings(user.email);
    }
  }, [activeTab, user]);

  // Trigger contact-reveal emails once per day when customer views their profile
  useEffect(() => {
    if (!user) return;
    const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
    const lastRun = localStorage.getItem('rc_contact_reveal_last_run');
    const today = new Date().toISOString().split('T')[0];
    if (lastRun === today) return;
    fetch(`${SUPABASE_URL}/functions/v1/booking-handler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-contact-reveal-emails' }),
    })
      .then(() => localStorage.setItem('rc_contact_reveal_last_run', today))
      .catch(() => {});

    // Also trigger pending booking reminders (at most once per hour)
    const lastReminder = localStorage.getItem('rc_booking_reminders_last_run');
    const nowMs = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (!lastReminder || nowMs - Number(lastReminder) >= ONE_HOUR_MS) {
      fetch(`${SUPABASE_URL}/functions/v1/booking-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(() => localStorage.setItem('rc_booking_reminders_last_run', String(nowMs)))
        .catch(() => {});
    }
  }, [user]);

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type & size
    if (!file.type.startsWith('image/')) {
      setAvatarError(t('account.profile.selectImageError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('account.profile.imageSizeError'));
      return;
    }

    setAvatarError('');
    setAvatarUploading(true);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      // Upload (upsert) to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setAvatarError(t('account.profile.uploadFailedError'));
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Cache-bust so the browser shows the new image immediately
      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      // Save URL to profiles table
      await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: freshUrl }, { onConflict: 'id' });

      setAvatarUrl(freshUrl);
    } catch {
      setAvatarError(t('account.profile.somethingWrongError'));
    } finally {
      setAvatarUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarUploading(true);
    try {
      // Remove all avatar files for this user
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (files && files.length > 0) {
        const paths = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(paths);
      }

      // Clear from profiles table
      await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      setAvatarUrl('');
    } catch {
      setAvatarError(t('account.profile.removePhotoFailedError'));
    } finally {
      setAvatarUploading(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const [saveProfileError, setSaveProfileError] = useState('');
  const [saveProfileLoading, setSaveProfileLoading] = useState(false);

  const handleSaveProfile = async () => {
    // Validate required name fields
    if (!editForm.firstName.trim()) {
      setSaveProfileError(t('account.profile.firstNameRequiredError'));
      return;
    }
    if (!editForm.lastName.trim()) {
      setSaveProfileError(t('account.profile.lastNameRequiredError'));
      return;
    }

    // Phone is required and must be a valid Georgian number (so it can be SMS-verified).
    const normalizedNew = normalizeGeoPhone(editForm.phone);
    if (!normalizedNew) {
      setSaveProfileError(t('account.profile.validPhoneError'));
      return;
    }

    const email = user?.email;
    if (!email || !user) return;

    // Did the number change from the one already on file?
    const normalizedCurrent = normalizeGeoPhone(userProfile.phone) ?? '';
    const phoneChanged = normalizedNew !== normalizedCurrent;

    setSaveProfileError('');
    setSaveProfileLoading(true);
    try {
      // Save name + email now. The phone is written here ONLY if it didn't change
      // (an unchanged number keeps its verified status). A changed number is saved
      // by the verification step below — never before the new number is verified.
      // `email` is deliberately absent. It mirrors auth.users.email and is synced
      // from there by upsertProfile once a change is confirmed. Writing whatever
      // was typed here changed nothing about the login, so the profile ended up
      // displaying an address the account didn't own — and let anyone put someone
      // else's address on their profile, unverified.
      const payload: Record<string, string> = {
        id: user.id,
        first_name: editForm.firstName.trim(),
        last_name: editForm.lastName.trim(),
        full_name: `${editForm.firstName.trim()} ${editForm.lastName.trim()}`.trim(),
      };
      if (!phoneChanged) payload.phone = normalizedNew;

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        setSaveProfileError(t('account.profile.saveFailedError'));
        return;
      }

      if (phoneChanged) {
        // Reflect the saved name/email locally but keep the OLD phone until the
        // new one is verified, then open the SMS verification modal.
        const pending = { ...editForm, phone: userProfile.phone };
        setUserProfile(pending);
        localStorage.setItem('userProfile', JSON.stringify(pending));
        const users = getAllUsers();
        if (users[email]) { users[email] = { ...users[email], ...pending }; saveAllUsers(users); }
        setVerifyPhone(normalizedNew);
        setVerifyOpen(true);
        return;
      }

      // Unchanged number — finish up.
      const merged = { ...editForm, phone: normalizedNew };
      const users = getAllUsers();
      if (users[email]) { users[email] = { ...users[email], ...merged }; saveAllUsers(users); }
      localStorage.setItem('userProfile', JSON.stringify(merged));
      setUserProfile(merged);
      setIsEditing(false);
    } finally {
      setSaveProfileLoading(false);
    }
  };

  // Called by PhoneVerifyModal once the NEW number is verified. The phone-otp
  // function has already written phone + phone_verified=true for this user.
  const handleProfilePhoneVerified = (normalizedPhone: string) => {
    setVerifyOpen(false);
    setPhoneVerified(true);
    // Base on userProfile so this works both from Edit Profile and the read-view
    // "Verify now" button.
    const merged = { ...userProfile, phone: normalizedPhone };
    setEditForm(merged);
    setUserProfile(merged);
    const emailKey = user?.email;
    if (emailKey) {
      const users = getAllUsers();
      if (users[emailKey]) { users[emailKey] = { ...users[emailKey], ...merged }; saveAllUsers(users); }
    }
    localStorage.setItem('userProfile', JSON.stringify(merged));
    setIsEditing(false);
  };

  const handleRequestEmailChange = async () => {
    const next = newEmail.trim().toLowerCase();
    const current = (user?.email ?? '').trim().toLowerCase();
    setEmailStatus(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setEmailStatus({ kind: 'error', text: t('account.profile.emailInvalid') });
      return;
    }
    if (next === current) {
      setEmailStatus({ kind: 'error', text: t('account.profile.emailUnchanged') });
      return;
    }

    setEmailSaving(true);
    try {
      // Supabase mails the confirmation itself and only swaps the address once
      // the link is opened, so an address the user doesn't control can never
      // become their login. Nothing is written to profiles here.
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${window.location.origin}/auth/callback` },
      );
      if (error) {
        setEmailStatus({ kind: 'error', text: error.message });
        return;
      }
      setEmailStatus({ kind: 'sent', text: t('account.profile.emailChangeSent', { email: next }) });
      setEmailEditing(false);
      setNewEmail('');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm(userProfile);
    setIsEditing(false);
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* ── Compact Profile Header ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 40%, #3d2020 70%, #2a1515 100%)',
        }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("https://readdy.ai/api/search-image?query=soft%20misty%20georgian%20mountain%20landscape%20with%20pine%20forests%20and%20gentle%20hills%2C%20minimal%20atmospheric%20haze%2C%20muted%20tones%2C%20serene%20nature%20scene%2C%20wide%20panoramic%20view%2C%20subtle%20texture%20for%20background%20overlay%2C%20no%20people%2C%20calm%20and%20peaceful%20atmosphere&width=1400&height=300&seq=profile-header-bg-01&orientation=landscape")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-50/20 to-transparent" />

        <div className="relative max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0 group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t('account.profile.profilePhotoAlt')}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover object-top border-[3px] border-white/30 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 border-[3px] border-white/20 shadow-lg flex items-center justify-center backdrop-blur-sm">
                  <i className="ri-user-3-line text-white/70 text-3xl md:text-4xl"></i>
                </div>
              )}

              {/* Camera overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                title={t('account.profile.changePhoto')}
              >
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className="ri-camera-line text-white text-xl"></i>
                )}
              </button>

              {/* Mobile camera button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="md:hidden absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
              >
                <i className="ri-camera-line text-gray-600 text-sm"></i>
              </button>

              {userProfile.verified && (
                <div className="hidden md:flex absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full items-center justify-center border-2 border-white">
                  <i className="ri-check-line text-white text-xs"></i>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 text-center sm:text-left pb-0.5">
              <h1 className="text-xl md:text-2xl font-bold text-white leading-tight truncate">
                {userProfile.firstName || userProfile.lastName
                  ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
                  : t('account.profile.myProfileFallback')}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-1.5">
                {userProfile.location && (
                  <div className="flex items-center gap-1 text-white/60">
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-map-pin-line text-xs"></i>
                    </div>
                    <span className="text-xs">{userProfile.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-white/60">
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-calendar-line text-xs"></i>
                  </div>
                  <span className="text-xs">{t('account.profile.joined', { date: userProfile.joinDate })}</span>
                </div>
                {userProfile.email && (
                  <div className="flex items-center gap-1 text-white/50">
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <i className="ri-mail-line text-xs"></i>
                    </div>
                    <span className="text-xs truncate max-w-[180px]">{userProfile.email}</span>
                  </div>
                )}
              </div>
              {avatarError && (
                <p className="text-xs text-red-300 mt-1.5">{avatarError}</p>
              )}
            </div>

            {/* Edit button */}
            <div className="flex-shrink-0 pb-0.5">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap backdrop-blur-sm"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-edit-line text-sm"></i>
                </div>
                {isEditing ? t('account.profile.cancel') : t('account.profile.editProfile')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="max-w-[1280px] mx-auto px-3 md:px-4 py-5 md:py-8">

        {/* Profile Tabs */}
        <div className="bg-white rounded-card shadow-card border border-line">
          <div className="border-b border-line overflow-hidden">
            <nav className="flex overflow-x-auto px-3 md:px-8 gap-0 md:space-x-8 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { id: 'profile', label: t('account.profile.tabProfile'), icon: 'ri-user-line' },
                { id: 'bookings', label: t('account.profile.tabBookings'), icon: 'ri-calendar-check-line' },
                { id: 'wishlist', label: t('account.profile.tabWishlist'), icon: 'ri-heart-line' },
                { id: 'reviews', label: t('account.profile.tabReviews'), icon: 'ri-star-line' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 py-3 md:py-4 px-2 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center">
                      <i className={tab.icon}></i>
                    </div>
                    {tab.label}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 md:p-8">
            {/* Profile Details Tab */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl">
                {/* Missing name banner — shown for Google users with incomplete name */}
                {!isEditing && (!userProfile.firstName || !userProfile.lastName) && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-user-line text-red-500"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800">{t('account.profile.incompleteTitle')}</p>
                      <p className="text-xs text-red-700 mt-0.5">
                        {t('account.profile.incompleteBodyPre')}{' '}
                        {!userProfile.firstName && !userProfile.lastName
                          ? t('account.profile.incompleteFirstLast')
                          : !userProfile.firstName
                          ? t('account.profile.incompleteFirst')
                          : t('account.profile.incompleteLast')}{' '}
                        {t('account.profile.incompleteBodyPost')}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-shrink-0 text-xs font-medium text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      {t('account.profile.complete')}
                    </button>
                  </div>
                )}

                {/* Complete Profile Banner — phone missing */}
                {!isEditing && userProfile.firstName && userProfile.lastName && !userProfile.phone && (
                  <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-phone-line text-amber-500"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800">{t('account.profile.addPhoneTitle')}</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {t('account.profile.addPhoneBody')}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-shrink-0 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      {t('account.profile.add')}
                    </button>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-sm md:text-lg font-semibold text-gray-900">{t('account.profile.editProfileTitle')}</h3>

                    {/* Photo management in edit mode */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs md:text-sm font-medium text-gray-700 mb-3">{t('account.profile.profilePhoto')}</p>
                      <div className="flex items-center gap-4">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={t('account.profile.profilePhotoAlt')}
                            className="w-16 h-16 rounded-full object-cover object-top border-2 border-white shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <i className="ri-user-3-line text-gray-400 text-2xl"></i>
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarUploading}
                            className="text-xs md:text-sm font-medium text-red-500 hover:text-red-600 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                          >
                            {avatarUploading ? (
                              <>
                                <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                {t('account.profile.uploadingEllipsis')}
                              </>
                            ) : (
                              <>
                                <i className="ri-upload-2-line"></i>
                                {avatarUrl ? t('account.profile.changePhoto') : t('account.profile.uploadPhoto')}
                              </>
                            )}
                          </button>
                          {avatarUrl && (
                            <button
                              onClick={handleRemoveAvatar}
                              disabled={avatarUploading}
                              className="text-xs md:text-sm text-gray-500 hover:text-gray-700 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                            >
                              <i className="ri-delete-bin-line"></i>
                              {t('account.profile.removePhoto')}
                            </button>
                          )}
                          <p className="text-xs text-gray-400">{t('account.profile.photoRequirements')}</p>
                          {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          {t('account.profile.firstName')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className={`w-full p-2.5 md:p-3 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            !editForm.firstName.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder={t('account.profile.required')}
                        />
                        {!editForm.firstName.trim() && (
                          <p className="text-xs text-red-500 mt-1">{t('account.profile.firstNameRequired')}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          {t('account.profile.lastName')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className={`w-full p-2.5 md:p-3 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            !editForm.lastName.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder={t('account.profile.required')}
                        />
                        {!editForm.lastName.trim() && (
                          <p className="text-xs text-red-500 mt-1">{t('account.profile.lastNameRequired')}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          {t('account.profile.email')}
                        </label>
                        {/* Read-only: this is the login address. Changing it is a
                            separate, confirmed action — see below. */}
                        <input
                          type="email"
                          value={user?.email ?? ''}
                          readOnly
                          disabled
                          className="w-full p-2.5 md:p-3 text-sm border border-gray-200 bg-gray-50 text-gray-600 rounded-lg cursor-not-allowed"
                        />

                        {!emailEditing ? (
                          <button
                            type="button"
                            onClick={() => { setEmailEditing(true); setEmailStatus(null); setNewEmail(''); }}
                            className="mt-1.5 text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                          >
                            {t('account.profile.changeEmail')}
                          </button>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder={t('account.profile.newEmailPlaceholder')}
                              className="w-full p-2.5 md:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500">{t('account.profile.emailChangeNote')}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleRequestEmailChange}
                                disabled={emailSaving}
                                className="px-3 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg cursor-pointer"
                              >
                                {emailSaving ? t('common.loading') : t('account.profile.sendConfirmation')}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEmailEditing(false); setEmailStatus(null); }}
                                className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 cursor-pointer"
                              >
                                {t('account.profile.cancel')}
                              </button>
                            </div>
                          </div>
                        )}

                        {emailStatus && (
                          <p className={`mt-2 text-xs ${emailStatus.kind === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                            {emailStatus.text}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          {t('account.profile.phone')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <i className="ri-phone-line text-gray-400 text-sm"></i>
                          </div>
                          <input
                            type="tel"
                            required
                            value={editForm.phone}
                            onChange={(e) => {
                              setEditForm(prev => ({ ...prev, phone: e.target.value }));
                              if (saveProfileError) setSaveProfileError('');
                            }}
                            placeholder={t('account.profile.phonePlaceholder')}
                            className="w-full pl-9 pr-3 py-2.5 md:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{t('account.profile.phoneHint')}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                        {t('account.profile.location')}
                      </label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full p-2.5 md:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                        {t('account.profile.bio')}
                      </label>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                        rows={4}
                        className="w-full p-2.5 md:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    {saveProfileError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                        <i className="ri-error-warning-line text-red-500 flex-shrink-0"></i>
                        <p className="text-sm text-red-700">{saveProfileError}</p>
                      </div>
                    )}

                    <div className="flex gap-3 md:gap-4 pt-2 md:pt-4">
                      <Button onClick={handleSaveProfile} variant="primary" disabled={saveProfileLoading}>
                        {saveProfileLoading ? t('account.profile.saving') : t('account.profile.saveChanges')}
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" disabled={saveProfileLoading}>
                        {t('account.profile.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-sm md:text-lg font-semibold text-gray-900">{t('account.profile.profileInformation')}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.firstName')}</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.firstName || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.lastName')}</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.lastName || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.email')}</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900 break-all">{userProfile.email}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.phone')}</label>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          <p className="text-sm md:text-base text-gray-900">{userProfile.phone || '—'}</p>
                          {userProfile.phone && (phoneVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                              <i className="ri-checkbox-circle-line"></i> {t('account.profile.verified')}
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                <i className="ri-error-warning-line"></i> {t('account.profile.notVerified')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setVerifyPhone(normalizeGeoPhone(userProfile.phone) ?? userProfile.phone);
                                  setVerifyOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                              >
                                <i className="ri-shield-check-line"></i> {t('account.profile.verifyNow')}
                              </button>
                            </>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.location')}</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.location || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.memberSince')}</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.joinDate || '—'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-500">{t('account.profile.bio')}</label>
                      <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.bio || t('account.profile.noBioYet')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My Bookings Tab */}
            {activeTab === 'bookings' && (
              <div>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h3 className="text-sm md:text-lg font-semibold text-gray-900">{t('account.profile.myBookings')}</h3>
                  <button
                    onClick={() => { const email = user?.email; if (email) loadBookings(email); }}
                    className="text-xs md:text-sm text-red-500 hover:text-red-600 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                    {t('account.profile.refresh')}
                  </button>
                </div>

                {bookingsLoading ? (
                  <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">{t('account.profile.loadingBookings')}</p>
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-calendar-line text-2xl text-gray-400"></i>
                    </div>
                    <h4 className="text-base font-medium text-gray-900 mb-2">{t('account.profile.noBookingsYet')}</h4>
                    <p className="text-gray-500 text-sm mb-6">{t('account.profile.noBookingsSub')}</p>
                    <button
                      onClick={() => navigate('/search')}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {t('account.profile.exploreCottages')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        onRefresh={() => { const email = user?.email; if (email) loadBookings(email); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
              <div>
                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">{t('account.profile.wishlist')}</h3>
                <p className="text-sm text-gray-600">{t('account.profile.wishlistPlaceholder')}</p>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">{t('account.profile.reviews')}</h3>
                <p className="text-sm text-gray-600">{t('account.profile.reviewsPlaceholder')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer — shared component (owns Contact + Cancellation modals) */}
      <Footer />

      <PhoneVerifyModal
        open={verifyOpen}
        userId={user?.id ?? ''}
        initialPhone={verifyPhone}
        title={t('account.profile.verifyPhoneTitle')}
        reason={t('account.profile.verifyPhoneReason')}
        onVerified={handleProfilePhoneVerified}
        onClose={() => setVerifyOpen(false)}
      />
    </div>
  );
}
