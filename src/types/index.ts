import type { Timestamp } from 'firebase/firestore';

export type BoardSkin = 'leaf' | 'default' | 'cloud';

export type Board = {
  id: string;
  name: string;
  skin: BoardSkin;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Note = {
  id: string;
  text: string;
  x: number;
  y: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Link = {
  id: string;
  a: string;
  b: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
