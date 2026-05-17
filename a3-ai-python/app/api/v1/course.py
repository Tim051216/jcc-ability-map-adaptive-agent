from fastapi import APIRouter

from app.schemas.course import (
    CourseCardResponse,
    CourseCategoryItem,
    CourseChapterResponse,
    CourseDetailResponse,
    CourseSectionPlayResponse,
    LearningProgressUpdateRequest,
    LearningProgressUpdateResponse,
    CourseSearchResponse,
    CourseTeacherResponse,
    LearningCourseDetailResponse,
)
from app.services.course_service import CourseService

router = APIRouter()


@router.get("/categories", response_model=list[CourseCategoryItem])
async def list_categories() -> list[CourseCategoryItem]:
    return await CourseService().list_categories()


@router.get("/recommend/{bucket}", response_model=list[CourseCardResponse])
async def list_recommend_courses(bucket: str) -> list[CourseCardResponse]:
    return await CourseService().list_recommend_courses(bucket)


@router.get("/interest-courses/{interest_id}", response_model=list[CourseCardResponse])
async def list_interest_courses(interest_id: int) -> list[CourseCardResponse]:
    return await CourseService().list_interest_courses(interest_id)


@router.get("/search", response_model=CourseSearchResponse)
async def search_courses(
    keyword: str | None = None,
    categoryIdLv1: int | None = None,
    free: bool | None = None,
    sortBy: str | None = None,
    pageNo: int = 1,
    pageSize: int = 12,
) -> CourseSearchResponse:
    return await CourseService().search_courses(
        keyword=keyword,
        category_id_lv1=categoryIdLv1,
        free=free,
        sort_by=sortBy,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.get("/courses/{course_id}", response_model=CourseDetailResponse)
async def get_course_detail(course_id: int) -> CourseDetailResponse:
    return await CourseService().get_course_detail(course_id)


@router.get("/courses/{course_id}/teachers", response_model=list[CourseTeacherResponse])
async def list_course_teachers(course_id: int) -> list[CourseTeacherResponse]:
    return await CourseService().list_course_teachers(course_id)


@router.get("/courses/{course_id}/catalog", response_model=list[CourseChapterResponse])
async def list_course_catalog(course_id: int) -> list[CourseChapterResponse]:
    return await CourseService().list_course_catalog(course_id)


@router.get("/courses/{course_id}/chapters")
async def list_course_chapters(course_id: int) -> list[dict]:
    return await CourseService().list_course_chapters(course_id)


@router.get("/courses/{course_id}/learning", response_model=LearningCourseDetailResponse)
async def get_learning_course_detail(course_id: int) -> LearningCourseDetailResponse:
    return await CourseService().get_learning_course_detail(course_id)


@router.get("/courses/{course_id}/sections/{section_id}/play", response_model=CourseSectionPlayResponse)
async def get_course_section_play_info(course_id: int, section_id: int) -> CourseSectionPlayResponse:
    return await CourseService().get_section_play_info(course_id, section_id)


@router.post("/courses/{course_id}/learning-progress", response_model=LearningProgressUpdateResponse)
async def update_learning_progress(course_id: int, payload: LearningProgressUpdateRequest) -> LearningProgressUpdateResponse:
    return await CourseService().update_learning_progress(course_id, payload)
