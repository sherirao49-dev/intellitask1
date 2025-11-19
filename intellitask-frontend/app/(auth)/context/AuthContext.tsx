"use client";

import { createContext, useContext, useState, useEffect } from "react";
import {
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase"; // Import from the file we made
import { apiClient } from "@/lib/apiClient"; // Import our new API client

// Define the shape of our user role
type UserRole = "admin" | "developer" | null;

// Define the shape of our context data
interface AuthContextType {
  user: User | null;
  idToken: string | null; // To store the JWT
  role: UserRole; // To store the user's role
  loading: boolean;
  googleSignIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Sign in with Google
  const googleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // User state change will be caught by onAuthStateChanged
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  // Sign out
  const logOut = async () => {
    try {
      await signOut(auth);
      // Clear all state
      setUser(null);
      setIdToken(null);
      setRole(null);
    } catch (error) {
      // This block is now fixed
      console.error("Error signing out: ", error);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Get the JWT from the user
        const token = await currentUser.getIdToken();
        setIdToken(token);

        try {
          // *** NEW: Call our backend to get the user's role ***
          // The apiClient automatically uses the token
          const userInfo = await apiClient.get("/users/me");
          setRole(userInfo.role); // Set the role from our API
        } catch (error) {
          // This block is now fixed
          console.error("Error fetching user role: ", error);
          // Log out if we can't get the role (e.g., API is down)
          await logOut();
        }
      } else {
        // No user, clear all state
        setUser(null);
        setIdToken(null);
        setRole(null);
      }
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => unsubscribe();
  }, []);

  const value = { user, idToken, role, loading, googleSignIn, logOut };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Create a custom hook to use the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};