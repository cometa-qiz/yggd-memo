type Props = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

export function LinkLine({
  x1,
  y1,
  x2,
  y2,
  dashed = false,
  selected = false,
  onSelect,
}: Props) {
  const dx = (x2 - x1) * 0.5;
  return (
    <path
      d={`M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
      strokeWidth={selected ? 3 : 2}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={dashed ? '6 3' : undefined}
      style={{
        stroke: selected ? 'var(--dusk)' : 'var(--thread)',
        // onSelect がある確定線のみクリック可能にする（SVG親のpointer-events:noneを上書き）
        pointerEvents: onSelect ? 'stroke' : 'none',
        cursor: onSelect ? 'pointer' : 'default',
      }}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
    />
  );
}
