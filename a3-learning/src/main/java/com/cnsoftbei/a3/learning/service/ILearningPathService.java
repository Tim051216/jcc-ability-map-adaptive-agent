package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.po.LearningPath;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.vo.LearningPathVO;
import com.cnsoftbei.a3.learning.domain.vo.PathProgressVO;

import java.util.List;

/**
 * <p>
 * 学习路径主表 服务类
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
public interface ILearningPathService extends IService<LearningPath> {

    /**
     * 创建学习路径
     * 
     * @param planningDTO 路径规划参数
     * @return 路径ID
     */
    Long createLearningPath(PathPlanningDTO planningDTO);

    /**
     * 获取学习路径详情
     * 
     * @param pathId 路径ID
     * @return 路径详情
     */
    LearningPathVO getPathDetail(Long pathId);

    /**
     * 校验当前登录用户是否拥有该学习路径（详情、进度、节点列表等需在 service 层复用）。
     */
    void ensureCurrentUserOwnsPath(Long pathId);

    /**
     * 激活学习路径
     * 
     * @param pathId 路径ID
     * @return 是否成功
     */
    Boolean activatePath(Long pathId);

    /**
     * 查询用户的学习路径列表
     * 
     * @param userId 用户ID
     * @return 路径列表
     */
    List<LearningPathVO> queryUserPaths(Long userId);

    /**
     * 查询用户当前进行中的路径
     * 
     * @param userId 用户ID
     * @return 当前路径
     */
    LearningPathVO queryCurrentPath(Long userId);

    /**
     * 查询路径进度
     * 
     * @param pathId 路径ID
     * @return 进度信息
     */
    PathProgressVO queryPathProgress(Long pathId);

    /**
     * 暂停学习路径
     * 
     * @param pathId 路径ID
     * @return 是否成功
     */
    Boolean pausePath(Long pathId);

    /**
     * 恢复学习路径
     * 
     * @param pathId 路径ID
     * @return 是否成功
     */
    Boolean resumePath(Long pathId);

    /**
     * 完成学习路径
     * 
     * @param pathId 路径ID
     * @return 是否成功
     */
    Boolean completePath(Long pathId);

    /**
     * 路径下节点全部完成后的自动收口（不写当前用户会话校验，仅限节点聚合等业务内调用）。
     */
    Boolean completePathWhenNodesFinished(Long pathId);
}
