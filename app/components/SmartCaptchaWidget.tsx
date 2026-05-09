"use client";

import Script from "next/script";
import { useEffect, useMemo } from "react";

declare global {
  interface Window {
    __sbSmartCaptchaTokenCallback?: (token: string) => void;
  }
}

export function SmartCaptchaWidget({
  siteKey,
  onTokenChange
}: {
  siteKey: string;
  onTokenChange: (token: string) => void;
}) {
  const callbackName = useMemo(() => "__sbSmartCaptchaTokenCallback", []);

  useEffect(() => {
    window.__sbSmartCaptchaTokenCallback = (token: string) => {
      onTokenChange(String(token || "").trim());
    };
    return () => {
      window.__sbSmartCaptchaTokenCallback = undefined;
    };
  }, [onTokenChange]);

  if (!siteKey) return null;

  return (
    <div className="grid" style={{ gap: 6 }}>
      <Script src="https://smartcaptcha.yandexcloud.net/captcha.js" strategy="afterInteractive" />
      <div
        className="smart-captcha"
        data-sitekey={siteKey}
        data-callback={callbackName}
        style={{ minHeight: 84 }}
      />
      <div className="muted" style={{ fontSize: 12 }}>
        Подтвердите, что вы не робот.
      </div>
    </div>
  );
}

