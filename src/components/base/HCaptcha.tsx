import { useRef, useImperativeHandle, forwardRef } from 'react';
import HCaptchaLib from '@hcaptcha/react-hcaptcha';

export const HCAPTCHA_SITE_KEY = '525e8946-9664-4210-8c24-6e9e1a4057ca';

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
