import { RunRecord } from '../services/history';

export type Tier = 'locked' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary' | 'mythic';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: Tier;
  achieved: boolean;
  progress: number;
  progressLabel: string;
  xp: number;
};

export function computeAchievements(history: RunRecord[]): Achievement[] {
  const runs = history.length;
  const totalDist = history.reduce((a, r) => a + (r.distanceMeters || 0), 0);
  const totalArea = history.reduce((a, r) => a + (r.areaSqMeters || 0), 0);
  const loops = history.filter(r => (r.areaSqMeters || 0) > 100).length;
  const totalDur = history.reduce((a, r) => a + (r.durationSec || 0), 0);

  const days = Array.from(new Set(history.map(r => new Date(r.createdAt).toDateString()))).sort();
  let maxStreak = 0, streak = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { streak = 1; }
    else {
      const diff = Math.floor((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
      streak = diff === 1 ? streak + 1 : 1;
    }
    if (streak > maxStreak) maxStreak = streak;
  }

  const morningRuns = history.filter(r => new Date(r.createdAt).getHours() < 8).length;
  const bestRun = history.reduce((max, r) => r.distanceMeters > max ? r.distanceMeters : max, 0);

  function make(
    id: string, title: string, description: string, icon: string,
    value: number, target: number, tier: Tier, xp: number,
    labelFn: (v: number, t: number) => string
  ): Achievement {
    const achieved = value >= target;
    const progress = Math.min(value / target, 1);
    return {
      id, title, description, icon, tier: achieved ? tier : 'locked',
      achieved, progress, progressLabel: labelFn(Math.min(value, target), target), xp,
    };
  }

  return [
    make('first-run',    'First Step',         'Complete your first run',              'footsteps',   runs,      1,       'bronze',    50,   (v,t) => `${v}/${t} runs`),
    make('runs-5',       'Getting Started',    'Complete 5 runs',                      'walk',        runs,      5,       'bronze',    100,  (v,t) => `${v}/${t} runs`),
    make('runs-10',      'Regular Runner',     'Complete 10 runs',                     'fitness',     runs,      10,      'silver',    200,  (v,t) => `${v}/${t} runs`),
    make('runs-25',      'Dedicated Athlete',  'Complete 25 runs',                     'medal',       runs,      25,      'gold',      400,  (v,t) => `${v}/${t} runs`),
    make('runs-50',      'Iron Legs',          'Complete 50 runs',                     'trophy',      runs,      50,      'gold',      600,  (v,t) => `${v}/${t} runs`),
    make('runs-100',     'Century Runner',     'Complete 100 runs',                    'star',        runs,      100,     'diamond',   1000, (v,t) => `${v}/${t} runs`),
    make('runs-250',     'Unstoppable',        'Complete 250 runs',                    'flame',       runs,      250,     'legendary', 2000, (v,t) => `${v}/${t} runs`),
    make('runs-500',     'Eternal Runner',     'Complete 500 runs',                    'planet',      runs,      500,     'mythic',    5000, (v,t) => `${v}/${t} runs`),

    make('dist-1k',      '1K Starter',         'Run 1,000 m total',                    'trending-up', totalDist, 1000,    'bronze',    50,   (v,t) => `${Math.round(v)}/${t} m`),
    make('dist-5k',      '5K Warrior',         'Run 5,000 m total',                    'trending-up', totalDist, 5000,    'silver',    150,  (v,t) => `${Math.round(v)}/${t} m`),
    make('dist-10k',     '10K Champion',       'Run 10,000 m total',                   'trending-up', totalDist, 10000,   'silver',    250,  (v,t) => `${Math.round(v)}/${t} m`),
    make('dist-half',    'Half Hero',          'Run 21,097 m total',                   'medal',       totalDist, 21097,   'gold',      500,  (v,t) => `${Math.round(v)}/${t} m`),
    make('dist-marathon','Marathon Legend',    'Run 42,195 m total',                   'trophy',      totalDist, 42195,   'gold',      800,  (v,t) => `${Math.round(v)}/${t} m`),
    make('dist-100k',    'Ultra Runner',       'Run 100,000 m total',                  'rocket',      totalDist, 100000,  'diamond',   1500, (v,t) => `${Math.round(v/1000)}/${t/1000} km`),
    make('dist-500k',    'Road Conqueror',     'Run 500 km total',                     'flame',       totalDist, 500000,  'legendary', 3000, (v,t) => `${Math.round(v/1000)}/${t/1000} km`),
    make('dist-1000k',   'Transcendent',       'Run 1,000 km total',                   'planet',      totalDist, 1000000, 'mythic',    8000, (v,t) => `${Math.round(v/1000)}/${t/1000} km`),

    make('loop-1',       'Territory Maker',    'Complete your first closed loop run',  'map',         loops,     1,       'bronze',    100,  (v,t) => `${v}/${t} loops`),
    make('loop-5',       'Loop Builder',       'Complete 5 closed loop runs',          'git-commit',  loops,     5,       'silver',    200,  (v,t) => `${v}/${t} loops`),
    make('loop-20',      'Land Baron',         'Complete 20 closed loop runs',         'globe',       loops,     20,      'gold',      500,  (v,t) => `${v}/${t} loops`),
    make('loop-50',      'Empire Builder',     'Complete 50 closed loop runs',         'flag',        loops,     50,      'legendary', 1500, (v,t) => `${v}/${t} loops`),
    make('area-10k',     'Loop Explorer',      'Cover 10,000 m² in loop runs',         'expand',      totalArea, 10000,   'bronze',    150,  (v,t) => `${Math.round(v)}/${t} m²`),
    make('area-50k',     'Loop Conqueror',     'Cover 50,000 m² in loop runs',         'flag',        totalArea, 50000,   'gold',      400,  (v,t) => `${Math.round(v)}/${t} m²`),
    make('area-500k',    'Loop King',          'Cover 500,000 m² in loop runs',        'earth',       totalArea, 500000,  'diamond',   1200, (v,t) => `${Math.round(v/1000)}/${t/1000} km²`),
    make('area-5m',      'Loop God',           'Cover 5,000,000 m² in loop runs',      'planet',      totalArea, 5000000, 'mythic',    10000,(v,t) => `${Math.round(v/1000)}/${t/1000} km²`),

    make('streak-3',     '3-Day Streak',       'Run 3 days in a row',                  'flame',       maxStreak, 3,       'silver',    200,  (v,t) => `${v}/${t} days`),
    make('streak-7',     'Week Warrior',       'Run 7 days in a row',                  'calendar',    maxStreak, 7,       'gold',      500,  (v,t) => `${v}/${t} days`),
    make('streak-30',    'Monthly Master',     'Run 30 days in a row',                 'infinite',    maxStreak, 30,      'diamond',   1500, (v,t) => `${v}/${t} days`),
    make('streak-100',   'Centurion Streak',   'Run 100 days in a row',                'flame',       maxStreak, 100,     'legendary', 4000, (v,t) => `${v}/${t} days`),
    make('streak-365',   'Year of Running',    'Run every day for a year',             'planet',      maxStreak, 365,     'mythic',    15000,(v,t) => `${v}/${t} days`),

    make('morning-1',    'Early Bird',         'Complete a run before 8am',            'sunny',       morningRuns, 1,     'bronze',    100,  (v,t) => `${v}/${t} morning runs`),
    make('morning-10',   'Dawn Warrior',       'Complete 10 morning runs',             'sunny',       morningRuns, 10,    'gold',      400,  (v,t) => `${v}/${t} morning runs`),
    make('morning-50',   'Sunrise Legend',     'Complete 50 morning runs',             'sunny',       morningRuns, 50,    'legendary', 2000, (v,t) => `${v}/${t} morning runs`),
    make('best-5k',      'Speed Demon',        'Run 5km in a single session',          'speedometer', bestRun,   5000,    'silver',    300,  (v,t) => `${Math.round(v)}/${t} m best`),
    make('best-10k',     'Distance Master',    'Run 10km in a single session',         'speedometer', bestRun,   10000,   'gold',      600,  (v,t) => `${Math.round(v)}/${t} m best`),
    make('best-21k',     'Half Marathon Hero', 'Run 21km in a single session',         'speedometer', bestRun,   21000,   'legendary', 2500, (v,t) => `${Math.round(v)}/${t} m best`),
    make('time-1h',      'Hour Runner',        'Accumulate 1 hour of running',         'time',        totalDur,  3600,    'bronze',    150,  (v,t) => `${Math.round(v/60)}/${t/60} min`),
    make('time-10h',     'Time Investor',      'Accumulate 10 hours of running',       'time',        totalDur,  36000,   'gold',      600,  (v,t) => `${Math.round(v/3600)}/${t/3600} hrs`),
    make('time-100h',    'Century Hours',      'Accumulate 100 hours of running',      'time',        totalDur,  360000,  'legendary', 5000, (v,t) => `${Math.round(v/3600)}/${t/3600} hrs`),
    make('time-1000h',   'Immortal Runner',    'Accumulate 1,000 hours of running',    'planet',      totalDur,  3600000, 'mythic',    20000,(v,t) => `${Math.round(v/3600)}/${t/3600} hrs`),
  ];
}
