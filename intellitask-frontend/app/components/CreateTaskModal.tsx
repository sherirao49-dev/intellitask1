"use client";

import { useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { X, Plus, Loader } from "lucide-react";

interface CreateTaskModalProps {
  onClose: () => void;
  onTaskCreated: () => void; // To refresh the list after creation
}

export default function CreateTaskModal({ onClose, onTaskCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      setError("Title and Description are required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Call the manual create endpoint we added to main.py
      await apiClient.post("/admin/tasks", {
        projectId: "test-project", // Hardcoded for MVP
        title,
        description,
        priority,
        assigneeId: null // Created as unassigned
      });

      onTaskCreated(); // Refresh the parent list
      onClose(); // Close modal
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create task.");
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full max-w-md rounded-lg shadow-2xl p-6 border border-gray-700">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus size={20} /> Create New Task
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              type="text"
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix login bug"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
            <select
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader size={18} className="animate-spin" /> : "Create Task"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}