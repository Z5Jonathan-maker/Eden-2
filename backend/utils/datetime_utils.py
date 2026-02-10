"""
Common utility functions for Eden backend
"""

from datetime import datetime, timezone
from typing import Union, Optional
import logging

logger = logging.getLogger(__name__)


def parse_datetime(value: Union[str, datetime, None]) -> Optional[datetime]:
    """
    Safely parse datetime from MongoDB which may be string or datetime object.
    Handles the inconsistency where MongoDB sometimes returns strings and sometimes datetime.
    
    Args:
        value: datetime object, ISO string, or None
        
    Returns:
        datetime object or None if parsing fails
    """
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, str):
        try:
            # Try ISO format first
            if 'T' in value:
                # Handle with or without timezone
                if value.endswith('Z'):
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
                return datetime.fromisoformat(value)
            # Try other common formats
            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        except Exception as e:
            logger.warning(f"Failed to parse datetime '{value}': {e}")
    
    return None


def safe_datetime_compare(dt1: Union[str, datetime, None], dt2: Union[str, datetime, None]) -> int:
    """
    Safely compare two datetime values that may be strings or datetime objects.
    
    Args:
        dt1: First datetime (string or datetime)
        dt2: Second datetime (string or datetime)
        
    Returns:
        -1 if dt1 < dt2, 0 if equal, 1 if dt1 > dt2
        Returns 0 if either value cannot be parsed
    """
    parsed1 = parse_datetime(dt1)
    parsed2 = parse_datetime(dt2)
    
    if parsed1 is None or parsed2 is None:
        return 0
    
    if parsed1 < parsed2:
        return -1
    elif parsed1 > parsed2:
        return 1
    return 0


def datetime_diff_hours(dt1: Union[str, datetime, None], dt2: Union[str, datetime, None]) -> Optional[float]:
    """
    Calculate difference between two datetimes in hours.
    
    Args:
        dt1: First datetime (string or datetime)
        dt2: Second datetime (string or datetime)
        
    Returns:
        Difference in hours (positive if dt1 > dt2), or None if parsing fails
    """
    parsed1 = parse_datetime(dt1)
    parsed2 = parse_datetime(dt2)
    
    if parsed1 is None or parsed2 is None:
        return None
    
    diff = parsed1 - parsed2
    return diff.total_seconds() / 3600


def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


def now_utc_iso() -> str:
    """Get current UTC datetime as ISO string"""
    return datetime.now(timezone.utc).isoformat()


def format_age(dt: Union[str, datetime, None]) -> str:
    """
    Format datetime as human-readable age (e.g., "2 hours ago", "3 days ago")
    
    Args:
        dt: datetime to format
        
    Returns:
        Human-readable age string
    """
    parsed = parse_datetime(dt)
    if parsed is None:
        return "Unknown"
    
    # Make timezone-aware if needed
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    diff = now - parsed
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days} day{'s' if days != 1 else ''} ago"
    else:
        weeks = int(seconds / 604800)
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
