'use client';

import { useCallback, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Phase 2. Captures a parent's signature on the receipt.
 *
 * Emits a PNG data URL. Storing that straight into `sales.signature_url` is
 * fine for a handful of sales a day, but it inflates every row that reads the
 * table -- move it to Supabase Storage and keep only the path once volume
 * justifies it.
 */
export function SignaturePad({
  label,
  onChange,
  clearLabel = 'Clear',
  height = 160
}: {
  label: string;
  onChange: (dataUrl: string | null) => void;
  clearLabel?: string;
  height?: number;
}) {
  const padRef = useRef<SignatureCanvas | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const handleEnd = useCallback(() => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setHasInk(false);
      onChange(null);
      return;
    }
    setHasInk(true);
    onChange(pad.toDataURL('image/png'));
  }, [onChange]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setHasInk(false);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!hasInk}
        >
          {clearLabel}
        </Button>
      </div>

      <div className="rounded-md border bg-white" style={{ height }}>
        <SignatureCanvas
          ref={padRef}
          penColor="#111827"
          onEnd={handleEnd}
          canvasProps={{
            className: 'h-full w-full touch-none rounded-md',
            // The canvas needs intrinsic pixels; CSS alone leaves it 300x150
            // and the strokes land in the wrong place.
            width: 600,
            height
          }}
        />
      </div>
    </div>
  );
}
