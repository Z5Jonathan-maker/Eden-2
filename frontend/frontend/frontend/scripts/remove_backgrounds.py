#!/usr/bin/env python3
"""
Background Removal Script for Operation Eden Icons
Uses rembg library to remove backgrounds from AI-generated images
"""
import os
import requests
from PIL import Image
from rembg import remove
from io import BytesIO
import base64

# Icon URLs to process
ICONS = {
    "app_logo": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/2c69ba4fa716079f2acd9aa211dda94ceb024ba68b4454d13dd0e8c01c925f96.png",
    "agent_eve": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/d0fbf9c1c47be61abd0eca4690afbaf12ee615d3004381238ef4e47428a829f3.png",
    "scales": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/c890f8beb5b0ca013984229bba6c6e52760c1e5ccd0c9470473df412abb2ffe6.png",
    "garden": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/0f562d81dc09d1b47e7ff966b9821a58b240e5afbe7c7ca5ce9d1ff8f2c39a2f.png",
    "harvest": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/303fa569302874601ece7c5047e5591ba40c3712ca69d134d3c364ec096883a8.png",
    "recon": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/3837c67e4bbfad99b9adb6548a4a79c1fc4f74157d0495113bc0a1ee226f8288.png",
    "contracts": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/d7b047a0eebd0513d2d27d89e1ea93fc3505946cd1b3d9713f9974a9ca0f68cb.png",
    "doctrine": "https://static.prod-images.emergentagent.com/jobs/8ba07340-a1d5-4110-8ac8-13207fff0ddf/images/29fca77990e4b5760934377c171842d49a6d28ccef746d0c466af5baf1e7e537.png",
}

OUTPUT_DIR = "/app/frontend/public/icons"

def download_image(url):
    """Download image from URL"""
    response = requests.get(url)
    response.raise_for_status()
    return Image.open(BytesIO(response.content))

def remove_background(image):
    """Remove background using rembg"""
    # Convert to bytes
    img_byte_arr = BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    # Remove background
    output = remove(img_byte_arr.read())
    return Image.open(BytesIO(output))

def main():
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    processed = {}
    
    for name, url in ICONS.items():
        print(f"Processing {name}...")
        try:
            # Download
            img = download_image(url)
            print(f"  Downloaded: {img.size}")
            
            # Remove background
            img_no_bg = remove_background(img)
            print(f"  Background removed")
            
            # Save
            output_path = os.path.join(OUTPUT_DIR, f"{name}.png")
            img_no_bg.save(output_path, format='PNG')
            print(f"  Saved to: {output_path}")
            
            processed[name] = output_path
            
        except Exception as e:
            print(f"  ERROR: {e}")
    
    print("\n=== COMPLETED ===")
    print(f"Processed {len(processed)} icons")
    for name, path in processed.items():
        print(f"  {name}: {path}")
    
    return processed

if __name__ == "__main__":
    main()
