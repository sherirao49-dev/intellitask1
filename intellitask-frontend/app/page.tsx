"use client";

import { useAuth } from "./(auth)/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link"; // <-- NEW IMPORT
import { User } from "lucide-react"; // <-- NEW IMPORT

// Import dashboards
import DeveloperDashboard from "./components/DeveloperDashboard";
import AdminDashboard from "./components/AdminDashboard"; 

// --- Main Homepage ---
export default function HomePage() {
  const { user, role, loading, logOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Loading application...
      </div>
    );
  }

  const renderDashboard = () => {
    if (role === 'admin') {
      return <AdminDashboard />;
    }
    if (role === 'developer') {
      return <DeveloperDashboard />;
    }
    return <p>Loading user role...</p>;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">IntelliTask AI</h1>
        
        <div className="flex items-center gap-4"> {/* <-- NEW WRAPPER */}
          {/* --- NEW PROFILE LINK --- */}
          {role === 'developer' && (
            <Link 
              href="/profile" 
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
            >
              <User size={18} /> My Profile
            </Link>
          )}
          {/* ------------------------ */}

          <button
            onClick={logOut}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            Logout
          </button>
        </div>
      </header>
      
      <main>
        <h2 className="text-xl mb-6 text-gray-400">Welcome, {user.displayName || user.email}!</h2>
        {renderDashboard()}
      </main>
    </div>
  );
}