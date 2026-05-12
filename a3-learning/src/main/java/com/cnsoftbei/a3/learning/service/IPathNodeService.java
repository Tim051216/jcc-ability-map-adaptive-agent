package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.po.PathNode;
import com.cnsoftbei.a3.learning.domain.vo.PathNodeVO;

import java.util.List;

/**
 * <p>
 * 路径节点表 服务类
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
public interface IPathNodeService extends IService<PathNode> {

    /**
     * 查询路径的所有节点
     * 
     * @param pathId 路径ID
     * @return 节点列表
     */
    List<PathNodeVO> queryPathNodes(Long pathId);

    /**
     * 获取节点详情
     * 
     * @param nodeId 节点ID
     * @return 节点详情
     */
    PathNodeVO getNodeDetail(Long nodeId);

    /**
     * 开始学习节点
     * 
     * @param nodeId 节点ID
     * @return 是否成功
     */
    Boolean startNode(Long nodeId);

    /**
     * 完成节点
     * 
     * @param nodeId 节点ID
     * @return 是否成功
     */
    Boolean completeNode(Long nodeId);

    /**
     * 暂缓节点
     * 
     * @param nodeId 节点ID
     * @param reason 暂缓原因
     * @return 是否成功
     */
    Boolean pauseNode(Long nodeId, String reason);

    /**
     * 跳过节点
     * 
     * @param nodeId 节点ID
     * @param reason 跳过原因
     * @return 是否成功
     */
    Boolean skipNode(Long nodeId, String reason);

    /**
     * 重做节点
     * 
     * @param nodeId 节点ID
     * @return 是否成功
     */
    Boolean redoNode(Long nodeId);

    /**
     * 解锁节点
     * 
     * @param nodeId 节点ID
     * @return 是否成功
     */
    Boolean unlockNode(Long nodeId);

    /**
     * 查询下一个节点
     * 
     * @param currentNodeId 当前节点ID
     * @return 下一个节点
     */
    PathNodeVO getNextNode(Long currentNodeId);

    /**
     * 为新路径写入默认阶梯节点；若路径下已有节点则不做任何事。
     */
    void seedLadderDemoNodes(Long pathId, Long userId, PathPlanningDTO planningDTO);
}
