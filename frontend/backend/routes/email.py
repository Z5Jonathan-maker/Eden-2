from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from dependencies import get_current_active_user, require_role
from services.email_service import send_email, is_email_configured
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email", tags=["email"])

class EmailTestRequest(BaseModel):
    to_email: EmailStr
    
class EmailConfigStatus(BaseModel):
    configured: bool
    sender_email: str

@router.get("/status", response_model=EmailConfigStatus)
async def get_email_status(current_user: dict = Depends(require_role(["admin", "adjuster"]))):
    """Check if email service is configured"""
    gmail_user = os.environ.get('GMAIL_USER', '')
    return EmailConfigStatus(
        configured=is_email_configured(),
        sender_email=gmail_user if gmail_user else 'Not configured'
    )

@router.post("/test")
async def send_test_email(
    request: EmailTestRequest,
    current_user: dict = Depends(require_role(["admin"]))
):
    """Send a test email to verify configuration"""
    if not is_email_configured():
        raise HTTPException(
            status_code=400, 
            detail="Email service not configured. Please add RESEND_API_KEY to your environment."
        )
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #ea580c; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Eden Claims Management</h1>
            </div>
            <div class="content">
                <h2>Test Email</h2>
                <p>This is a test email from Eden Claims Management.</p>
                <p>If you received this email, your email configuration is working correctly!</p>
                <p><strong>Sent by:</strong> {current_user['full_name']}</p>
            </div>
            <div class="footer">
                <p>© 2024 Eden Claims Management. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    result = await send_email(
        to_email=request.to_email,
        subject="Test Email from Eden Claims Management",
        html_content=html_content
    )
    
    if result["status"] == "success":
        return {"message": f"Test email sent to {request.to_email}", "email_id": result.get("email_id")}
    else:
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to send email"))
