// booking-handler request handling — free of Deno globals and network imports
// so authorization, idempotency and payment safety can be unit-tested
// (handler.test.ts). index.ts wires in Supabase, Resend and bog-payment.
//
// AUTHORIZATION MODEL (see docs/booking-handler-security-remediation.md)
// ─────────────────────────────────────────────────────────────────────────────
//  admin-confirm-booking, admin-reject-booking,
//  admin-approve-dates, admin-reject-dates      → `x-admin-password` header must
//                                                 match ADMIN_PANEL_PASSWORD
//  host-approve-booking, host-reject-booking,
//  host-cancel-booking                          → `Authorization: Bearer <user
//                                                 session>`; verified, email-
//                                                 confirmed user whose email is
//                                                 the property's host_email
//  cancel, change-dates                         → verified session; user owns
//                                                 the booking (user_email,
//                                                 customer_id, or approved agency)
//  expire-pending-approvals,
//  send-contact-reveal-emails                   → `x-cron-secret` header must
//                                                 match CRON_SECRET
//  anything else (GET actions, legacy implicit
//  booking creation, retry-transient-emails)    → removed
//
// Emails or user ids in the request body are NEVER used as identity.
//
// PAYMENT SAFETY
//  - Every state change is a conditional update on the expected previous status
//    ("claim"). Only the request that wins the claim may call the BOG refund or
//    send emails, so concurrent requests cannot refund twice.
//  - A failed refund leaves payment_status = 'paid' (truthful), records a
//    `refund_failed` status-log event, alerts the company inbox, and returns an
//    error to the caller. It is never reported as refunded.

import {
  COMPANY_EMAIL,
  buildConfirmEmailHtml,
  buildCustomerCancelledEmailHtml,
  buildCustomerContactRevealEmailHtml,
  buildDateChangeApprovedEmailHtml,
  buildDateChangeRejectedEmailHtml,
  buildDateChangeSubmittedEmailHtml,
  buildExpiredApprovalEmailHtml,
  buildHostAdminRejectedBookingEmailHtml,
  buildHostCancelCustomerEmailHtml,
  buildHostContactRevealEmailHtml,
  buildHostGuestCancelledEmailHtml,
  buildRefundFailedAlertHtml,
  buildRejectEmailHtml,
  escapeHtml,
  safeRecord,
  subjectSafe,
  toHostSafeBooking,
} from './templates.ts';
import { applyPromoDiscount, findActivePromoForLocation } from '../_shared/promos.ts';
import { applyOfferToTotal, findActiveOfferForStay } from '../_shared/hostOffers.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Minimal shape of the supabase-js client this handler uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

export interface AuthUser {
  id: string;
  email: string | null;
  /** true when auth.users.email_confirmed_at (or confirmed_at) is set */
  emailConfirmed: boolean;
}

export interface HandlerDeps {
  /** Service-role Supabase client. */
  db: Db;
  /** ADMIN_PANEL_PASSWORD. Empty → every admin action is denied. */
  adminPassword: string | undefined;
  /** CRON_SECRET. Empty → every batch action is denied. */
  cronSecret: string | undefined;
  /** Verifies a user access token. Returns null for invalid/expired/anon/service tokens. */
  getUserFromToken: (token: string) => Promise<AuthUser | null>;
  /** Sends one email via Resend. Must not throw on HTTP errors. */
  sendResend: (msg: { from: string; to: string; subject: string; html: string }) => Promise<{ status: number; body: string }>;
  /** Calls bog-payment internal-refund for a booking. ok=false on any failure. */
  requestRefund: (bookingId: string) => Promise<{ ok: boolean }>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Structured log sink — callers pass ids, statuses and counts only. */
  log?: (event: string, fields?: Record<string, string | number | boolean | null>) => void;
}

export const FROM_EMAIL = 'bookings@rentcottage.ge';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_ACTIONS = new Set(['admin-confirm-booking', 'admin-reject-booking', 'admin-approve-dates', 'admin-reject-dates']);
const HOST_ACTIONS = new Set(['host-approve-booking', 'host-reject-booking', 'host-cancel-booking']);
const GUEST_ACTIONS = new Set(['cancel', 'change-dates']);
const BATCH_ACTIONS = new Set(['expire-pending-approvals', 'send-contact-reveal-emails']);

/** Terminal states: nothing may confirm, reject, cancel or refund these again. */
const CLOSED_STATUSES = ['cancelled', 'cancelled_by_host', 'rejected'];
/** States a booking request can be confirmed from. */
const CONFIRMABLE_STATUSES = ['pending_host_approval', 'pending'];
/** Statuses that occupy a property's nights (same set the iCal export publishes). */
const OCCUPYING_STATUSES = ['confirmed', 'pending', 'pending_host_approval'];

const BOOKING_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Small helpers ────────────────────────────────────────────────────────────

class HttpError extends Error {
  status: number;
  extra?: Row;
  constructor(status: number, message: string, extra?: Row) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function json(body: Row, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Constant-time secret comparison (both sides hashed so length does not leak). */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function lower(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function bookingIdFrom(body: Row): string {
  const raw = body.bookingId;
  const id = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!id) throw new HttpError(400, 'Missing bookingId');
  if (!BOOKING_ID_RE.test(id)) throw new HttpError(400, 'Invalid bookingId');
  return id;
}

function isPaidOnline(b: Row): boolean {
  return b.payment_method === 'pay_now' && b.payment_status === 'paid' && !!b.payment_transaction_id;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const db = deps.db;
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = deps.log ?? (() => {});

  const todayStr = () => now().toISOString().split('T')[0];

  // ── Authorization ───────────────────────────────────────────────────────────

  async function requireAdmin(req: Request): Promise<void> {
    const expected = deps.adminPassword ?? '';
    if (!expected) {
      log('config_error', { missing: 'ADMIN_PANEL_PASSWORD' });
      throw new HttpError(401, 'Unauthorized');
    }
    if (!(await secretsMatch(req.headers.get('x-admin-password') ?? '', expected))) {
      throw new HttpError(401, 'Unauthorized');
    }
  }

  async function requireCron(req: Request): Promise<void> {
    const expected = deps.cronSecret ?? '';
    if (!expected) {
      log('config_error', { missing: 'CRON_SECRET' });
      throw new HttpError(401, 'Unauthorized');
    }
    if (!(await secretsMatch(req.headers.get('x-cron-secret') ?? '', expected))) {
      throw new HttpError(401, 'Unauthorized');
    }
  }

  async function requireUser(req: Request): Promise<AuthUser & { email: string }> {
    const header = req.headers.get('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!m) throw new HttpError(401, 'Unauthorized');
    let user: AuthUser | null = null;
    try {
      user = await deps.getUserFromToken(m[1].trim());
    } catch {
      user = null;
    }
    if (!user || !user.id || !user.email || !user.emailConfirmed) throw new HttpError(401, 'Unauthorized');
    return user as AuthUser & { email: string };
  }

  // ── Data access ─────────────────────────────────────────────────────────────

  async function loadBooking(id: string): Promise<Row | null> {
    const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
    if (error) throw new HttpError(500, 'Request failed');
    return data ?? null;
  }

  async function loadProperty(id: unknown, columns: string): Promise<Row | null> {
    if (!id) return null;
    const { data, error } = await db.from('property_applications').select(columns).eq('id', String(id)).maybeSingle();
    if (error) throw new HttpError(500, 'Request failed');
    return data ?? null;
  }

  /**
   * Atomically moves a booking from `expected` status to the new values.
   * Returns true only for the single request that performed the transition.
   */
  async function claim(id: string, expectedStatus: string, updates: Row): Promise<boolean> {
    const { data, error } = await db.from('bookings').update(updates).eq('id', id).eq('status', expectedStatus).select('id');
    if (error) throw new HttpError(500, 'Request failed');
    return Array.isArray(data) && data.length === 1;
  }

  async function logEvent(bookingId: string, eventType: string, fromStatus: string | null, toStatus: string, changedBy: string, note?: string) {
    try {
      await db.from('booking_status_logs').insert({ booking_id: bookingId, event_type: eventType, from_status: fromStatus ?? null, to_status: toStatus, changed_by: changedBy, note: note ?? null });
    } catch { /* non-fatal */ }
  }

  // ── Email (bounce-aware, logged to email_delivery_logs) ─────────────────────

  function isPermanentFailure(httpStatus: number, errorBody: string): boolean {
    if (httpStatus === 422) return true;
    if (httpStatus === 400) {
      const l = errorBody.toLowerCase();
      if (['email_not_deliverable', 'invalid_email', 'mailbox_does_not_exist', 'invalid_to', 'bounce_rate_limit_exceeded'].some((c) => l.includes(c))) return true;
      if (l.includes('invalid') && l.includes('email')) return true;
    }
    return false;
  }

  async function logDelivery(o: { to: string; subject: string; context: string; contextId?: string; status: string; httpStatus?: number | null; errorMessage?: string | null; attempt: number; retryAfter?: Date | null }) {
    try {
      // email_delivery_logs is service-role only (RLS, no anon/auth access); the
      // recipient is required there for bounce handling.
      await db.from('email_delivery_logs').insert({
        recipient_email: o.to.toLowerCase().trim(),
        subject: o.subject,
        context: o.context,
        context_id: o.contextId ?? null,
        status: o.status,
        http_status: o.httpStatus ?? null,
        error_message: o.errorMessage ?? null,
        attempt_number: o.attempt,
        retry_after: o.retryAfter ? o.retryAfter.toISOString() : null,
        updated_at: now().toISOString(),
      });
    } catch { /* non-fatal */ }
  }

  async function sendEmail(to: string | null | undefined, rawSubject: string, html: string, context: string, contextId?: string): Promise<boolean> {
    if (!to) return false;
    const subject = subjectSafe(rawSubject);
    const { data: blocked } = await db.from('blocked_emails').select('id, bounce_type').eq('email', to.toLowerCase().trim()).maybeSingle();
    if (blocked) {
      log('email_skipped_blocked', { context, contextId: contextId ?? null });
      await logDelivery({ to, subject, context, contextId, status: 'skipped_blocked', errorMessage: `Email is blocked (${blocked.bounce_type ?? 'permanent'})`, attempt: 1 });
      return false;
    }
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let status = 0;
      let body = '';
      try {
        const res = await deps.sendResend({ from: FROM_EMAIL, to, subject, html });
        status = res.status;
        body = res.body ?? '';
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) {
        log('email_sent', { context, contextId: contextId ?? null, attempt });
        await logDelivery({ to, subject, context, contextId, status: 'sent', httpStatus: status, attempt });
        return true;
      }
      if (status && isPermanentFailure(status, body)) {
        log('email_permanent_failure', { context, contextId: contextId ?? null, status });
        try {
          await db.from('blocked_emails').upsert({
            email: to.toLowerCase().trim(),
            blocked_reason: `Permanent bounce (HTTP ${status})`,
            blocked_at: now().toISOString(),
            source: `${context}/${contextId ?? 'unknown'}`,
            bounce_type: 'permanent',
          }, { onConflict: 'email' });
        } catch { /* non-fatal */ }
        await logDelivery({ to, subject, context, contextId, status: 'permanent_failure', httpStatus: status, errorMessage: body.slice(0, 500), attempt });
        return false;
      }
      if (attempt < maxRetries) {
        await sleep(2000 * Math.pow(2, attempt - 1));
        continue;
      }
      log('email_transient_failure', { context, contextId: contextId ?? null, status });
      await logDelivery({ to, subject, context, contextId, status: 'transient_failure', httpStatus: status || null, errorMessage: body.slice(0, 500) || 'Request failed', attempt, retryAfter: new Date(now().getTime() + 15 * 60 * 1000) });
      return false;
    }
    return false;
  }

  // ── Refunds (winner-only, failure is never reported as success) ─────────────

  async function refundOnce(booking: Row, trigger: string): Promise<'not_needed' | 'ok' | 'failed'> {
    if (!isPaidOnline(booking)) return 'not_needed';
    let ok = false;
    try {
      ok = (await deps.requestRefund(String(booking.id))).ok === true;
    } catch {
      ok = false;
    }
    if (ok) {
      log('refund_requested', { bookingId: String(booking.id), trigger });
      return 'ok';
    }
    log('refund_failed', { bookingId: String(booking.id), trigger });
    await logEvent(String(booking.id), 'refund_failed', booking.status, booking.status, 'system', `Refund could not be completed (${trigger}); payment still marked paid`);
    await sendEmail(COMPANY_EMAIL, `Refund failed – booking ${booking.id}`, buildRefundFailedAlertHtml(safeRecord(booking), escapeHtml(trigger)), 'refund_failed_alert', String(booking.id));
    return 'failed';
  }

  const REFUND_FAILED_MESSAGE = 'The booking was updated, but the refund could not be completed. Our team has been notified and will process it.';

  // ── Ownership ───────────────────────────────────────────────────────────────

  async function assertHostOwnsBooking(user: AuthUser & { email: string }, booking: Row | null): Promise<Row> {
    // Not-found and not-owned return the same response (no existence oracle).
    if (!booking || !booking.property_id) throw new HttpError(404, 'Booking not found');
    const prop = await loadProperty(booking.property_id, 'host_email, host_first_name');
    if (!prop || !prop.host_email || lower(prop.host_email) !== lower(user.email)) throw new HttpError(404, 'Booking not found');
    return prop;
  }

  async function assertGuestOwnsBooking(user: AuthUser & { email: string }, booking: Row | null): Promise<void> {
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (booking.user_email && lower(booking.user_email) === lower(user.email)) return;
    if (booking.customer_id && String(booking.customer_id) === user.id) return;
    if (booking.corporate_id) {
      const { data } = await db.from('corporate_applications').select('id').eq('id', String(booking.corporate_id)).eq('user_id', user.id).eq('status', 'approved').maybeSingle();
      if (data) return;
    }
    throw new HttpError(404, 'Booking not found');
  }

  // ── Availability & pricing (server-side, mirrors bog-payment create-order) ──

  async function assertDatesAvailable(booking: Row, checkIn: string, checkOut: string): Promise<void> {
    const propertyId = String(booking.property_id ?? '');
    if (!propertyId) throw new HttpError(409, 'Selected dates are not available');

    // Other bookings: nights overlap (check-out day is not a night).
    const { data: others, error: e1 } = await db.from('bookings')
      .select('id, check_in, check_out, status')
      .eq('property_id', propertyId)
      .in('status', OCCUPYING_STATUSES)
      .lt('check_in', checkOut)
      .gt('check_out', checkIn);
    if (e1) throw new HttpError(500, 'Request failed');
    if ((others ?? []).some((o: Row) => String(o.id) !== String(booking.id))) {
      throw new HttpError(409, 'Selected dates are not available');
    }

    // Host-blocked and imported calendar ranges: same rule as the property page
    // calendar (blocked when checkIn <= end_date && checkOut >= start_date).
    for (const table of ['blocked_dates', 'ical_blocked_dates']) {
      const { data: ranges, error } = await db.from(table)
        .select('id')
        .eq('property_id', propertyId)
        .lte('start_date', checkOut)
        .gte('end_date', checkIn);
      if (error) throw new HttpError(500, 'Request failed');
      if ((ranges ?? []).length > 0) throw new HttpError(409, 'Selected dates are not available');
    }
  }

  /** Authoritative stay price: property pricing × nights, best single discount (promo vs host offer). */
  async function quoteStay(booking: Row, checkIn: string, checkOut: string): Promise<number> {
    const pricing = await loadProperty(booking.property_id, 'price_per_night, pricing_type, guest_pricing_tiers, location');
    if (!pricing) throw new HttpError(400, 'Could not determine the booking price.');
    const ci = new Date(checkIn + 'T00:00:00Z');
    const co = new Date(checkOut + 'T00:00:00Z');
    const nights = Math.round((co.getTime() - ci.getTime()) / 86_400_000);
    const guestCount = Number(booking.guests) || 1;
    let nightly = Number(pricing.price_per_night) || 0;
    const tiers = Array.isArray(pricing.guest_pricing_tiers)
      ? (pricing.guest_pricing_tiers as Array<{ min_guests: number; max_guests: number; price_per_night: number }>)
      : [];
    if (pricing.pricing_type === 'per_guest' && tiers.length > 0) {
      const tier = tiers.find((t) => guestCount >= t.min_guests && guestCount <= t.max_guests);
      nightly = Number((tier ?? tiers[tiers.length - 1]).price_per_night) || nightly;
    }
    const full = nightly * nights;
    if (!(full > 0)) throw new HttpError(400, 'Could not determine the booking price.');
    const promo = await findActivePromoForLocation(db, String(pricing.location ?? booking.property_location ?? ''));
    const offer = await findActiveOfferForStay(db, String(booking.property_id), nights, checkIn, checkOut);
    const candidates = [Math.round(full * 100) / 100];
    if (promo) candidates.push(applyPromoDiscount(full, promo.discount_percent));
    if (offer) candidates.push(applyOfferToTotal(offer, nightly, nights));
    return Math.min(...candidates);
  }

  // ── Contact reveal (claimed, so concurrent runs send one pair) ──────────────

  async function revealContactsForBooking(booking: Row, source: string): Promise<'sent' | 'skipped' | 'error'> {
    if (!booking.property_id) return 'skipped';
    const pa = await loadProperty(booking.property_id, 'host_first_name, host_last_name, host_email, host_phone');
    if (!pa?.host_email) return 'skipped';

    const { data: claimed, error } = await db.from('bookings').update({ contact_reveal_sent: true }).eq('id', booking.id).eq('contact_reveal_sent', false).select('id');
    if (error) return 'error';
    if (!Array.isArray(claimed) || claimed.length !== 1) return 'skipped'; // someone else sent it

    const { data: guestProfile } = await db.from('profiles').select('phone, first_name, last_name').eq('email', booking.user_email).maybeSingle();
    const hostName = `${pa.host_first_name || ''} ${pa.host_last_name || ''}`.trim() || 'Your Host';
    const guestName = booking.user_name || `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim() || 'Guest';
    const b = safeRecord(booking);

    const customerOk = await sendEmail(
      booking.user_email,
      `Your host contact details are now available – ${booking.property_title} 🔓`,
      buildCustomerContactRevealEmailHtml(b, escapeHtml(hostName), escapeHtml(pa.host_email), pa.host_phone ? escapeHtml(pa.host_phone) : null),
      'contact_reveal_guest', String(booking.id),
    );
    const hostOk = await sendEmail(
      pa.host_email,
      `სტუმრის საკონტაქტო ინფორმაცია ხელმისაწვდომია – ${booking.property_title} 🔓`,
      buildHostContactRevealEmailHtml(escapeHtml(pa.host_first_name || 'there'), b, escapeHtml(guestName), escapeHtml(booking.user_email), guestProfile?.phone ? escapeHtml(guestProfile.phone) : null),
      'contact_reveal_host', String(booking.id),
    );

    if (customerOk || hostOk) {
      await logEvent(String(booking.id), 'contact_reveal_sent', booking.status, booking.status, 'system', `Reveal sent (${source}) — guest=${customerOk ? 'ok' : 'failed'} host=${hostOk ? 'ok' : 'failed'}`);
      return 'sent';
    }
    // Nothing delivered: release the claim so a later run can retry.
    await db.from('bookings').update({ contact_reveal_sent: false }).eq('id', booking.id);
    return 'error';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function confirmBooking(booking: Row, changedBy: 'admin' | 'host'): Promise<{ alreadyDone: boolean }> {
    const id = String(booking.id);
    if (booking.status === 'confirmed') return { alreadyDone: true };
    if (!CONFIRMABLE_STATUSES.includes(booking.status)) throw new HttpError(409, 'This booking cannot be confirmed in its current state');
    if (booking.payment_method === 'pay_now' && booking.payment_status !== 'paid') throw new HttpError(409, 'This booking cannot be confirmed because payment is not completed');

    if (!(await claim(id, booking.status, { status: 'confirmed' }))) {
      const fresh = await loadBooking(id);
      if (fresh?.status === 'confirmed') return { alreadyDone: true };
      throw new HttpError(409, 'This booking was changed by another request. Please refresh.');
    }
    await logEvent(id, changedBy === 'host' ? 'host_approved' : 'confirmed', booking.status, 'confirmed', changedBy);
    await sendEmail(booking.user_email, `Your booking at ${booking.property_title} is confirmed! 🎉`, buildConfirmEmailHtml(safeRecord(booking)), changedBy === 'host' ? 'booking_confirmed_host' : 'booking_confirmed', id);
    if (changedBy === 'host') {
      const fresh = await loadBooking(id);
      if (fresh) await revealContactsForBooking(fresh, 'host_approval');
    }
    return { alreadyDone: false };
  }

  async function rejectBooking(booking: Row, changedBy: 'admin' | 'host', rejectionNote: string | undefined): Promise<{ alreadyDone: boolean; refund: string }> {
    const id = String(booking.id);
    if (CLOSED_STATUSES.includes(booking.status)) return { alreadyDone: true, refund: 'not_needed' };
    if (booking.status === 'completed') throw new HttpError(409, 'This booking cannot be rejected in its current state');
    if (changedBy === 'host' && booking.status === 'confirmed') throw new HttpError(409, 'Cannot reject a confirmed booking — use Cancel instead');

    const updates: Row = { status: 'rejected', canceled_by: changedBy, canceled_at: now().toISOString() };
    if (rejectionNote) updates.rejection_note = rejectionNote;
    if (booking.payment_status === 'paid') {
      // Online-refundable: payment_status is set by bog-payment on refund success
      // and stays 'paid' on failure. Paid without a BOG order: manual refund.
      if (!isPaidOnline(booking)) updates.payment_status = 'refund_pending';
    } else {
      updates.payment_status = 'cancelled';
    }

    if (!(await claim(id, booking.status, updates))) {
      const fresh = await loadBooking(id);
      if (fresh && CLOSED_STATUSES.includes(fresh.status)) return { alreadyDone: true, refund: 'not_needed' };
      throw new HttpError(409, 'This booking was changed by another request. Please refresh.');
    }
    const refund = await refundOnce(booking, `${changedBy}_reject`);
    await logEvent(id, changedBy === 'host' ? 'host_rejected' : 'rejected', booking.status, 'rejected', changedBy, rejectionNote ? 'Reason provided' : undefined);

    const b = safeRecord(booking);
    const note = rejectionNote ? escapeHtml(rejectionNote) : undefined;
    await sendEmail(booking.user_email, `Update on your booking at ${booking.property_title}`, buildRejectEmailHtml(b, note, changedBy), changedBy === 'host' ? 'booking_rejected_by_host' : 'booking_rejected', id);
    if (changedBy === 'admin' && booking.property_id) {
      const pa = await loadProperty(booking.property_id, 'host_email, host_first_name');
      if (pa?.host_email && pa.host_email !== COMPANY_EMAIL) {
        await sendEmail(pa.host_email, `ჯავშნის მოთხოვნა უარყოფილია ადმინის მიერ – ${booking.property_title}`, buildHostAdminRejectedBookingEmailHtml(escapeHtml(pa.host_first_name || 'there'), toHostSafeBooking(b), note), 'booking_rejected_host', id);
      }
    }
    return { alreadyDone: false, refund };
  }

  async function hostCancel(booking: Row): Promise<{ refund: string }> {
    const id = String(booking.id);
    if (booking.status === 'cancelled' || booking.status === 'cancelled_by_host') throw new HttpError(409, 'Booking is already cancelled');
    if (booking.status !== 'confirmed') throw new HttpError(409, 'Only confirmed bookings can be cancelled by the host');

    if (!(await claim(id, 'confirmed', { status: 'cancelled_by_host', canceled_by: 'host', canceled_at: now().toISOString() }))) {
      throw new HttpError(409, 'This booking was changed by another request. Please refresh.');
    }
    const refund = await refundOnce(booking, 'host_cancel');
    await logEvent(id, 'host_cancelled', 'confirmed', 'cancelled_by_host', 'host', refund === 'ok' ? 'paid online → refund requested' : refund === 'failed' ? 'paid online → refund FAILED' : 'no online refund needed');
    const refundNote = refund === 'ok'
      ? 'Since you paid online, a refund has been issued to your card. It typically appears within 5–10 business days.'
      : refund === 'failed'
      ? 'Since you paid online, you are entitled to a refund. Our team will process it and contact you.'
      : '';
    await sendEmail(booking.user_email, `Important: Your booking at ${booking.property_title} has been cancelled`, buildHostCancelCustomerEmailHtml(safeRecord(booking), refundNote), 'booking_cancelled_by_host', id);
    return { refund };
  }

  async function guestCancel(booking: Row): Promise<{ refund: string }> {
    const id = String(booking.id);
    if (booking.check_in <= todayStr()) throw new HttpError(409, 'Cannot cancel after check-in date');
    if (CLOSED_STATUSES.includes(booking.status)) throw new HttpError(409, 'Booking already cancelled');

    const updates: Row = { status: 'cancelled', canceled_by: 'customer', canceled_at: now().toISOString() };
    if (!isPaidOnline(booking)) updates.payment_status = 'cancelled';
    if (!(await claim(id, booking.status, updates))) {
      throw new HttpError(409, 'This booking was changed by another request. Please refresh.');
    }
    const refund = await refundOnce(booking, 'guest_cancel');
    await logEvent(id, 'cancelled', booking.status, 'cancelled', 'customer');
    const b = safeRecord(booking);
    await sendEmail(booking.user_email, `Booking Cancelled – ${booking.property_title}`, buildCustomerCancelledEmailHtml(b), 'booking_cancelled', id);
    if (booking.property_id) {
      const pa = await loadProperty(booking.property_id, 'host_email, host_first_name');
      if (pa?.host_email && pa.host_email !== COMPANY_EMAIL) {
        await sendEmail(pa.host_email, `სტუმარმა გააუქმა ჯავშანი – ${booking.property_title}`, buildHostGuestCancelledEmailHtml(escapeHtml(pa.host_first_name || 'there'), toHostSafeBooking(b)), 'booking_cancelled_host', id);
      }
    }
    return { refund };
  }

  async function requestDateChange(booking: Row, checkIn: unknown, checkOut: unknown): Promise<{ requestedTotalPrice: number }> {
    const id = String(booking.id);
    const today = todayStr();
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) throw new HttpError(400, 'Invalid dates');
    if (CLOSED_STATUSES.includes(booking.status)) throw new HttpError(409, 'This booking can no longer be changed');
    if (booking.check_in <= today) throw new HttpError(409, 'Cannot change after check-in');
    if (checkOut <= checkIn) throw new HttpError(400, 'Check-out must be after check-in');
    if (checkIn < today) throw new HttpError(400, 'New check-in date cannot be in the past.');
    if (booking.date_change_status === 'pending') throw new HttpError(409, 'A date change is already pending');

    await assertDatesAvailable(booking, checkIn, checkOut);
    const price = await quoteStay(booking, checkIn, checkOut); // client totalPrice is ignored

    const { error } = await db.from('bookings').update({
      requested_check_in: checkIn,
      requested_check_out: checkOut,
      requested_total_price: price,
      date_change_status: 'pending',
      date_change_requested_at: now().toISOString(),
    }).eq('id', id);
    if (error) throw new HttpError(500, 'Request failed');
    await logEvent(id, 'date_change_requested', booking.status, booking.status, 'customer');
    await sendEmail(booking.user_email, `Date Change Submitted – ${booking.property_title}`, buildDateChangeSubmittedEmailHtml(safeRecord(booking), checkIn, checkOut, '₾' + price), 'date_change_submitted', id);
    return { requestedTotalPrice: price };
  }

  async function approveDateChange(booking: Row): Promise<void> {
    const id = String(booking.id);
    if (booking.date_change_status !== 'pending') throw new HttpError(409, 'No pending date change request');
    const ci = booking.requested_check_in;
    const co = booking.requested_check_out;
    if (!isValidDate(ci) || !isValidDate(co) || co <= ci) throw new HttpError(409, 'The requested dates are invalid');
    if (CLOSED_STATUSES.includes(booking.status)) throw new HttpError(409, 'This booking can no longer be changed');

    // Re-validate at approval time: dates may have been taken since the request,
    // and requests made before this fix carry a browser-supplied price.
    await assertDatesAvailable(booking, ci, co);
    const price = await quoteStay(booking, ci, co);

    const { data, error } = await db.from('bookings')
      .update({ check_in: ci, check_out: co, total_price: price, requested_total_price: price, date_change_status: 'approved' })
      .eq('id', id).eq('date_change_status', 'pending').select('id');
    if (error) throw new HttpError(500, 'Request failed');
    if (!Array.isArray(data) || data.length !== 1) throw new HttpError(409, 'No pending date change request');
    await logEvent(id, 'dates_approved', booking.status, booking.status, 'admin');
    await sendEmail(booking.user_email, `Date Change Approved – ${booking.property_title}`, buildDateChangeApprovedEmailHtml(safeRecord(booking), ci, co, '₾' + price), 'date_change_approved', id);
  }

  async function rejectDateChange(booking: Row): Promise<void> {
    const id = String(booking.id);
    if (booking.date_change_status !== 'pending') throw new HttpError(409, 'No pending date change request');
    const { data, error } = await db.from('bookings').update({ date_change_status: 'rejected' }).eq('id', id).eq('date_change_status', 'pending').select('id');
    if (error) throw new HttpError(500, 'Request failed');
    if (!Array.isArray(data) || data.length !== 1) throw new HttpError(409, 'No pending date change request');
    await logEvent(id, 'dates_rejected', booking.status, booking.status, 'admin');
    await sendEmail(booking.user_email, `Date Change Not Approved – ${booking.property_title}`, buildDateChangeRejectedEmailHtml(safeRecord(booking)), 'date_change_rejected', id);
  }

  async function expirePendingApprovals(): Promise<{ expired: number; refundFailures: number }> {
    const nowIso = now().toISOString();
    const { data: candidates, error } = await db.from('bookings').select('*')
      .eq('status', 'pending_host_approval')
      .lt('approval_deadline', nowIso)
      .not('approval_deadline', 'is', null);
    if (error) throw new HttpError(500, 'Request failed');
    let expired = 0;
    let refundFailures = 0;
    for (const booking of candidates ?? []) {
      const id = String(booking.id);
      const won = await claim(id, 'pending_host_approval', { status: 'rejected', canceled_by: 'system', canceled_at: nowIso });
      if (!won) continue;
      const refund = await refundOnce(booking, 'expired');
      if (refund === 'failed') refundFailures++;
      await logEvent(id, 'expired_auto_rejected', 'pending_host_approval', 'rejected', 'system', 'Auto-rejected: 24h approval window expired');
      await sendEmail(booking.user_email, `Booking Request Expired – ${booking.property_title}`, buildExpiredApprovalEmailHtml(safeRecord(booking)), 'booking_expired', id);
      expired++;
    }
    return { expired, refundFailures };
  }

  async function sendContactRevealEmails(): Promise<{ sent: number; skipped: number; errors: number }> {
    const tomorrow = new Date(now().getTime());
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const { data: bookings, error } = await db.from('bookings').select('*')
      .eq('status', 'confirmed').eq('check_in', tomorrowStr).eq('contact_reveal_sent', false);
    if (error) return { sent: 0, skipped: 0, errors: 1 };
    let sent = 0, skipped = 0, errors = 0;
    for (const booking of bookings ?? []) {
      try {
        const r = await revealContactsForBooking(booking, 'daily');
        if (r === 'sent') sent++; else if (r === 'skipped') skipped++; else errors++;
      } catch {
        errors++;
      }
    }
    return { sent, skipped, errors };
  }

  // ── Router ──────────────────────────────────────────────────────────────────

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    // Legacy GET email-link actions (confirm/reject/approve-dates/reject-dates) are removed.
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let body: Row;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      body = parsed as Row;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action : '';
    try {
      // Authorization happens before any parameter validation or DB access.
      if (ADMIN_ACTIONS.has(action)) {
        await requireAdmin(req);
        const id = bookingIdFrom(body);
        const booking = await loadBooking(id);
        if (!booking) throw new HttpError(404, 'Booking not found');
        if (action === 'admin-confirm-booking') {
          const r = await confirmBooking(booking, 'admin');
          return json({ success: true, alreadyConfirmed: r.alreadyDone });
        }
        if (action === 'admin-reject-booking') {
          const note = typeof body.rejectionNote === 'string' ? body.rejectionNote.trim().slice(0, 1000) || undefined : undefined;
          const r = await rejectBooking(booking, 'admin', note);
          if (r.refund === 'failed') return json({ error: REFUND_FAILED_MESSAGE, refundFailed: true }, 502);
          return json({ success: true, alreadyRejected: r.alreadyDone });
        }
        if (action === 'admin-approve-dates') { await approveDateChange(booking); return json({ success: true }); }
        await rejectDateChange(booking);
        return json({ success: true });
      }

      if (HOST_ACTIONS.has(action)) {
        const user = await requireUser(req);
        const id = bookingIdFrom(body);
        const booking = await loadBooking(id);
        await assertHostOwnsBooking(user, booking);
        if (action === 'host-approve-booking') {
          await confirmBooking(booking as Row, 'host');
          return json({ success: true });
        }
        if (action === 'host-reject-booking') {
          const note = typeof body.rejectionNote === 'string' ? body.rejectionNote.trim().slice(0, 1000) || undefined : undefined;
          const r = await rejectBooking(booking as Row, 'host', note);
          if (r.refund === 'failed') return json({ error: REFUND_FAILED_MESSAGE, refundFailed: true }, 502);
          return json({ success: true });
        }
        const r = await hostCancel(booking as Row);
        if (r.refund === 'failed') return json({ error: REFUND_FAILED_MESSAGE, refundFailed: true }, 502);
        return json({ success: true });
      }

      if (GUEST_ACTIONS.has(action)) {
        const user = await requireUser(req);
        const id = bookingIdFrom(body);
        const booking = await loadBooking(id);
        await assertGuestOwnsBooking(user, booking);
        if (action === 'cancel') {
          const r = await guestCancel(booking as Row);
          if (r.refund === 'failed') return json({ error: REFUND_FAILED_MESSAGE, refundFailed: true }, 502);
          return json({ success: true });
        }
        const r = await requestDateChange(booking as Row, body.checkIn, body.checkOut);
        return json({ success: true, requestedTotalPrice: r.requestedTotalPrice });
      }

      if (BATCH_ACTIONS.has(action)) {
        await requireCron(req);
        if (action === 'expire-pending-approvals') {
          const r = await expirePendingApprovals();
          return json({ success: true, expired: r.expired, refundFailures: r.refundFailures });
        }
        const r = await sendContactRevealEmails();
        return json({ success: true, ...r });
      }

      // No action, unknown action, retry-transient-emails, or the old implicit
      // booking creation: rejected without side effects.
      return json({ error: 'Unknown action' }, 400);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.message, ...(e.extra ?? {}) }, e.status);
      }
      log('unhandled_error', { action });
      return json({ error: 'Request failed' }, 500);
    }
  };
}
