import type { Timestamp } from 'firebase/firestore';

export type BoardSkin = 'leaf' | 'default' | 'cloud';

export type Board = {
  id: string;
  name: string;
  skin: BoardSkin;
  isActive: boolean;
  /** 表示順（昇順）。既存ボードにはマイグレーションで割り振られるため、取得直後は欠けている場合がある */
  order: number;
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
