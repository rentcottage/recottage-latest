import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Button from '../../components/base/Button';
import ContactModal from '../../components/feature/ContactModal';
import CancellationModal from '../../components/feature/CancellationModal';
import BookingCard from './components/BookingCard';
import PhoneVerifyModal from '../../components/feature/PhoneVerifyModal';
import { supabase } from '../../lib/supabase';
import { normalizeGeoPhone } from '../../lib/otp';
import { useAuth } from '../../hooks/useAuth';
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
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
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
      setAvatarError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5 MB.');
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
        setAvatarError('Upload failed. Please try again.');
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
      setAvatarError('Something went wrong. Please try again.');
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
      setAvatarError('Could not remove photo. Please try again.');
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
      setSaveProfileError('First name is required.');
      return;
    }
    if (!editForm.lastName.trim()) {
      setSaveProfileError('Last name is required.');
      return;
    }

    // Phone is required and must be a valid Georgian number (so it can be SMS-verified).
    const normalizedNew = normalizeGeoPhone(editForm.phone);
    if (!normalizedNew) {
      setSaveProfileError('Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).');
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
      const payload: Record<string, string> = {
        id: user.id,
        first_name: editForm.firstName.trim(),
        last_name: editForm.lastName.trim(),
        full_name: `${editForm.firstName.trim()} ${editForm.lastName.trim()}`.trim(),
        email: editForm.email.trim(),
      };
      if (!phoneChanged) payload.phone = normalizedNew;

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        setSaveProfileError('Failed to save. Please try again.');
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

        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0 group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
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
                title="Change photo"
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
                  : 'My Profile'}
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
                  <span className="text-xs">Joined {userProfile.joinDate}</span>
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
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="max-w-6xl mx-auto px-3 md:px-4 py-5 md:py-8">

        {/* Profile Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 overflow-hidden">
            <nav className="flex overflow-x-auto px-3 md:px-8 gap-0 md:space-x-8 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { id: 'profile', label: 'Profile', icon: 'ri-user-line' },
                { id: 'bookings', label: 'My Bookings', icon: 'ri-calendar-check-line' },
                { id: 'wishlist', label: 'Wishlist', icon: 'ri-heart-line' },
                { id: 'reviews', label: 'Reviews', icon: 'ri-star-line' },
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
                      <p className="text-sm font-medium text-red-800">Profile incomplete</p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Please add your{' '}
                        {!userProfile.firstName && !userProfile.lastName
                          ? 'first and last name'
                          : !userProfile.firstName
                          ? 'first name'
                          : 'last name'}{' '}
                        to complete your profile.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-shrink-0 text-xs font-medium text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Complete
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
                      <p className="text-sm font-medium text-amber-800">Add a phone number</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Adding a phone number makes it easier to stay in touch about your bookings.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-shrink-0 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-sm md:text-lg font-semibold text-gray-900">Edit Profile</h3>

                    {/* Photo management in edit mode */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs md:text-sm font-medium text-gray-700 mb-3">Profile Photo</p>
                      <div className="flex items-center gap-4">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Profile"
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
                                Uploading...
                              </>
                            ) : (
                              <>
                                <i className="ri-upload-2-line"></i>
                                {avatarUrl ? 'Change photo' : 'Upload photo'}
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
                              Remove photo
                            </button>
                          )}
                          <p className="text-xs text-gray-400">JPG, PNG, WebP · max 5 MB</p>
                          {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className={`w-full p-2.5 md:p-3 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            !editForm.firstName.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="Required"
                        />
                        {!editForm.firstName.trim() && (
                          <p className="text-xs text-red-500 mt-1">First name is required</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className={`w-full p-2.5 md:p-3 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            !editForm.lastName.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="Required"
                        />
                        {!editForm.lastName.trim() && (
                          <p className="text-xs text-red-500 mt-1">Last name is required</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full p-2.5 md:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                          Phone <span className="text-red-500">*</span>
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
                            placeholder="+995 555 000 000"
                            className="w-full pl-9 pr-3 py-2.5 md:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Georgian number. Changing it requires SMS verification.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1.5 md:mb-2">
                        Location
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
                        Bio
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
                        {saveProfileLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" disabled={saveProfileLoading}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    <h3 className="text-sm md:text-lg font-semibold text-gray-900">Profile Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">First Name</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.firstName || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">Last Name</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.lastName || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">Email</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900 break-all">{userProfile.email}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">Phone</label>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          <p className="text-sm md:text-base text-gray-900">{userProfile.phone || '—'}</p>
                          {userProfile.phone && (phoneVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                              <i className="ri-checkbox-circle-line"></i> Verified
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                <i className="ri-error-warning-line"></i> Not verified
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setVerifyPhone(normalizeGeoPhone(userProfile.phone) ?? userProfile.phone);
                                  setVerifyOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                              >
                                <i className="ri-shield-check-line"></i> Verify now
                              </button>
                            </>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">Location</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.location || '—'}</p>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-medium text-gray-500">Member Since</label>
                        <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.joinDate || '—'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-500">Bio</label>
                      <p className="mt-0.5 text-sm md:text-base text-gray-900">{userProfile.bio || 'No bio added yet.'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My Bookings Tab */}
            {activeTab === 'bookings' && (
              <div>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h3 className="text-sm md:text-lg font-semibold text-gray-900">My Bookings</h3>
                  <button
                    onClick={() => { const email = user?.email; if (email) loadBookings(email); }}
                    className="text-xs md:text-sm text-red-500 hover:text-red-600 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                    Refresh
                  </button>
                </div>

                {bookingsLoading ? (
                  <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading your bookings...</p>
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-calendar-line text-2xl text-gray-400"></i>
                    </div>
                    <h4 className="text-base font-medium text-gray-900 mb-2">No bookings yet</h4>
                    <p className="text-gray-500 text-sm mb-6">Your booking requests will appear here once you book a cottage.</p>
                    <button
                      onClick={() => navigate('/search')}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Explore Cottages
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
                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">Wishlist</h3>
                <p className="text-sm text-gray-600">Your saved properties will appear here.</p>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">Reviews</h3>
                <p className="text-sm text-gray-600">Your reviews will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Support</h3>
              <ul className="space-y-1 md:space-y-2">
                <li><button onClick={() => setShowCancellationModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left">Cancellation Options</button></li>
                <li><button onClick={() => setShowContactModal(true)} className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer text-left">Contact Us</button></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Community</h3>
              <ul className="space-y-1 md:space-y-2">
                <li><a href="/become-host" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Become a Host</a></li>
                <li><a href="/host-resources" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Host Resources</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">About</h3>
              <ul className="space-y-1 md:space-y-2">
                <li><a href="/how-it-works" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">How it Works</a></li>
                <li><a href="/about-georgia" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">About Georgia</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61583084123461"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                >
                  <i className="ri-facebook-line text-sm md:text-base"></i>
                </a>
                <a
                  href="https://www.instagram.com/rentcottage.ge/"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"
                >
                  <i className="ri-instagram-line text-sm md:text-base"></i>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 md:pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 md:mb-0">
              <h1 className="text-sm md:text-xl font-semibold md:font-bold text-red-500" style={{ fontFamily: '"Pacifico", serif' }}>
                RentCottage.Ge
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a href="/privacy" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Privacy</a>
                <a href="/terms" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Terms &amp; Conditions</a>
                <a href="/sitemap" className="text-xs md:text-sm text-gray-300 hover:text-white cursor-pointer">Site Map</a>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-400">© 2024 RentCottage.Ge, Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
      {showCancellationModal && <CancellationModal isOpen={showCancellationModal} onClose={() => setShowCancellationModal(false)} />}

      <PhoneVerifyModal
        open={verifyOpen}
        userId={user?.id ?? ''}
        initialPhone={verifyPhone}
        title="Verify your phone number"
        reason="We'll text a 6-digit code to confirm this number is yours."
        onVerified={handleProfilePhoneVerified}
        onClose={() => setVerifyOpen(false)}
      />
    </div>
  );
}
