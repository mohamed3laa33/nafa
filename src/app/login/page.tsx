
"use client";import { useState } from 'react';
import { useAuth } from '@/app/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const { user } = await res.json();
        login(user);
        router.push('/');
      } else {
        const { error } = await res.json();
        setError(error || 'Invalid credentials');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="w-1/2 flex items-center justify-center p-12">
        <img src="/logo.png" alt="Nafaa Logo" width={400} height={160} />
      </div>
      <div className="w-1/2 flex items-center justify-center">
        <form onSubmit={handleSubmit} className="p-12 bg-white rounded-xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Welcome Back</h1>
          {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold text-lg transition">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
