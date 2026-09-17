#!/usr/bin/env python3
"""Privacy, write-authorization and public-availability tests for
  supabase/migrations/20260918100000_public_unavailable_ranges.sql
  supabase/migrations/20260918100100_block_tables_privacy.sql

Runs against a LOCAL, disposable PostgreSQL 17 (never production):

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/privacy_test.py [ranges.sql] [privacy.sql]

The database `rc_privacy_test` is rebuilt from bootstrap.sql, prod_structure.sql,
the no-overlap migration and the two migrations under test. Exit 0 = all pass.
"""
import datetime as dt
import json
import os
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MIG = os.path.join(ROOT, 'supabase', 'migrations')
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_PRIVACY_DB', 'rc_privacy_test')
RANGES_SQL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(MIG, '20260918100000_public_unavailable_ranges.sql')
PRIVACY_SQL = sys.argv[2] if len(sys.argv) > 2 else os.path.join(MIG, '20260918100100_block_tables_privacy.sql')


def args(db):
    return [PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', db]


def run(sql, db=DB):
    p = subprocess.run(args(db), input=sql, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def q(sql):
    rc, out, err = run(sql)
    if rc != 0:
        raise RuntimeError(f'psql failed: {err[:300]}')
    return out


def run_file(path):
    p = subprocess.run(args(DB) + ['-f', path], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f'{os.path.basename(path)} failed: {p.stderr.strip()[:500]}')


# ── Identities ────────────────────────────────────────────────────────────────

HOST_A = {'id': str(uuid.uuid4()), 'email': 'host.a@example.test'}
HOST_B = {'id': str(uuid.uuid4()), 'email': 'host.b@example.test'}
UNCONFIRMED = {'id': str(uuid.uuid4()), 'email': 'host.u@example.test'}
GUEST = {'id': str(uuid.uuid4()), 'email': 'guest@example.test'}


def as_role(role, sql, user=None, jwt_email=None):
    """Runs sql as anon/authenticated/service_role with Supabase-like JWT claims."""
    claims = {'role': role}
    if user:
        claims['sub'] = user['id']
        claims['email'] = jwt_email if jwt_email is not None else user['email']
    prefix = f"do $cfg$ begin perform set_config('request.jwt.claims', '{json.dumps(claims)}', false); end $cfg$;\nset role {role};\n"
    return run(prefix + sql)


# ── Fixtures (relative to the database's "today" in Asia/Tbilisi) ─────────────

def setup():
    run('drop database if exists ' + DB, db='postgres')
    run('create database ' + DB, db='postgres')
    run_file(os.path.join(HERE, 'bootstrap.sql'))
    run_file(os.path.join(HERE, 'prod_structure.sql'))
    run_file(os.path.join(MIG, '20260917160000_booking_no_overlap.sql'))
    run_file(RANGES_SQL)
    run_file(PRIVACY_SQL)


TODAY = None
P = {}


def d(offset):
    return (TODAY + dt.timedelta(days=offset)).isoformat()


def seed():
    global TODAY
    TODAY = dt.date.fromisoformat(q("select (timezone('Asia/Tbilisi', now()))::date"))
    for u, confirmed in ((HOST_A, True), (HOST_B, True), (UNCONFIRMED, False), (GUEST, True)):
        q(f"insert into auth.users (id, email, email_confirmed_at) values ('{u['id']}', '{u['email']}', {'now()' if confirmed else 'null'});")
    for key, status, owner in (('A', 'approved', 'HOST.A@Example.test'), ('B', 'approved', HOST_B['email']), ('REJ', 'rejected', HOST_A['email']),
                               ('PEND', 'pending', HOST_A['email']), ('HID', 'hidden', HOST_A['email']), ('U', 'approved', UNCONFIRMED['email'])):
        P[key] = str(uuid.uuid4())
        q(f"insert into public.property_applications (id, status, host_email, title, host_first_name, host_last_name, host_phone, property_type, location, bedrooms, bathrooms, max_guests, description, price_per_night) "
          f"values ('{P[key]}', '{status}', '{owner}', 'T', 'F', 'L', '0', 'cottage', 'X', 1, 1, 2, 'D', 100);")
    a = P['A']
    rows = [
        # (table, start, end, extra)
        ('blocked_dates', d(10), d(10), "host_email, reason", f"'{HOST_A['email']}', 'Private family visit'"),        # single-day block
        ('blocked_dates', d(-5), d(-1), "host_email, reason", f"'{HOST_A['email']}', null"),                         # past block
        ('blocked_dates', d(-3), d(0), "host_email, reason", f"'{HOST_A['email']}', null"),                          # ends today
        ('ical_blocked_dates', d(20), d(23), "host_email, summary, uid, platform, source", f"'{HOST_A['email']}', 'Guest Private Name', 'uid-1', 'airbnb', 'airbnb'"),
    ]
    for table, s, e, cols, vals in rows:
        q(f"insert into public.{table} (property_id, start_date, end_date, {cols}) values ('{a}', '{s}', '{e}', {vals});")
    # month rollover block
    first_next = (TODAY.replace(day=1) + dt.timedelta(days=40)).replace(day=1)
    last_prev = first_next - dt.timedelta(days=1)
    q(f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{a}', '{last_prev.isoformat()}', '{(first_next + dt.timedelta(days=1)).isoformat()}', '{HOST_A['email']}');")
    bookings = [
        (d(30), d(33), 'confirmed', '0 minutes'),
        (d(33), d(35), 'pending_host_approval', '0 minutes'),   # back-to-back with the previous one
        (d(40), d(42), 'pending', '0 minutes'),
        (d(50), d(52), 'pending_payment', '10 minutes'),        # live hold → booked
        (d(60), d(62), 'pending_payment', '25 minutes'),        # expired hold → not booked
        (d(70), d(72), 'cancelled', '0 minutes'),
        (d(80), d(82), 'payment_failed', '0 minutes'),
        (d(-10), d(-4), 'confirmed', '0 minutes'),             # past stay
        (d(-3), d(0), 'pending', '0 minutes'),                 # departs today → past
        (d(0), d(2), 'confirmed', '0 minutes'),                # arrives today (back-to-back with the departure)
    ]
    for ci, co, status, ago in bookings:
        q(f"insert into public.bookings (property_id, check_in, check_out, status, payment_status, user_email, user_name, property_title, total_price, created_at) "
          f"values ('{a}', '{ci}', '{co}', '{status}', 'x', 'guest.private@example.test', 'Guest Private Name', 'T', 123, now() - interval '{ago}');")
    for key in ('B', 'REJ', 'PEND', 'HID'):
        q(f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P[key]}', '{d(5)}', '{d(6)}', 'owner@example.test');")
        q(f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values ('{P[key]}', '{d(7)}', '{d(9)}', 'confirmed', 'g@example.test', 'T', 1);")


# ── Tests ─────────────────────────────────────────────────────────────────────

RESULTS = []


def test(name):
    def deco(fn):
        def wrapper():
            try:
                fn()
                RESULTS.append((name, True, ''))
            except AssertionError as e:
                RESULTS.append((name, False, str(e)))
            except Exception as e:  # noqa: BLE001
                RESULTS.append((name, False, f'error: {str(e)[:300]}'))
        wrapper.test_name = name
        return wrapper
    return deco


def denied(res):
    return res[0] != 0 and ('permission denied' in res[2] or 'row-level security' in res[2])


def rpc_rows(prop, role='anon'):
    rc, out, err = as_role(role, f"select start_date || '|' || end_date || '|' || source_kind from public.get_unavailable_ranges('{prop}');")
    assert rc == 0, f'rpc failed for {role}: {err[:200]}'
    return [tuple(line.split('|')) for line in out.splitlines() if line]


@test('anon cannot SELECT blocked_dates or ical_blocked_dates')
def t_anon_select():
    for table in ('blocked_dates', 'ical_blocked_dates'):
        assert denied(as_role('anon', f'select count(*) from public.{table};')), table
        assert denied(as_role('anon', f"select host_email from public.{table};")), table


@test('anon cannot write either table')
def t_anon_write():
    for table, cols, vals in (('blocked_dates', 'host_email', "'x@example.test'"), ('ical_blocked_dates', 'host_email', "'x@example.test'")):
        assert denied(as_role('anon', f"insert into public.{table} (property_id, start_date, end_date, {cols}) values ('{P['A']}', '{d(90)}', '{d(91)}', {vals});")), table
        assert denied(as_role('anon', f"delete from public.{table};")), table


@test('RPC returns only (start_date, end_date, source_kind) with source_kind in booked/blocked')
def t_rpc_shape():
    assert q("select pg_get_function_result('public.get_unavailable_ranges(uuid)'::regprocedure)") == 'TABLE(start_date date, end_date date, source_kind text)'
    rows = rpc_rows(P['A'])
    assert rows, 'no rows for approved property'
    assert all(len(r) == 3 and r[2] in ('booked', 'blocked') for r in rows), rows
    dump = as_role('anon', f"select row_to_json(r)::text from public.get_unavailable_ranges('{P['A']}') r;")[1]
    for secret in (HOST_A['email'], 'host.a@', 'Private family visit', 'Guest Private Name', 'uid-1', 'airbnb', 'guest.private', '123', P['A']):
        assert secret.lower() not in dump.lower(), f'leak: {secret[:10]}'
    for row in dump.splitlines():
        assert sorted(json.loads(row).keys()) == ['end_date', 'source_kind', 'start_date'], row


@test('RPC executable by anon and authenticated; anon/authenticated cannot call the ownership helper or no-overlap internals')
def t_rpc_grants():
    assert rpc_rows(P['A'], 'anon')
    assert rpc_rows(P['A'], 'authenticated')
    assert q("select has_function_privilege('anon', 'public.get_unavailable_ranges(uuid)', 'EXECUTE')") == 't'
    assert q("select has_function_privilege('authenticated', 'public.get_unavailable_ranges(uuid)', 'EXECUTE')") == 't'
    assert q("select bool_or(a.grantee = 0) from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.get_unavailable_ranges(uuid)'::regprocedure") in ('f', ''), 'PUBLIC grant present'
    assert denied(as_role('anon', f"select public.is_property_owner('{P['A']}');"))


@test('RPC returns nothing for rejected, pending, hidden and unknown properties (no error)')
def t_rpc_status():
    for key in ('REJ', 'PEND', 'HID'):
        assert rpc_rows(P[key]) == [], key
    assert rpc_rows(str(uuid.uuid4())) == []
    assert rpc_rows(P['B']) != []


@test('RPC excludes past ranges; keeps ranges ending today (blocks) and ongoing stays')
def t_rpc_future():
    rows = rpc_rows(P['A'])
    starts = {(r[0], r[2]) for r in rows}
    assert (d(-5), 'blocked') not in starts, 'past block'
    assert (d(-3), 'blocked') in starts, 'block ending today'
    assert (d(-10), 'booked') not in starts, 'past booking'
    assert (d(-3), 'booked') not in starts, 'booking departing today'
    assert (d(0), 'booked') in starts, 'booking arriving today'


@test('RPC booked ranges: occupying statuses + holds under 20 min; end_date = check_out (exclusive)')
def t_rpc_booked():
    booked = sorted((r[0], r[1]) for r in rpc_rows(P['A']) if r[2] == 'booked')
    assert booked == sorted([(d(0), d(2)), (d(30), d(33)), (d(33), d(35)), (d(40), d(42)), (d(50), d(52))]), booked
    blocked = sorted((r[0], r[1]) for r in rpc_rows(P['A']) if r[2] == 'blocked')
    assert (d(10), d(10)) in blocked and (d(20), d(23)) in blocked, blocked


def frontend_unavailable(rows, ci, co):
    """The property page rule (src/lib/availability.ts), applied to RPC rows."""
    for s, e, kind in rows:
        if kind == 'blocked' and not (co < s or ci > e):
            return True
        if kind == 'booked' and ci < e and co > s:
            return True
    return False


@test('RPC + page rule == server rule (release holds, then booking_dates_free) for every bookable stay (≤8 nights) in the next 120 days')
def t_semantics():
    rows = rpc_rows(P['A'])
    # Bookable stays only: create-order rejects a check-in before today.
    days = [d(i) for i in range(0, 120)]
    pairs = [(days[i], days[j]) for i in range(len(days)) for j in range(i + 1, min(i + 9, len(days)))]
    values = ','.join(f"('{ci}'::date,'{co}'::date)" for ci, co in pairs)
    out = q("begin;\n"
            f"select public.release_expired_holds('{P['A']}');\n"
            f"select ci || '|' || co || '|' || public.booking_dates_free('{P['A']}', ci, co) from (values {values}) v(ci, co);\n"
            "rollback;")
    server = {}
    for line in out.splitlines():
        parts = line.split('|')
        if len(parts) == 3:
            assert parts[2] in ('true', 'false'), parts
            server[(parts[0], parts[1])] = parts[2] == 'false'
    assert len(server) == len(pairs), f'{len(server)} vs {len(pairs)}'
    mismatches = [(ci, co) for ci, co in pairs if frontend_unavailable(rows, ci, co) != server[(ci, co)]]
    assert not mismatches, f'{len(mismatches)} mismatches, e.g. {mismatches[:3]}'
    # spot checks of the conventions
    assert frontend_unavailable(rows, d(8), d(10)) and not frontend_unavailable(rows, d(11), d(12)), 'single-day block'
    assert not frontend_unavailable(rows, d(28), d(30)), 'check-out on a booking\'s check-in day is free'
    assert frontend_unavailable(rows, d(9), d(10)), 'check-out on a block\'s first day is blocked (today\'s stricter rule)'
    assert not frontend_unavailable(rows, d(60), d(62)), 'expired hold is not unavailable'


@test('host A cannot read, insert or delete blocks on host B\'s property')
def t_cross_host():
    rc, out, _ = as_role('authenticated', f"select count(*) from public.blocked_dates where property_id = '{P['B']}';", HOST_A)
    assert rc == 0 and out.splitlines()[-1] == '0', out
    rc, out, _ = as_role('authenticated', f"select count(*) from public.ical_blocked_dates where property_id = '{P['B']}';", HOST_A)
    assert rc == 0 and out.splitlines()[-1] == '0'
    res = as_role('authenticated', f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['B']}', '{d(95)}', '{d(96)}', '{HOST_A['email']}');", HOST_A)
    assert denied(res), res[2][:120]
    before = q(f"select count(*) from public.blocked_dates where property_id = '{P['B']}'")
    rc, _, _ = as_role('authenticated', f"delete from public.blocked_dates where property_id = '{P['B']}';", HOST_A)
    assert q(f"select count(*) from public.blocked_dates where property_id = '{P['B']}'") == before, 'B block deleted by A'
    assert denied(as_role('authenticated', f"update public.blocked_dates set end_date = start_date where property_id = '{P['B']}';", HOST_A))
    # A block planted on B's property with A's email (possible before this fix)
    # can no longer be deleted or read by A; B, the owner, can remove it.
    planted = q(f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['B']}', '{d(97)}', '{d(98)}', '{HOST_A['email']}') returning id;")
    as_role('authenticated', f"delete from public.blocked_dates where id = '{planted}';", HOST_A)
    assert q(f"select count(*) from public.blocked_dates where id = '{planted}'") == '1', 'A deleted a block on B\'s property via host_email'
    rc, out, _ = as_role('authenticated', f"select count(*) from public.blocked_dates where id = '{planted}';", HOST_A)
    assert out.splitlines()[-1] == '0', 'A reads a block on B\'s property via host_email'
    rc, _, err = as_role('authenticated', f"delete from public.blocked_dates where id = '{planted}';", HOST_B)
    assert rc == 0 and q(f"select count(*) from public.blocked_dates where id = '{planted}'") == '0', 'owner B could not delete a block on own property'


@test('host A manages own blocks (case-insensitive owner email); cannot spoof host_email; no UPDATE')
def t_own_host():
    ins = as_role('authenticated', f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['A']}', '{d(100)}', '{d(101)}', '{HOST_A['email'].upper()}') returning 1;", HOST_A)
    assert ins[0] == 0, ins[2][:160]
    rc, out, _ = as_role('authenticated', f"select count(*) from public.blocked_dates where property_id = '{P['A']}' and start_date = '{d(100)}';", HOST_A)
    assert out.splitlines()[-1] == '1'
    spoof = as_role('authenticated', f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['A']}', '{d(102)}', '{d(103)}', '{HOST_B['email']}');", HOST_A)
    assert denied(spoof), 'host_email spoof accepted'
    rc, out, _ = as_role('authenticated', f"select count(*) from public.ical_blocked_dates where property_id = '{P['A']}';", HOST_A)
    assert out.splitlines()[-1] == '1', 'owner reads own imported blocks'
    assert denied(as_role('authenticated', f"update public.blocked_dates set reason = 'x' where property_id = '{P['A']}';", HOST_A))
    rc, _, err = as_role('authenticated', f"delete from public.blocked_dates where property_id = '{P['A']}' and start_date = '{d(100)}';", HOST_A)
    assert rc == 0, err
    assert q(f"select count(*) from public.blocked_dates where property_id = '{P['A']}' and start_date = '{d(100)}'") == '0'


@test('unconfirmed or JWT-email-only users are not owners; guests cannot manage any block')
def t_unconfirmed():
    assert denied(as_role('authenticated', f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['U']}', '{d(90)}', '{d(91)}', '{UNCONFIRMED['email']}');", UNCONFIRMED))
    # Claims email of host A, but the account (auth.users) is the guest's.
    assert denied(as_role('authenticated', f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['A']}', '{d(90)}', '{d(91)}', '{HOST_A['email']}');", GUEST, jwt_email=HOST_A['email']))
    rc, out, _ = as_role('authenticated', "select count(*) from public.blocked_dates;", GUEST)
    assert out.splitlines()[-1] == '0'


@test('authenticated users (even owners) cannot write ical_blocked_dates')
def t_ical_no_writes():
    for sql in (f"insert into public.ical_blocked_dates (property_id, start_date, end_date, host_email) values ('{P['A']}', '{d(90)}', '{d(91)}', '{HOST_A['email']}');",
                f"update public.ical_blocked_dates set summary = 'x' where property_id = '{P['A']}';",
                f"delete from public.ical_blocked_dates where property_id = '{P['A']}';"):
        assert denied(as_role('authenticated', sql, HOST_A)), sql[:50]
    assert q(f"select count(*) from public.ical_blocked_dates where property_id = '{P['A']}'") == '1'


@test('service role (ical-sync, ical-export, booking-handler) still reads and writes both tables')
def t_service_role():
    rc, _, err = as_role('service_role', f"insert into public.ical_blocked_dates (property_id, start_date, end_date, host_email, platform) values ('{P['B']}', '{d(110)}', '{d(111)}', '{HOST_B['email']}', 'booking_com');\n"
                         f"delete from public.ical_blocked_dates where property_id = '{P['B']}' and start_date = '{d(110)}';\n"
                         f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['B']}', '{d(112)}', '{d(113)}', '{HOST_B['email']}');\n"
                         f"select count(*) from public.blocked_dates; select count(*) from public.ical_blocked_dates;")
    assert rc == 0, err[:200]


@test('no-overlap lock triggers still fire for host writes (a held property lock blocks the insert)')
def t_lock_trigger():
    assert q("select count(*) from pg_trigger where tgname in ('blocked_dates_lock_booking_dates','ical_blocked_dates_lock_booking_dates') and tgenabled = 'O'") == '2'
    holder = subprocess.Popen(args(DB), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    holder.stdin.write(f"begin;\nselect pg_advisory_xact_lock(public.booking_dates_lock_key('{P['A']}'));\nselect 'locked';\n")
    holder.stdin.flush()
    while holder.stdout.readline().strip() != 'locked':
        pass
    res = as_role('authenticated', f"set statement_timeout = '400ms';\ninsert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{P['A']}', '{d(104)}', '{d(105)}', '{HOST_A['email']}');", HOST_A)
    holder.stdin.write('rollback;\n\\q\n')
    holder.stdin.flush()
    holder.wait(timeout=30)
    assert res[0] != 0 and 'statement timeout' in res[2], f'insert did not wait for the property lock: {res[2][:120]}'


TESTS = [t_anon_select, t_anon_write, t_rpc_shape, t_rpc_grants, t_rpc_status, t_rpc_future, t_rpc_booked, t_semantics,
         t_cross_host, t_own_host, t_unconfirmed, t_ical_no_writes, t_service_role, t_lock_trigger]


def main():
    setup()
    seed()
    for t in TESTS:
        t()
    for name, passed, err in RESULTS:
        print(f"{'PASS' if passed else 'FAIL'}  {name}" + (f"  [{err}]" if err else ''), flush=True)
    ok = all(p for _, p, _ in RESULTS)
    print('ALL PASS' if ok else 'FAILURES', flush=True)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
