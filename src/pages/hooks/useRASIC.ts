import { useRole } from '../../context/RoleContext';
import { RASIC_MATRIX } from '../../data/rasic';
import type { RasicLetter } from '../../types';

export function useRASIC() {
  const { activeRole } = useRole();

  function getRasicLetter(activityId: number): RasicLetter {
    const activity = RASIC_MATRIX.find(a => a.id === activityId);
    if (!activity) return 'I';
    return activity.roles[activeRole];
  }

  function canExecute(activityId: number): boolean {
    const letter = getRasicLetter(activityId);
    return letter === 'R' || letter === 'R/A';
  }

  function mustConsult(activityId: number): boolean {
    return getRasicLetter(activityId) === 'C';
  }

  function isInformed(activityId: number): boolean {
    return getRasicLetter(activityId) === 'I';
  }

  return { getRasicLetter, canExecute, mustConsult, isInformed };
}
