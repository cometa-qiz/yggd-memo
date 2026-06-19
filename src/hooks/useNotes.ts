'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  subscribeNotes,
  createNote,
  updateNoteText,
  updateNotePosition,
  deactivateNote,
} from '@/lib/firestore';
import type { Note } from '@/types';

type UseNotesReturn = {
  notes: Note[];
  loading: boolean;
  addNote: (text: string, x: number, y: number) => Promise<string>;
  editNote: (noteId: string, text: string) => Promise<void>;
  moveNote: (noteId: string, x: number, y: number) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;
};

export function useNotes(boardId: string | null): UseNotesReturn {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !boardId) return;
    const unsubscribe = subscribeNotes(user.uid, boardId, (updated) => {
      setNotes(updated);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, boardId]);

  const addNote = useCallback(
    async (text: string, x: number, y: number): Promise<string> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      return createNote(user.uid, boardId, text, x, y);
    },
    [user, boardId]
  );

  const editNote = useCallback(
    async (noteId: string, text: string): Promise<void> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      await updateNoteText(user.uid, boardId, noteId, text);
    },
    [user, boardId]
  );

  const moveNote = useCallback(
    async (noteId: string, x: number, y: number): Promise<void> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      await updateNotePosition(user.uid, boardId, noteId, x, y);
    },
    [user, boardId]
  );

  const removeNote = useCallback(
    async (noteId: string): Promise<void> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      await deactivateNote(user.uid, boardId, noteId);
    },
    [user, boardId]
  );

  return { notes, loading, addNote, editNote, moveNote, removeNote };
}
