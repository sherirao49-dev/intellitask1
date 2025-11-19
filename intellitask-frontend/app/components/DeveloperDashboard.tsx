"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import TaskCommentModal from "./TaskCommentModal";
import {
  Clock, ListTodo, AlertCircle, CheckCircle, Loader, CircleDot, FileWarning, ChevronUp, ChevronDown, MessageSquare, GripVertical
} from "lucide-react";
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent, useSensors, useSensor, PointerSensor } from "@dnd-kit/core";

// --- Enums ---
const TASK_STATUSES = ["To-Do", "In Progress", "In Review", "Done"];

interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
}

// --- Draggable Task Card ---
function TaskCard({ task, onOpenComments, isOverlay = false }: { task: Task, onOpenComments?: (id: string, title: string) => void, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.taskId,
    data: { task }
  });

  // Styling for the drag movement
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Helper for styles
  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case "Low": return { icon: <ChevronDown size={16} />, color: "text-green-500" };
      case "Medium": return { icon: <Clock size={16} />, color: "text-yellow-500" };
      case "High": return { icon: <ChevronUp size={16} />, color: "text-orange-500" };
      case "Critical": return { icon: <AlertCircle size={16} />, color: "text-red-500" };
      default: return { icon: <Clock size={16} />, color: "text-gray-400" };
    }
  };
  const priorityInfo = getPriorityInfo(task.priority);

  // If this card is being dragged (the original one), we hide it so it looks like it's moving
  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="opacity-30 bg-gray-700 p-5 rounded-lg border border-gray-600 h-[150px]">
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 w-full group relative ${isOverlay ? 'cursor-grabbing rotate-3 scale-105 shadow-2xl z-50' : 'hover:border-gray-500'}`}
    >
      {/* Drag Handle */}
      <div {...listeners} {...attributes} className="absolute top-3 right-3 cursor-grab text-gray-500 hover:text-white">
        <GripVertical size={18} />
      </div>

      <h3 className="text-lg font-bold text-white mb-2 pr-6">{task.title}</h3>
      
      <p className="text-gray-400 text-xs mb-3 line-clamp-2">
        {task.description}
      </p>
      
      <div className="flex justify-between items-center mt-3">
        <span className={`flex items-center gap-1 text-xs ${priorityInfo.color} font-medium`}>
          {priorityInfo.icon}
          {task.priority}
        </span>

        {/* Only show comment button if not dragging/overlay */}
        {!isOverlay && onOpenComments && (
          <button 
            onClick={() => onOpenComments(task.taskId, task.title)}
            className="text-gray-400 hover:text-white text-xs flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
          >
            <MessageSquare size={14} /> Comments
          </button>
        )}
      </div>
    </div>
  );
}

// --- Droppable Column ---
function KanbanColumn({ title, tasks, titleColor, statusId, onOpenComments }: { title: string, tasks: Task[], titleColor: string, statusId: string, onOpenComments: any }) {
  const { setNodeRef, isOver } = useDroppable({
    id: statusId,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] rounded-xl p-4 transition-colors ${isOver ? 'bg-gray-800/50 border-2 border-blue-500/50' : 'bg-gray-900 border border-gray-800'}`}
    >
      <h3 className={`text-sm font-bold mb-4 ${titleColor} uppercase tracking-wider flex items-center justify-between`}>
        {title}
        <span className="bg-gray-800 text-white px-2 py-0.5 rounded-full text-xs">{tasks.length}</span>
      </h3>
      
      <div className="space-y-3 min-h-[200px]">
        {tasks.map((task) => (
          <TaskCard key={task.taskId} task={task} onOpenComments={onOpenComments} />
        ))}
        {tasks.length === 0 && !isOver && (
          <div className="h-24 border-2 border-dashed border-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Dashboard ---
export default function DeveloperDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null); // For drag overlay
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string | null>(null);

  // Use sensors for better drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts (prevents accidental clicks)
      },
    })
  );

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const taskData = await apiClient.get("/tasks/my"); 
      setTasks(taskData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task;
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;
    
    // Find current task to check if status actually changed
    const currentTask = tasks.find(t => t.taskId === taskId);
    if (currentTask && currentTask.status !== newStatus) {
      
      // 1. Optimistic Update (Update UI immediately)
      setTasks(prev => prev.map(t => 
        t.taskId === taskId ? { ...t, status: newStatus } : t
      ));

      // 2. Call API
      try {
        await apiClient.put(`/tasks/${taskId}/status`, { status: newStatus });
      } catch (err) {
        console.error("Failed to update status", err);
        // Revert on failure
        fetchTasks();
      }
    }
  };

  const handleOpenComments = (id: string, title: string) => {
    setSelectedTaskId(id);
    setSelectedTaskTitle(title);
  };

  if (loading && tasks.length === 0) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="h-full">
       <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">My Tasks</h2>
        <button onClick={fetchTasks} className="text-sm text-blue-400 hover:underline">Refresh Board</button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-8 h-[calc(100vh-200px)] items-start">
          <KanbanColumn title="To Do" statusId="To-Do" tasks={tasks.filter(t => t.status === "To-Do")} titleColor="text-gray-400" onOpenComments={handleOpenComments} />
          <KanbanColumn title="In Progress" statusId="In Progress" tasks={tasks.filter(t => t.status === "In Progress")} titleColor="text-blue-400" onOpenComments={handleOpenComments} />
          <KanbanColumn title="In Review" statusId="In Review" tasks={tasks.filter(t => t.status === "In Review")} titleColor="text-yellow-400" onOpenComments={handleOpenComments} />
          <KanbanColumn title="Done" statusId="Done" tasks={tasks.filter(t => t.status === "Done")} titleColor="text-green-400" onOpenComments={handleOpenComments} />
        </div>

        {/* Overlay shows the card while dragging */}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTaskId && selectedTaskTitle && (
        <TaskCommentModal
          taskId={selectedTaskId}
          taskTitle={selectedTaskTitle}
          onClose={() => { setSelectedTaskId(null); setSelectedTaskTitle(null); }}
        />
      )}
    </div>
  );
}