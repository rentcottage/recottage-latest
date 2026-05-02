import { useRef, useImperativeHandle, forwardRef } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';

// hCaptcha test sitekey — works on any domain, free tier
// Replace with your own sitekey from hcaptcha.com when going to production
export const HCAPTCHA_SITE_KEY = '7c3ed03a-c4f2-4bd4-8bda-e8a291bc5ede';

export interface HCaptchaHandle {
  execute: () => void;
  resetCaptcha: () => void;
}

interface HCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

const HCaptcha = forwardRef<HCaptchaHandle, HCaptchaProps>(
  ({ onVerify, onExpire, onError }, ref) => {
    const captchaRef = useRef<HCaptchaLib>(null);

    useImperativeHandle(ref, () => ({
      execute: () => captchaRef.current?.execute(),
      resetCaptcha: () => captchaRef.current?.resetCaptcha(),
    }));

    return (
      <HCaptchaLib
        ref={captchaRef}
        sitekey={HCAPTCHA_SITE_KEY}
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
        size="normal"
        theme="light"
      />
    );
  }
);

HCaptcha.displayName = 'HCaptcha';

export default HCaptcha;
