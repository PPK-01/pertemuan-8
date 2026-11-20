import { dummyLabs, dummySessionCodes, dummySessions } from '@/data/dummy';
import type { Lab, Session } from '@/types';

/**
 * Penyimpanan in-memory bersama untuk mode fallback (offline / tanpa Firebase).
 * Memisahkan state in-memory dari services/labs dan services/sessions
 * untuk menghindari impor melingkar (circular dependency).
 */
export const inMemory = {
  labs: [...dummyLabs] as Lab[],
  sessions: [...dummySessions] as Session[],
  codes: { ...dummySessionCodes } as Record<string, string>,
};

export function getInMemoryLabs(): Lab[] {
  return inMemory.labs;
}

export function getInMemorySessions(): Session[] {
  return inMemory.sessions;
}
