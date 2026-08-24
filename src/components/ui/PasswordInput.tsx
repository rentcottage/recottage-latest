import { useState } from 'react';

/**
 * Password field with a show/hide toggle.
 *
 * Typing a password blind is the single easiest way to fail a login or to
 * register with a typo'd password, so every password box in the app gets the
 * same eye button. Extracted rather than repeated: there are six of them
 * across login, register, the auth modals and the corporate portal, and they
 * should all behave identically.
 *
 * Styling is passed in, since the surrounding forms don't share one input
 * style — the component only adds the right padding the button needs.
 */
export default function PasswordInput({
  className = '',
  toggleLabel = 'Show password',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { toggleLabel?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        // Never a submit button, and skipped when tabbing between fields so it
        // doesn't sit between the password box and the submit button.
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={toggleLabel}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
      >
        <i className={visible ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true"></i>
      </button>
    </div>
  );
}
