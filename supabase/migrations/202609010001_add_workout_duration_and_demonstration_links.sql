begin;

alter table public.workout_sessions
  add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_sessions_duration_seconds_check'
      and conrelid = 'public.workout_sessions'::regclass
  ) then
    alter table public.workout_sessions
      add constraint workout_sessions_duration_seconds_check
      check (duration_seconds is null or duration_seconds >= 0)
      not valid;

    alter table public.workout_sessions
      validate constraint workout_sessions_duration_seconds_check;
  end if;
end
$$;

comment on column public.workout_sessions.duration_seconds is
  'Elapsed workout time in whole seconds, excluding pauses. Null means the timer was never started.';

update public.exercises as exercise
set demonstration_url = links.demonstration_url
from (
  values
    ('double-dumbbell-front-squat', 'https://www.crossfit.com/essentials/the-dumbbell-front-squat'),
    ('dumbbell-goblet-squat', 'https://www.muscleandstrength.com/exercises/dumbbell-goblet-squat'),
    ('heel-elevated-dumbbell-squat', 'https://www.youtube.com/watch?v=WB8vkcytauI'),
    ('dumbbell-bulgarian-split-squat', 'https://www.muscleandstrength.com/exercises/one-leg-dumbbell-squat-aka-bulgarian-squat.html'),
    ('dumbbell-split-squat', 'https://www.muscleandstrength.com/exercises/dumbbell-split-squat'),
    ('cable-front-squat', 'https://www.youtube.com/watch?v=0eNLyqyVm6M'),
    ('heel-elevated-goblet-squat', 'https://www.menshealth.com/fitness/a42362207/heel-elevated-goblet-squat/'),
    ('band-resisted-squat', 'https://www.youtube.com/watch?v=duP-UZsfOaQ'),
    ('kneeling-cable-lat-pulldown', 'https://www.puregym.com/exercises/back/lat-exercises/kneeling-lat-pulldown/'),
    ('half-kneeling-single-arm-cable-pulldown', 'https://www.youtube.com/watch?v=Vu3OrBHrMNk'),
    ('straight-arm-cable-pulldown', 'https://www.muscleandstrength.com/exercises/straight-arm-lat-pull-down.html'),
    ('chest-supported-dumbbell-row', 'https://www.muscleandstrength.com/exercises/chest-supported-dumbbell-row'),
    ('seated-low-cable-row', 'https://www.muscleandstrength.com/exercises/seated-row.html'),
    ('one-arm-dumbbell-row', 'https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/'),
    ('standing-single-arm-cable-row', 'https://www.youtube.com/watch?v=_z5NMUxkxxw'),
    ('kneeling-two-arm-band-lat-pulldown', 'https://library.theprehabguys.com/vimeo-video/tall-kneeling-lat-pull-down-band/'),
    ('half-kneeling-single-arm-band-lat-pulldown', 'https://library.theprehabguys.com/vimeo-video/half-kneeling-lat-pulldown/'),
    ('straight-arm-band-pulldown', 'https://ie.physitrack.com/home-exercise-video/resisted-bent-over-straight-arm-pull-down'),
    ('two-dumbbell-bent-over-row', 'https://www.muscleandstrength.com/exercises/bent-over-dumbbell-row.html'),
    ('seated-resistance-band-row', 'https://www.setforset.com/blogs/news/resistance-band-rows'),
    ('dumbbell-romanian-deadlift', 'https://www.nasm.org/resource-center/exercise-library/dumbbell-romanian-deadlift'),
    ('b-stance-dumbbell-romanian-deadlift', 'https://www.youtube.com/watch?v=PX7He7WbINg'),
    ('single-leg-dumbbell-romanian-deadlift', 'https://www.hevyapp.com/exercises/how-to-single-leg-romanian-deadlift-dumbbell/'),
    ('cable-pull-through', 'https://sweat.com/exercises/cable-pull-through'),
    ('standing-single-leg-cable-hamstring-curl', 'https://www.muscleandstrength.com/exercises/standing-cable-hamstring-curl.html'),
    ('prone-cable-hamstring-curl-bench', 'https://www.muscleandstrength.com/exercises/one-leg-lying-cable-hamstring-curl.html'),
    ('seated-cable-hamstring-curl-bench', 'https://us.physitrack.com/home-exercise-video/cable-machine-seated-leg-curl-%2528hamstrings%2529'),
    ('prone-dumbbell-hamstring-curl-bench', 'https://www.muscleandstrength.com/exercises/dumbbell-hamstring-curl.html'),
    ('resistance-band-good-morning', 'https://fitbod.me/exercises/loop-band-good-morning'),
    ('standing-single-leg-band-hamstring-curl', 'https://fitbod.me/exercises/standing-loop-band-hamstring-curl'),
    ('sliding-hamstring-curl', 'https://www.self.com/story/hamstring-curls-blake-livelys-trainer'),
    ('barbell-bench-press', 'https://www.muscleandstrength.com/exercises/barbell-bench-press.html'),
    ('flat-dumbbell-bench-press', 'https://www.muscleandstrength.com/exercises/dumbbell-bench-press.html'),
    ('incline-dumbbell-bench-press', 'https://www.muscleandstrength.com/exercises/incline-dumbbell-bench-press.html'),
    ('dumbbell-floor-press', 'https://www.muscleandstrength.com/exercises/dumbbell-floor-press.html'),
    ('standing-single-arm-cable-chest-press', 'https://www.youtube.com/watch?v=dDxpCUfmcLU'),
    ('seated-dumbbell-shoulder-press', 'https://www.muscleandstrength.com/exercises/seated-dumbbell-press.html'),
    ('standing-dumbbell-overhead-press', 'https://www.muscleandstrength.com/exercises/standing-dumbbell-press.html'),
    ('half-kneeling-single-arm-cable-overhead-press', 'https://www.hertssportsvillage.co.uk/half-kneeling-cable-overhead-press-training-video-138'),
    ('single-arm-dumbbell-floor-press', 'https://ericcressey.com/strength-exercise-of-the-week-1-arm-dumbbell-floor-press/'),
    ('push-up', 'https://www.nasm.org/resource-center/blog/training/proper-push-up-form-and-technique-a-complete-guide'),
    ('standing-band-chest-press', 'https://www.youtube.com/watch?v=6-86jEAXA08'),
    ('half-kneeling-single-arm-dumbbell-overhead-press', 'https://www.youtube.com/watch?v=7oeFpnRCJkY'),
    ('standing-band-overhead-press', 'https://www.muscleandstrength.com/exercises/banded-standing-shoulder-press')
) as links(exercise_id, demonstration_url)
where exercise.id = links.exercise_id;

commit;
