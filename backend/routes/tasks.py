from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from models import TaskCreate, TaskUpdate, Task
from dependencies import db, get_current_active_user
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/", response_model=Task)
async def create_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_active_user),
):
    try:
        task_dict = task_data.model_dump()
        task_dict["created_by"] = current_user["id"]
        task_dict["created_by_name"] = current_user["full_name"]
        task_obj = Task(**task_dict)
        await db.tasks.insert_one(task_obj.model_dump())
        logger.info(f"Task created: {task_obj.id} for claim {task_data.claim_id}")
        return task_obj
    except Exception as e:
        logger.error(f"Create task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/claim/{claim_id}", response_model=List[Task])
async def get_tasks_for_claim(
    claim_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    try:
        query = {"claim_id": claim_id}
        if status:
            query["status"] = status
        tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
        return [Task(**t) for t in tasks]
    except Exception as e:
        logger.error(f"Get tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{task_id}", response_model=Task)
async def update_task(
    task_id: str,
    updates: TaskUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    try:
        task = await db.tasks.find_one({"id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)

        if update_data.get("status") == "completed" and task.get("status") != "completed":
            update_data["completed_at"] = datetime.now(timezone.utc)

        await db.tasks.update_one({"id": task_id}, {"$set": update_data})
        updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        return Task(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    try:
        result = await db.tasks.delete_one({"id": task_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my", response_model=List[Task])
async def get_my_tasks(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """Get all tasks assigned to the current user across all claims."""
    try:
        query = {"assigned_to": current_user["full_name"]}
        if status:
            query["status"] = status
        else:
            query["status"] = {"$ne": "completed"}
        tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
        return [Task(**t) for t in tasks]
    except Exception as e:
        logger.error(f"Get my tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overdue", response_model=List[Task])
async def get_overdue_tasks(
    current_user: dict = Depends(get_current_active_user),
):
    """Get all overdue tasks (due_date in the past, not completed)."""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query = {
            "status": {"$ne": "completed"},
            "due_date": {"$lt": today, "$ne": None, "$exists": True},
        }
        # Non-admin users only see their own
        if current_user.get("role") not in ("admin", "manager"):
            query["assigned_to"] = current_user["full_name"]
        tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
        return [Task(**t) for t in tasks]
    except Exception as e:
        logger.error(f"Get overdue tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
