package com.cnsoftbei.a3.learning.service;

import com.cnsoftbei.a3.api.dto.leanring.LearningLessonDTO;
import com.cnsoftbei.a3.learning.domain.dto.LearningRecordFormDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningRecord;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * <p>
 * 学习记录表 服务类
 * </p>
 *
 * @author fenny
 * @since 2023-11-21
 */
public interface ILearningRecordService extends IService<LearningRecord> {

    LearningLessonDTO queryLearningRecordByCourse(Long courseId);

    void addLearningRecord(LearningRecordFormDTO formDTO);
}
