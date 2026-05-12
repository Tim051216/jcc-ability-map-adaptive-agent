"""
评估测评相关数据库模型
对应 MySQL a3_evaluation 数据库中的表
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import JSON, BigInteger, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EvaluationTest(Base):
    """测评表 - 存储测评基本信息"""
    
    __tablename__ = "evaluation_test"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    test_type: Mapped[int] = mapped_column(Integer)  # 1-课前测评, 2-课中练习, 3-课后测评, 4-阶段测试
    difficulty_level: Mapped[int] = mapped_column(Integer)  # 1-基础, 2-进阶, 3-拔高
    course_id: Mapped[int] = mapped_column(BigInteger, index=True)
    chapter_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    section_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    knowledge_points: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, default=100)
    pass_score: Mapped[int] = mapped_column(Integer, default=60)
    time_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(Integer, default=1, index=True)  # 0-草稿, 1-已发布, 2-已关闭
    creator_id: Mapped[int] = mapped_column(BigInteger, index=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationQuestion(Base):
    """测评题目表 - 存储AI生成的测评题目"""
    
    __tablename__ = "evaluation_question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_id: Mapped[int] = mapped_column(BigInteger, index=True)
    question_type: Mapped[int] = mapped_column(Integer)  # 1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程
    difficulty_level: Mapped[int] = mapped_column(Integer, index=True)
    knowledge_point: Mapped[str] = mapped_column(String(255), index=True)
    question_content: Mapped[str] = mapped_column(Text)
    question_options: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text)
    answer_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    order_num: Mapped[int] = mapped_column(Integer, default=0)
    generation_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quality_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    status: Mapped[int] = mapped_column(Integer, default=1)  # 0-草稿, 1-已发布, 2-已废弃
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationAnswerRecord(Base):
    """答题记录表 - 存储学生答题详情"""
    
    __tablename__ = "evaluation_answer_record"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_id: Mapped[int] = mapped_column(BigInteger, index=True)
    question_id: Mapped[int] = mapped_column(BigInteger)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_correct: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-错误, 1-正确, NULL-待批改
    score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    grading_type: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-自动批改, 2-AI批改, 3-人工批改
    grading_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    grading_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    answer_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    submit_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    grading_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationTestRecord(Base):
    """测评记录表 - 存储学生整体测评记录"""
    
    __tablename__ = "evaluation_test_record"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    test_id: Mapped[int] = mapped_column(BigInteger, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    total_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    total_questions: Mapped[int] = mapped_column(Integer)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0)
    unanswered_count: Mapped[int] = mapped_column(Integer, default=0)
    completion_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    accuracy_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    time_spent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[int] = mapped_column(Integer, default=0, index=True)  # 0-进行中, 1-已提交, 2-已批改
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    submit_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    grading_complete_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationReport(Base):
    """评估报告表 - 存储多维度学习效果评估报告"""
    
    __tablename__ = "evaluation_report"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    course_id: Mapped[int] = mapped_column(BigInteger, index=True)
    report_type: Mapped[int] = mapped_column(Integer, index=True)  # 1-单次测评报告, 2-阶段性报告, 3-综合报告
    time_range_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    time_range_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    test_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    overall_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    knowledge_mastery: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ability_analysis: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    learning_efficiency: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weaknesses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improvement_suggestions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommended_resources: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    generation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[int] = mapped_column(Integer, default=1)  # 0-生成中, 1-已完成
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationKnowledgeMastery(Base):
    """知识点掌握度表 - 记录学生对各知识点的掌握情况"""
    
    __tablename__ = "evaluation_knowledge_mastery"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    course_id: Mapped[int] = mapped_column(BigInteger, index=True)
    knowledge_point: Mapped[str] = mapped_column(String(255))
    mastery_level: Mapped[int] = mapped_column(Integer, default=0, index=True)  # 0-未学习, 1-初步了解, 2-基本掌握, 3-熟练掌握, 4-精通
    mastery_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    practice_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    last_practice_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationWrongQuestion(Base):
    """错题本表 - 记录学生的错题"""
    
    __tablename__ = "evaluation_wrong_question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    question_id: Mapped[int] = mapped_column(BigInteger)
    test_id: Mapped[int] = mapped_column(BigInteger)
    answer_record_id: Mapped[int] = mapped_column(BigInteger)
    knowledge_point: Mapped[str] = mapped_column(String(255), index=True)
    wrong_count: Mapped[int] = mapped_column(Integer, default=1)
    is_mastered: Mapped[int] = mapped_column(Integer, default=0, index=True)  # 0-未掌握, 1-已掌握
    last_wrong_time: Mapped[datetime] = mapped_column(DateTime)
    mastered_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class EvaluationFeedbackLoop(Base):
    """闭环反馈表 - 记录评估结果对学习路径的反馈调整"""
    
    __tablename__ = "evaluation_feedback_loop"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    report_id: Mapped[int] = mapped_column(BigInteger, index=True)
    feedback_type: Mapped[int] = mapped_column(Integer)  # 1-学习路径调整, 2-资源推荐, 3-难度调整, 4-学习提醒
    feedback_content: Mapped[dict] = mapped_column(JSON)
    action_taken: Mapped[int] = mapped_column(Integer, default=0, index=True)  # 0-未执行, 1-已执行
    action_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    action_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
