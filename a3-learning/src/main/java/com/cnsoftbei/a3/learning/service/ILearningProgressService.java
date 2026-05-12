package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.po.LearningProgress;
import com.cnsoftbei.a3.learning.domain.dto.ProgressRecordDTO;

import java.util.List;

/**
 * <p>
 * 学习进度记录表 服务类
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
public interface ILearningProgressService extends IService<LearningProgress> {

    /**
     * 记录学习进度
     * 
     * @param recordDTO 进度记录
     * @return 是否成功
     */
    Boolean recordProgress(ProgressRecordDTO recordDTO);

    /**
     * 查询节点的学习进度
     * 
     * @param nodeId 节点ID
     * @return 进度列表
     */
    List<LearningProgress> queryNodeProgress(Long nodeId);

    /**
     * 查询路径的学习进度
     * 
     * @param pathId 路径ID
     * @return 进度列表
     */
    List<LearningProgress> queryPathProgress(Long pathId);

    /**
     * 计算节点完成度
     * 
     * @param nodeId 节点ID
     * @return 完成百分比
     */
    Integer calculateNodeCompletion(Long nodeId);

    /**
     * 计算路径完成度
     * 
     * @param pathId 路径ID
     * @return 完成百分比
     */
    Integer calculatePathCompletion(Long pathId);
}
