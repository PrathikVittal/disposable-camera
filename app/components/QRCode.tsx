"use client";

import { forwardRef, useEffect, useRef, useImperativeHandle } from "react";
import QRCodeLib from "qrcode";

type Props = {
  value: string;
  size?: number;
};

export type QRCodeHandle = {
  toDataURL: () => string | null;
  getCanvas: () => HTMLCanvasElement | null;
};

const QRCode = forwardRef<QRCodeHandle, Props>(function QRCode(
  { value, size = 200 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(console.error);
  }, [value, size]);

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? null,
    getCanvas: () => canvasRef.current,
  }));

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-xl"
    />
  );
});

export default QRCode;
