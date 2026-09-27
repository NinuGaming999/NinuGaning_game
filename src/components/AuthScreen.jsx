import { useState } from 'react';
import { registerAccount, sendPasswordReset, signInAccount } from '../utils/authService';

function friendlyError(error) {
  const code = error?.code || '';
  if (code === 'auth/email-already-in-use') return 'That email is already registered.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/weak-password') return 'Password is too weak. Use at least 8 characters.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
  if (code === 'auth/email-not-verified') return error.message;
  return error?.message || 'Authentication failed. Please try again.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    if (mode === 'register' && password !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInAccount({ email, password });
      } else if (mode === 'register') {
        await registerAccount({ email, password, displayName });
        setMode('login');
        setPassword('');
        setConfirm('');
        setMessage('Account created. Check your email, verify it, then sign in.');
      } else {
        await sendPasswordReset(email);
        setMode('login');
        setMessage('If an account exists for that email, a password reset email has been sent.');
      }
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11151d] shadow-2xl p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="text-xs font-black tracking-[0.35em] text-[#19d3ff]">NINU GAMING ARCADE</div>
          <h1 className="text-3xl md:text-4xl font-black mt-2">{mode === 'register' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'RESET PASSWORD' : 'WELCOME BACK'}</h1>
          <p className="text-xs text-white/40 mt-2">Use a real account so your identity is tied to a Firebase user ID.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && <input autoComplete="nickname" value={displayName} onChange={(e) => setDisplayName(e.target.value.replace(/[\n\r]/g, '').slice(0, 30))} placeholder="Display name" maxLength={30} className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 outline-none focus:border-[#19d3ff]" required />}
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 outline-none focus:border-[#19d3ff]" required />
          {mode !== 'reset' && <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={8} className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 outline-none focus:border-[#19d3ff]" required />}
          {mode === 'register' && <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" minLength={8} className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 outline-none focus:border-[#19d3ff]" required />}
          <button disabled={busy} className="w-full py-3 rounded-xl bg-[#19d3ff] text-black font-black disabled:opacity-50">{busy ? 'PLEASE WAIT…' : mode === 'register' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'SEND RESET EMAIL' : 'SIGN IN'}</button>
        </form>
        {message && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#ffd08a]">{message}</div>}
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
          {mode !== 'login' && <button onClick={() => { setMode('login'); setMessage(''); }}>Sign in</button>}
          {mode !== 'register' && <button onClick={() => { setMode('register'); setMessage(''); }} className="text-[#19d3ff]">Create account</button>}
          {mode !== 'reset' && <button onClick={() => { setMode('reset'); setMessage(''); }} className="text-white/50">Forgot password?</button>}
        </div>
      </div>
    </div>
  );
}
