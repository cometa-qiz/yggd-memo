'use client';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;

type Props = {
  noteCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
};

export function CanvasControls({ noteCount, zoom, onZoomIn, onZoomOut, onCenter }: Props) {
  return (
    <div
      className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="min-w-[3rem] text-center text-xs text-gray-500">
        {noteCount}件
      </span>

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-base text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        aria-label="縮小"
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-xs text-gray-500">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= MAX_ZOOM}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-base text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        aria-label="拡大"
      >
        ＋
      </button>

      <div className="h-4 w-px bg-gray-200" />

      <button
        onClick={onCenter}
        className="flex h-7 items-center justify-center rounded-lg px-2 text-xs text-gray-600 hover:bg-gray-100"
        aria-label="中央寄せ"
      >
        中央
      </button>
    </div>
  );
}
