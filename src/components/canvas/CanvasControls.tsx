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
  connectMode: boolean;
  onToggleConnectMode: () => void;
  deleteMode: boolean;
  onToggleDeleteMode: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
};

/** 縦区切り線（横並びレイアウト用） */
function Divider() {
  return (
    <span
      aria-hidden
      style={{ display: 'block', width: '1px', height: '22px', background: 'var(--line)', flexShrink: 0 }}
    />
  );
}

/** 横区切り線（縦積みレイアウト用） */
function HDivider() {
  return (
    <span
      aria-hidden
      style={{ display: 'block', width: '100%', height: '1px', background: 'var(--line)', flexShrink: 0 }}
    />
  );
}

type ModeButtonProps = {
  onClick: () => void;
  active: boolean;
  activeColor: string;
  ariaLabel: string;
  children: React.ReactNode;
};

/**
 * 切る・つなぐ・削除・範囲選択の各モード切り替えボタン。
 * 横並び（PC）・縦積み（スマホ）どちらの並びでも見た目が崩れないよう、
 * ボタン自体は幅を親（flex方向）に委ね、ラベルは常にnowrapで折り返さない。
 */
function ModeButton({ onClick, active, activeColor, ariaLabel, children }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={active ? '' : 'canvas-ctrl-btn'}
      style={{
        height: '40px',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '12px',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: active ? activeColor : 'transparent',
        color: active ? '#ffffff' : 'var(--ink)',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      {children}
    </button>
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
  connectMode,
  onToggleConnectMode,
  deleteMode,
  onToggleDeleteMode,
  selectMode,
  onToggleSelectMode,
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

      {/* コントロール（右下）: design-mockup.html .controls .grp と同仕様
          モードボタン（つなぐ・切る・削除・範囲選択）部分は display:contents でラップし、
          スマホ幅ではこの行から丸ごと消えて（hidden）下の縦積みボックスに置き換わる。
          PC幅（md以上）ではcontentsにより従来と全く同じ横並びに戻る。 */}
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

        {/* モードボタン群（PC幅のみ、この行の一部として横並び表示） */}
        <div className="hidden md:contents">
          <Divider />
          <ModeButton onClick={onToggleConnectMode} active={connectMode} activeColor="#2563eb" ariaLabel="つなぐモード切り替え">
            🔗 つなぐ
          </ModeButton>

          <Divider />
          <ModeButton onClick={onToggleCutMode} active={cutMode} activeColor="#dc2626" ariaLabel="切るモード切り替え">
            ✂ 切る
          </ModeButton>

          <Divider />
          <ModeButton onClick={onToggleDeleteMode} active={deleteMode} activeColor="#ea580c" ariaLabel="削除モード切り替え">
            🗑 削除
          </ModeButton>

          <Divider />
          <ModeButton onClick={onToggleSelectMode} active={selectMode} activeColor="#7c3aed" ariaLabel="範囲選択モード切り替え">
            □ 範囲選択
          </ModeButton>
        </div>
      </div>

      {/* モードボタン群（スマホ幅のみ、ズーム・中央寄せの行の上に縦積み表示） */}
      <div
        className="flex md:hidden flex-col absolute right-4 z-30"
        style={{
          bottom: '64px',
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '13px',
          boxShadow: '0 2px 8px var(--shadow)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ModeButton onClick={onToggleConnectMode} active={connectMode} activeColor="#2563eb" ariaLabel="つなぐモード切り替え">
          🔗 つなぐ
        </ModeButton>

        <HDivider />
        <ModeButton onClick={onToggleCutMode} active={cutMode} activeColor="#dc2626" ariaLabel="切るモード切り替え">
          ✂ 切る
        </ModeButton>

        <HDivider />
        <ModeButton onClick={onToggleDeleteMode} active={deleteMode} activeColor="#ea580c" ariaLabel="削除モード切り替え">
          🗑 削除
        </ModeButton>

        <HDivider />
        <ModeButton onClick={onToggleSelectMode} active={selectMode} activeColor="#7c3aed" ariaLabel="範囲選択モード切り替え">
          □ 範囲選択
        </ModeButton>
      </div>
    </>
  );
}
