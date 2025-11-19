"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import { Home, User, Shield, Loader, AlertCircle, Check } from "lucide-react";
import { useAuth } from "@/app/(auth)/context/AuthContext";

interface UserData {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "developer";
  skills: string[];
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get("/admin/users");
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Prevent changing your own role so you don't lock yourself out!
    if (userId === currentUser?.uid) {
      alert("You cannot change your own role here.");
      return;
    }

    try {
      await apiClient.put(`/admin/users/${userId}/role`, { role: newRole });
      setSuccess(`User role updated to ${newRole}`);

      // Update the local list immediately
      setUsers(prevUsers => prevUsers.map(u => 
        u.uid === userId ? { ...u, role: newRole as "admin" | "developer" } : u
      ));

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert("Failed to update role.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">IntelliTask AI</h1>
        <Link href="/" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
          <Home size={18} />
          Back to Dashboard
        </Link>
      </header>

      <main className="rounded-lg bg-gray-800 p-6 border border-gray-700 max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400 flex items-center gap-2">
          <User size={24} /> User Management
        </h2>

        {success && (
          <div className="bg-green-900 text-green-200 border border-green-700 p-3 rounded mb-4 flex items-center gap-2">
            <Check size={18} /> {success}
          </div>
        )}

        {loading && <div className="flex items-center gap-2 text-gray-400"><Loader className="animate-spin" /> Loading users...</div>}
        {error && <p className="text-red-500 flex items-center gap-2"><AlertCircle /> {error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-sm uppercase">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Skills</th>
                  <th className="p-4">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="p-4 font-medium">{user.name}</td>
                    <td className="p-4 text-gray-400">{user.email}</td>
                    <td className="p-4 text-sm">
                      {user.skills && user.skills.length > 0 ? (
                        user.skills.join(", ")
                      ) : (
                        <span className="text-gray-600 italic">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? <Shield size={16} className="text-blue-400" /> : <User size={16} className="text-green-400" />}

                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                          className={`bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 ${
                            user.uid === currentUser?.uid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          disabled={user.uid === currentUser?.uid}
                        >
                          <option value="developer">Developer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}