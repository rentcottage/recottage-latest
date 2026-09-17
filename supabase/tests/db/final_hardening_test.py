#!/usr/bin/env python3
"""Privacy and write-authorization tests for the final hardening migrations:

  supabase/migrations/20260918130000_storage_experience_photos.sql
  supabase/migrations/20260918130100_public_offers_activities_reviews_views.sql
  supabase/migrations/20260918130150_offers_activities_reviews_privacy.sql
  supabase/migrations/20260918130200_admin_auth_failures.sql

Runs against a LOCAL, disposable PostgreSQL 17 (never production):

  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PGHOST=/tmp/rcpg PGPORT=55432 \\
    python3 supabase/tests/db/final_hardening_test.py

The database `rc_hardening_test` is rebuilt from bootstrap.sql, prod_structure.sql
(which carries the pre-hardening shape of the three tables and a stand-in
storage schema) and the migrations under test. Exit 0 = all pass.
"""
import json
import os
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MIG = os.path.join(ROOT, 'supabase', 'migrations')
PSQL = os.environ.get('PSQL', 'psql')
DB = os.environ.get('RC_HARDENING_DB', 'rc_hardening_test')

STORAGE_SQL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(MIG, '20260918130000_storage_experience_photos.sql')
VIEWS_SQL = sys.argv[2] if len(sys.argv) > 2 else os.path.join(MIG, '20260918130100_public_offers_activities_reviews_views.sql')
PRIVACY_SQL = sys.argv[3] if len(sys.argv) > 3 else os.path.join(MIG, '20260918130150_offers_activities_reviews_privacy.sql')
THROTTLE_SQL = sys.argv[4] if len(sys.argv) > 4 else os.path.join(MIG, '20260918130200_admin_auth_failures.sql')


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
GUEST = {'id': str(uuid.uuid4()), 'email': 'guest@example.test'}
OTHER = {'id': str(uuid.uuid4()), 'email': 'other@example.test'}

GUEST_NAME = 'Nino Privatesurname'
GUEST_EMAIL = GUEST['email']


def as_role(role, sql, user=None):
    claims = {'role': role}
    if user:
        claims['sub'] = user['id']
        claims['email'] = user['email']
    prefix = (f"do $cfg$ begin perform set_config('request.jwt.claims', '{json.dumps(claims)}', false); end $cfg$;\n"
              f"set role {role};\n")
    return run(prefix + sql)


P = {}
B = {}


def setup():
    run('drop database if exists ' + DB, db='postgres')
    run('create database ' + DB, db='postgres')
    run_file(os.path.join(HERE, 'bootstrap.sql'))
    run_file(os.path.join(HERE, 'prod_structure.sql'))
    # The whole chain, so the scan below sees production's real grants.
    for earlier in ('20260917160000_booking_no_overlap.sql',
                    '20260918100000_public_unavailable_ranges.sql',
                    '20260918100100_block_tables_privacy.sql',
                    '20260918110000_status_logs_privacy.sql',
                    '20260918120000_public_properties_view.sql',
                    '20260918120100_property_applications_privacy.sql'):
        run_file(os.path.join(MIG, earlier))
    run_file(STORAGE_SQL)
    run_file(VIEWS_SQL)
    run_file(PRIVACY_SQL)
    run_file(THROTTLE_SQL)


def seed():
    for u in (HOST_A, HOST_B, GUEST, OTHER):
        q(f"insert into auth.users (id, email, email_confirmed_at) values ('{u['id']}', '{u['email']}', now());")
    for key, owner in (('A', HOST_A['email']), ('B', HOST_B['email'])):
        P[key] = str(uuid.uuid4())
        q("insert into public.property_applications (id, status, host_email, title, host_first_name, host_last_name, "
          "host_phone, property_type, location, bedrooms, bathrooms, max_guests, description, price_per_night) "
          f"values ('{P[key]}', 'approved', '{owner}', 'T', 'F', 'L', '0', 'cottage', 'X', 1, 1, 2, 'D', 100);")
    # One confirmed booking of property A by the guest, and one of property B by
    # somebody else (used for the "review someone else's booking" test).
    # Distinct stay windows: the no-overlap constraint from the earlier
    # migration refuses two bookings of one property on the same dates.
    for key, prop, email, name, status, ci, co in (
        ('OK', 'A', GUEST_EMAIL, GUEST_NAME, 'confirmed', 5, 2),
        ('PENDING', 'A', GUEST_EMAIL, GUEST_NAME, 'pending', 20, 17),
        ('OTHER', 'B', OTHER['email'], 'Other Guest', 'confirmed', 5, 2),
    ):
        B[key] = str(uuid.uuid4())
        q("insert into public.bookings (id, property_id, check_in, check_out, status, user_email, user_name, "
          f"property_title, total_price, customer_id) values ('{B[key]}', '{P[prop]}', current_date - {ci}, current_date - {co}, "
          f"'{status}', '{email}', '{name}', 'T', 100, "
          f"'{GUEST['id'] if email == GUEST_EMAIL else OTHER['id']}');")

    q(f"insert into public.host_offers (property_id, host_email, title, offer_type, buy_nights, free_nights, active) "
      f"values ('{P['A']}', '{HOST_A['email']}', 'Autumn', 'free_nights', 2, 1, true);")
    q(f"insert into public.host_offers (property_id, host_email, title, offer_type, discount_percent, active) "
      f"values ('{P['A']}', '{HOST_A['email']}', 'Hidden', 'discount', 10, false);")
    q(f"insert into public.property_activities (property_id, host_email, title, category, price, price_unit, active) "
      f"values ('{P['A']}', '{HOST_A['email']}', 'Wine tasting', 'wine', 40, 'per_person', true);")
    q(f"insert into public.property_activities (property_id, host_email, title, category, price, price_unit, active) "
      f"values ('{P['A']}', '{HOST_A['email']}', 'Draft', 'tour', 10, 'per_person', false);")
    q("insert into public.reviews (booking_id, property_id, guest_email, guest_name, rating, review_text) values "
      f"('{B['OK']}', '{P['A']}', '{GUEST_EMAIL}', '{GUEST_NAME}', 5, 'Lovely stay');")
    # Storage objects in each bucket.
    q("insert into storage.objects (bucket_id, name) values "
      "('experience-photos', 'experiences/existing.jpg'), ('property-photos', 'existing.jpg');")


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
    """Refused outright (no privilege / RLS), as opposed to silently doing nothing."""
    return res[0] != 0 and ('permission denied' in res[2] or 'row-level security' in res[2])


def wrote_nothing(res, table, expect):
    """A statement that ran but changed nothing (RLS filtered every row)."""
    return res[0] != 0 or q(f'select count(*) from {table}') == str(expect)


# ── (a) storage ───────────────────────────────────────────────────────────────

@test('anon and authenticated cannot write, overwrite or delete in experience-photos')
def t_storage_experience_no_write():
    before = q("select count(*) from storage.objects where bucket_id = 'experience-photos'")
    for role, user in (('anon', None), ('authenticated', GUEST)):
        ins = as_role(role, "insert into storage.objects (bucket_id, name) values ('experience-photos', 'experiences/evil.js');", user)
        assert denied(ins), f'{role} INSERT was allowed: {ins[2][:150]}'
        upd = as_role(role, "update storage.objects set name = 'experiences/hijacked.jpg' where bucket_id = 'experience-photos';", user)
        assert wrote_nothing(upd, "storage.objects where bucket_id = 'experience-photos' and name = 'experiences/existing.jpg'", 1), f'{role} UPDATE changed a row'
        dele = as_role(role, "delete from storage.objects where bucket_id = 'experience-photos';", user)
        assert wrote_nothing(dele, "storage.objects where bucket_id = 'experience-photos'", int(before)), f'{role} DELETE removed a row'
    assert q("select count(*) from storage.objects where bucket_id = 'experience-photos'") == before


@test('experience-photos stays publicly readable')
def t_storage_experience_read():
    for role, user in (('anon', None), ('authenticated', GUEST)):
        rc, out, err = as_role(role, "select count(*) from storage.objects where bucket_id = 'experience-photos';", user)
        assert rc == 0 and out == '1', f'{role} lost read access: {err[:150]}'


@test('exp_photo_all is gone and the only experience-photos policy is a SELECT policy')
def t_storage_policies():
    assert q("select count(*) from pg_policies where schemaname='storage' and policyname='exp_photo_all'") == '0'
    rows = q("select policyname || ':' || cmd from pg_policies where schemaname='storage' and tablename='objects' "
             "and (coalesce(qual,'') like '%experience-photos%' or coalesce(with_check,'') like '%experience-photos%') order by 1")
    assert rows == 'experience_photos_public_read:SELECT', rows


@test('property-photos: anon can still upload, but cannot overwrite or delete')
def t_storage_property_photos():
    ins = as_role('anon', "insert into storage.objects (bucket_id, name) values ('property-photos', '1700000000-photo.webp');")
    assert ins[0] == 0, f'the become-host upload broke: {ins[2][:200]}'
    upd = as_role('anon', "update storage.objects set name = 'stolen.jpg' where bucket_id = 'property-photos' and name = 'existing.jpg';")
    assert wrote_nothing(upd, "storage.objects where bucket_id = 'property-photos' and name = 'existing.jpg'", 1), 'anon overwrote a property photo'
    dele = as_role('anon', "delete from storage.objects where bucket_id = 'property-photos' and name = 'existing.jpg';")
    assert wrote_nothing(dele, "storage.objects where bucket_id = 'property-photos' and name = 'existing.jpg'", 1), 'anon deleted a property photo'


# ── (c) host_offers / property_activities ─────────────────────────────────────

@test('anon cannot read host_offers or property_activities at all')
def t_anon_no_tables():
    for table in ('host_offers', 'property_activities'):
        assert denied(as_role('anon', f'select count(*) from public.{table};')), table
        assert denied(as_role('anon', f'select host_email from public.{table};')), table


@test('the public views carry no host_email and only live rows')
def t_public_views():
    for view, expected in (('public_host_offers', 1), ('public_property_activities', 1)):
        assert q(f"select count(*) from information_schema.columns where table_schema='public' and table_name='{view}' and column_name='host_email'") == '0', view
        for role, user in (('anon', None), ('authenticated', GUEST)):
            rc, out, err = as_role(role, f'select count(*) from public.{view};', user)
            assert rc == 0, f'{role} cannot read {view}: {err[:150]}'
            assert out == str(expected), f'{view} for {role}: {out}'
        dump = as_role('anon', f'select row_to_json(v)::text from public.{view} v;')[1]
        assert HOST_A['email'] not in dump and 'host.a@' not in dump, f'{view} leaks host_email'


@test('a host still reads and writes their own offers and activities; not another host\'s')
def t_host_scoped():
    for table in ('host_offers', 'property_activities'):
        rc, out, err = as_role('authenticated', f'select count(*) from public.{table};', HOST_A)
        assert rc == 0 and out == '2', f'host A lost {table}: {out} {err[:150]}'
        rc, out, _ = as_role('authenticated', f'select count(*) from public.{table};', HOST_B)
        assert rc == 0 and out == '0', f'host B sees host A rows in {table}: {out}'
        upd = as_role('authenticated', f"update public.{table} set active = false;", HOST_B)
        assert wrote_nothing(upd, f'public.{table} where active', 1), f'host B changed host A rows in {table}'
    ins = as_role('authenticated',
                  f"insert into public.host_offers (property_id, host_email, offer_type, discount_percent) values "
                  f"('{P['A']}', '{HOST_A['email']}', 'discount', 5);", HOST_A)
    assert ins[0] == 0, f'host A cannot create an offer: {ins[2][:200]}'
    q("delete from public.host_offers where discount_percent = 5;")


# ── (d) reviews ───────────────────────────────────────────────────────────────

@test('anon cannot read the reviews table; the public view has no email and no booking id')
def t_reviews_public():
    assert denied(as_role('anon', 'select count(*) from public.reviews;'))
    assert denied(as_role('anon', 'select guest_email from public.reviews;'))
    cols = q("select string_agg(column_name, ',' order by column_name) from information_schema.columns "
             "where table_schema='public' and table_name='public_reviews'")
    assert cols == 'created_at,display_name,id,property_id,rating,review_text', cols
    dump = as_role('anon', 'select row_to_json(v)::text from public.public_reviews v;')[1]
    for secret in (GUEST_EMAIL, 'Privatesurname', B['OK']):
        assert secret.lower() not in dump.lower(), f'public_reviews leaks {secret[:12]}'


@test('the public view shows the first name and last initial only')
def t_reviews_display_name():
    assert q("select display_name from public.public_reviews") == 'Nino P.'
    for raw, want in (('Sarah', 'Sarah'), ('  Ana  Beridze  ', 'Ana B.'), ('', 'Guest'), ('   ', 'Guest'),
                      ('maria.k', 'maria.k'), ('Jean Luc Picard', 'Jean L.')):
        q(f"update public.reviews set guest_name = $x${raw}$x$;")
        got = q('select display_name from public.public_reviews')
        assert got == want, f'{raw!r} → {got!r}, wanted {want!r}'
    q("update public.reviews set guest_name = $x$%s$x$;" % GUEST_NAME)
    dump = as_role('anon', 'select row_to_json(v)::text from public.public_reviews v;')[1]
    assert 'Privatesurname' not in dump


@test('a guest can review their own confirmed booking, and only that')
def t_reviews_insert():
    def insert(user, booking, prop, email):
        return as_role('authenticated',
                       f"insert into public.reviews (booking_id, property_id, guest_email, guest_name, rating, review_text) "
                       f"values ({booking}, '{prop}', '{email}', 'X', 4, 'ok');", user)

    ok = insert(OTHER, f"'{B['OTHER']}'", P['B'], OTHER['email'])
    assert ok[0] == 0, f'a real guest could not review their stay: {ok[2][:200]}'
    q(f"delete from public.reviews where booking_id = '{B['OTHER']}';")

    # Someone else's booking, a booking that is not confirmed, no booking at
    # all, a booking of a different property, and a spoofed guest_email.
    assert denied(insert(GUEST, f"'{B['OTHER']}'", P['B'], GUEST_EMAIL)), 'reviewed another guest\'s booking'
    assert denied(insert(GUEST, f"'{B['PENDING']}'", P['A'], GUEST_EMAIL)), 'reviewed an unconfirmed booking'
    assert denied(insert(GUEST, 'null', P['A'], GUEST_EMAIL)), 'reviewed with no booking'
    assert denied(insert(GUEST, f"'{B['OK']}'", P['B'], GUEST_EMAIL)), 'review attached to the wrong property'
    assert denied(insert(GUEST, f"'{B['OK']}'", P['A'], OTHER['email'])), 'wrote a review under another guest\'s email'
    assert denied(as_role('anon',
                          f"insert into public.reviews (booking_id, property_id, guest_email, guest_name, rating, review_text) "
                          f"values ('{B['OK']}', '{P['A']}', '{GUEST_EMAIL}', 'X', 5, 'spam');")), 'anon wrote a review'


@test('a guest sees their own review; the host sees reviews of their property; nobody else does')
def t_reviews_select():
    rc, out, _ = as_role('authenticated', 'select count(*) from public.reviews;', GUEST)
    assert rc == 0 and out == '1', f'guest cannot see their own review: {out}'
    rc, out, _ = as_role('authenticated', 'select count(*) from public.reviews;', HOST_A)
    assert rc == 0 and out == '1', f'host A cannot see the review of their property: {out}'
    rc, out, _ = as_role('authenticated', 'select count(*) from public.reviews;', HOST_B)
    assert rc == 0 and out == '0', f'host B sees another property\'s review: {out}'
    rc, out, _ = as_role('authenticated', 'select count(*) from public.reviews;', OTHER)
    assert rc == 0 and out == '0', f'an unrelated user sees a review row: {out}'


@test('reviews cannot be edited or deleted by anyone but the service role')
def t_reviews_immutable():
    for user in (GUEST, HOST_A):
        upd = as_role('authenticated', "update public.reviews set review_text = 'edited';", user)
        assert wrote_nothing(upd, "public.reviews where review_text = 'Lovely stay'", 1), 'a review was edited'
        dele = as_role('authenticated', 'delete from public.reviews;', user)
        assert wrote_nothing(dele, 'public.reviews', 1), 'a review was deleted'


# ── (b) throttle table ────────────────────────────────────────────────────────

@test('admin_auth_failures is invisible to anon and authenticated, service role only')
def t_throttle_table():
    assert q("select relrowsecurity from pg_class where relname = 'admin_auth_failures'") == 't'
    assert q("select count(*) from pg_policies where tablename = 'admin_auth_failures'") == '0'
    for role, user in (('anon', None), ('authenticated', GUEST)):
        assert denied(as_role(role, 'select count(*) from public.admin_auth_failures;', user)), role
        assert denied(as_role(role, "insert into public.admin_auth_failures (ip_hash, function_name) values ('x', 'y');", user)), role
    rc, _, err = as_role('service_role', "insert into public.admin_auth_failures (ip_hash, function_name) values ('deadbeef', 'admin-read');")
    assert rc == 0, f'service role cannot record a failure: {err[:200]}'
    q('delete from public.admin_auth_failures;')


# ── Cross-cutting ─────────────────────────────────────────────────────────────

@test('no email column anywhere in the public schema yields a row to anon')
def t_no_email_for_anon():
    # Grants alone are not the question — RLS may still filter every row — so
    # each candidate column is actually read as anon.
    targets = q("""
      select coalesce(string_agg(c.relname || '|' || a.attname, E'\n'), '') from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and a.attname like '%email%';""")
    leaks = []
    for line in targets.splitlines():
        rel, col = line.split('|')
        rc, out, err = as_role('anon', f'select {col} from public.{rel} limit 1;')
        if rc == 0 and out.strip():
            leaks.append(f'{rel}.{col}')
    assert not leaks, f'anon can read: {", ".join(leaks)}'


@test('service role is unaffected')
def t_service_role():
    for stmt, table in (
        ("select count(*) from public.reviews;", 'reviews'),
        ("select count(*) from public.host_offers;", 'host_offers'),
        ("select count(*) from public.property_activities;", 'property_activities'),
        ("insert into storage.objects (bucket_id, name) values ('experience-photos', 'experiences/svc.jpg');", 'storage'),
    ):
        rc, _, err = as_role('service_role', stmt)
        assert rc == 0, f'service role blocked on {table}: {err[:200]}'
    q("delete from storage.objects where name = 'experiences/svc.jpg';")


TESTS = [t_storage_experience_no_write, t_storage_experience_read, t_storage_policies, t_storage_property_photos,
         t_anon_no_tables, t_public_views, t_host_scoped,
         t_reviews_public, t_reviews_display_name, t_reviews_insert, t_reviews_select, t_reviews_immutable,
         t_throttle_table, t_no_email_for_anon, t_service_role]


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
