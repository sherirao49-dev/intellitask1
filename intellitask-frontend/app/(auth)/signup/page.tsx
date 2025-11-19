"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader, AlertCircle, UserPlus } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Update their profile with the name provided
      if (auth.currentUser) {
          await updateProfile(auth.currentUser, {
              displayName: name
          });
      }

      // 3. Redirect to homepage (The AuthContext + Backend will handle Firestore creation)
      router.push("/");
      
    } catch (err: any) {
      console.error(err);
      let msg = "Failed to create account.";
      if (err.code === 'auth/email-already-in-use') msg = "Email is already in use.";
      if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400 flex justify-center items-center gap-2">
             <UserPlus size={32} /> Sign Up
          </h1>
          <p className="text-gray-400 mt-2">Create a new IntelliTask account</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-6 flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center mt-6"
          >
            {loading ? <Loader size={20} className="animate-spin" /> : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Log in here
          </Link>
        </div>
      </div>
    </div>
  );
}