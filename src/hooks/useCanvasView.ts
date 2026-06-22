import { useState, useRef, useEffect } from 'react';

export type CanvasView = {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** 現在の表示領域の中心点をワールド座標で返す */
  viewportCenterWorld: () => { x: number; y: number };
};

export function useCanvasView(): CanvasView {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ホイール・ピンチのイベントハンドラーでクロージャーの stale 値を避けるため ref に常時反映
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const canvasRef = useRef<HTMLDivElement>(null);

  function viewportCenterWorld(): { x: number; y: number } {
    const el = canvasRef.current;
    const w = el ? el.clientWidth  / 2 : 0;
    const h = el ? el.clientHeight / 2 : 0;
    return {
      x: (w - panRef.current.x) / zoomRef.current,
      y: (h - panRef.current.y) / zoomRef.current,
    };
  }

  return { zoom, pan, setZoom, setPan, zoomRef, panRef, canvasRef, viewportCenterWorld };
}
