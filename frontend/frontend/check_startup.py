import sys
import os
import traceback

# Add backend to sys.path
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

print(f"CWD: {os.getcwd()}")
print(f"Path: {sys.path[0]}")

print("Attempting to import server:app...")

try:
    from server import app
    print("SUCCESS: server:app imported successfully!")
except Exception:
    print("FAILURE: Could not import server:app")
    traceback.print_exc()
