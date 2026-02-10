import os
import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Gmail SMTP Configuration
GMAIL_USER = os.environ.get('GMAIL_USER', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')
SENDER_NAME = os.environ.get('SENDER_NAME', 'Eden Claims')

def is_email_configured():
    """Check if email service is configured"""
    return bool(GMAIL_USER and GMAIL_APP_PASSWORD)

async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send an email using Gmail SMTP"""
    if not is_email_configured():
        logger.warning("Email service not configured. Skipping email send.")
        return {"status": "skipped", "message": "Email service not configured"}
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SENDER_NAME} <{GMAIL_USER}>"
        msg['To'] = to_email
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Send via Gmail SMTP (run in thread to not block)
        def send_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                server.send_message(msg)
        
        await asyncio.to_thread(send_sync)
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return {
            "status": "success",
            "message": f"Email sent to {to_email}"
        }
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"status": "error", "message": str(e)}

# Email templates
def get_claim_created_email(client_name: str, claim_number: str, claim_type: str, property_address: str) -> str:
    """Generate email for new claim created"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #ea580c; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .claim-info {{ background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            .btn {{ display: inline-block; padding: 12px 24px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 6px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Eden Claims Management</h1>
            </div>
            <div class="content">
                <h2>Hello {client_name},</h2>
                <p>Your insurance claim has been successfully submitted and is being processed.</p>
                
                <div class="claim-info">
                    <p><strong>Claim Number:</strong> {claim_number}</p>
                    <p><strong>Claim Type:</strong> {claim_type}</p>
                    <p><strong>Property:</strong> {property_address}</p>
                    <p><strong>Status:</strong> New</p>
                </div>
                
                <p>Our team will review your claim and keep you updated on its progress. You can track your claim status anytime through our client portal.</p>
            </div>
            <div class="footer">
                <p>© 2024 Eden Claims Management. All rights reserved.</p>
                <p>If you have questions, contact us at support@eden-claims.com</p>
            </div>
        </div>
    </body>
    </html>
    """

def get_status_change_email(client_name: str, claim_number: str, old_status: str, new_status: str, claim_type: str) -> str:
    """Generate email for claim status change"""
    status_messages = {
        'In Progress': 'Your claim is now being actively worked on by our team.',
        'Under Review': 'Your claim is under review. We are evaluating all documentation.',
        'Completed': 'Great news! Your claim has been completed. Please check the portal for details.',
        'Closed': 'Your claim has been closed. Contact us if you have any questions.'
    }
    
    status_message = status_messages.get(new_status, f'Your claim status has been updated to {new_status}.')
    
    status_color = {
        'New': '#3b82f6',
        'In Progress': '#f59e0b',
        'Under Review': '#8b5cf6',
        'Completed': '#22c55e',
        'Closed': '#6b7280'
    }.get(new_status, '#6b7280')
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #ea580c; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .status-badge {{ display: inline-block; padding: 8px 16px; background-color: {status_color}; color: white; border-radius: 20px; font-weight: bold; }}
            .claim-info {{ background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Eden Claims Management</h1>
            </div>
            <div class="content">
                <h2>Hello {client_name},</h2>
                <p>There's an update on your insurance claim:</p>
                
                <div class="claim-info">
                    <p><strong>Claim Number:</strong> {claim_number}</p>
                    <p><strong>Claim Type:</strong> {claim_type}</p>
                    <p><strong>Previous Status:</strong> {old_status}</p>
                    <p><strong>New Status:</strong> <span class="status-badge">{new_status}</span></p>
                </div>
                
                <p>{status_message}</p>
            </div>
            <div class="footer">
                <p>© 2024 Eden Claims Management. All rights reserved.</p>
                <p>If you have questions, contact us at support@eden-claims.com</p>
            </div>
        </div>
    </body>
    </html>
    """

def get_claim_assigned_email(client_name: str, claim_number: str, adjuster_name: str) -> str:
    """Generate email when adjuster is assigned"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #ea580c; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .claim-info {{ background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Eden Claims Management</h1>
            </div>
            <div class="content">
                <h2>Hello {client_name},</h2>
                <p>Good news! An adjuster has been assigned to your claim.</p>
                
                <div class="claim-info">
                    <p><strong>Claim Number:</strong> {claim_number}</p>
                    <p><strong>Assigned Adjuster:</strong> {adjuster_name}</p>
                </div>
                
                <p>Your assigned adjuster will be reviewing your claim and may contact you for additional information. You can track all updates through your client portal.</p>
            </div>
            <div class="footer">
                <p>© 2024 Eden Claims Management. All rights reserved.</p>
                <p>If you have questions, contact us at support@eden-claims.com</p>
            </div>
        </div>
    </body>
    </html>
    """

# Functions to send specific notification emails
async def send_claim_created_notification(client_email: str, client_name: str, claim_number: str, claim_type: str, property_address: str):
    """Send notification when a claim is created"""
    html = get_claim_created_email(client_name, claim_number, claim_type, property_address)
    return await send_email(
        to_email=client_email,
        subject=f"Claim {claim_number} Submitted Successfully - Eden",
        html_content=html
    )

async def send_status_change_notification(client_email: str, client_name: str, claim_number: str, old_status: str, new_status: str, claim_type: str):
    """Send notification when claim status changes"""
    html = get_status_change_email(client_name, claim_number, old_status, new_status, claim_type)
    return await send_email(
        to_email=client_email,
        subject=f"Claim {claim_number} Status Update: {new_status} - Eden",
        html_content=html
    )

async def send_assignment_notification(client_email: str, client_name: str, claim_number: str, adjuster_name: str):
    """Send notification when adjuster is assigned"""
    html = get_claim_assigned_email(client_name, claim_number, adjuster_name)
    return await send_email(
        to_email=client_email,
        subject=f"Adjuster Assigned to Claim {claim_number} - Eden",
        html_content=html
    )
