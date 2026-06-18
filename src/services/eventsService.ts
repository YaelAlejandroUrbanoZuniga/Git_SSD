import { scoutingEvents } from '../data/events-demo';
import type { ScoutingEvent } from '../types';

export function getScoutingEvents(): Promise<ScoutingEvent[]> {
  return Promise.resolve(scoutingEvents);
}

export function getEventById(id: string): Promise<ScoutingEvent | undefined> {
  return Promise.resolve(scoutingEvents.find(e => e.id === id));
}
