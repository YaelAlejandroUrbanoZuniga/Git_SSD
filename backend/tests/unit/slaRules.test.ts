import { describe, expect, it } from 'vitest';
import { daysSince, globalSlaForDays, resolveSla, slaForStage } from '../../src/domain/sla';

// A fixed clock, so "days ago" in these tests never depends on the real date.
const NOW = new Date('2026-07-16T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

describe('slaForStage — Parking Lot (green < 25, yellow 25–29, red >= 30)', () => {
  it.each([
    [0, 'green'],
    [24, 'green'],
    [25, 'yellow'],
    [29, 'yellow'],
    [30, 'red'],
    [365, 'red'],
  ])('%i days in Parking Lot ⇒ %s', (days, expected) => {
    expect(slaForStage('Parking Lot', days)).toBe(expected);
  });
});

describe('slaForStage — Preliminary Evaluation (green < 50, yellow 50–59, red >= 60)', () => {
  it.each([
    [0, 'green'],
    [49, 'green'],
    [50, 'yellow'],
    [59, 'yellow'],
    [60, 'red'],
    [365, 'red'],
  ])('%i days in Preliminary Evaluation ⇒ %s', (days, expected) => {
    expect(slaForStage('Preliminary Evaluation', days)).toBe(expected);
  });
});

describe('slaForStage — stages without a confirmed threshold', () => {
  // The business has not agreed a limit for these; they must not get a colour
  // invented for them, at any number of days.
  it.each(['Scouting Event', 'Supplier Evaluation', 'Intelex Handoff'])(
    '%s has no automatic colour',
    stage => {
      expect(slaForStage(stage, 0)).toBeNull();
      expect(slaForStage(stage, 90)).toBeNull();
      expect(slaForStage(stage, 999)).toBeNull();
    },
  );

  it('returns null for terminal and unknown stages', () => {
    expect(slaForStage('Blacklisted', 500)).toBeNull();
    expect(slaForStage('Completed', 500)).toBeNull();
    expect(slaForStage('Limbo', 500)).toBeNull();
  });
});

describe('globalSlaForDays (green < 75, yellow 75–89, red >= 90)', () => {
  it.each([
    [0, 'green'],
    [74, 'green'],
    [75, 'yellow'],
    [89, 'yellow'],
    [90, 'red'],
    [365, 'red'],
  ])('%i days since Parking Lot ⇒ %s', (days, expected) => {
    expect(globalSlaForDays(days)).toBe(expected);
  });

  it('is null when the cycle never started (never reached Parking Lot)', () => {
    expect(globalSlaForDays(null)).toBeNull();
    expect(globalSlaForDays(undefined)).toBeNull();
  });
});

describe('daysSince', () => {
  it('counts whole elapsed days', () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(daysAgo(30), NOW)).toBe(30);
  });

  it('floors future dates at 0 instead of going negative', () => {
    expect(daysSince('2026-12-31', NOW)).toBe(0);
  });

  it('returns null for a missing or unparseable date', () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince('', NOW)).toBeNull();
    expect(daysSince('TBC', NOW)).toBeNull();
  });
});

describe('resolveSla — anchor dates drive the colour', () => {
  it('counts Parking Lot days from the parking onboarding date', () => {
    const res = resolveSla(
      {
        stage: 'Parking Lot',
        parkingOnboardingDate: daysAgo(30),
        // Stale counters must lose to the anchor — this is the whole point.
        daysInStage: 1,
        daysSinceParkingLot: 1,
      },
      NOW,
    );
    expect(res).toEqual({ sla: 'red', globalSla: 'green', daysSinceParkingLot: 30 });
  });

  it('counts Preliminary Evaluation days from the preliminary start date', () => {
    const res = resolveSla(
      {
        stage: 'Preliminary Evaluation',
        parkingOnboardingDate: daysAgo(90),
        preliminaryStartDate: daysAgo(50),
        daysInStage: 0,
        daysSinceParkingLot: 0,
      },
      NOW,
    );
    // Stage colour from the preliminary anchor, global from the parking anchor.
    expect(res).toEqual({ sla: 'yellow', globalSla: 'red', daysSinceParkingLot: 90 });
  });

  it('keeps the global clock running on the parking anchor after Parking Lot', () => {
    const res = resolveSla(
      { stage: 'Intelex Handoff', parkingOnboardingDate: daysAgo(80), daysInStage: 4, daysSinceParkingLot: 4 },
      NOW,
    );
    // No confirmed stage threshold, but the full-cycle clock still applies.
    expect(res).toEqual({ sla: null, globalSla: 'yellow', daysSinceParkingLot: 80 });
  });

  it('has no global SLA before Parking Lot', () => {
    const res = resolveSla({ stage: 'Scouting Event', daysInStage: 400, daysSinceParkingLot: null }, NOW);
    expect(res).toEqual({ sla: null, globalSla: null, daysSinceParkingLot: null });
  });
});

describe('resolveSla — falls back to the stored counters without an anchor', () => {
  it('uses the stored daysInStage when the parking anchor is missing', () => {
    const res = resolveSla(
      { stage: 'Parking Lot', parkingOnboardingDate: null, daysInStage: 28, daysSinceParkingLot: 28 },
      NOW,
    );
    expect(res).toEqual({ sla: 'yellow', globalSla: 'green', daysSinceParkingLot: 28 });
  });

  it('uses the stored daysSinceParkingLot when the parking satellite is empty', () => {
    // Seeded rows past Parking Lot carry the counter but no parking date.
    const res = resolveSla(
      {
        stage: 'Preliminary Evaluation',
        parkingOnboardingDate: null,
        preliminaryStartDate: daysAgo(10),
        daysInStage: 55,
        daysSinceParkingLot: 85,
      },
      NOW,
    );
    expect(res).toEqual({ sla: 'green', globalSla: 'yellow', daysSinceParkingLot: 85 });
  });
});
