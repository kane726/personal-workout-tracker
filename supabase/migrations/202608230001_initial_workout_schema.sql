-- Personal Workout Tracker: initial schema, policies, validation, and approved program seed.
-- Run this migration in a new Supabase project before deploying the client.

begin;

create extension if not exists pgcrypto;

create table public.exercises (
  id text primary key,
  name text not null unique,
  category text not null check (category in ('squat', 'pull', 'hamstring', 'push')),
  subtype text check (subtype is null or subtype in ('horizontal', 'vertical', 'hinge', 'curl')),
  locations text[] not null check (
    cardinality(locations) > 0
    and locations <@ array['office', 'home']::text[]
  ),
  equipment text[] not null,
  load_mode text not null check (load_mode in (
    'dumbbell_pair', 'dumbbell_single', 'barbell_total', 'cable_stack', 'band', 'bodyweight'
  )),
  instructions text not null,
  demonstration_url text,
  created_at timestamptz not null default now()
);

create table public.workout_templates (
  id text primary key,
  location text not null check (location in ('office', 'home')),
  workout_day smallint not null check (workout_day between 1 and 3),
  first_superset text not null check (first_superset in ('A', 'B')),
  created_at timestamptz not null default now(),
  unique (location, workout_day)
);

create table public.workout_template_slots (
  id text primary key,
  template_id text not null references public.workout_templates(id) on delete cascade,
  slot_position smallint not null check (slot_position between 1 and 4),
  superset text not null check (superset in ('A', 'B')),
  scheduled_exercise_id text not null references public.exercises(id),
  target_sets smallint not null default 3 check (target_sets = 3),
  rep_min smallint not null check (rep_min >= 1),
  rep_max smallint not null check (rep_max >= rep_min),
  per_side boolean not null default false,
  unique (template_id, slot_position),
  unique (template_id, scheduled_exercise_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id text not null references public.workout_templates(id),
  location text not null check (location in ('office', 'home')),
  workout_day smallint not null check (workout_day between 1 and 3),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text not null default '',
  substitutions_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'draft' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot_position smallint not null check (slot_position between 1 and 4),
  superset text not null check (superset in ('A', 'B')),
  scheduled_exercise_id text not null references public.exercises(id),
  actual_exercise_id text not null references public.exercises(id),
  target_sets smallint not null check (target_sets = 3),
  rep_min smallint not null check (rep_min >= 1),
  rep_max smallint not null check (rep_max >= rep_min),
  per_side boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, slot_position),
  unique (session_id, actual_exercise_id)
);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 3),
  actual_reps smallint check (actual_reps is null or actual_reps >= 0),
  effort smallint check (effort is null or effort between 1 and 10),
  completed boolean not null default false,
  note text not null default '',
  load_value numeric(8, 2) check (load_value is null or load_value >= 0),
  band_description text,
  estimated_resistance_lbs numeric(8, 2) check (
    estimated_resistance_lbs is null or estimated_resistance_lbs >= 0
  ),
  weight_unit text not null default 'lb' check (weight_unit = 'lb'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

create index workout_sessions_user_id_idx on public.workout_sessions(user_id);
create index workout_sessions_user_status_completed_idx
  on public.workout_sessions(user_id, status, completed_at desc);
create index session_exercises_user_id_idx on public.session_exercises(user_id);
create index session_exercises_session_id_idx on public.session_exercises(session_id);
create index session_exercises_actual_exercise_idx on public.session_exercises(actual_exercise_id);
create index set_logs_user_id_idx on public.set_logs(user_id);
create index set_logs_session_id_idx on public.set_logs(session_id);
create index set_logs_session_exercise_id_idx on public.set_logs(session_exercise_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workout_sessions_set_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

create trigger session_exercises_set_updated_at
before update on public.session_exercises
for each row execute function public.set_updated_at();

create trigger set_logs_set_updated_at
before update on public.set_logs
for each row execute function public.set_updated_at();

create or replace function public.validate_workout_session_template()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_template public.workout_templates%rowtype;
begin
  select * into source_template
  from public.workout_templates
  where id = new.template_id;

  if source_template.id is null then
    raise exception 'Workout template does not exist';
  end if;
  if new.location <> source_template.location or new.workout_day <> source_template.workout_day then
    raise exception 'Workout location and day must match the fixed template';
  end if;
  return new;
end;
$$;

create trigger workout_sessions_validate_template
before insert or update of template_id, location, workout_day on public.workout_sessions
for each row execute function public.validate_workout_session_template();

create or replace function public.validate_session_exercise()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_session public.workout_sessions%rowtype;
  source_slot public.workout_template_slots%rowtype;
  scheduled_category text;
  actual_category text;
  actual_locations text[];
begin
  select * into parent_session
  from public.workout_sessions
  where id = new.session_id;

  if parent_session.id is null then
    raise exception 'Workout session does not exist';
  end if;
  if new.user_id <> parent_session.user_id then
    raise exception 'Session exercise owner must match workout owner';
  end if;

  select * into source_slot
  from public.workout_template_slots
  where template_id = parent_session.template_id
    and slot_position = new.slot_position;

  if source_slot.id is null then
    raise exception 'Template slot does not exist';
  end if;
  if new.scheduled_exercise_id <> source_slot.scheduled_exercise_id
    or new.superset <> source_slot.superset
    or new.target_sets <> source_slot.target_sets
    or new.rep_min <> source_slot.rep_min
    or new.rep_max <> source_slot.rep_max
    or new.per_side <> source_slot.per_side then
    raise exception 'A performed exercise must inherit its scheduled slot';
  end if;

  select category into scheduled_category from public.exercises where id = new.scheduled_exercise_id;
  select category, locations into actual_category, actual_locations from public.exercises where id = new.actual_exercise_id;

  if actual_category <> scheduled_category then
    raise exception 'A substitute must remain in the scheduled broad category';
  end if;
  if not (parent_session.location = any(actual_locations)) then
    raise exception 'The exercise is not compatible with this workout location';
  end if;

  return new;
end;
$$;

create trigger session_exercises_validate
before insert or update on public.session_exercises
for each row execute function public.validate_session_exercise();

create or replace function public.validate_set_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_exercise public.session_exercises%rowtype;
  exercise_load_mode text;
begin
  select * into parent_exercise
  from public.session_exercises
  where id = new.session_exercise_id;

  if parent_exercise.id is null then
    raise exception 'Performed exercise does not exist';
  end if;
  if new.session_id <> parent_exercise.session_id or new.user_id <> parent_exercise.user_id then
    raise exception 'Set ownership must match its performed exercise';
  end if;
  if new.set_number > parent_exercise.target_sets then
    raise exception 'Set number exceeds the scheduled set count';
  end if;

  select load_mode into exercise_load_mode
  from public.exercises
  where id = parent_exercise.actual_exercise_id;

  if new.completed then
    if new.actual_reps is null or new.effort is null then
      raise exception 'Completed sets require actual reps and effort';
    end if;
    if exercise_load_mode = 'band'
      and (nullif(trim(new.band_description), '') is null or new.estimated_resistance_lbs is null) then
      raise exception 'Completed band sets require a band description and estimated resistance';
    end if;
    if exercise_load_mode not in ('band', 'bodyweight') and new.load_value is null then
      raise exception 'Completed weighted sets require the appropriate load';
    end if;
  end if;

  if exercise_load_mode = 'bodyweight'
    and (new.load_value is not null or new.band_description is not null or new.estimated_resistance_lbs is not null) then
    raise exception 'Bodyweight exercises record reps and effort only';
  end if;

  return new;
end;
$$;

create trigger set_logs_validate
before insert or update on public.set_logs
for each row execute function public.validate_set_log();

alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_slots enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.set_logs enable row level security;

revoke all on table public.exercises from anon, authenticated;
revoke all on table public.workout_templates from anon, authenticated;
revoke all on table public.workout_template_slots from anon, authenticated;
revoke all on table public.workout_sessions from anon, authenticated;
revoke all on table public.session_exercises from anon, authenticated;
revoke all on table public.set_logs from anon, authenticated;

grant select on table public.exercises to authenticated;
grant select on table public.workout_templates to authenticated;
grant select on table public.workout_template_slots to authenticated;
grant select, insert, update, delete on table public.workout_sessions to authenticated;
grant select, insert, update, delete on table public.session_exercises to authenticated;
grant select, insert, update, delete on table public.set_logs to authenticated;

create policy "Authenticated users read exercises"
on public.exercises for select to authenticated using (true);
create policy "Authenticated users read templates"
on public.workout_templates for select to authenticated using (true);
create policy "Authenticated users read template slots"
on public.workout_template_slots for select to authenticated using (true);

create policy "Users read their own workout sessions"
on public.workout_sessions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create their own workout sessions"
on public.workout_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update their own workout sessions"
on public.workout_sessions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete their own workout sessions"
on public.workout_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their own performed exercises"
on public.session_exercises for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create their own performed exercises"
on public.session_exercises for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update their own performed exercises"
on public.session_exercises for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete their own performed exercises"
on public.session_exercises for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their own set logs"
on public.set_logs for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create their own set logs"
on public.set_logs for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users update their own set logs"
on public.set_logs for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users delete their own set logs"
on public.set_logs for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.current_excluded_exercises()
returns table (exercise_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select ws.id
    from public.workout_sessions ws
    where ws.user_id = (select auth.uid())
      and ws.status = 'completed'
    order by ws.completed_at desc
    limit 1
  )
  select distinct se.actual_exercise_id
  from latest
  join public.session_exercises se on se.session_id = latest.id
  where exists (
    select 1
    from public.set_logs sl
    where sl.session_exercise_id = se.id
      and sl.completed = true
  );
$$;

revoke all on function public.current_excluded_exercises() from public, anon;
grant execute on function public.current_excluded_exercises() to authenticated;

-- Approved catalog and fixed templates are inserted below.
insert into public.exercises (id, name, category, subtype, locations, equipment, load_mode, instructions, demonstration_url) values
  ('double-dumbbell-front-squat', 'Double-dumbbell front squat', 'squat', null, array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Hold both dumbbells at shoulder height. Brace, sit between your hips, and drive through your whole foot.', null),
  ('dumbbell-goblet-squat', 'Dumbbell goblet squat', 'squat', null, array['office', 'home']::text[], array['One dumbbell']::text[], 'dumbbell_single', 'Hold one dumbbell at your chest. Keep your ribs stacked and knees tracking over your toes.', null),
  ('heel-elevated-dumbbell-squat', 'Heel-elevated dumbbell squat', 'squat', null, array['office']::text[], array['Two dumbbells', 'Small heel wedge or plates']::text[], 'dumbbell_pair', 'Elevate both heels, stay tall, and let the knees travel forward while keeping the whole forefoot planted.', null),
  ('dumbbell-bulgarian-split-squat', 'Dumbbell Bulgarian split squat', 'squat', null, array['office']::text[], array['Two dumbbells', 'Adjustable bench']::text[], 'dumbbell_pair', 'Rest the rear foot on the bench. Lower the back knee under control and drive through the front foot.', null),
  ('dumbbell-split-squat', 'Dumbbell split squat with both feet on the floor', 'squat', null, array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Use a stable staggered stance. Drop the rear knee down and keep most pressure through the front foot.', null),
  ('cable-front-squat', 'Cable front squat', 'squat', null, array['office']::text[], array['Low cable station', 'Rope or straight-bar attachment']::text[], 'cable_stack', 'Hold the cable at chest height, step back for tension, brace, and squat without letting the stack pull you forward.', null),
  ('heel-elevated-goblet-squat', 'Heel-elevated goblet squat', 'squat', null, array['home']::text[], array['One dumbbell', 'Small heel wedge or plates']::text[], 'dumbbell_single', 'Hold the dumbbell at your chest, keep your torso tall, and lower with both heels supported.', null),
  ('band-resisted-squat', 'Band-resisted squat', 'squat', null, array['home']::text[], array['Resistance band']::text[], 'band', 'Stand evenly on the band with it secured at shoulder height. Brace and keep tension through the full squat.', null),
  ('kneeling-cable-lat-pulldown', 'Kneeling cable lat pulldown', 'pull', 'vertical', array['office']::text[], array['High cable station', 'Pulldown attachment']::text[], 'cable_stack', 'Kneel tall, set your ribs down, and pull your elbows toward your sides without leaning back.', null),
  ('half-kneeling-single-arm-cable-pulldown', 'Half-kneeling single-arm cable pulldown', 'pull', 'vertical', array['office']::text[], array['High cable station', 'Single handle']::text[], 'cable_stack', 'Kneel with the working-side knee down. Pull the elbow toward your hip while keeping your torso still.', null),
  ('straight-arm-cable-pulldown', 'Straight-arm cable pulldown', 'pull', 'vertical', array['office']::text[], array['High cable station', 'Rope or straight-bar attachment']::text[], 'cable_stack', 'Keep a soft elbow bend and pull the handle from shoulder height to your thighs without rocking.', null),
  ('chest-supported-dumbbell-row', 'Chest-supported dumbbell row', 'pull', 'horizontal', array['office']::text[], array['Two dumbbells', 'Incline bench']::text[], 'dumbbell_pair', 'Keep your chest on the bench and row both elbows back. Pause without shrugging.', null),
  ('seated-low-cable-row', 'Seated low-cable row', 'pull', 'horizontal', array['office']::text[], array['Low cable station', 'Row handle']::text[], 'cable_stack', 'Sit tall, brace your feet, and pull the handle to your lower ribs without swinging.', null),
  ('one-arm-dumbbell-row', 'One-arm dumbbell row', 'pull', 'horizontal', array['office']::text[], array['One dumbbell', 'Bench']::text[], 'dumbbell_single', 'Brace on the bench, keep your spine long, and row the dumbbell toward your hip.', null),
  ('standing-single-arm-cable-row', 'Standing single-arm cable row', 'pull', 'horizontal', array['office']::text[], array['Middle cable station', 'Single handle']::text[], 'cable_stack', 'Stand square and braced. Row to your ribs without twisting your torso.', null),
  ('kneeling-two-arm-band-lat-pulldown', 'Kneeling two-arm band lat pulldown', 'pull', 'vertical', array['home']::text[], array['Resistance band', 'High door anchor']::text[], 'band', 'Kneel beneath the high anchor and pull both elbows down toward your sides while staying tall.', null),
  ('half-kneeling-single-arm-band-lat-pulldown', 'Half-kneeling single-arm band lat pulldown', 'pull', 'vertical', array['home']::text[], array['Resistance band', 'High door anchor']::text[], 'band', 'Keep your ribs down and pull one elbow toward your hip without leaning or rotating.', null),
  ('straight-arm-band-pulldown', 'Straight-arm band pulldown', 'pull', 'vertical', array['home']::text[], array['Resistance band', 'High door anchor']::text[], 'band', 'With a soft elbow bend, sweep the band from shoulder height to your thighs without arching your back.', null),
  ('one-arm-dumbbell-row-thigh-braced', 'One-arm dumbbell row braced against the thigh', 'pull', 'horizontal', array['home']::text[], array['One dumbbell']::text[], 'dumbbell_single', 'Hinge and brace the free hand on your thigh. Row toward your hip without rotating.', null),
  ('two-dumbbell-bent-over-row', 'Two-dumbbell bent-over row', 'pull', 'horizontal', array['home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Hinge with a flat back and row both dumbbells toward your hips. Keep your torso fixed.', null),
  ('seated-resistance-band-row', 'Seated resistance-band row', 'pull', 'horizontal', array['home']::text[], array['Resistance band', 'Low door anchor']::text[], 'band', 'Sit tall facing the low anchor and pull toward your ribs. Avoid leaning back to finish the rep.', null),
  ('dumbbell-romanian-deadlift', 'Dumbbell Romanian deadlift', 'hamstring', 'hinge', array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Push your hips back with soft knees and keep the dumbbells close. Stop when your hamstrings limit the hinge.', null),
  ('b-stance-dumbbell-romanian-deadlift', 'B-stance dumbbell Romanian deadlift', 'hamstring', 'hinge', array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Place the support foot slightly behind. Load the front leg and hinge your hips straight back.', null),
  ('single-leg-dumbbell-romanian-deadlift', 'Single-leg dumbbell Romanian deadlift', 'hamstring', 'hinge', array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Keep your hips square as the free leg reaches back. Hinge over the planted leg with control.', null),
  ('cable-pull-through', 'Cable pull-through', 'hamstring', 'hinge', array['office']::text[], array['Low cable station', 'Rope attachment']::text[], 'cable_stack', 'Face away from the stack, hinge back, then squeeze your glutes to stand without leaning backward.', null),
  ('standing-single-leg-cable-hamstring-curl', 'Standing single-leg cable hamstring curl', 'hamstring', 'curl', array['office']::text[], array['Low cable station', 'Cable ankle cuff']::text[], 'cable_stack', 'Keep both thighs aligned and curl your heel toward your glute without arching your back.', null),
  ('prone-cable-hamstring-curl-bench', 'Prone cable hamstring curl on the bench', 'hamstring', 'curl', array['office']::text[], array['Low cable station', 'Cable ankle cuff', 'Bench']::text[], 'cable_stack', 'Lie face down with hips heavy on the bench. Curl your heel in without lifting the thigh.', null),
  ('seated-cable-hamstring-curl-bench', 'Seated cable hamstring curl on the bench', 'hamstring', 'curl', array['office']::text[], array['Low cable station', 'Cable ankle cuff', 'Bench']::text[], 'cable_stack', 'Sit tall with the cuff attached and curl your heel beneath the bench while keeping the thigh still.', null),
  ('prone-dumbbell-hamstring-curl-bench', 'Prone dumbbell hamstring curl on the bench', 'hamstring', 'curl', array['office']::text[], array['One dumbbell', 'Bench']::text[], 'dumbbell_single', 'Secure a light dumbbell between your feet and curl slowly. Keep your hips pressed into the bench.', null),
  ('resistance-band-good-morning', 'Resistance-band good morning', 'hamstring', 'hinge', array['home']::text[], array['Resistance band']::text[], 'band', 'Stand on the band with it across your shoulders. Push your hips back, then stand tall under control.', null),
  ('prone-band-hamstring-curl-floor', 'Prone band hamstring curl on the floor', 'hamstring', 'curl', array['home']::text[], array['Resistance band', 'Low door anchor']::text[], 'band', 'Lie face down and curl both heels toward your glutes. Keep your hips and thighs down.', null),
  ('standing-single-leg-band-hamstring-curl', 'Standing single-leg band hamstring curl', 'hamstring', 'curl', array['home']::text[], array['Resistance band', 'Low door anchor']::text[], 'band', 'Face the anchor and curl one heel back while keeping your knees aligned and torso still.', null),
  ('seated-single-leg-band-hamstring-curl-floor', 'Seated single-leg band hamstring curl from the floor', 'hamstring', 'curl', array['home']::text[], array['Resistance band', 'Low door anchor']::text[], 'band', 'Sit facing the low anchor and pull one heel toward you while keeping the thigh still.', null),
  ('sliding-hamstring-curl', 'Sliding hamstring curl', 'hamstring', 'curl', array['home']::text[], array['Furniture sliders or towels', 'Smooth floor']::text[], 'bodyweight', 'Bridge your hips up, slide your heels away slowly, then curl them back without dropping your hips.', null),
  ('barbell-bench-press', 'Barbell bench press', 'push', 'horizontal', array['office']::text[], array['Barbell', 'Bench', 'Rack']::text[], 'barbell_total', 'Set your shoulder blades, lower the bar to your lower chest, and press while keeping your feet planted.', null),
  ('flat-dumbbell-bench-press', 'Flat dumbbell bench press', 'push', 'horizontal', array['office']::text[], array['Two dumbbells', 'Flat bench']::text[], 'dumbbell_pair', 'Keep your shoulder blades set and press both dumbbells up over your chest without bouncing.', null),
  ('incline-dumbbell-bench-press', 'Incline dumbbell bench press', 'push', 'horizontal', array['office']::text[], array['Two dumbbells', 'Incline bench']::text[], 'dumbbell_pair', 'Use a moderate incline, keep your shoulder blades set, and press without shrugging.', null),
  ('dumbbell-floor-press', 'Dumbbell floor press', 'push', 'horizontal', array['office', 'home']::text[], array['Two dumbbells', 'Floor']::text[], 'dumbbell_pair', 'Lie on the floor, pause your upper arms gently on the ground, and press the dumbbells over your chest.', null),
  ('standing-single-arm-cable-chest-press', 'Standing single-arm cable chest press', 'push', 'horizontal', array['office']::text[], array['Middle cable station', 'Single handle']::text[], 'cable_stack', 'Stand staggered and braced. Press forward without allowing your torso to rotate.', null),
  ('seated-dumbbell-shoulder-press', 'Seated dumbbell shoulder press', 'push', 'vertical', array['office']::text[], array['Two dumbbells', 'Adjustable bench']::text[], 'dumbbell_pair', 'Sit tall with back support and press overhead without flaring your ribs or shrugging.', null),
  ('standing-dumbbell-overhead-press', 'Standing dumbbell overhead press', 'push', 'vertical', array['office', 'home']::text[], array['Two dumbbells']::text[], 'dumbbell_pair', 'Brace your trunk and press both dumbbells overhead without leaning back.', null),
  ('half-kneeling-single-arm-cable-overhead-press', 'Half-kneeling single-arm cable overhead press', 'push', 'vertical', array['office']::text[], array['Low cable station', 'Single handle']::text[], 'cable_stack', 'Kneel with the working-side knee down and press overhead while keeping your ribs stacked.', null),
  ('single-arm-dumbbell-floor-press', 'Single-arm dumbbell floor press', 'push', 'horizontal', array['home']::text[], array['One dumbbell', 'Floor']::text[], 'dumbbell_single', 'Press one dumbbell from the floor while bracing hard enough to keep your torso square.', null),
  ('push-up', 'Push-up', 'push', 'horizontal', array['home']::text[], array['Floor']::text[], 'bodyweight', 'Keep a straight line from shoulders to heels and lower your chest between your hands with control.', null),
  ('standing-band-chest-press', 'Standing band chest press', 'push', 'horizontal', array['home']::text[], array['Resistance band', 'Middle door anchor']::text[], 'band', 'Face away from the anchor, brace in a staggered stance, and press forward without leaning.', null),
  ('half-kneeling-single-arm-dumbbell-overhead-press', 'Half-kneeling single-arm dumbbell overhead press', 'push', 'vertical', array['home']::text[], array['One dumbbell']::text[], 'dumbbell_single', 'Kneel with the working-side knee down and press overhead while keeping your torso tall.', null),
  ('standing-band-overhead-press', 'Standing band overhead press', 'push', 'vertical', array['home']::text[], array['Resistance band']::text[], 'band', 'Stand evenly on the band, brace, and press overhead without leaning back.', null);

insert into public.workout_templates (id, location, workout_day, first_superset) values
  ('office-day-1', 'office', 1, 'A'),
  ('office-day-2', 'office', 2, 'B'),
  ('office-day-3', 'office', 3, 'A'),
  ('home-day-1', 'home', 1, 'A'),
  ('home-day-2', 'home', 2, 'B'),
  ('home-day-3', 'home', 3, 'A');

insert into public.workout_template_slots (id, template_id, slot_position, superset, scheduled_exercise_id, target_sets, rep_min, rep_max, per_side) values
  ('office-day-1-slot-1', 'office-day-1', 1, 'A', 'double-dumbbell-front-squat', 3, 6, 8, false),
  ('office-day-1-slot-2', 'office-day-1', 2, 'A', 'kneeling-cable-lat-pulldown', 3, 8, 10, false),
  ('office-day-1-slot-3', 'office-day-1', 3, 'B', 'standing-single-leg-cable-hamstring-curl', 3, 10, 12, true),
  ('office-day-1-slot-4', 'office-day-1', 4, 'B', 'barbell-bench-press', 3, 10, 12, false),
  ('office-day-2-slot-1', 'office-day-2', 1, 'B', 'dumbbell-romanian-deadlift', 3, 6, 8, false),
  ('office-day-2-slot-2', 'office-day-2', 2, 'B', 'seated-dumbbell-shoulder-press', 3, 8, 10, false),
  ('office-day-2-slot-3', 'office-day-2', 3, 'A', 'dumbbell-bulgarian-split-squat', 3, 10, 12, true),
  ('office-day-2-slot-4', 'office-day-2', 4, 'A', 'chest-supported-dumbbell-row', 3, 10, 12, false),
  ('office-day-3-slot-1', 'office-day-3', 1, 'A', 'heel-elevated-dumbbell-squat', 3, 6, 8, false),
  ('office-day-3-slot-2', 'office-day-3', 2, 'A', 'straight-arm-cable-pulldown', 3, 8, 10, false),
  ('office-day-3-slot-3', 'office-day-3', 3, 'B', 'single-leg-dumbbell-romanian-deadlift', 3, 10, 12, true),
  ('office-day-3-slot-4', 'office-day-3', 4, 'B', 'incline-dumbbell-bench-press', 3, 10, 12, false),
  ('home-day-1-slot-1', 'home-day-1', 1, 'A', 'dumbbell-goblet-squat', 3, 6, 8, false),
  ('home-day-1-slot-2', 'home-day-1', 2, 'A', 'kneeling-two-arm-band-lat-pulldown', 3, 8, 10, false),
  ('home-day-1-slot-3', 'home-day-1', 3, 'B', 'prone-band-hamstring-curl-floor', 3, 10, 12, false),
  ('home-day-1-slot-4', 'home-day-1', 4, 'B', 'dumbbell-floor-press', 3, 10, 12, false),
  ('home-day-2-slot-1', 'home-day-2', 1, 'B', 'b-stance-dumbbell-romanian-deadlift', 3, 6, 8, false),
  ('home-day-2-slot-2', 'home-day-2', 2, 'B', 'standing-dumbbell-overhead-press', 3, 8, 10, false),
  ('home-day-2-slot-3', 'home-day-2', 3, 'A', 'band-resisted-squat', 3, 10, 12, false),
  ('home-day-2-slot-4', 'home-day-2', 4, 'A', 'one-arm-dumbbell-row-thigh-braced', 3, 10, 12, true),
  ('home-day-3-slot-1', 'home-day-3', 1, 'A', 'dumbbell-split-squat', 3, 6, 8, true),
  ('home-day-3-slot-2', 'home-day-3', 2, 'A', 'straight-arm-band-pulldown', 3, 8, 10, false),
  ('home-day-3-slot-3', 'home-day-3', 3, 'B', 'seated-single-leg-band-hamstring-curl-floor', 3, 10, 12, true),
  ('home-day-3-slot-4', 'home-day-3', 4, 'B', 'standing-band-chest-press', 3, 10, 12, false);

commit;
