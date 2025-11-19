"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link"; 
import { FileSearch, Plus, Trash2, Users } from "lucide-react"; // <-- Added Users icon
import CreateProjectModal from "./CreateProjectModal";

interface Project {
  projectId: string;
  title: string;
}

export default function AdminDashboard() {
  const [srsText, setSrsText] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      const data = await apiClient.get("/projects");
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0].projectId);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleGenerateTasks = async () => {
    if (!srsText) {
      setError("Please paste your SRS text.");
      return;
    }
    if (!selectedProject) {
      setError("Please select a project.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiClient.post("/admin/generate-tasks", {
        srs_text: srsText,
        project_id: selectedProject,
      });
      setSuccess(result.message || "Tasks generated successfully!");
      setSrsText(""); 
    } catch (err: any) {
      setError(err.message || "Failed to generate tasks.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm("Are you sure? This will delete the project. Tasks will remain but become orphaned.")) {
      return;
    }

    try {
      await apiClient.delete(`/projects/${selectedProject}`);
      setSuccess("Project deleted successfully.");
      setSelectedProject(""); 
      fetchProjects(); 
    } catch (err: any) {
      setError("Failed to delete project.");
      console.error(err);
    }
  };

  const handleListModels = async () => {
    console.log("Attempting to list models...");
    setSuccess(null);
    setError(null);
    try {
      const result = await apiClient.get("/admin/list-models");
      console.log("Available Models:", result.models);
      setSuccess(`Available models logged to console. Found: ${result.models.join(', ')}`);
    } catch (err: any) {
      console.error("Error listing models:", err);
      setError(err.message || "Failed to list models.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex justify-end gap-3">
        <Link href="/admin/users" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
          <Users size={18} />
          Manage Users
        </Link>

        <Link href="/admin/review" className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
          <FileSearch size={18} />
          Go to AI Review Inbox
        </Link>
      </div>

      <div className="rounded-lg bg-gray-800 p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Admin Dashboard: AI Task Generation</h2>
        
        {success && (
          <div className="bg-green-800 border border-green-600 text-green-100 px-4 py-3 rounded-lg mb-4">
            <p>{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-800 border border-red-600 text-red-100 px-4 py-3 rounded-lg mb-4">
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Project Selection Row */}
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-300 mb-1">
              1. Select Project
            </label>
            <div className="flex gap-2">
              <select
                id="project"
                className="flex-1 bg-gray-700 text-white border-gray-600 rounded-lg p-2"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="" disabled>Select a project</option>
                {projects.map(p => (
                  <option key={p.projectId} value={p.projectId}>{p.title}</option>
                ))}
              </select>
              
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 rounded-lg flex items-center"
                title="Create New Project"
              >
                <Plus size={20} />
              </button>

              <button
                onClick={handleDeleteProject}
                disabled={!selectedProject}
                className="bg-red-600 hover:bg-red-700 text-white px-3 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete Selected Project"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
          
          {/* SRS Text Area */}
          <div>
            <label htmlFor="srs" className="block text-sm font-medium text-gray-300 mb-1">
              2. Paste SRS Text
            </label>
            <textarea
              id="srs"
              rows={10}
              className="w-full bg-gray-700 text-white border-gray-600 rounded-lg p-2"
              placeholder="Paste your Software Requirements Specification (SRS) text here..."
              value={srsText}
              onChange={(e) => setSrsText(e.target.value)}
            />
          </div>
          
          {/* Generate Button */}
          <button
            onClick={handleGenerateTasks}
            disabled={loading}
            className={`w-full font-bold py-3 px-4 rounded-lg transition duration-300 ${
              loading 
                ? "bg-gray-600 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Generating Tasks..." : "✨ Generate Tasks with AI"}
          </button>

          <button
            onClick={handleListModels}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg transition duration-300"
          >
            Debug: List Available Models
          </button>
        </div>
      </div>

      {/* Create Project Modal */}
      {isProjectModalOpen && (
        <CreateProjectModal
          onClose={() => setIsProjectModalOpen(false)}
          onProjectCreated={fetchProjects}
        />
      )}
    </div>
  );
}