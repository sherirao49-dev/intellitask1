import { auth } from './firebase'; // Import our configured Firebase auth

// Get the base URL from our environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * A helper function to make authenticated API requests to our FastAPI backend.
 * It automatically gets the user's JWT and adds it to the headers.
 */
async function fetchFromApi(
  endpoint: string,
  options: RequestInit = {}
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('No authenticated user found.');
  }

  // 1. Get the Firebase ID Token (JWT)
  const token = await user.getIdToken();

  // 2. Set up default headers
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  // 3. Merge default options with provided options
  const requestOptions: RequestInit = {
    ...options,
    headers,
  };

  // 4. Make the fetch call
  const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

  if (!response.ok) {
    // Handle HTTP errors
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }

  // If response has no content, return null
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Export simplified methods for a cleaner API
export const apiClient = {
  get: (endpoint: string, options: RequestInit = {}) =>
    fetchFromApi(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, body: any, options: RequestInit = {}) =>
    fetchFromApi(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  put: (endpoint: string, body: any, options: RequestInit = {}) =>
    fetchFromApi(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  delete: (endpoint: string, options: RequestInit = {}) =>
    fetchFromApi(endpoint, { ...options, method: 'DELETE' }),
};