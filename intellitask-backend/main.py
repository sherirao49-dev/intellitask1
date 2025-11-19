import uvicorn
import firebase_admin
import uuid 
import os 
import json 
from dotenv import load_dotenv 
import google.generativeai as genai 
from datetime import datetime 
from fastapi.middleware.cors import CORSMiddleware 

from firebase_admin import credentials, auth, firestore
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import EmailStr, BaseModel 
from typing import List, Dict, Any 

# Import all our models and enums from models.py
from models import (
    TokenData, Role, User, Project, ProjectCreate, UserSkillsUpdate, 
    SrsInput, Task, TaskStatus, TaskPriority, Comment, CommentCreate, TaskCreate 
)

# --- Load Environment Variables ---
load_dotenv() 

# --- Configure Gemini API ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env file. AI features will fail.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("Gemini API configured successfully.")
    except Exception as e:
        print(f"Error configuring Gemini API: {e}")


# --- Firebase Admin SDK Initialization ---
db = None 

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("firebase-service-account.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin SDK and Firestore client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}")
        pass
else:
    print("Firebase Admin SDK already initialized.")
    db = firestore.client()


# --- FastAPI App Initialization ---
app = FastAPI(
    title="IntelliTask AI System API",
    description="API for managing tasks, projects, and AI generation.",
    version="0.1.0"
)

# --- CORS Middleware ---
origins = [
    "http://localhost:3000", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# --- Database Dependency ---
async def get_db():
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firestore client is not initialized."
        )
    return db


# --- Security & Authentication ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db_client = Depends(get_db)
):
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")

        if not uid or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: UID or email not found.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_ref = db_client.collection('users').document(uid)
        user_doc = user_ref.get()

        if user_doc.exists:
            user_data = user_doc.to_dict()
            role = user_data.get('role', Role.DEVELOPER) 
            
            if user_data.get('email') != email:
                 user_ref.update({'email': email})

        else:
            print(f"New user. Creating profile for UID: {uid}")
            firebase_user = auth.get_user(uid)
            display_name = firebase_user.display_name or "New User"

            new_user = User(
                uid=uid,
                email=email,
                name=display_name,
                role=Role.DEVELOPER,
                skills=[]
            )
            user_ref.set(new_user.model_dump())
            role = Role.DEVELOPER

        return TokenData(uid=uid, email=email, role=role)

    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during authentication: {e}"
        )


# --- RBAC (Role-Based Access Control) Dependencies ---

async def get_admin_user(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. Admin access required."
        )
    return current_user

async def get_developer_user(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != Role.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. Developer access required."
        )
    return current_user

# --- Task & Comment Permission Helper ---

async def check_task_access(
    task_id: str,
    current_user: TokenData = Depends(get_current_user),
    db_client = Depends(get_db)
) -> Task:
    try:
        task_ref = db_client.collection('tasks').document(task_id)
        task_doc = task_ref.get()

        if not task_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Task not found"
            )
        
        task = Task(**task_doc.to_dict())
        
        if current_user.role == Role.ADMIN:
            return task 
        
        if current_user.role == Role.DEVELOPER:
            if task.assigneeId == current_user.uid and task.isApproved:
                return task
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to access this task."
                )
        
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking task access: {e}")


# --- AI Task Generation Endpoint (Admin Only) ---

def build_ai_prompt(srs_text: str, developers: List[User]) -> str:
    dev_list_str = "\n".join(
        [f"- UserID: {dev.uid}, Name: {dev.name}, Skills: {', '.join(dev.skills)}" for dev in developers]
    )
    if not dev_list_str:
        dev_list_str = "No developers available."

    prompt = f"""
    You are an expert Project Manager AI. Your job is to parse a Software Requirements Specification (SRS) document and break it down into actionable tasks for a development team.

    You must return your response as a single, valid JSON array of task objects. Do not include any text before or after the JSON array.

    Here is the list of available developers and their skills:
    --- DEVELOPER LIST ---
    {dev_list_str}
    --- END DEVELOPER LIST ---

    Here is the Software Requirements Specification (SRS):
    --- SRS ---
    {srs_text}
    --- END SRS ---

    Now, please generate the list of tasks. For each task, provide:
    1. "title": A concise, clear task title.
    2. "description": A detailed description of what needs to be done.
    3. "priority": Assign a priority ('Low', 'Medium', 'High', 'Critical').
    4. "assigneeId": Based on the developer list, intelligently assign this task to the developer whose skills best match the task. Use their UserID. If no developer is a good match, or if it's a general task, set this value to null.
    5. "notes": Any extra context or reasoning for the assignment.

    Remember, the output MUST be a valid JSON array.
    """
    return prompt

@app.get("/admin/list-models", summary="List available AI models (Admin Only)")
async def list_models(admin_user: TokenData = Depends(get_admin_user)):
    try:
        print("Listing available AI models...")
        models_list = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models_list.append(m.name)
        
        return {"models": models_list}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {e}"
        )

@app.post("/admin/generate-tasks", 
          summary="Generate tasks from SRS text (Admin Only)")
async def generate_tasks_from_srs(
    srs_data: SrsInput,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini API is not configured on the server."
        )
    
    try:
        users_ref = db_client.collection('users').where(
            field_path='role', 
            op_string='==', 
            value=Role.DEVELOPER
        ).stream()
        
        developer_list = [User(**user.to_dict()) for user in users_ref]

        prompt = build_ai_prompt(srs_data.srs_text, developer_list)

        print("Sending prompt to Gemini API...")
        
        model = genai.GenerativeModel('models/gemini-pro-latest') 

        response = model.generate_content(prompt)

        ai_response_text = response.text.strip().replace("```json", "").replace("```", "")
        
        try:
            task_list_json: List[Dict[str, Any]] = json.loads(ai_response_text)
        except json.JSONDecodeError:
            print(f"Error: Gemini response was not valid JSON.\nResponse:\n{response.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI returned an invalid response. Please try again."
            )

        print(f"Received {len(task_list_json)} tasks from AI. Saving to Firestore...")
        created_tasks = []
        batch = db_client.batch() 

        for task_json in task_list_json:
            task_id = str(uuid.uuid4())
            
            description = task_json.get('description', 'No description provided.')
            notes = task_json.get('notes')
            if notes:
                description += f"\n\n--- AI Notes ---\n{notes}"

            new_task = Task(
                taskId=task_id,
                projectId=srs_data.project_id,
                title=task_json.get('title', 'Untitled Task'),
                description=description,
                priority=TaskPriority(task_json.get('priority', 'Medium')),
                status=TaskStatus.TO_DO,
                assigneeId=task_json.get('assigneeId'),
                creator=f"Generated by AI (Admin: {admin_user.email})",
                isApproved=False 
            )

            task_ref = db_client.collection('tasks').document(task_id)
            batch.set(task_ref, new_task.model_dump())
            created_tasks.append(new_task)

        batch.commit()
        
        return {
            "message": f"Successfully generated and saved {len(created_tasks)} tasks.",
            "tasks": created_tasks
        }

    except Exception as e:
        print(f"Error in AI task generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{e}" 
        )


# --- Project Management Endpoints (Admin Only) ---

@app.post("/projects", 
          summary="Create a new project (Admin Only)", 
          response_model=Project)
async def create_project(
    project_data: ProjectCreate,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        project_id = str(uuid.uuid4())
        
        new_project = Project(
            projectId=project_id,
            title=project_data.title,
            description=project_data.description
        )
        
        project_ref = db_client.collection('projects').document(project_id)
        project_ref.set(new_project.model_dump()) 
        
        return new_project
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {e}"
        )

@app.get("/projects", 
         summary="Get all projects (Admin Only)", 
         response_model=List[Project])
async def get_all_projects(
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        projects_ref = db_client.collection('projects').stream()
        projects_list = [Project(**project.to_dict()) for project in projects_ref]
        return projects_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve projects: {e}"
        )

# --- NEW: UPDATE & DELETE PROJECT (Added to match requirements) ---
@app.delete("/projects/{project_id}",
            summary="Delete a project (Admin Only)",
            status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        project_ref = db_client.collection('projects').document(project_id)
        project_ref.delete()
        return None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {e}"
        )

@app.put("/projects/{project_id}", 
         summary="Update a project (Admin Only)",
         response_model=Project)
async def update_project(
    project_id: str, 
    project_data: ProjectCreate, 
    admin_user: TokenData = Depends(get_admin_user), 
    db_client = Depends(get_db)
):
    try:
        project_ref = db_client.collection('projects').document(project_id)
        if not project_ref.get().exists:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_ref.update({
            "title": project_data.title, 
            "description": project_data.description
        })
        return Project(**project_ref.get().to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {e}")
# ---------------------------------------------------------

@app.get("/projects/{project_id}", 
         summary="Get a single project (Admin Only)", 
         response_model=Project)
async def get_project_by_id(
    project_id: str,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        project_ref = db_client.collection('projects').document(project_id)
        project_doc = project_ref.get()
        
        if not project_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        return Project(**project_doc.to_dict())
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve project: {e}"
        )


# --- 5. ADMIN TASK MANAGEMENT ---

@app.get("/admin/tasks",
         summary="Get all tasks from all projects (Admin Only)",
         response_model=List[Task])
async def get_all_tasks(
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        tasks_ref = db_client.collection('tasks').order_by("createdAt", direction="DESCENDING").stream()
        tasks_list = []
        for task in tasks_ref:
            tasks_list.append(Task(**task.to_dict()))
        return tasks_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve all tasks: {e}"
        )

@app.put("/admin/tasks/{task_id}/approve",
         summary="Approve a task (Admin Only)",
         response_model=Task)
async def approve_task(
    task_id: str,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        task_ref = db_client.collection('tasks').document(task_id)
        task_doc = task_ref.get()
        
        if not task_doc.exists:
            raise HTTPException(status_code=404, detail="Task not found")
            
        update_data = {
            "isApproved": True,
            "updatedAt": datetime.now()
        }
        task_ref.update(update_data)
        
        updated_task = task_ref.get()
        return Task(**updated_task.to_dict())

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve task: {e}"
        )

@app.post("/admin/tasks",
          summary="Manually create a new task (Admin Only)",
          response_model=Task)
async def create_manual_task(
    task_data: TaskCreate,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        task_id = str(uuid.uuid4())
        
        new_task = Task(
            taskId=task_id,
            projectId=task_data.projectId,
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            assigneeId=task_data.assigneeId,
            status=TaskStatus.TO_DO,
            creator=f"Admin: {admin_user.email}",
            isApproved=True 
        )
        
        task_ref = db_client.collection('tasks').document(task_id)
        task_ref.set(new_task.model_dump())
        
        return new_task
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create manual task: {e}"
        )

@app.delete("/admin/tasks/{task_id}",
            summary="Delete a task (Admin Only)",
            status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        task_ref = db_client.collection('tasks').document(task_id)
        task_ref.delete()
        return None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete task: {e}"
        )

# --- NEW: UPDATE TASK (EDIT) ---
@app.put("/admin/tasks/{task_id}",
         summary="Update a task manually (Admin Only)",
         response_model=Task)
async def update_task(
    task_id: str,
    task_data: TaskCreate, # Reusing the create model for update
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        task_ref = db_client.collection('tasks').document(task_id)
        if not task_ref.get().exists:
            raise HTTPException(status_code=404, detail="Task not found")

        update_data = {
            "title": task_data.title,
            "description": task_data.description,
            "priority": task_data.priority,
            "assigneeId": task_data.assigneeId,
            "projectId": task_data.projectId,
            "updatedAt": datetime.now()
        }
        task_ref.update(update_data)
        return Task(**task_ref.get().to_dict())
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update task: {e}"
        )
# ----------------------------------


# --- 6. USER MANAGEMENT (NEW SECTION) ---

class UserRoleUpdate(BaseModel):
    role: Role

@app.get("/admin/users", 
         summary="Get all users (Admin Only)", 
         response_model=List[User])
async def get_all_users(
    admin_user: TokenData = Depends(get_admin_user), 
    db_client = Depends(get_db)
):
    """List all users for the Admin dashboard."""
    try:
        users_ref = db_client.collection('users').stream()
        return [User(**u.to_dict()) for u in users_ref]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {e}")

@app.put("/admin/users/{user_id}/role", 
         summary="Update user role (Admin Only)")
async def update_user_role(
    user_id: str, 
    role_data: UserRoleUpdate, 
    admin_user: TokenData = Depends(get_admin_user), 
    db_client = Depends(get_db)
):
    """Allows an Admin to promote/demote a user."""
    try:
        db_client.collection('users').document(user_id).update({"role": role_data.role})
        return {"message": "Role updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update role: {e}")

@app.delete("/admin/users/{user_id}", 
            summary="Delete user (Admin Only)", 
            status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str, 
    admin_user: TokenData = Depends(get_admin_user), 
    db_client = Depends(get_db)
):
    """Removes a user from Firestore AND Firebase Authentication."""
    try:
        db_client.collection('users').document(user_id).delete()
        auth.delete_user(user_id)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {e}")

# --------------------------------------


# --- 7. DEVELOPER FEATURES ---
    
@app.put("/users/me/skills",
         summary="Update current user's skills (Developer Only)",
         response_model=UserSkillsUpdate)
async def update_my_skills(
    skills_data: UserSkillsUpdate,
    current_user: TokenData = Depends(get_developer_user),
    db_client = Depends(get_db)
):
    try:
        user_ref = db_client.collection('users').document(current_user.uid)
        user_ref.update({"skills": skills_data.model_dump().get("skills")})
        return skills_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update skills: {e}"
        )

@app.get("/admin/developers",
         summary="Get all developers and their skills (Admin Only)",
         response_model=List[User])
async def get_all_developers(
    admin_user: TokenData = Depends(get_admin_user),
    db_client = Depends(get_db)
):
    try:
        users_ref = db_client.collection('users').where(
            field_path='role', 
            op_string='==', 
            value=Role.DEVELOPER
        ).stream()
        
        developer_list = [User(**user.to_dict()) for user in users_ref]
        return developer_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve developers: {e}"
        )

# --- Developer Task Endpoints ---

class TaskStatusUpdate(BaseModel):
    status: TaskStatus

@app.get("/tasks/my", 
         summary="Get all tasks assigned to me (Developer Only)", 
         response_model=List[Task])
async def get_my_tasks(
    current_user: TokenData = Depends(get_developer_user),
    db_client = Depends(get_db)
):
    try:
        tasks_ref = db_client.collection('tasks').where(
            field_path='assigneeId', 
            op_string='==', 
            value=current_user.uid
        ).where(
            field_path='isApproved', 
            op_string='==',
            value=True
        ).stream()
        
        tasks_list = [Task(**task.to_dict()) for task in tasks_ref]
        return tasks_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tasks: {e}"
        )

@app.put("/tasks/{task_id}/status", 
         summary="Update a task's status (Developer Only)", 
         response_model=Task)
async def update_my_task_status(
    task_id: str,
    status_update: TaskStatusUpdate,
    current_user: TokenData = Depends(get_developer_user),
    db_client = Depends(get_db)
):
    try:
        task = await check_task_access(task_id, current_user, db_client)
        db_client.collection('tasks').document(task_id).update({"status": status_update.status.value, "updatedAt": datetime.now()})
        return Task(**db_client.collection('tasks').document(task_id).get().to_dict())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update task status: {e}"
        )


# --- 8. COLLABORATION (COMMENTS) ---

@app.post("/tasks/{task_id}/comments",
          summary="Add a comment to a task",
          response_model=Comment)
async def create_comment(
    task_id: str,
    comment_data: CommentCreate,
    task: Task = Depends(check_task_access),
    current_user: TokenData = Depends(get_current_user),
    db_client = Depends(get_db)
):
    try:
        user_ref = db_client.collection('users').document(current_user.uid)
        user_doc = user_ref.get()
        author_name = user_doc.to_dict().get('name', 'Unknown User')

        comment_id = str(uuid.uuid4())
        
        new_comment = Comment(
            commentId=comment_id,
            taskId=task_id,
            authorId=current_user.uid,
            authorName=author_name,
            text=comment_data.text
        )
        
        comment_ref = db_client.collection('tasks').document(task_id).collection('comments').document(comment_id)
        comment_ref.set(new_comment.model_dump())
        
        return new_comment
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create comment: {e}"
        )

@app.get("/tasks/{task_id}/comments",
         summary="Get all comments for a task",
         response_model=List[Comment])
async def get_comments(
    task_id: str,
    task: Task = Depends(check_task_access),
    db_client = Depends(get_db)
):
    try:
        comments_ref = db_client.collection('tasks').document(task_id).collection('comments').order_by('timestamp').stream()
        
        comments_list = [Comment(**comment.to_dict()) for comment in comments_ref]
        return comments_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve comments: {e}"
        )


# --- 9. GENERAL ROUTES ---

@app.get("/users/me", summary="Get current user's info")
async def read_users_me(current_user: TokenData = Depends(get_current_user), db_client = Depends(get_db)):
    user_doc = db_client.collection('users').document(current_user.uid).get()
    if user_doc.exists:
        return user_doc.to_dict()
    return {
        "message": "Authentication successful!",
        "uid": current_user.uid,
        "email": current_user.email,
        "role": current_user.role
    }

@app.get("/")
async def root():
    return {"message": "Welcome to the IntelliTask API!"}


# --- SERVER RUNNER ---
if __name__ == "__main__":
    print("Starting Uvicorn server...")
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )