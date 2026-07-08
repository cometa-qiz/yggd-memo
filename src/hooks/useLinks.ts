'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { subscribeLinks, createLink, deactivateLink } from '@/lib/firestore';
import { findActiveLink } from '@/utils/graphUtils';
import type { Link } from '@/types';

type UseLinksReturn = {
  links: Link[];
  loading: boolean;
  addLink: (a: string, b: string) => Promise<string>;
  removeLink: (linkId: string) => Promise<void>;
};

export function useLinks(boardId: string | null): UseLinksReturn {
  const { user } = useAuth();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !boardId) return;
    const unsubscribe = subscribeLinks(user.uid, boardId, (updated) => {
      setLinks(updated);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, boardId]);

  const addLink = useCallback(
    async (a: string, b: string): Promise<string> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      // a/bどちらの向きでも既存のisActiveなリンクがあれば新規作成せず既存IDを返す
      const existing = findActiveLink(links, a, b);
      if (existing) return existing.id;
      return createLink(user.uid, boardId, a, b);
    },
    [user, boardId, links]
  );

  const removeLink = useCallback(
    async (linkId: string): Promise<void> => {
      if (!user || !boardId) throw new Error('Not authenticated or no board');
      await deactivateLink(user.uid, boardId, linkId);
    },
    [user, boardId]
  );

  return { links, loading, addLink, removeLink };
}
