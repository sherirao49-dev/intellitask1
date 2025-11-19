"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import { Home, ListTodo, AlertCircle, CheckCircle, Loader, CircleDot, FileWarning, ChevronUp, ChevronDown, Clock, User, Check, Trash2, Plus, Edit, Filter, XCircle } from "lucide-react";
import CreateTaskModal from "@/app/components/CreateTaskModal";
import EditTaskModal from "@/app/components/EditTaskModal";

interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  creator: string;
  assigneeId: string | null;
  isApproved: boolean; 
}

interface UserData {
  uid: string;
  name: string;
}

function AssignmentDisplay({ assigneeId }: { assigneeId: string | null }) {
  if (assigneeId) {
    return <span className="flex items-center gap-1 text-sm text-gray-300"><User size={14} /> Assigned</span>;
  }
  return <span className="flex items-center gap-1 text-sm text-gray-500"><User size={14} /> Unassigned</span>;
}

function StatusDisplay({ status }: { status: string }) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "To-Do": return { icon: <ListTodo size={14} />, color: "text-gray-400" };
      case "In Progress": return { icon: <Loader size={14} className="animate-spin" />, color: "text-blue-400" };
      case "In Review": return { icon: <FileWarning size={14} />, color: "text-yellow-400" };
      case "Done": return { icon: <CheckCircle size={14} />, color: "text-green-400" };
      default: return { icon: <CircleDot size={14} />, color: "text-gray-400" };
    }
  };
  const info = getStatusInfo(status);
  return <span className={`flex items-center gap-1 text-sm ${info.color}`}>{info.icon}{status}</span>;
}

function PriorityDisplay({ priority }: { priority: string }) {
  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case "Low": return { icon: <ChevronDown size={14} />, color: "text-green-500" };
      case "Medium": return { icon: <Clock size={14} />, color: "text-yellow-500" };
      case "High": return { icon: <ChevronUp size={14} />, color: "text-orange-500" };
      case "Critical": return { icon: <AlertCircle size={14} />, color: "text-red-500" };
      default: return { icon: <Clock size={14} />, color: "text-gray-400" };
    }
  };
  const info = getPriorityInfo(priority);
  return <span className={`flex items-center gap-1 text-sm ${info.color}`}>{info.icon}{priority}</span>;
}


export default function AdminReviewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<UserData[]>([]); // For the filter dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- Filter State ---
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  // --------------------

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch Tasks
      const taskData = await apiClient.get("/admin/tasks");
      setTasks(taskData);

      // Fetch Developers (for the filter list)
      const devData = await apiClient.get("/admin/developers");
      setDevelopers(devData);

    } catch (err: any) {
      setError(err.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (taskId: string) => {
    try {
      await apiClient.put(`/admin/tasks/${taskId}/approve`, {});
      setTasks(currentTasks => 
        currentTasks.map(task => 
          task.taskId === taskId ? { ...task, isApproved: true } : task
        )
      );
    } catch (err) {
      console.error("Failed to approve task:", err);
      alert("Failed to approve task.");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to permanently delete this task?")) return;
    try {
      await apiClient.delete(`/admin/tasks/${taskId}`);
      setTasks(currentTasks => currentTasks.filter(task => task.taskId !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("Failed to delete task.");
    }
  };

  // --- Filter Logic ---
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === "All" || task.status === filterStatus;
    const matchesPriority = filterPriority === "All" || task.priority === filterPriority;
    
    let matchesAssignee = true;
    if (filterAssignee === "Unassigned") {
      matchesAssignee = task.assigneeId === null;
    } else if (filterAssignee !== "All") {
      matchesAssignee = task.assigneeId === filterAssignee;
    }

    return matchesStatus && matchesPriority && matchesAssignee;
  });
  // -------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">IntelliTask AI</h1>
        <Link href="/" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
          <Home size={18} />
          Back to Dashboard
        </Link>
      </header>

      <main className="rounded-lg bg-gray-800 p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-blue-400">AI Task Review Inbox</h2>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            <Plus size={20} /> Create Manual Task
          </button>
        </div>

        {/* --- FILTER BAR --- */}
        <div className="bg-gray-900 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-center border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 font-semibold">
            <Filter size={18} /> Filters:
          </div>
          
          {/* Status Filter */}
          <select 
            className="bg-gray-800 text-white border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="To-Do">To-Do</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Done">Done</option>
          </select>

          {/* Priority Filter */}
          <select 
            className="bg-gray-800 text-white border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          {/* Assignee Filter */}
          <select 
            className="bg-gray-800 text-white border border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="All">All Assignees</option>
            <option value="Unassigned">Unassigned</option>
            {developers.map(dev => (
              <option key={dev.uid} value={dev.uid}>{dev.name}</option>
            ))}
          </select>

          {/* Reset Filters Button */}
          {(filterStatus !== "All" || filterPriority !== "All" || filterAssignee !== "All") && (
            <button 
              onClick={() => {
                setFilterStatus("All");
                setFilterPriority("All");
                setFilterAssignee("All");
              }}
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 ml-auto"
            >
              <XCircle size={16} /> Clear Filters
            </button>
          )}
        </div>
        {/* ------------------ */}
        
        {loading && <p className="text-gray-400">Loading all tasks...</p>}
        {error && <p className="text-red-500">{error}</p>}
        
        {!loading && !error && (
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No tasks match your filters.</p>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.taskId} className={`bg-gray-700 p-4 rounded-lg shadow-lg flex justify-between items-center ${task.isApproved ? "opacity-75" : ""}`}>
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      {task.title}
                      {task.isApproved && (
                        <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full border border-green-700 flex items-center gap-1">
                          <Check size={10} /> Approved
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-300 text-sm mt-1">{task.description}</p>
                    <p className="text-gray-500 text-xs mt-2">Creator: {task.creator}</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 w-48">
                    <AssignmentDisplay assigneeId={task.assigneeId} />
                    <StatusDisplay status={task.status} />
                    <PriorityDisplay priority={task.priority} />
                    
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => setTaskToEdit(task)}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition"
                        title="Edit Task"
                      >
                        <Edit size={16} />
                      </button>

                      <button 
                        onClick={() => handleDelete(task.taskId)}
                        className="text-sm bg-red-600 hover:bg-red-700 text-white p-2 rounded transition"
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>

                      {!task.isApproved && (
                        <button 
                          onClick={() => handleApprove(task.taskId)}
                          className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition font-medium"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {isCreateModalOpen && (
        <CreateTaskModal 
          onClose={() => setIsCreateModalOpen(false)}
          onTaskCreated={fetchData}
        />
      )}

      {taskToEdit && (
        <EditTaskModal
          task={taskToEdit}
          onClose={() => setTaskToEdit(null)}
          onTaskUpdated={fetchData}
        />
      )}
    </div>
  );
}