"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import { X, Save, Loader, User } from "lucide-react";

// We need the shape of a User for the dropdown
interface UserData {
  uid: string;
  name: string;
  email: string;
}

interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
}

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export default function EditTaskModal({ task, onClose, onTaskUpdated }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  
  const [developers, setDevelopers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch developers when the modal opens so we can re-assign tasks
  useEffect(() => {
    const fetchDevelopers = async () => {
      try {
        const data = await apiClient.get("/admin/developers");
        setDevelopers(data);
      } catch (err) {
        console.error("Failed to load developers", err);
      }
    };
    fetchDevelopers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Call the backend PUT endpoint to update the task
      await apiClient.put(`/admin/tasks/${task.taskId}`, {
        projectId: task.projectId, // Keep original project
        title,
        description,
        priority,
        assigneeId: assigneeId || null, // Send null if empty string
      });

      onTaskUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update task.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full max-w-md rounded-lg shadow-2xl p-6 border border-gray-700">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Edit Task
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              type="text"
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority & Assignee Row */}
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Assign To</label>
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {developers.map(dev => (
                  <option key={dev.uid} value={dev.uid}>{dev.name}</option>
                ))}
              </select>
            </div>
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
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}