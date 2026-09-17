#!/usr/bin/env python3
"""Concurrency tests for supabase/migrations/*_booking_no_overlap.sql.

Runs against a LOCAL, disposable PostgreSQL 17 (never production). Every
scenario uses real parallel connections (separate psql processes released
together by an advisory-lock barrier) and is repeated REPEAT times.

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/concurrency_test.py [path/to/migration.sql]

The database `rc_booking_test` is dropped and recreated from bootstrap.sql,
prod_structure.sql (structure only) and the migration. Exit code 0 = all pass.
"""
import os
import subprocess
import sys
import threading
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_TEST_DB', 'rc_booking_test')
REPEAT = int(os.environ.get('REPEAT', '50'))
MIGRATION = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'supabase', 'migrations', '20260917160000_booking_no_overlap.sql')
BARRIER = 424242


def base_args(db):
    return [PSQL, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', os.environ.get('PGUSER', 'postgres'), '-d', db]


def run(sql, db=DB, check=True):
    p = subprocess.run(base_args(db), input=sql, capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError(f'psql failed: {p.stderr.strip()[:400]}')
    return p


def run_file(path, db=DB):
    p = subprocess.run(base_args(db) + ['-f', path], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f'{os.path.basename(path)} failed: {p.stderr.strip()[:600]}')


def q(sql):
    return run(sql).stdout.strip()


def setup():
    run(f'drop database if exists {DB}', db='postgres')
    run(f'create database {DB}', db='postgres')
    run_file(os.path.join(HERE, 'bootstrap.sql'))
    run_file(os.path.join(HERE, 'prod_structure.sql'))
    run_file(MIGRATION)


# ── Parallel execution with a barrier ─────────────────────────────────────────

class Barrier:
    """Holds an exclusive advisory lock; workers wait on it (shared) and start together."""
    def __init__(self):
        self.p = subprocess.Popen(base_args(DB), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.p.stdin.write(f'select pg_advisory_lock({BARRIER});\nselect 1;\n')
        self.p.stdin.flush()
        self.p.stdout.readline()
        self.p.stdout.readline()

    def release(self):
        self.p.stdin.write(f'select pg_advisory_unlock({BARRIER});\n\\q\n')
        self.p.stdin.flush()
        self.p.wait(timeout=30)


def parallel(sqls, role='service_role'):
    """Runs each SQL script in its own connection, all released at the same moment."""
    barrier = Barrier()
    results = [None] * len(sqls)

    def worker(i, sql):
        script = f"do $$ begin perform pg_advisory_lock_shared({BARRIER}); perform pg_advisory_unlock_shared({BARRIER}); end $$;\nset role {role};\n{sql}\n"
        p = subprocess.run(base_args(DB), input=script, capture_output=True, text=True)
        results[i] = (p.returncode, p.stdout.strip(), p.stderr.strip())

    threads = [threading.Thread(target=worker, args=(i, s)) for i, s in enumerate(sqls)]
    for t in threads:
        t.start()
    time.sleep(0.15)  # every worker is now blocked on the barrier
    barrier.release()
    for t in threads:
        t.join(timeout=60)
    return results


def ok(res):
    return res[0] == 0


def err_has(res, text):
    return res[0] != 0 and text in res[2]


def booking_json(prop, ci, co, status='pending_host_approval', extra=''):
    return (f"'{{\"property_id\": \"{prop}\", \"check_in\": \"{ci}\", \"check_out\": \"{co}\", \"status\": \"{status}\", "
            f"\"user_email\": \"guest@example.test\", \"property_title\": \"T\", \"guests\": 1, \"total_price\": 100{extra}}}'::jsonb")


def create_sql(prop, ci, co, status='pending_host_approval'):
    return f"select public.create_booking_checked({booking_json(prop, ci, co, status)}) ->> 'id';"


def direct_insert(prop, ci, co, status, created_ago='0 minutes', extra_cols='', extra_vals=''):
    return q(f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price, created_at{extra_cols}) "
             f"values ('{prop}', '{ci}', '{co}', '{status}', 'guest@example.test', 'T', 100, now() - interval '{created_ago}'{extra_vals}) returning id;")


def new_prop():
    return str(uuid.uuid4())  # lowercase canonical uuid text, as production stores it


# ── Scenarios ─────────────────────────────────────────────────────────────────

FAILURES = []


def check(cond, label):
    if not cond:
        FAILURES.append(label)
        raise AssertionError(label)


def scenario(name):
    def deco(fn):
        fn.scenario_name = name
        return fn
    return deco


@scenario('a) two create_booking_checked, same property and dates → exactly one succeeds')
def s_a(i):
    prop = new_prop()
    status = 'pending_payment' if i % 2 else 'pending_host_approval'
    res = parallel([create_sql(prop, '2099-06-10', '2099-06-13', status), create_sql(prop, '2099-06-11', '2099-06-14', status)])
    wins = [r for r in res if ok(r)]
    check(len(wins) == 1, f'a#{i}: {len(wins)} winners')
    check(all(ok(r) or err_has(r, 'DATES_UNAVAILABLE') for r in res), f'a#{i}: unexpected error')
    check(q(f"select count(*) from public.bookings where property_id='{prop}'") == '1', f'a#{i}: row count')


@scenario('b) booking vs concurrent block insert → serialized (never a booking over a block committed before its check)')
def s_b(i):
    prop = new_prop()
    table = 'blocked_dates' if i % 2 else 'ical_blocked_dates'
    extra = ", host_email" if table == 'blocked_dates' else ", host_email, platform"
    extra_v = ", 'host@example.test'" if table == 'blocked_dates' else ", 'host@example.test', 'airbnb'"
    booking = ("begin;\n" + create_sql(prop, '2099-07-10', '2099-07-13') +
               "\nselect pg_sleep(0.05);\nselect 'T_PRECOMMIT=' || extract(epoch from clock_timestamp());\ncommit;")
    block = (f"begin;\ninsert into public.{table} (property_id, start_date, end_date{extra}) values ('{prop}', '2099-07-12', '2099-07-15'{extra_v});\n"
             "select 'T_INSERTED=' || extract(epoch from clock_timestamp());\nselect pg_sleep(0.05);\ncommit;")
    # `set role service_role` + RLS: service_role bypasses RLS locally (bypassrls), as in Supabase.
    res = parallel([booking, block])
    check(ok(res[1]), f'b#{i}: block insert failed: {res[1][2][:120]}')
    if ok(res[0]):
        t_pre = float(res[0][1].split('T_PRECOMMIT=')[1].split()[0])
        t_ins = float(res[1][1].split('T_INSERTED=')[1].split()[0])
        check(t_ins > t_pre, f'b#{i}: block was inserted before the booking committed (race)')
    else:
        check(err_has(res[0], 'DATES_UNAVAILABLE'), f'b#{i}: unexpected booking error {res[0][2][:120]}')
    # Deterministic: a committed block always stops a later booking (block rule unchanged).
    prop2 = new_prop()
    q(f"insert into public.{table} (property_id, start_date, end_date{extra}) values ('{prop2}', '2099-07-13', '2099-07-13'{extra_v});")
    r = parallel([create_sql(prop2, '2099-07-10', '2099-07-13')])[0]
    check(err_has(r, 'DATES_UNAVAILABLE'), f'b#{i}: block starting on check-out day must block (today\'s rule)')


@scenario('c) date change vs new booking for the same dates → exactly one succeeds')
def s_c(i):
    prop = new_prop()
    bid = direct_insert(prop, '2099-08-01', '2099-08-03', 'confirmed',
                        extra_cols=', date_change_status, requested_check_in, requested_check_out',
                        extra_vals=", 'pending', '2099-08-10', '2099-08-12'")
    res = parallel([f"select public.apply_date_change('{bid}', 150) ->> 'id';", create_sql(prop, '2099-08-11', '2099-08-13')])
    check(sum(1 for r in res if ok(r)) == 1, f'c#{i}: winners={[ok(r) for r in res]}')
    check(all(ok(r) or err_has(r, 'DATES_UNAVAILABLE') for r in res), f'c#{i}: unexpected error')
    overlap = q(f"select count(*) from public.bookings a join public.bookings b on a.property_id=b.property_id and a.id<b.id and a.check_in<b.check_out and b.check_in<a.check_out "
                f"where a.property_id='{prop}' and a.status in ('confirmed','pending','pending_host_approval','pending_payment') and b.status in ('confirmed','pending','pending_host_approval','pending_payment')")
    check(overlap == '0', f'c#{i}: overlap exists')


@scenario('d) late apply_paid_status vs a confirmed booking → conflict (rejected, paid, system); racing → exactly one occupies')
def s_d(i):
    prop = new_prop()
    late = direct_insert(prop, '2099-09-01', '2099-09-04', 'payment_failed', created_ago='40 minutes')
    q(f"update public.bookings set payment_status='payment_failed', payment_method='pay_now' where id='{late}'")
    direct_insert(prop, '2099-09-02', '2099-09-05', 'confirmed')
    r = parallel([f"select public.apply_paid_status('{late}', '{{\"payment_status\":\"paid\",\"status\":\"pending_host_approval\",\"payment_transaction_id\":\"ord-x\"}}'::jsonb) ->> 'result';"])[0]
    check(ok(r) and r[1] == 'conflict', f'd#{i}: expected conflict, got {r[1]!r} {r[2][:100]}')
    row = q(f"select status||'|'||payment_status||'|'||canceled_by||'|'||rejection_note from public.bookings where id='{late}'")
    check(row == 'rejected|paid|system|DATES_UNAVAILABLE_AFTER_PAYMENT', f'd#{i}: row {row}')
    again = parallel([f"select public.apply_paid_status('{late}', '{{\"payment_status\":\"paid\",\"status\":\"pending_host_approval\"}}'::jsonb) ->> 'result';"])[0]
    check(again[1] == 'noop', f'd#{i}: duplicate apply must be noop, got {again[1]!r}')

    prop2 = new_prop()
    late2 = direct_insert(prop2, '2099-09-01', '2099-09-04', 'payment_failed', created_ago='40 minutes')
    res = parallel([f"select public.apply_paid_status('{late2}', '{{\"payment_status\":\"paid\",\"status\":\"pending_host_approval\"}}'::jsonb) ->> 'result';",
                    create_sql(prop2, '2099-09-03', '2099-09-06', 'confirmed')])
    occupying = q(f"select count(*) from public.bookings where property_id='{prop2}' and status in ('confirmed','pending','pending_host_approval','pending_payment')")
    check(occupying == '1', f'd#{i}: occupying={occupying}')
    if res[0][1] == 'applied':
        check(err_has(res[1], 'DATES_UNAVAILABLE'), f'd#{i}: new booking should fail after re-occupation')
    else:
        check(res[0][1] == 'conflict' and ok(res[1]), f'd#{i}: results {res[0][1]!r} {ok(res[1])}')


@scenario('d2) expired hold whose dates are still free is re-occupied by apply_paid_status')
def s_d2(i):
    prop = new_prop()
    late = direct_insert(prop, '2099-09-10', '2099-09-12', 'payment_failed', created_ago='40 minutes')
    r = parallel([f"select public.apply_paid_status('{late}', '{{\"payment_status\":\"paid\",\"status\":\"pending_host_approval\",\"approval_deadline\":\"2099-01-02T00:00:00Z\"}}'::jsonb) ->> 'result';"])[0]
    check(r[1] == 'applied', f'd2#{i}: {r[1]!r}')
    check(q(f"select status||'|'||payment_status from public.bookings where id='{late}'") == 'pending_host_approval|paid', f'd2#{i}: row')
    stale = direct_insert(prop, '2099-10-10', '2099-10-12', 'pending_payment', created_ago='30 minutes')
    r2 = parallel([f"select public.apply_paid_status('{stale}', '{{\"payment_status\":\"paid\",\"status\":\"confirmed\"}}'::jsonb) ->> 'result';"])[0]
    check(r2[1] == 'applied', f'd2#{i}: an own expired hold must not be released before being paid: {r2[1]!r}')


@scenario('e) back-to-back stays (check_out = next check_in) → both succeed')
def s_e(i):
    prop = new_prop()
    res = parallel([create_sql(prop, '2099-06-10', '2099-06-13'), create_sql(prop, '2099-06-13', '2099-06-15')])
    check(all(ok(r) for r in res), f'e#{i}: {[r[2][:80] for r in res if not ok(r)]}')
    check(q(f"select count(*) from public.bookings where property_id='{prop}'") == '2', f'e#{i}: rows')


@scenario('f) hold older than 20 min is released (logged) and the new booking succeeds; a hold under 20 min blocks')
def s_f(i):
    prop = new_prop()
    old = direct_insert(prop, '2099-05-01', '2099-05-03', 'pending_payment', created_ago='21 minutes')
    r = parallel([create_sql(prop, '2099-05-02', '2099-05-04')])[0]
    check(ok(r), f'f#{i}: booking after expired hold failed: {r[2][:100]}')
    check(q(f"select status||'|'||payment_status from public.bookings where id='{old}'") == 'payment_failed|payment_failed', f'f#{i}: old hold not released')
    check(q(f"select count(*) from public.booking_status_logs where booking_id='{old}' and event_type='payment_hold_expired'") == '1', f'f#{i}: no log entry')
    prop2 = new_prop()
    young = direct_insert(prop2, '2099-05-01', '2099-05-03', 'pending_payment', created_ago='19 minutes')
    r2 = parallel([create_sql(prop2, '2099-05-02', '2099-05-04')])[0]
    check(err_has(r2, 'DATES_UNAVAILABLE'), f'f#{i}: young hold did not block')
    check(q(f"select status from public.bookings where id='{young}'") == 'pending_payment', f'f#{i}: young hold changed')


@scenario('g) release_expired_holds never touches other properties')
def s_g(i):
    prop_x, prop_y = new_prop(), new_prop()
    hold_x = direct_insert(prop_x, '2099-04-01', '2099-04-03', 'pending_payment', created_ago='45 minutes')
    r = parallel([create_sql(prop_y, '2099-04-01', '2099-04-03')])[0]
    check(ok(r), f'g#{i}: booking on Y failed')
    check(q(f"select status from public.bookings where id='{hold_x}'") == 'pending_payment', f'g#{i}: X hold was released by a Y booking')
    check(q(f"select count(*) from public.booking_status_logs where booking_id='{hold_x}'") == '0', f'g#{i}: X got a log entry')


@scenario('h) direct overlapping INSERT as service_role → 23P01 (constraint backstop), for every occupying status')
def s_h(i):
    prop = new_prop()
    statuses = ['confirmed', 'pending', 'pending_host_approval', 'pending_payment']
    first = statuses[i % 4]
    second = statuses[(i + 1) % 4]
    ins = lambda s, ci, co: (f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) "
                             f"values ('{prop}', '{ci}', '{co}', '{s}', 'g@example.test', 'T', 1);")
    r1 = parallel([ins(first, '2099-03-01', '2099-03-05')])[0]
    check(ok(r1), f'h#{i}: first insert failed')
    r2 = parallel([ins(second, '2099-03-04', '2099-03-06')])[0]
    check(r2[0] != 0 and 'bookings_no_overlap' in r2[2], f'h#{i}: overlap not rejected by constraint')
    r3 = parallel([ins('payment_failed', '2099-03-02', '2099-03-03'), ins('cancelled', '2099-03-02', '2099-03-03')])
    check(all(ok(r) for r in r3), f'h#{i}: non-occupying statuses must not be constrained')
    upd = parallel([f"update public.bookings set status='confirmed' where property_id='{prop}' and status='payment_failed';"])[0]
    check(upd[0] != 0 and 'bookings_no_overlap' in upd[2], f'h#{i}: moving INTO an occupying status must be checked')


@scenario('i) anon and authenticated cannot execute the functions or write bookings; host block inserts still work')
def s_i(i):
    prop = new_prop()
    calls = [
        create_sql(prop, '2099-02-01', '2099-02-02'),
        f"select public.apply_paid_status('{uuid.uuid4()}', '{{\"status\":\"confirmed\"}}'::jsonb);",
        f"select public.apply_date_change('{uuid.uuid4()}', 1);",
        f"select public.release_expired_holds('{prop}');",
        f"select public.booking_dates_free('{prop}', '2099-01-01', '2099-01-02');",
        f"select public.booking_dates_lock_key('{prop}');",
        f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values ('{prop}', '2099-01-01', '2099-01-02', 'confirmed', 'x@example.test', 'T', 1);",
        f"update public.bookings set status='confirmed' where property_id='{prop}';",
        f"delete from public.bookings where property_id='{prop}';",
    ]
    for role in ('anon', 'authenticated'):
        res = parallel(calls, role=role)
        for sql, r in zip(calls, res):
            check(r[0] != 0 and 'permission denied' in r[2], f'i#{i}: {role} allowed: {sql[:60]}')
    host = parallel([f"select set_config('request.jwt.claims', '{{\"email\":\"host@example.test\",\"role\":\"authenticated\"}}', false);\n"
                     f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{prop}', '2099-02-01', '2099-02-02', 'host@example.test');"],
                    role='authenticated')[0]
    check(ok(host), f'i#{i}: host block insert broken by the lock trigger: {host[2][:120]}')
    check(q(f"select count(*) from public.bookings where property_id='{prop}'") == '0', f'i#{i}: rows written')


@scenario('b2) booking vs concurrent ical_blocked_dates insert (imported OTA block) → serialized')
def s_b2(i):
    prop = new_prop()
    booking = ("begin;\n" + create_sql(prop, '2099-07-20', '2099-07-23') +
               "\nselect pg_sleep(0.05);\nselect 'T_PRECOMMIT=' || extract(epoch from clock_timestamp());\ncommit;")
    block = (f"begin;\ninsert into public.ical_blocked_dates (property_id, start_date, end_date, host_email, platform) values ('{prop}', '2099-07-21', '2099-07-24', 'host@example.test', 'airbnb');\n"
             "select 'T_INSERTED=' || extract(epoch from clock_timestamp());\nselect pg_sleep(0.05);\ncommit;")
    order = [booking, block] if i % 2 else [block, booking]
    res = parallel(order)
    rb, rk = (res[0], res[1]) if i % 2 else (res[1], res[0])
    check(ok(rk), f'b2#{i}: ical block insert failed: {rk[2][:120]}')
    if ok(rb):
        t_pre = float(rb[1].split('T_PRECOMMIT=')[1].split()[0])
        t_ins = float(rk[1].split('T_INSERTED=')[1].split()[0])
        check(t_ins > t_pre, f'b2#{i}: ical block inserted before the booking committed (race)')
    else:
        check(err_has(rb, 'DATES_UNAVAILABLE'), f'b2#{i}: unexpected booking error {rb[2][:120]}')


@scenario('k) property_id spelled in different case/format is the SAME property (lock key, check and constraint)')
def s_k(i):
    canon = str(uuid.uuid4())
    variants = [canon.upper(), canon.title(), ' ' + canon, canon + ' ', '{' + canon + '}', canon.replace('-', '')]
    variant = variants[i % len(variants)]
    first = parallel([create_sql(canon, '2099-11-01', '2099-11-04')])[0]
    check(ok(first), f'k#{i}: canonical booking failed')
    second = parallel([create_sql(variant, '2099-11-02', '2099-11-05')])[0]
    check(err_has(second, 'DATES_UNAVAILABLE') or err_has(second, 'INVALID_BOOKING'), f'k#{i}: booking with property_id variant {variant!r} was not rejected: {second[2][:100]}')
    # A variant spelling on FREE dates is stored canonically (never a second spelling).
    free = parallel([create_sql(variant, '2099-12-01', '2099-12-03')])[0]
    if ok(free):
        check(q(f"select property_id from public.bookings where id='{free[1]}'") == canon, f'k#{i}: variant stored non-canonically')
    else:
        check(err_has(free, 'INVALID_BOOKING'), f'k#{i}: unexpected error {free[2][:100]}')
    check(q(f"select count(*) from public.bookings where property_id <> lower(property_id) or property_id !~ '^[0-9a-f-]{{36}}$'") == '0', f'k#{i}: non-canonical property_id stored')
    # Non-uuid ids are rejected outright.
    bad = parallel([create_sql('not-a-uuid', '2099-12-10', '2099-12-12')])[0]
    check(err_has(bad, 'INVALID_BOOKING'), f'k#{i}: non-uuid property_id accepted')


@scenario('l) CHECK: non-canonical property_id rejected on direct insert into bookings, blocked_dates and ical_blocked_dates')
def s_l(i):
    canon = str(uuid.uuid4())
    variants = [canon.upper(), '{' + canon + '}', canon.replace('-', ''), ' ' + canon, 'prop-' + canon[:8], '']
    v = variants[i % len(variants)]
    inserts = {
        'bookings': f"insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values ('{v}', '2099-01-10', '2099-01-12', 'cancelled', 'g@example.test', 'T', 1);",
        'blocked_dates': f"insert into public.blocked_dates (property_id, start_date, end_date, host_email) values ('{v}', '2099-01-10', '2099-01-12', 'host@example.test');",
        'ical_blocked_dates': f"insert into public.ical_blocked_dates (property_id, start_date, end_date, host_email, platform) values ('{v}', '2099-01-10', '2099-01-12', 'host@example.test', 'airbnb');",
    }
    res = parallel(list(inserts.values()))
    for (table, _), r in zip(inserts.items(), res):
        check(r[0] != 0 and f'{table}_property_id_canonical' in r[2], f'l#{i}: {table} accepted property_id {v!r}')
    ok_res = parallel([sql.replace(f"'{v}'", f"'{canon}'") for sql in inserts.values()])
    check(all(ok(r) for r in ok_res), f'l#{i}: canonical ids rejected: {[r[2][:80] for r in ok_res if not ok(r)]}')
    null_ok = parallel(["insert into public.bookings (property_id, check_in, check_out, status, user_email, property_title, total_price) values (null, '2099-01-10', '2099-01-12', 'cancelled', 'g@example.test', 'T', 1);"])[0]
    check(ok(null_ok), f'l#{i}: null property_id on bookings must stay allowed')


SCENARIOS = [s_a, s_b, s_b2, s_c, s_d, s_d2, s_e, s_f, s_g, s_h, s_i, s_k, s_l]


def main():
    setup()
    started = time.time()
    summary = []
    for fn in SCENARIOS:
        passed = 0
        first_error = ''
        for i in range(REPEAT):
            try:
                fn(i)
                passed += 1
            except AssertionError as e:
                first_error = first_error or str(e)
            except Exception as e:  # noqa: BLE001
                first_error = first_error or f'error: {str(e)[:200]}'
        summary.append((fn.scenario_name, passed, first_error))
        print(f"{'PASS' if passed == REPEAT else 'FAIL'} {passed}/{REPEAT}  {fn.scenario_name}" + (f"  [{first_error}]" if first_error else ''), flush=True)
    total_ok = all(p == REPEAT for _, p, _ in summary)
    print(f"{'ALL PASS' if total_ok else 'FAILURES'} in {time.time() - started:.0f}s", flush=True)
    sys.exit(0 if total_ok else 1)


if __name__ == '__main__':
    main()
