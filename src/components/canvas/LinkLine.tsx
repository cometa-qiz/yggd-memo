type Props = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function LinkLine({ x1, y1, x2, y2 }: Props) {
  // 水平方向のS字ベジェ曲線：両端で水平に接続し、中間でなめらかに遷移する
  const dx = (x2 - x1) * 0.5;
  return (
    <path
      d={`M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
      stroke="#94a3b8"
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
    />
  );
}
