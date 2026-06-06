# Codebase Index

## Purpose
- This file is a lightweight index to reduce repeated full-repo reads.
- Read this first before opening many files.
- Keep it short, path-oriented, and update it when architecture or important constraints change.

## Top Level
- `a3-student-react-web`: student frontend, Vite + React + TS
- `a3-admin-web`: admin frontend, Vite + React + TS
- `a3-ai-python`: AI aggregation layer and student/admin API entry
- `a3-resource`: Java course/resource service
- `a3-learning`: Java learning service
- `a3-user`: Java user service
- `a3-gateway`: Java gateway routing `/cs` `/ls` `/us` `/ai`
- `sql`: schema and seed SQL

## Student Frontend
- Entry API base: `a3-student-react-web/.env.example`
- API wrapper: `a3-student-react-web/src/lib/studentApi.ts`
- Route/course helpers: `a3-student-react-web/src/lib/courseContext.ts`

### Student Pages
- Overview: `a3-student-react-web/src/pages/Overview.tsx`
- Classroom: `a3-student-react-web/src/pages/CourseLearning.tsx`
- Learning path: `a3-student-react-web/src/pages/LearningPath.tsx`
- Evaluation: `a3-student-react-web/src/pages/Evaluation.tsx`
- Resource center: `a3-student-react-web/src/pages/ResourceCenter.tsx`
- Resource preview: `a3-student-react-web/src/pages/ResourceSourcePreview.tsx`
- AI tutor: `a3-student-react-web/src/pages/AITutor.tsx`
- Capability/profile: `a3-student-react-web/src/pages/CapabilityModel.tsx`
- Profile conversation: `a3-student-react-web/src/pages/ProfileConversation.tsx`
- Collection: `a3-student-react-web/src/pages/Collection.tsx`
- Study report: `a3-student-react-web/src/pages/StudyReport.tsx`
- Login: `a3-student-react-web/src/pages/Login.tsx`

### Student Frontend Constraints
- Current frontend talks to Python API, not directly to Java.
- User-visible English should generally be Chinese; keep domain terms like `AI`, `PDF`, `PPT`, `Office` when appropriate.
- Classroom no longer uses fallback videos. If no video, it should fall back to courseware preview.

## Admin Frontend
- API wrapper: `a3-admin-web/src/lib/adminApi.ts`
- Dashboard/panels live under:
  - `a3-admin-web/src/components/dashboard`
  - `a3-admin-web/src/components/panels`

## Python API Layer
- Router aggregator: `a3-ai-python/app/api/router.py`
- API modules:
  - `student_portal.py`
  - `chat.py`
  - `course.py`
  - `course_comment.py`
  - `danmaku.py`
  - `learning.py`
  - `profile.py`
  - `profile_conversation.py`
  - `plan.py`
  - `resource.py`
  - `evaluation.py`
  - `rag.py`
  - `tutoring.py`
  - `admin.py`

### Important Python Service Files
- Course aggregation: `a3-ai-python/app/services/course_service.py`
- Student portal aggregation: `a3-ai-python/app/services/student_portal_service.py`
- Resource service: `a3-ai-python/app/services/resource_service.py`
- Resource source file preview/index: `a3-ai-python/app/services/resource_source_file_service.py`
- Evaluation service: `a3-ai-python/app/services/evaluation_service.py`
- Tutoring service: `a3-ai-python/app/services/tutoring_service.py`
- Profile conversation service: `a3-ai-python/app/services/profile_conversation_service.py`
- Plan service: `a3-ai-python/app/services/plan_service.py`

### Python -> Java Bridge
- Base Java client: `a3-ai-python/app/integrations/java_clients/base.py`
- Course client: `a3-ai-python/app/integrations/java_clients/course_client.py`
- Learning client: `a3-ai-python/app/integrations/java_clients/learning_client.py`
- User client: `a3-ai-python/app/integrations/java_clients/user_client.py`
- Media client: `a3-ai-python/app/integrations/java_clients/media_client.py`

## Java Services

### Gateway
- Local routes: `a3-gateway/src/main/resources/bootstrap-local.yml`
- Important route prefixes:
  - `/cs` -> course/resource service
  - `/ls` -> learning service
  - `/us` -> user service
  - `/ai` -> Python API

### Course / Resource Java
- Controllers:
  - `a3-resource/src/main/java/com/cnsoftbei/a3/course/controller/CourseInfoController.java`
  - `a3-resource/src/main/java/com/cnsoftbei/a3/course/controller/CourseController.java`
  - `a3-resource/src/main/java/com/cnsoftbei/a3/course/controller/CatalogueController.java`
  - `a3-resource/src/main/java/com/cnsoftbei/a3/course/controller/CategoryController.java`
- High-value endpoints:
  - internal course detail: `/course/{id}`
  - internal section info: `/course/section/{id}`
  - course + catalogs + progress: `/courses/{id}/catalogs`

### Learning Java
- Controllers directory:
  - `a3-learning/src/main/java/com/cnsoftbei/a3/learning/controller`
- High-value controllers:
  - `LearningRecordController.java`
  - `InteractionQuestionController.java`
  - `InteractionReplyController.java`
  - `LikedRecordController.java`
  - `EvaluationController.java`

### User Java
- Controllers directory:
  - `a3-user/src/main/java/com/cnsoftbei/a3/user/controller`
- High-value controller:
  - `UserController.java`

## Current Important Behavioral Notes
- Student frontend uses Python API as aggregation layer.
- Python course API now prefers Java real course data over old frontend fixtures.
- Classroom video fallback was intentionally removed.
- Resource built-in fallback videos were intentionally removed.
- Classroom should display PPT/PDF courseware when no video exists.

## SQL / Seed Notes
- Course schema: `sql/course.sql`
- Learning schema: `sql/learning.sql`
- Resource-related schema: `sql/learning_resource.sql`
- Video seed SQL exists here and may reintroduce videos if imported:
  - `sql/resource_video_seed.sql`

## When Investigating Issues
- Classroom content source:
  - frontend: `src/pages/CourseLearning.tsx`
  - python: `app/services/course_service.py`
  - java: `a3-resource ... CourseController/CourseInfoController`
- Resource preview/source file issues:
  - frontend: `ResourceCenter.tsx`, `ResourceSourcePreview.tsx`
  - python: `resource_service.py`, `resource_source_file_service.py`
- Profile/portrait issues:
  - frontend: `CapabilityModel.tsx`, `ProfileConversation.tsx`
  - python: `profile_conversation.py`, `profile_conversation_service.py`
- Evaluation issues:
  - frontend: `Evaluation.tsx`
  - python: `evaluation.py`, `evaluation_service.py`
- Tutor issues:
  - frontend: `AITutor.tsx`
  - python: `tutoring.py`, `tutoring_service.py`, `tutoring_task_service.py`

## Maintenance Rule
- Update this file when:
  - a new aggregation layer is added
  - a major fallback is introduced or removed
  - high-traffic page ownership changes
  - route prefixes or service boundaries change
