from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import List, Optional
from enum import Enum

# --- Enums ---
class Role(str, Enum):
    ADMIN = "admin"
    DEVELOPER = "developer"

class TaskStatus(str, Enum):
    TO_DO = "To-Do"
    IN_PROGRESS = "In Progress"
    IN_REVIEW = "In Review"
    DONE = "Done"

class TaskPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# --- Base Models (for Firestore documents) ---

class User(BaseModel):
    uid: str = Field(..., description="Firebase Auth User ID")
    email: EmailStr
    name: str
    role: Role = Role.DEVELOPER 
    skills: List[str] = Field(default_factory=list, description="List of developer skills")

class Project(BaseModel):
    projectId: str = Field(..., description="Unique Project ID")
    title: str
    description: str
    memberIds: List[str] = Field(default_factory=list, description="List of user UIDs assigned to this project")

class Task(BaseModel):
    taskId: str = Field(..., description="Unique Task ID") 
    projectId: str = Field(..., description="Links to a Project") 
    title: str 
    description: str 
    status: TaskStatus = TaskStatus.TO_DO 
    priority: TaskPriority = TaskPriority.MEDIUM 
    assigneeId: Optional[str] = None 
    creator: str 
    isApproved: bool = False  # <-- THIS IS THE NEW FIELD
    createdAt: datetime = Field(default_factory=datetime.now) 
    updatedAt: datetime = Field(default_factory=datetime.now) 

class Comment(BaseModel):
    commentId: str = Field(..., description="Unique Comment ID")
    taskId: str = Field(..., description="Links to a Task")
    authorId: str
    authorName: str 
    text: str
    timestamp: datetime = Field(default_factory=datetime.now) 


# --- API Request/Response Models ---

class ProjectCreate(BaseModel):
    title: str
    description: str

class TaskCreate(BaseModel):
    projectId: str
    title: str
    description: str
    priority: TaskPriority = TaskPriority.MEDIUM
    assigneeId: Optional[str] = None

class CommentCreate(BaseModel):
    text: str

class UserSkillsUpdate(BaseModel):
    skills: List[str]

class SrsInput(BaseModel):
    srs_text: str
    project_id: str

# --- Authentication Models ---

class TokenData(BaseModel):
    uid: str
    email: EmailStr | None = None
    role: Role