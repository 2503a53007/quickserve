'use client';

import React, { useRef, useState, useCallback } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusAt = useCallback((idx: number) => {
    inputsRef.current[idx]?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    const digit = raw[raw.length - 1];
    const newDigits = [...digits];
    newDigits[idx] = digit;
    onChange(newDigits.join(''));
    if (idx < length - 1) focusAt(idx + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[idx]) {
        const newDigits = [...digits];
        newDigits[idx] = '';
        onChange(newDigits.join(''));
      } else if (idx > 0) {
        const newDigits = [...digits];
        newDigits[idx - 1] = '';
        onChange(newDigits.join(''));
        focusAt(idx - 1);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      focusAt(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      focusAt(idx + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted.padEnd(length, '').slice(0, length));
    focusAt(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length }, (_, idx) => (
        <input
          key={idx}
          ref={(el) => { inputsRef.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[idx]}
          disabled={disabled}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-150 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
            'focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
            error
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          aria-label={`OTP digit ${idx + 1}`}
        />
      ))}
    </div>
  );
}

export default OtpInput;
