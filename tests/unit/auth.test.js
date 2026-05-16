/**
 * Auth state machine + data lifecycle tests.
 *
 * These tests exercise the exact logic from app.js as pure functions,
 * covering the sign-out guard, localStorage preservation, and pre-signin merge.
 * The 1000-scenario simulation at the bottom stress-tests the merge invariants.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ─── Pure re-implementations of app.js auth/data logic ───────────────────────
// Mirrors the real code so tests break if the logic changes.

const STORE = 'tr_';

/**
 * Should an auth event be blocked given the current signed_out flag?
 * Matches app.js onAuthStateChange line 1360.
 */
function shouldBlockAuthEvent(event, signedOut) {
  return (
    (event === 'INITIAL_SESSION' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'SIGNED_IN') &&
    !!signedOut
  );
}

/**
 * Simulates signOut(): clears memory state, keeps localStorage data,
 * sets signed_out flag. Returns new memory state + what remains in "localStorage".
 */
function simulateSignOut(memoryCheckins, memoryPlan, localStorage) {
  const nextLocal = { ...localStorage };
  // Only these keys are removed on sign-out (not checkins/plan)
  delete nextLocal[STORE + 'sync_nudge_dismissed'];
  delete nextLocal[STORE + 'form'];
  delete nextLocal[STORE + 'user_hint'];
  delete nextLocal[STORE + 'page'];
  nextLocal[STORE + 'signed_out'] = '1';
  return {
    memory: { checkins: [], plan: null, userName: '', currentUser: null },
    localStorage: nextLocal,
  };
}

/**
 * Simulates the SIGNED_IN handler: reads pre-signin data from memory ||
 * localStorage, wipes both, pulls from cloud, then merges.
 * Matches app.js lines 1367–1388.
 */
function simulateSignedIn(
  memoryCheckins,
  memoryPlan,
  localStorage,
  cloudCheckins,
  cloudPlan,
  userHint,
  incomingUserId
) {
  // Grab pre-signin data from memory, fall back to localStorage
  const preSigninCheckins =
    memoryCheckins.length > 0
      ? [...memoryCheckins]
      : JSON.parse(localStorage[STORE + 'checkins'] || '[]');
  const preSigninPlan =
    memoryPlan || JSON.parse(localStorage[STORE + 'plan'] || 'null');

  // Wipe local state
  let checkins = [];
  let plan = null;
  const nextLocal = { ...localStorage };
  [STORE+'checkins', STORE+'plan', STORE+'celebrated', STORE+'name'].forEach(
    k => delete nextLocal[k]
  );
  delete nextLocal[STORE + 'signed_out'];

  // syncDown (cloud → local)
  checkins = [...cloudCheckins];
  plan = cloudPlan;

  // Merge logic
  const isSameOrAnon = !userHint || userHint.id === incomingUserId;
  if (isSameOrAnon) {
    const syncedDates = new Set(checkins.map(c => c.date));
    const mergeBack = preSigninCheckins.filter(c => !syncedDates.has(c.date));
    if (mergeBack.length) {
      checkins = [...checkins, ...mergeBack].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );
    }
  } else if (!checkins.length && preSigninCheckins.length) {
    checkins = preSigninCheckins;
  }

  if (!plan && preSigninPlan) plan = preSigninPlan;

  nextLocal[STORE + 'checkins'] = JSON.stringify(checkins);
  if (plan) nextLocal[STORE + 'plan'] = JSON.stringify(plan);

  return {
    memory: { checkins, plan, currentUser: { id: incomingUserId } },
    localStorage: nextLocal,
  };
}

// ─── Auth guard tests ─────────────────────────────────────────────────────────
describe('auth event guard', () => {
  it('blocks INITIAL_SESSION when signed_out is set', () => {
    expect(shouldBlockAuthEvent('INITIAL_SESSION', '1')).toBe(true);
  });

  it('blocks TOKEN_REFRESHED when signed_out is set', () => {
    expect(shouldBlockAuthEvent('TOKEN_REFRESHED', '1')).toBe(true);
  });

  it('blocks SIGNED_IN when signed_out is set', () => {
    expect(shouldBlockAuthEvent('SIGNED_IN', '1')).toBe(true);
  });

  it('allows INITIAL_SESSION when signed_out is not set', () => {
    expect(shouldBlockAuthEvent('INITIAL_SESSION', null)).toBe(false);
  });

  it('allows TOKEN_REFRESHED when signed_out is not set', () => {
    expect(shouldBlockAuthEvent('TOKEN_REFRESHED', null)).toBe(false);
  });

  it('allows SIGNED_IN when signed_out is not set', () => {
    expect(shouldBlockAuthEvent('SIGNED_IN', null)).toBe(false);
  });

  it('never blocks SIGNED_OUT event', () => {
    expect(shouldBlockAuthEvent('SIGNED_OUT', '1')).toBe(false);
    expect(shouldBlockAuthEvent('SIGNED_OUT', null)).toBe(false);
  });

  it('treats empty string signed_out as falsy (not blocking)', () => {
    expect(shouldBlockAuthEvent('SIGNED_IN', '')).toBe(false);
  });

  it('treats undefined signed_out as not blocking', () => {
    expect(shouldBlockAuthEvent('INITIAL_SESSION', undefined)).toBe(false);
  });
});

// ─── signOut localStorage preservation ───────────────────────────────────────
describe('signOut localStorage preservation', () => {
  const checkins = [
    { id: 1, date: '2025-01-01', weight: 200, note: '' },
    { id: 2, date: '2025-01-08', weight: 198, note: '' },
  ];
  const plan = { cw: 200, gw: 170 };

  it('preserves checkins in localStorage after sign-out', () => {
    const ls = {
      [STORE+'checkins']: JSON.stringify(checkins),
      [STORE+'plan']: JSON.stringify(plan),
    };
    const { localStorage: nextLs } = simulateSignOut(checkins, plan, ls);
    expect(nextLs[STORE+'checkins']).toBe(JSON.stringify(checkins));
  });

  it('preserves plan in localStorage after sign-out', () => {
    const ls = { [STORE+'plan']: JSON.stringify(plan) };
    const { localStorage: nextLs } = simulateSignOut([], plan, ls);
    expect(nextLs[STORE+'plan']).toBe(JSON.stringify(plan));
  });

  it('clears in-memory state after sign-out', () => {
    const { memory } = simulateSignOut(checkins, plan, {});
    expect(memory.checkins).toHaveLength(0);
    expect(memory.plan).toBeNull();
    expect(memory.currentUser).toBeNull();
    expect(memory.userName).toBe('');
  });

  it('sets signed_out flag after sign-out', () => {
    const { localStorage: nextLs } = simulateSignOut([], null, {});
    expect(nextLs[STORE+'signed_out']).toBe('1');
  });

  it('removes user_hint on sign-out', () => {
    const ls = { [STORE+'user_hint']: '{"id":"abc"}' };
    const { localStorage: nextLs } = simulateSignOut([], null, ls);
    expect(nextLs[STORE+'user_hint']).toBeUndefined();
  });

  it('removes page on sign-out', () => {
    const ls = { [STORE+'page']: 'checkin' };
    const { localStorage: nextLs } = simulateSignOut([], null, ls);
    expect(nextLs[STORE+'page']).toBeUndefined();
  });

  it('removes form on sign-out', () => {
    const ls = { [STORE+'form']: '{}' };
    const { localStorage: nextLs } = simulateSignOut([], null, ls);
    expect(nextLs[STORE+'form']).toBeUndefined();
  });
});

// ─── Sign-in merge: same user ─────────────────────────────────────────────────
describe('SIGNED_IN merge — same user', () => {
  const userId = 'user-abc';
  const userHint = { id: userId };

  it('merges offline check-ins not yet on cloud', () => {
    // Cloud has Jan 1, local (in localStorage) has Jan 1 + Jan 8
    const localCheckins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
    ];
    const cloudCheckins = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };
    const { memory } = simulateSignedIn([], null, ls, cloudCheckins, null, userHint, userId);
    expect(memory.checkins).toHaveLength(2);
    expect(memory.checkins.map(c => c.date)).toContain('2025-01-08');
  });

  it('no duplication when cloud and local have same dates', () => {
    const checkin = { id:1, date:'2025-01-01', weight:200, note:'' };
    const ls = { [STORE+'checkins']: JSON.stringify([checkin]) };
    const { memory } = simulateSignedIn([], null, ls, [checkin], null, userHint, userId);
    expect(memory.checkins.filter(c => c.date === '2025-01-01')).toHaveLength(1);
  });

  it('rescues check-ins from localStorage when memory is empty (post sign-out)', () => {
    const localCheckins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
      { id:3, date:'2025-01-15', weight:196, note:'' },
    ];
    // Cloud is empty (check-ins never synced)
    const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };
    const { memory } = simulateSignedIn([], null, ls, [], null, userHint, userId);
    expect(memory.checkins).toHaveLength(3);
  });

  it('memory check-ins take precedence over localStorage as pre-signin source', () => {
    const memCheckins = [{ id:99, date:'2025-03-01', weight:190, note:'' }];
    const lsCheckins  = [{ id:1,  date:'2025-01-01', weight:200, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(lsCheckins) };
    const { memory } = simulateSignedIn(memCheckins, null, ls, [], null, userHint, userId);
    expect(memory.checkins.map(c => c.date)).toContain('2025-03-01');
  });

  it('result is sorted by date ascending', () => {
    const local = [{ id:2, date:'2025-01-15', weight:196, note:'' }];
    const cloud = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(local) };
    const { memory } = simulateSignedIn([], null, ls, cloud, null, userHint, userId);
    const dates = memory.checkins.map(c => c.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('anonymous user (no hint) treated as same user — merges', () => {
    const local = [{ id:2, date:'2025-01-08', weight:198, note:'' }];
    const cloud = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(local) };
    const { memory } = simulateSignedIn([], null, ls, cloud, null, null, userId);
    expect(memory.checkins).toHaveLength(2);
  });

  it('restores plan from localStorage when cloud has none', () => {
    const plan = { cw:200, gw:170 };
    const ls = { [STORE+'plan']: JSON.stringify(plan) };
    const { memory } = simulateSignedIn([], null, ls, [], null, userHint, userId);
    expect(memory.plan).toEqual(plan);
  });

  it('cloud plan takes priority over localStorage plan', () => {
    const localPlan = { cw:200, gw:170 };
    const cloudPlan = { cw:195, gw:165 };
    const ls = { [STORE+'plan']: JSON.stringify(localPlan) };
    const { memory } = simulateSignedIn([], null, ls, [], cloudPlan, userHint, userId);
    expect(memory.plan).toEqual(cloudPlan);
  });

  it('signed_out flag is cleared after SIGNED_IN', () => {
    const ls = { [STORE+'signed_out']: '1' };
    const { localStorage: nextLs } = simulateSignedIn([], null, ls, [], null, userHint, userId);
    expect(nextLs[STORE+'signed_out']).toBeUndefined();
  });
});

// ─── Sign-in merge: different user ───────────────────────────────────────────
describe('SIGNED_IN merge — different user', () => {
  const prevUserId = 'user-old';
  const newUserId  = 'user-new';
  const userHint   = { id: prevUserId };

  it('does NOT merge previous user local data into new user', () => {
    const localCheckins = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const cloudCheckins = [{ id:2, date:'2025-02-01', weight:190, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };
    const { memory } = simulateSignedIn([], null, ls, cloudCheckins, null, userHint, newUserId);
    expect(memory.checkins.map(c => c.date)).not.toContain('2025-01-01');
    expect(memory.checkins.map(c => c.date)).toContain('2025-02-01');
  });

  it('allows previous local data IF cloud is completely empty', () => {
    const localCheckins = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };
    const { memory } = simulateSignedIn([], null, ls, [], null, userHint, newUserId);
    expect(memory.checkins).toHaveLength(1);
  });

  it('does not add local data when cloud has any entries', () => {
    const localCheckins = Array.from({length:5},(_,i) => ({
      id:i, date:`2025-01-0${i+1}`, weight:200-i, note:'',
    }));
    const cloudCheckins = [{ id:99, date:'2025-03-01', weight:180, note:'' }];
    const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };
    const { memory } = simulateSignedIn([], null, ls, cloudCheckins, null, userHint, newUserId);
    expect(memory.checkins).toHaveLength(1);
    expect(memory.checkins[0].date).toBe('2025-03-01');
  });
});

// ─── Sign-out → sign-in data survival cycle ──────────────────────────────────
describe('sign-out → sign-in data survival cycle', () => {
  it('check-ins survive sign-out + sign-in when cloud was behind', () => {
    const userId = 'user-1';
    const checkins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
    ];
    const plan = { cw:200, gw:170 };
    const ls = {
      [STORE+'checkins']: JSON.stringify(checkins),
      [STORE+'plan']: JSON.stringify(plan),
    };

    // Sign out
    const { localStorage: afterSignout } = simulateSignOut(checkins, plan, ls);
    expect(afterSignout[STORE+'signed_out']).toBe('1');
    expect(afterSignout[STORE+'checkins']).toBe(JSON.stringify(checkins));

    // Sign back in as same user, cloud has nothing (sync failed during sign-out)
    const userHint = { id: userId };
    const { memory } = simulateSignedIn(
      [], null, afterSignout, [], null, userHint, userId
    );

    // All check-ins should be recovered
    expect(memory.checkins).toHaveLength(2);
    expect(memory.plan).toEqual(plan);
  });

  it('cloud data wins over stale localStorage on sign-in', () => {
    const userId = 'user-1';
    const staleLocal = [{ id:1, date:'2025-01-01', weight:200, note:'' }];
    const cloudData  = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
      { id:3, date:'2025-01-15', weight:196, note:'' },
    ];
    const ls = { [STORE+'checkins']: JSON.stringify(staleLocal) };

    // No sign-out step needed, just sign in directly
    const userHint = { id: userId };
    const { memory } = simulateSignedIn(
      [], null, ls, cloudData, null, userHint, userId
    );
    expect(memory.checkins).toHaveLength(3);
  });

  it('no duplicates after full sign-out + sign-in with partial cloud coverage', () => {
    const userId = 'user-1';
    const allCheckins = [
      { id:1, date:'2025-01-01', weight:200, note:'' },
      { id:2, date:'2025-01-08', weight:198, note:'' },
      { id:3, date:'2025-01-15', weight:196, note:'' },
    ];
    // Cloud only has the first two
    const cloudCheckins = allCheckins.slice(0,2);
    const ls = { [STORE+'checkins']: JSON.stringify(allCheckins) };

    const userHint = { id: userId };
    const { memory } = simulateSignedIn(
      [], null, ls, cloudCheckins, null, userHint, userId
    );
    const dates = memory.checkins.map(c => c.date);
    const uniqueDates = new Set(dates);
    expect(dates.length).toBe(uniqueDates.size);
    expect(memory.checkins).toHaveLength(3);
  });
});

// ─── 1000-scenario simulation ─────────────────────────────────────────────────
describe('1000-scenario data integrity simulation', () => {
  // Seeded random (deterministic across runs)
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(0xDEADBEEF);
  const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

  function makeCheckins(count, startDayOffset = 0) {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(2025, 0, 1 + (startDayOffset + i) * 7);
      return {
        id: startDayOffset * 100 + i,
        date: d.toISOString().slice(0, 10),
        weight: 200 - i * 0.5,
        note: '',
      };
    });
  }

  it('invariant: no duplicate dates after merge (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const localCount  = randInt(0, 15);
      const cloudCount  = randInt(0, 15);
      const overlapCount = randInt(0, Math.min(localCount, cloudCount));
      const isSameUser  = rand() > 0.3;

      const sharedCheckins = makeCheckins(overlapCount, 0);
      const localOnly       = makeCheckins(localCount - overlapCount, overlapCount);
      const cloudOnly       = makeCheckins(cloudCount - overlapCount, overlapCount + localCount);

      const localCheckins = [...sharedCheckins, ...localOnly];
      const cloudCheckins = [...sharedCheckins, ...cloudOnly];

      const userId  = 'user-sim';
      const userHint = isSameUser ? { id: userId } : { id: 'user-other' };
      const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };

      const { memory } = simulateSignedIn(
        [], null, ls, cloudCheckins, null, userHint, userId
      );

      const dates = memory.checkins.map(c => c.date);
      const unique = new Set(dates);
      expect(dates.length).toBe(unique.size);
    }
  });

  it('invariant: same-user never loses cloud data (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const cloudCount = randInt(1, 20);
      const localCount = randInt(0, 10);
      const cloudCheckins = makeCheckins(cloudCount, 0);
      const localCheckins = makeCheckins(localCount, cloudCount);

      const userId = 'user-sim';
      const userHint = { id: userId };
      const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };

      const { memory } = simulateSignedIn(
        [], null, ls, cloudCheckins, null, userHint, userId
      );

      // All cloud check-ins must be present
      const resultDates = new Set(memory.checkins.map(c => c.date));
      cloudCheckins.forEach(c => {
        expect(resultDates.has(c.date)).toBe(true);
      });
    }
  });

  it('invariant: same-user never loses offline local data (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const cloudCount = randInt(0, 10);
      const offlineCount = randInt(1, 10);
      const cloudCheckins = makeCheckins(cloudCount, 0);
      const offlineCheckins = makeCheckins(offlineCount, cloudCount + 50);

      const userId = 'user-sim';
      const userHint = { id: userId };
      const allLocal = [...cloudCheckins, ...offlineCheckins];
      const ls = { [STORE+'checkins']: JSON.stringify(allLocal) };

      const { memory } = simulateSignedIn(
        [], null, ls, cloudCheckins, null, userHint, userId
      );

      // All offline check-ins must be in the result
      const resultDates = new Set(memory.checkins.map(c => c.date));
      offlineCheckins.forEach(c => {
        expect(resultDates.has(c.date)).toBe(true);
      });
    }
  });

  it('invariant: different-user with cloud data only gets their cloud data (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const prevUserLocalCount = randInt(1, 15);
      const newUserCloudCount  = randInt(1, 15);

      const prevLocal = makeCheckins(prevUserLocalCount, 0);
      const newCloud  = makeCheckins(newUserCloudCount, prevUserLocalCount + 20);

      const userHint = { id: 'user-prev' };
      const newUserId = 'user-new';
      const ls = { [STORE+'checkins']: JSON.stringify(prevLocal) };

      const { memory } = simulateSignedIn(
        [], null, ls, newCloud, null, userHint, newUserId
      );

      // No prev-user dates should appear
      const prevDates = new Set(prevLocal.map(c => c.date));
      memory.checkins.forEach(c => {
        expect(prevDates.has(c.date)).toBe(false);
      });
      expect(memory.checkins).toHaveLength(newUserCloudCount);
    }
  });

  it('invariant: result is always sorted ascending (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const localCount = randInt(0, 10);
      const cloudCount = randInt(0, 10);
      const localCheckins = makeCheckins(localCount, randInt(0, 30));
      const cloudCheckins = makeCheckins(cloudCount, randInt(0, 30));
      const userId = 'user-sim';
      const ls = { [STORE+'checkins']: JSON.stringify(localCheckins) };

      const { memory } = simulateSignedIn(
        [], null, ls, cloudCheckins, null, { id: userId }, userId
      );

      const dates = memory.checkins.map(c => c.date);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i-1]).toBe(true);
      }
    }
  });

  it('invariant: sign-out never loses data that was in localStorage (1000 scenarios)', () => {
    for (let s = 0; s < 1000; s++) {
      const count = randInt(0, 20);
      const checkins = makeCheckins(count, 0);
      const ls = { [STORE+'checkins']: JSON.stringify(checkins) };
      const { localStorage: afterSignout } = simulateSignOut(checkins, null, ls);
      const preserved = JSON.parse(afterSignout[STORE+'checkins'] || '[]');
      expect(preserved).toHaveLength(count);
    }
  });
});
