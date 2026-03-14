'''
University Module

Educational platform for insurance professionals.
'''

from .routes import router
from .seed_data import seed_university_data

__all__ = ["router", "seed_university_data"]
