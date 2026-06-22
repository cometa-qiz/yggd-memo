'use client';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;

type Props = {
  noteCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  cutMode: boolean;
  onToggleCutMode: () => void;
};

/** 縦区切り線 */
function Divider() {
  return (
    <span
      aria-hidden
      style={{ display: 'block', width: '1px', height: '22px', background: 'var(--line)', flexShrink: 0 }}
    />
  );
}

export function CanvasControls({
  noteCount,
  zoom,
  onZoomIn,
  onZoomOut,
  onCenter,
  cutMode,
  onToggleCutMode,
}: Props) {
  return (
    <>
      {/* 件数表示（左下）: design-mockup.html .count と同仕様 */}
      <div
        className="absolute bottom-4 left-4 z-30 select-none"
        style={{
          background: 'var(--glass)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          border: '1px solid var(--line)',
          borderRadius: '20px',
          padding: '5px 11px',
          fontSize: '12px',
          color: 'var(--ink-soft)',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {noteCount}件
      </div>

      {/* コントロール（右下）: design-mockup.html .controls .grp と同仕様 */}
      <div
        className="absolute bottom-4 right-4 z-30 flex items-center"
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '13px',
          boxShadow: '0 2px 8px var(--shadow)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 縮小 */}
        <button
          onClick={onZoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="canvas-ctrl-btn flex items-center justify-center"
          style={{
            width: '40px',
            height: '40px',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            fontSize: '18px',
            cursor: 'pointer',
          }}
          aria-label="縮小"
        >
          −
        </button>

        <Divider />

        {/* ズーム率 */}
        <span
          className="select-none text-center text-xs"
          style={{ minWidth: '2.5rem', color: 'var(--ink-soft)', padding: '0 4px' }}
        >
          {Math.round(zoom * 100)}%
        </span>

        <Divider />

        {/* 拡大 */}
        <button
          onClick={onZoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="canvas-ctrl-btn flex items-center justify-center"
          style={{
            width: '40px',
            height: '40px',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            fontSize: '18px',
            cursor: 'pointer',
          }}
          aria-label="拡大"
        >
          ＋
        </button>

        <Divider />

        {/* 中央寄せ */}
        <button
          onClick={onCenter}
          className="canvas-ctrl-btn flex items-center justify-center text-xs"
          style={{
            height: '40px',
            padding: '0 10px',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
          aria-label="中央寄せ"
        >
          中央
        </button>

        <Divider />

        {/* 切るモード */}
        <button
          onClick={onToggleCutMode}
          className={cutMode ? '' : 'canvas-ctrl-btn'}
          style={{
            height: '40px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            border: 'none',
            cursor: 'pointer',
            background: cutMode ? '#dc2626' : 'transparent',
            color: cutMode ? '#ffffff' : 'var(--ink)',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          aria-label="切るモード切り替え"
          aria-pressed={cutMode}
        >
          ✂ 切る
        </button>
      </div>
    </>
  );
}
