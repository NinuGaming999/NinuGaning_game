import { useState } from 'react';
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  claimUsername,
  friendlyError,
  resendVerification,
  sendResetEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  validateUsername,
} from '../utils/authService';

const inputClass =
  'w-full bg-[#111] border border-[#444] focus:border-[#FF2E2E] outline-none rounded-lg px-4 py-3 text-white';
const primaryBtn =
  'w-full bg-[#FF2E2E] hover:bg-[#e02020] disabled:opacity-50 text-white font-black tracking-wide rounded-lg py-3 transition';
const ghostBtn =
  'w-full border border-[#444] hover:border-[#FF2E2E] disabled:opacity-50 text-white font-bold rounded-lg py-3 transition';

function Shell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl border border-[#333] bg-[#191919] p-6 md:p-8 shadow-2xl">
        <div className="text-xs text-[#FF2E2E] font-black tracking-[0.28em]">NINU GAMING ARCADE</div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">{title}</h1>
        {subtitle && <p className="text-[#999] text-sm mt-2">{subtitle}</p>}
        <div className="mt-6 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Message({ error, info }) {
  if (error) return <div className="text-[#FF6B6B] text-sm">{error}</div>;
  if (info) return <div className="text-[#43D17A] text-sm">{info}</div>;
  return null;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function SignInScreen() {
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'signin') await signInWithEmail(email, password);
      else if (mode === 'signup') await signUpWithEmail(email, password);
      else {
        await sendResetEmail(email);
        setInfo('If that email has an account, a reset link is on its way.');
      }
    });
  };

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';

  return (
    <Shell title={title} subtitle="Your account keeps your scores and cards safe. Nobody else can post under your name.">
      {mode !== 'reset' && (
        <>
          <button type="button" disabled={busy} onClick={() => run(signInWithGoogle)} className={`${ghostBtn} flex items-center justify-center gap-3`}>
            <GoogleIcon /> Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[#666] text-xs">
            <div className="h-px flex-1 bg-[#333]" /> OR <div className="h-px flex-1 bg-[#333]" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
        {mode !== 'reset' && (
          <input
            type="password"
            required
            minLength={mode === 'signup' ? PASSWORD_MIN : undefined}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? `Password (${PASSWORD_MIN}+ characters)` : 'Password'}
            className={inputClass}
          />
        )}
        <Message error={error} info={info} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? 'PLEASE WAIT…' : mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'SEND RESET LINK' : 'SIGN IN'}
        </button>
      </form>

      <div className="flex justify-between text-sm text-[#999] pt-1">
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => { setMode('signup'); setError(''); }} className="hover:text-white">Create an account</button>
            <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="hover:text-white">Forgot password?</button>
          </>
        )}
        {mode !== 'signin' && (
          <button type="button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }} className="hover:text-white">← Back to sign in</button>
        )}
      </div>
    </Shell>
  );
}

export function VerifyEmailScreen({ user, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const check = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await onRefresh();
      setInfo('Not verified yet. Click the link in your email first, then try again.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await resendVerification();
      setInfo('Verification email sent again.');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Shell title="Verify your email" subtitle={`We sent a link to ${user.email}. Open it, then come back here.`}>
      <Message error={error} info={info} />
      <button type="button" disabled={busy} onClick={check} className={primaryBtn}>{busy ? 'CHECKING…' : "I'VE VERIFIED MY EMAIL"}</button>
      <button type="button" onClick={resend} className={ghostBtn}>Resend email</button>
      <button type="button" onClick={signOutUser} className="text-sm text-[#999] hover:text-white">Use a different account</button>
    </Shell>
  );
}

export function ChooseUsernameScreen({ user, onDone }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateUsername(name);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await claimUsername(user, name);
      await onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Pick your player name"
      subtitle={`This is your name on every leaderboard (${USERNAME_MIN}-${USERNAME_MAX} characters). It is permanent and belongs only to your account.`}
    >
      <form onSubmit={submit} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, USERNAME_MAX))}
          placeholder="Player name"
          autoFocus
          className={inputClass}
        />
        <Message error={error} />
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'SAVING…' : 'CLAIM THIS NAME'}</button>
      </form>
      <button type="button" onClick={signOutUser} className="text-sm text-[#999] hover:text-white">Sign out</button>
    </Shell>
  );
}
