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

export function SignInScreen({ onAuthSuccess }) {
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
      const res = await fn();
      if (res?.user || res) {
        await onAuthSuccess?.();
      }
    } catch (e) {
      console.error('Auth error:', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'signin') return await signInWithEmail(email, password);
      else if (mode === 'signup') return await signUpWithEmail(email, password);
      else {
        await sendResetEmail(email);
        setInfo('If that email has an account, a reset link is on its way.');
      }
    });
  };

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';

  return (
    <Shell title={title} subtitle="Your account keeps your scores and cards safe. Nobody else can post under your name.">
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
      <div className="rounded-lg border border-[#4a4a4a] bg-[#222] px-4 py-3 text-sm text-[#ddd]">
        <div className="font-black text-white">⚠️ Check your Spam / Junk folder</div>
        <p className="mt-1 text-[#aaa]">
          Your verification email may be filtered into <span className="text-white font-bold">Spam, Junk, or Promotions</span>.
          If you do not see it in your Inbox, check those folders and search for <span className="text-white font-bold">“verification”</span> or <span className="text-white font-bold">“Firebase”</span>.
        </p>
        <p className="mt-2 text-[#aaa]">Still nothing? Wait a few minutes, then click <span className="text-white font-bold">Resend email</span> below.</p>
      </div>
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
