#!/usr/bin/env python3
"""
Complete Background Removal Script for ALL Operation Eden Icons
Uses rembg library to remove backgrounds from all AI-generated images
"""
import os
import requests
from PIL import Image
from rembg import remove
from io import BytesIO

# ALL Icon URLs to process - TIER BADGES
TIER_BADGES = {
    "recruit": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/9b95d27c4d7f377506d490b04627ede29cbdafe93b09f508063d10c01377bd0e.png",
    "agent": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/9d6c0c40b2dea2bd012ad8e1a0bfdb0b483f9fac1aaa3a2f56d1e959e92c405d.png",
    "veteran": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/866aa2ea410e08d6ad8d03e8abc4e3cac7cee5327da288ae1b2456363106517a.png",
    "elite": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/c0eb7c9311917226b0fcc9bf173a72e604c7d987863d89ee21d99bb05f0b261d.png",
    "commander": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/e075197c8e0111d57a939ba4abe5c5bfbf431b202fcfc068aaf40a50048b2b33.png",
    "apex": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/610a1cfaac6c2fc9d6f15cdc9b336dcaa335377856fa5d843dc9cfc5b902f8c1.png",
    "legend": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/7d3c319499fa4e0684a95f3150ace49f68c7c43f01984baecf2175e3fac8ec47.png",
    "field_marshal": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/d0119567cb462b07f0adf39126280a6c7086b7df8325a0640ded4a4639d75ed4.png",
}

# UI Icons
UI_ICONS = {
    "xp_orb": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/11f6923b8aabe2edb63afb805283d746b3f23e86d486e148a9c73deba2e06060.png",
    "leaderboard_crown": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/30fc38c4c44d1a75d5423e25c1928453ea2699fa50a7576ea0fa256d8e6b0518.png",
    "daily_streak": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/24620aafe5d48bd2831ac4542785f3e342baae7cf6e8f7787157169a0b3b0f8c.png",
    "mission_complete": "https://static.prod-images.emergentagent.com/jobs/b7d5e59a-b409-4372-bf3a-f9017daf303e/images/a156a66761140c1bba0c9050aac3df5fadd3dcc2cf05fcd531451ba9d440160e.png",
}

OUTPUT_DIR = "/app/frontend/public/icons"

def download_image(url):
    """Download image from URL"""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return Image.open(BytesIO(response.content))

def remove_background(image):
    """Remove background using rembg"""
    img_byte_arr = BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    output = remove(img_byte_arr.read())
    return Image.open(BytesIO(output))

def process_icons(icons_dict, prefix=""):
    """Process a dictionary of icons"""
    processed = {}
    for name, url in icons_dict.items():
        full_name = f"{prefix}{name}" if prefix else name
        print(f"Processing {full_name}...")
        try:
            img = download_image(url)
            print(f"  Downloaded: {img.size}")
            
            img_no_bg = remove_background(img)
            print(f"  Background removed")
            
            output_path = os.path.join(OUTPUT_DIR, f"{full_name}.png")
            img_no_bg.save(output_path, format='PNG')
            print(f"  Saved to: {output_path}")
            
            processed[full_name] = output_path
        except Exception as e:
            print(f"  ERROR: {e}")
    return processed

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    all_processed = {}
    
    # Process tier badges
    print("\n=== PROCESSING TIER BADGES ===")
    tier_processed = process_icons(TIER_BADGES, "tier_")
    all_processed.update(tier_processed)
    
    # Process UI icons
    print("\n=== PROCESSING UI ICONS ===")
    ui_processed = process_icons(UI_ICONS, "ui_")
    all_processed.update(ui_processed)
    
    print("\n=== ALL COMPLETED ===")
    print(f"Total processed: {len(all_processed)} icons")
    for name, path in all_processed.items():
        print(f"  {name}: {path}")
    
    return all_processed

if __name__ == "__main__":
    main()
