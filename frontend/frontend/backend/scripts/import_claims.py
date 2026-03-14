#!/usr/bin/env python3
"""
One-time script to import claims from Excel file into Eden database.
Maps columns from ClaimTitan CRM export to Eden's claims schema.
"""

import asyncio
import pandas as pd
import requests
import os
import sys
from datetime import datetime, timezone
from io import BytesIO
import uuid
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv(Path(__file__).parent.parent / '.env')

# Excel file URL
EXCEL_URL = "https://customer-assets.emergentagent.com/job_eden-insurance/artifacts/wxp5de1d_claim_export_2026_02_03_16_27_02.xlsx"


def parse_date(date_str):
    """Parse various date formats from the Excel file."""
    if pd.isna(date_str) or not date_str:
        return None
    
    date_str = str(date_str).strip()
    
    # Try common formats
    formats = [
        "%b %dth %Y",    # Oct 9th 2024
        "%b %dst %Y",    # Oct 1st 2024
        "%b %dnd %Y",    # Oct 2nd 2024
        "%b %drd %Y",    # Oct 3rd 2024
        "%Y-%m-%d",      # 2024-10-09
        "%m/%d/%Y",      # 10/09/2024
    ]
    
    # Remove ordinal suffixes (st, nd, rd, th)
    cleaned = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
    
    for fmt in formats:
        try:
            # Adjust format after removing suffix
            clean_fmt = fmt.replace('th', '').replace('st', '').replace('nd', '').replace('rd', '')
            return datetime.strptime(cleaned, clean_fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    # If all formats fail, return the original string
    return date_str


def clean_phone(phone):
    """Clean and format phone numbers."""
    if pd.isna(phone) or not phone:
        return None
    return str(phone).strip()


def clean_email(email):
    """Validate and clean email addresses."""
    if pd.isna(email) or not email:
        return None
    email = str(email).strip().lower()
    # Basic email validation
    if '@' in email and '.' in email:
        return email
    return None


def clean_value(value, default=None):
    """Clean a value, returning default if empty/NaN."""
    if pd.isna(value) or value == '' or value is None:
        return default
    return str(value).strip()


def parse_currency(value):
    """Parse currency values to float."""
    if pd.isna(value) or value == '' or value is None:
        return 0.0
    try:
        # Remove $ and commas
        cleaned = str(value).replace('$', '').replace(',', '').strip()
        return float(cleaned)
    except ValueError:
        return 0.0


def map_claim_type(peril):
    """Map peril/named loss to claim type."""
    if pd.isna(peril) or not peril:
        return "Property Damage"
    
    peril = str(peril).lower()
    if 'wind' in peril:
        return "Wind/Storm"
    elif 'hurricane' in peril:
        return "Hurricane"
    elif 'flood' in peril:
        return "Flood"
    elif 'fire' in peril:
        return "Fire"
    elif 'hail' in peril:
        return "Hail"
    elif 'water' in peril:
        return "Water Damage"
    else:
        return "Property Damage"


def map_status(status):
    """Map CRM status to Eden status."""
    if pd.isna(status) or not status:
        return "New"
    
    status = str(status).lower()
    if 'closed' in status or 'complete' in status:
        return "Closed"
    elif 'cancel' in status:
        return "Cancelled"
    elif 'pending' in status or 'in progress' in status:
        return "In Progress"
    elif 'review' in status:
        return "Under Review"
    elif 'approved' in status:
        return "Approved"
    else:
        return "New"


async def import_claims():
    """Main import function."""
    print("=" * 60)
    print("EDEN CLAIMS IMPORT SCRIPT")
    print("=" * 60)
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    if not mongo_url:
        print("ERROR: MONGO_URL not set")
        return
    
    db_name = os.environ.get('DB_NAME', 'eden_claims')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"\n✓ Connected to MongoDB: {db_name}")
    
    # Download Excel file
    print(f"\n→ Downloading Excel file...")
    response = requests.get(EXCEL_URL)
    if response.status_code != 200:
        print(f"ERROR: Failed to download file: {response.status_code}")
        return
    
    print(f"✓ Downloaded {len(response.content)} bytes")
    
    # Read Excel into DataFrame
    print("\n→ Parsing Excel data...")
    df = pd.read_excel(BytesIO(response.content), engine='openpyxl')
    print(f"✓ Found {len(df)} rows and {len(df.columns)} columns")
    
    # Get admin user for created_by field
    admin_user = await db.users.find_one({"role": "admin"})
    if not admin_user:
        admin_user = await db.users.find_one({})
    
    created_by = admin_user['id'] if admin_user else "system-import"
    print(f"✓ Claims will be assigned to: {admin_user.get('email', 'system') if admin_user else 'system'}")
    
    # Process each row
    claims_to_insert = []
    skipped = 0
    
    print("\n→ Processing claims...")
    
    for idx, row in df.iterrows():
        # Build claim object
        file_number = clean_value(row.get('File Number'))
        claim_number = clean_value(row.get('Claim Number'))
        
        # Use file number as claim number if no claim number
        final_claim_number = claim_number or file_number or f"IMPORT-{idx+1:05d}"
        
        # Skip if no address (invalid record)
        address = clean_value(row.get('Address'))
        if not address:
            skipped += 1
            continue
        
        # Get policyholder info
        policyholder_name = clean_value(row.get('Policyholder Name'))
        policyholder_first = clean_value(row.get('Policyholder First Name'))
        policyholder_last = clean_value(row.get('Policyholder Last Name'))
        
        # Build client name
        if policyholder_name:
            client_name = policyholder_name
        elif policyholder_first and policyholder_last:
            client_name = f"{policyholder_first} {policyholder_last}"
        elif policyholder_last:
            client_name = policyholder_last
        else:
            client_name = "Unknown Client"
        
        # Get email (prefer policyholder email, fallback to claim email)
        client_email = clean_email(row.get('Policyholder Email'))
        if not client_email:
            client_email = clean_email(row.get('Claim Email'))
        if not client_email:
            # Generate placeholder email
            client_email = f"import.{idx+1}@placeholder.eden"
        
        # Parse date of loss
        date_of_loss = parse_date(row.get('Date of Loss'))
        if not date_of_loss:
            date_of_loss = parse_date(row.get('Storm Date'))
        if not date_of_loss:
            date_of_loss = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Build description
        description_parts = []
        if clean_value(row.get('Description of Loss')):
            description_parts.append(clean_value(row.get('Description of Loss')))
        if clean_value(row.get('Storm Name')):
            description_parts.append(f"Storm: {clean_value(row.get('Storm Name'))}")
        if clean_value(row.get('Insurance Company Name')):
            description_parts.append(f"Insurance: {clean_value(row.get('Insurance Company Name'))}")
        if clean_value(row.get('Team Lead')):
            description_parts.append(f"Team Lead: {clean_value(row.get('Team Lead'))}")
        
        # Build claim document
        claim = {
            "id": str(uuid.uuid4()),
            "claim_number": final_claim_number,
            "client_name": client_name,
            "client_email": client_email,
            "property_address": address,
            "date_of_loss": date_of_loss,
            "claim_type": map_claim_type(row.get('Peril / Named Loss')),
            "policy_number": clean_value(row.get('Policy Number'), "Unknown"),
            "estimated_value": parse_currency(row.get('Initial Estimated Loss')),
            "description": " | ".join(description_parts) if description_parts else "Imported from ClaimTitan CRM",
            "status": map_status(row.get('Claim Status')),
            "assigned_to": None,
            "priority": "Medium",
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # Additional metadata from import
            "import_metadata": {
                "source": "ClaimTitan CRM",
                "original_file_number": file_number,
                "original_claim_number": claim_number,
                "team_lead": clean_value(row.get('Team Lead')),
                "team_lead_email": clean_email(row.get('Team Lead Email')),
                "team_lead_phone": clean_phone(row.get('Team Lead Phone')),
                "insurance_company": clean_value(row.get('Insurance Company Name')),
                "insurance_phone": clean_phone(row.get('Insurance Company Phone')),
                "insurance_email": clean_email(row.get('Insurance Company Email')),
                "policyholder_phone": clean_phone(row.get('Policyholder Phone')),
                "property_rental_status": clean_value(row.get('Property Rental Status')),
                "is_habitable": clean_value(row.get('is Habitable')),
                "roof_age_years": clean_value(row.get('Roof Age (yrs)')),
                "is_fema_assisted": clean_value(row.get('is Fema Assisted')),
                "storm_name": clean_value(row.get('Storm Name')),
                "imported_at": datetime.now(timezone.utc).isoformat()
            }
        }
        
        claims_to_insert.append(claim)
    
    print(f"✓ Processed {len(claims_to_insert)} valid claims")
    print(f"  Skipped {skipped} rows (no address)")
    
    if not claims_to_insert:
        print("\n⚠ No claims to import!")
        return
    
    # Check for existing claims to avoid duplicates
    existing_numbers = set()
    existing_cursor = db.claims.find({}, {"claim_number": 1, "_id": 0})
    async for doc in existing_cursor:
        existing_numbers.add(doc.get("claim_number"))
    
    # Filter out duplicates
    new_claims = [c for c in claims_to_insert if c["claim_number"] not in existing_numbers]
    duplicates = len(claims_to_insert) - len(new_claims)
    
    if duplicates > 0:
        print(f"  Found {duplicates} duplicate claim numbers (will skip)")
    
    if not new_claims:
        print("\n⚠ All claims already exist in database!")
        return
    
    # Insert claims
    print(f"\n→ Inserting {len(new_claims)} new claims into database...")
    result = await db.claims.insert_many(new_claims)
    print(f"✓ Successfully inserted {len(result.inserted_ids)} claims!")
    
    # Print summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Total rows in Excel:     {len(df)}")
    print(f"  Skipped (no address):    {skipped}")
    print(f"  Duplicates skipped:      {duplicates}")
    print(f"  New claims imported:     {len(new_claims)}")
    print("=" * 60)
    
    # Show sample of imported claims
    print("\n→ Sample of imported claims:")
    for claim in new_claims[:5]:
        print(f"  • {claim['claim_number']}: {claim['client_name']} - {claim['property_address'][:40]}...")
    
    if len(new_claims) > 5:
        print(f"  ... and {len(new_claims) - 5} more")
    
    # Close connection
    client.close()
    print("\n✓ Import complete!")


if __name__ == "__main__":
    asyncio.run(import_claims())
