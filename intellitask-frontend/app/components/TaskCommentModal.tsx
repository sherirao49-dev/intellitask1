"use client";

import { apiClient } from "@/lib/apiClient";
import { X, CornerDownLeft, MessageSquare, Loader } from "lucide-react";
import { useEffect, useState } from "react";

interface Comment {
  commentId: string;
  taskId: string;
  authorName: string;
  text: string;
  timestamp: string; // ISO date string
}

interface ModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

export default function TaskCommentModal({ taskId, taskTitle, onClose }: ModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/tasks/${taskId}/comments`);
      setComments(data || []); // Handle null response if no comments
      setError(null);
    } catch (err: any) {
      setError("Failed to load comments.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  const handlePostComment = async () => {
    if (!newCommentText.trim()) return;

    setPosting(true);
    try {
      const newComment = await apiClient.post(`/tasks/${taskId}/comments`, {
        text: newCommentText,
      });

      // Update local state with the new comment and reset form
      setComments(prev => [...prev, newComment]);
      setNewCommentText("");
    } catch (err: any) {
      setError("Failed to post comment.");
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full max-w-2xl rounded-lg shadow-2xl p-6 border border-gray-700">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-700 mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare size={20} /> Comments for: {taskTitle}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="max-h-80 overflow-y-auto space-y-4 pr-2">
          {loading && <div className="text-center text-gray-400"><Loader size={20} className="animate-spin inline-block mr-2" /> Loading comments...</div>}
          {error && <p className="text-red-500">{error}</p>}
          
          {!loading && comments.length === 0 && (
            <p className="text-gray-500 text-center py-4">No comments yet. Be the first!</p>
          )}

          {comments.map((comment) => (
            <div key={comment.commentId} className="bg-gray-800 p-3 rounded-lg">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-blue-400">{comment.authorName}</span>
                <span className="text-gray-500">
                  {new Date(comment.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-300 text-sm">{comment.text}</p>
            </div>
          ))}
        </div>

        {/* Post Comment Form */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <textarea
            className="w-full bg-gray-700 text-white border-gray-600 rounded-lg p-2 text-sm resize-none focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Add your comment here..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={posting}
          />
          <button
            onClick={handlePostComment}
            disabled={posting || !newCommentText.trim()}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition duration-300 disabled:bg-gray-600 flex items-center"
          >
            {posting ? (
              <Loader size={16} className="animate-spin mr-2" />
            ) : (
              <CornerDownLeft size={16} className="mr-2" />
            )}
            {posting ? "Posting..." : "Post Comment"}
          </button>
        </div>

      </div>
    </div>
  );
}