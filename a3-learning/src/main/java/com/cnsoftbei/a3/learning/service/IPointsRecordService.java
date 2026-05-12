package com.cnsoftbei.a3.learning.service;

import com.cnsoftbei.a3.learning.domain.po.PointsRecord;
import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.vo.PointsStatisticsVO;
import com.cnsoftbei.a3.learning.enums.PointsRecordType;

import java.time.LocalDateTime;
import java.util.List;

/**
 * <p>
 * 学习积分记录，每个月底清零 服务类
 * </p>
 *
 * @author fenny
 * @since 2023-11-29
 */
public interface IPointsRecordService extends IService<PointsRecord> {

    void addPointsRecord(Long userId, Integer points, PointsRecordType type);

    List<PointsStatisticsVO> queryMyPointsToday();

    /**
     * 用户在 [start, end] 时间范围内获得的积分总和（与自然周对齐的起止时间由调用方传入）。
     */
    int sumPointsByUserBetween(Long userId, LocalDateTime start, LocalDateTime end);

}
