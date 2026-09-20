-- Reference PostgreSQL migration for the future authenticated server adapter.
-- This is not applied by the static preview. Map these IDs to your existing
-- identity/club tables when integrating with the production database.
begin;
create schema if not exists recruitment;
create table recruitment.students (
  id text primary key, name text not null, year text not null, major text not null
);
create table recruitment.clubs (id text primary key);
create table recruitment.events (
  id uuid primary key, club_id text not null references recruitment.clubs(id),
  name text not null check (length(trim(name)) > 0),
  starts_at timestamptz not null, check_in_enabled boolean not null default true,
  unique (id, club_id)
);
create table recruitment.applications (
  student_id text not null references recruitment.students(id),
  club_id text not null references recruitment.clubs(id),
  started_at timestamptz not null default now(),
  primary key (student_id, club_id)
);
create table recruitment.attendance (
  student_id text not null references recruitment.students(id),
  club_id text not null references recruitment.clubs(id),
  event_id uuid not null,
  checked_in_at timestamptz not null default now(),
  primary key (student_id, event_id),
  foreign key (event_id, club_id) references recruitment.events(id, club_id)
);
create index attendance_club_student on recruitment.attendance (club_id, student_id);

-- Call only from the authenticated server with its verified session subject.
-- The event determines club_id; never accept club_id or student_id from a QR URL.
create function recruitment.check_in(verified_student_id text, scanned_event_id uuid)
returns recruitment.attendance language plpgsql as $$
declare
  target recruitment.events;
  result recruitment.attendance;
begin
  select * into target from recruitment.events where id = scanned_event_id for share;
  if not found or not target.check_in_enabled then
    raise exception 'Check-in unavailable';
  end if;
  insert into recruitment.attendance(student_id, club_id, event_id)
    values (verified_student_id, target.club_id, target.id)
    on conflict (student_id, event_id) do nothing;
  select * into result from recruitment.attendance
    where student_id = verified_student_id and event_id = scanned_event_id;
  return result;
end;
$$;
revoke all on function recruitment.check_in(text, uuid) from public;

-- Attendance creates the CRM lead automatically; starting an application changes
-- the segment without moving/deleting attendance or duplicating the student.
create view recruitment.crm as
with contacts as (
  select student_id, club_id from recruitment.attendance
  union
  select student_id, club_id from recruitment.applications
)
select s.id as student_id, c.club_id, s.name, s.year, s.major,
  case when a.student_id is null then 'Lead' else 'Applicant' end as segment,
  (select count(*) from recruitment.attendance t
    where t.student_id = c.student_id and t.club_id = c.club_id) as events_attended
from contacts c join recruitment.students s on s.id = c.student_id
left join recruitment.applications a on a.student_id = c.student_id and a.club_id = c.club_id;

-- No anonymous/browser database access. The server must enforce club membership
-- for event creation and CRM reads, and use a least-privilege database role.
revoke all on schema recruitment from public;
revoke all on all tables in schema recruitment from public;
commit;
