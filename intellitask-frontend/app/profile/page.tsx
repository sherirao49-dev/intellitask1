"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/app/(auth)/context/AuthContext";
import { Loader, User, Zap, Save, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Define the shape of the user profile we fetch
interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: string;
  skills: string[];
}

export default function ProfilePage() {
  const { user, loading: authLoading, logOut, role } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillsInput, setSkillsInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // 1. Initial Data Fetch (When component mounts)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchProfile();
    }
  }, [user, authLoading]);

  // 2. Fetch Profile Function
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/users/me'); 
      
      // *** FINAL FIX: Apply fallback to skills before setting state ***
      setProfile({...data, skills: data.skills || []}); 
      
      // Also apply fallback for the input box
      setSkillsInput((data.skills || []).join(', '));
      
    } catch (err) {
      setMessage({type: 'error', text: 'Failed to fetch user data.'});
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Form Submission (Saving Skills)
  const handleSaveSkills = async () => {
    setIsSaving(true);
    setMessage(null);
    
    // Convert the comma-separated string back to a clean array
    const newSkillsArray = skillsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    try {
      // Call the PUT endpoint we built on Day 2!
      await apiClient.put('/users/me/skills', {
        skills: newSkillsArray,
      });

      // Update the local profile state with the new skills
      if (profile) {
        setProfile({...profile, skills: newSkillsArray});
      }
      
      setMessage({type: 'success', text: 'Skills updated successfully!'});
    } catch (err: any) {
      setMessage({type: 'error', text: err.message || 'Failed to save skills.'});
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <Loader size={24} className="animate-spin mr-2" /> Loading Profile...
      </div>
    );
  }

  if (!profile) return null; // Should be handled by the loading state

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-10 border-b border-gray-700 pb-6">
        <h1 className="text-3xl font-bold flex items-center gap-4">
          <User size={30} /> My Profile
        </h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition">
            Back to Dashboard
          </Link>
          <button
            onClick={logOut}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            Logout
          </button>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto space-y-8">
        
        {/* User Info Card */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
          <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Account Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <p className="text-gray-400">Name:</p>
            <p className="font-medium text-white">{profile.name}</p>
            <p className="text-gray-400">Email:</p>
            <p className="font-medium text-white">{profile.email}</p>
            <p className="text-gray-400">Role:</p>
            <p className={`font-bold uppercase ${profile.role === 'admin' ? 'text-blue-400' : 'text-green-400'}`}>
              {profile.role}
            </p>
          </div>
        </div>

        {/* Skills Management Form (The key feature) */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-yellow-400">
            <Zap size={20} /> Manage Technical Skills
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Enter your skills separated by commas (e.g., React, Python, Firebase). The AI uses this list to assign tasks intelligently.
          </p>

          {/* Messages */}
          {message && (
            <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
              <AlertCircle size={16} /> {message.text}
            </div>
          )}

          {/* Input Area */}
          <textarea
            rows={4}
            className="w-full bg-gray-700 text-white border-gray-600 rounded-lg p-3 text-sm focus:ring-yellow-500 focus:border-yellow-500"
            placeholder="e.g., Next.js, Python, Tailwind, Unit Testing"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            disabled={isSaving}
          />
          
          {/* Save Button */}
          <button
            onClick={handleSaveSkills}
            disabled={isSaving}
            className={`mt-4 w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition duration-300 ${
              isSaving
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            {isSaving ? (
              <>
                <Loader size={20} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={20} /> Save Changes
              </>
            )}
          </button>
        </div>

        {/* Current Skills List */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2 text-gray-300">Your Current Skills:</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills.length === 0 ? (
              <p className="text-gray-500 text-sm">No skills added yet.</p>
            ) : (
              profile.skills.map((skill, index) => (
                <span key={index} className="bg-gray-700 text-yellow-300 px-3 py-1 text-xs rounded-full">
                  {skill}
                </span>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}