import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from middleware.logging_middleware import StructuredLoggingMiddleware
    print("SUCCESS: StructuredLoggingMiddleware imported.")
    
    from server import app
    print("SUCCESS: Server app imported.")
    
    # Check if middleware is in the stack
    found = False
    for middleware in app.user_middleware:
        if middleware.cls == StructuredLoggingMiddleware:
            found = True
            break
            
    if found:
        print("SUCCESS: StructuredLoggingMiddleware is in app middleware stack.")
    else:
        print("FAILURE: StructuredLoggingMiddleware NOT found in app middleware stack.")
        sys.exit(1)

except ImportError as e:
    print(f"FAILURE: ImportError - {e}")
    sys.exit(1)
except Exception as e:
    print(f"FAILURE: {e}")
    sys.exit(1)
