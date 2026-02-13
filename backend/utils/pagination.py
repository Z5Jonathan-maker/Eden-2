"""
Pagination utilities for Eden 2 API

Provides consistent cursor-based and offset-based pagination across all endpoints.
Prevents memory overload from unlimited queries.

Cimadevilla Operating Stack - Layer 2 (Scale & Systems):
- Pagination that works at any scale
- Consistent API patterns across all endpoints
"""

from typing import TypeVar, Generic, List, Optional, Dict, Any
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorCursor

T = TypeVar('T')


class PaginationParams(BaseModel):
    """Standard pagination query parameters"""
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=50, ge=1, le=200, description="Items per page (max 200)")
    sort_by: Optional[str] = Field(default=None, description="Field to sort by")
    sort_order: str = Field(default="desc", description="Sort order: asc or desc")

    @property
    def skip(self) -> int:
        """Calculate skip value for MongoDB"""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """MongoDB limit value"""
        return self.page_size

    @property
    def sort_direction(self) -> int:
        """MongoDB sort direction: 1 for asc, -1 for desc"""
        return 1 if self.sort_order == "asc" else -1


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response structure"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool

    class Config:
        # Allow generic types
        arbitrary_types_allowed = True


class CursorParams(BaseModel):
    """Cursor-based pagination parameters (better for real-time data)"""
    cursor: Optional[str] = Field(default=None, description="Cursor for next page")
    limit: int = Field(default=50, ge=1, le=200, description="Items to fetch (max 200)")


class CursorResponse(BaseModel, Generic[T]):
    """Cursor-based paginated response"""
    items: List[T]
    next_cursor: Optional[str] = None
    has_more: bool = False

    class Config:
        arbitrary_types_allowed = True


async def paginate_query(
    cursor: AsyncIOMotorCursor,
    total_count: int,
    pagination: PaginationParams,
    model: type
) -> PaginatedResponse:
    """
    Apply pagination to a MongoDB cursor and return structured response

    Args:
        cursor: MongoDB cursor with find() query
        total_count: Total number of matching documents
        pagination: Pagination parameters
        model: Pydantic model to validate items

    Returns:
        PaginatedResponse with items and metadata
    """

    # Execute query with pagination
    items_raw = await cursor.skip(pagination.skip).limit(pagination.limit).to_list(length=pagination.limit)

    # Validate items with Pydantic model
    items = [model(**item) for item in items_raw]

    # Calculate pagination metadata
    total_pages = (total_count + pagination.page_size - 1) // pagination.page_size  # Ceiling division

    return PaginatedResponse(
        items=items,
        total=total_count,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=total_pages,
        has_next=pagination.page < total_pages,
        has_previous=pagination.page > 1
    )


async def paginate_aggregation(
    aggregation_results: List[Dict[str, Any]],
    total_count: int,
    pagination: PaginationParams,
    model: type
) -> PaginatedResponse:
    """
    Wrap aggregation results in pagination response

    Use when aggregation pipeline already includes $skip and $limit

    Args:
        aggregation_results: Results from db.collection.aggregate()
        total_count: Total count from separate count query or $facet
        pagination: Pagination parameters used in the pipeline
        model: Pydantic model to validate items

    Returns:
        PaginatedResponse with items and metadata
    """

    # Validate items with Pydantic model
    items = [model(**item) for item in aggregation_results]

    # Calculate pagination metadata
    total_pages = (total_count + pagination.page_size - 1) // pagination.page_size

    return PaginatedResponse(
        items=items,
        total=total_count,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=total_pages,
        has_next=pagination.page < total_pages,
        has_previous=pagination.page > 1
    )


def build_pagination_aggregation_stages(pagination: PaginationParams) -> List[Dict[str, Any]]:
    """
    Generate MongoDB aggregation stages for pagination

    Example usage:
        pipeline = [
            {"$match": {"status": "active"}},
            *build_pagination_aggregation_stages(pagination)
        ]

    Returns:
        List of aggregation stages [$sort, $skip, $limit]
    """

    stages = []

    # Add sort if specified
    if pagination.sort_by:
        stages.append({
            "$sort": {pagination.sort_by: pagination.sort_direction}
        })
    else:
        # Default sort by created_at descending
        stages.append({"$sort": {"created_at": -1}})

    # Add pagination
    stages.append({"$skip": pagination.skip})
    stages.append({"$limit": pagination.limit})

    return stages


async def get_total_count_from_facet(facet_result: List[Dict]) -> int:
    """
    Extract total count from $facet aggregation result

    Example facet structure:
        {
            "$facet": {
                "data": [...pipeline with pagination...],
                "total": [{"$count": "count"}]
            }
        }

    Args:
        facet_result: Single result from faceted aggregation

    Returns:
        Total count, or 0 if no count found
    """

    if not facet_result or len(facet_result) == 0:
        return 0

    total_array = facet_result[0].get("total", [])
    if len(total_array) == 0:
        return 0

    return total_array[0].get("count", 0)


async def paginate_with_facet(
    db_collection,
    base_pipeline: List[Dict[str, Any]],
    pagination: PaginationParams,
    model: type
) -> PaginatedResponse:
    """
    Execute aggregation with $facet for data + count in single query

    Most efficient pagination method: gets data AND count in one DB call

    Args:
        db_collection: MongoDB collection
        base_pipeline: Aggregation pipeline BEFORE pagination (match, lookup, etc.)
        pagination: Pagination parameters
        model: Pydantic model

    Returns:
        PaginatedResponse with items and metadata
    """

    # Build faceted aggregation: data + count in parallel
    facet_pipeline = base_pipeline + [
        {
            "$facet": {
                # Data pipeline: apply pagination
                "data": build_pagination_aggregation_stages(pagination),

                # Count pipeline: count total matches
                "total": [{"$count": "count"}]
            }
        }
    ]

    # Execute
    result = await db_collection.aggregate(facet_pipeline).to_list(length=1)

    if not result or len(result) == 0:
        # No results
        return PaginatedResponse(
            items=[],
            total=0,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=0,
            has_next=False,
            has_previous=False
        )

    # Extract data and count from facet
    data_array = result[0].get("data", [])
    total_count = await get_total_count_from_facet(result)

    # Return paginated response
    return await paginate_aggregation(data_array, total_count, pagination, model)


# Export public API
__all__ = [
    "PaginationParams",
    "PaginatedResponse",
    "CursorParams",
    "CursorResponse",
    "paginate_query",
    "paginate_aggregation",
    "build_pagination_aggregation_stages",
    "paginate_with_facet",
    "get_total_count_from_facet"
]
