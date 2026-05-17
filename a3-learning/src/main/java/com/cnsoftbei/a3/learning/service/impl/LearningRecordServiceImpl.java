package com.cnsoftbei.a3.learning.service.impl;

import com.cnsoftbei.a3.api.client.course.CourseClient;
import com.cnsoftbei.a3.api.dto.course.CourseFullInfoDTO;
import com.cnsoftbei.a3.api.dto.leanring.LearningLessonDTO;
import com.cnsoftbei.a3.api.dto.leanring.LearningRecordDTO;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.exceptions.DbException;
import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.LearningRecordFormDTO;
import com.cnsoftbei.a3.learning.domain.dto.LearningSectionPositionFormDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningLesson;
import com.cnsoftbei.a3.learning.domain.po.LearningRecord;
import com.cnsoftbei.a3.learning.enums.LessonStatus;
import com.cnsoftbei.a3.learning.enums.SectionType;
import com.cnsoftbei.a3.learning.mapper.LearningRecordMapper;
import com.cnsoftbei.a3.learning.service.ILearningBehaviorCollectionService;
import com.cnsoftbei.a3.learning.service.ILearningLessonService;
import com.cnsoftbei.a3.learning.service.ILearningRecordService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.learning.utils.LearningRecordDelayTaskHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * <p>
 * 学习记录表 服务实现类
 * </p>
 *
 * @author fenny
 * @since 2023-11-21
 */
@Service
@RequiredArgsConstructor
public class LearningRecordServiceImpl extends ServiceImpl<LearningRecordMapper, LearningRecord> implements ILearningRecordService {

    private final ILearningLessonService lessonService;
    private final CourseClient courseClient;
    private final LearningRecordDelayTaskHandler taskHandler;
    private final ILearningBehaviorCollectionService learningBehaviorCollectionService;

    @Override
    public LearningLessonDTO queryLearningRecordByCourse(Long courseId) {
        //1.获取当前用户
        Long user = UserContext.requireUser();
        //2.查询lesson信息
        LearningLesson learningLesson = lessonService.queryByUserAndCourseId(user, courseId);
        if(learningLesson == null){
            throw new BizIllegalException("该用户未拥有该课程");
        }
        //3.查询record表的小节学习进度
        List<LearningRecord> records = lambdaQuery()
                .eq(LearningRecord::getLessonId, learningLesson.getId())
                .eq(LearningRecord::getUserId, user)
                .list();
        // 没有得到学习记录不能抛异常，别问我怎么知道的
        // if(CollUtils.isEmpty(records)){
        //     return null;
        // }

        //4.设置LearningLessonDTO的信息
        LearningLessonDTO learningLessonDTO = new LearningLessonDTO();
        learningLessonDTO.setId(learningLesson.getId());
        learningLessonDTO.setLatestSectionId(learningLesson.getLatestSectionId());

        //5.复制小节记录集合到LearningRecordDTO
        List<LearningRecordDTO> dtos = BeanUtils.copyList(records, LearningRecordDTO.class);
        learningLessonDTO.setRecords(dtos);

        return learningLessonDTO;
    }


    @Override
    @Transactional
    public void addLearningRecord(LearningRecordFormDTO recordDTO) {
        Long user = UserContext.requireUser();
        SectionType type = recordDTO.getSectionType();
        //判断是否已经考完试或者小节已经全部学完
        boolean finished = false;
        if(type == SectionType.EXAM){
            //考试流程
            finished = handleExamRecord(user, recordDTO);
        }else{
            //看视频流程
            finished = handleVideoRecordWithRedis(user, recordDTO);
        }
        /**
         * 本来没有这个判断，但是使用了延迟队列的版本后就需要判断一下
         * + 如果是第一次看完视频，taskHandler的延时队列里就没有该记录
         *   没有该记录就无法更新成最新的课表信息(最新学习小节id、最新学习时间等)
         *   所以需要这里手动更新一下课表
         * + 否则就不需要更新，因为并不是第一次看完视频的情况下
         *   延时队列出元素后会更新课表信息，如果再次更新会造成重复更新
         */
        if(!finished){
            return;
        }
        //更新课表
        handleLearningLessonsChanges(recordDTO);
    }

    @Override
    @Transactional
    public void updateLearningPosition(LearningSectionPositionFormDTO formDTO) {
        Long userId = UserContext.requireUser();
        LearningLesson lesson = lessonService.getById(formDTO.getLessonId());
        if (lesson == null || !userId.equals(lesson.getUserId())) {
            throw new BizIllegalException("当前课表不存在");
        }
        LocalDateTime commitTime = formDTO.getCommitTime() == null ? LocalDateTime.now() : formDTO.getCommitTime();
        boolean update = lessonService.lambdaUpdate()
                .set(lesson.getStatus() == LessonStatus.NOT_BEGIN, LearningLesson::getStatus, LessonStatus.LEARNING)
                .set(LearningLesson::getLatestSectionId, formDTO.getSectionId())
                .set(LearningLesson::getLatestLearnTime, commitTime)
                .eq(LearningLesson::getId, lesson.getId())
                .eq(LearningLesson::getUserId, userId)
                .update();
        if(!update){
            throw new DbException("课表定位写回失败");
        }
    }

    /**
     * 更新课表的方法
     * 丢弃了finished参数
     * 因为执行条件必为第一次完成视频
     * @param recordDTO
     */
    private void handleLearningLessonsChanges(LearningRecordFormDTO recordDTO) {
        //1.查询课表
        LearningLesson lesson = lessonService.getById(recordDTO.getLessonId());
        if(lesson == null){
            throw new BizIllegalException("当前课表不存在");
        }
        //2.查询当前完成小节是否已经达到全部小节数量
        CourseFullInfoDTO cinfo = courseClient.getCourseInfoById(lesson.getCourseId(), false, false);
        if(cinfo == null){
            throw new BizIllegalException("当前课程不存在");
        }
        //判断是否学完所有小节
        boolean allLearned = lesson.getLearnedSections() + 1 >= cinfo.getSectionNum();
        //3.更新课表
        boolean update = lessonService.lambdaUpdate()
                //由于购买课程后就会初始化lesson，且初始化已学小节为0，所以如果是第一次观看视频，则设置lesson为正在学习
                .set(lesson.getLearnedSections() == 0, LearningLesson::getStatus, LessonStatus.LEARNING)
                //如果小节都学完了就更新lesson为完成状态
                .set(allLearned, LearningLesson::getStatus, LessonStatus.FINISHED)
                //没完成小节才更新最后学习时间
                .set(LearningLesson::getLatestLearnTime, recordDTO.getCommitTime())
                //没完成小节才更新最后学习章节
                .set(LearningLesson::getLatestSectionId, recordDTO.getSectionId())
                //如果完成了小节则课表完成小节数量+1
                .set(LearningLesson::getLearnedSections, lesson.getLearnedSections()+1)
                // .setSql(finished, "learned_sections = learned_sections + 1")
                .eq(LearningLesson::getId, lesson.getId())
                .update();
        if(!update){
            throw new DbException("课表更新失败");
        }

    }

    /**
     * 【已废弃！】更新课表方法
     * @param recordDTO
     * @param finished
     */
    private void handleLearningLessonsChanges_(LearningRecordFormDTO recordDTO, boolean finished) {
        //1.查询课表
        LearningLesson lesson = lessonService.getById(recordDTO.getLessonId());
        if(lesson == null){
            throw new BizIllegalException("当前课表不存在");
        }
        //2.查询当前完成小节是否已经达到全部小节数量
        CourseFullInfoDTO cinfo = courseClient.getCourseInfoById(lesson.getCourseId(), false, false);
        if(cinfo == null){
            throw new BizIllegalException("当前课程不存在");
        }
        boolean allLearned = lesson.getLearnedSections() + 1 >= cinfo.getSectionNum();
        //3.更新课表
        boolean update = lessonService.lambdaUpdate()
                //由于购买课程后就会初始化lesson，且初始化已学小节为0，所以如果是第一次观看视频，则设置lesson为正在学习
                .set(lesson.getLearnedSections() == 0, LearningLesson::getStatus, LessonStatus.LEARNING)
                //如果小节都学完了就更新lesson为完成状态
                .set(allLearned, LearningLesson::getStatus, LessonStatus.FINISHED)
                //没完成小节才更新最后学习时间，不过好像更新了也没啥问题，不过多了一步不必要的操作
                .set(LearningLesson::getLatestLearnTime, recordDTO.getCommitTime())
                //没完成小节才更新最后学习章节
                .set(LearningLesson::getLatestSectionId, recordDTO.getSectionId())
                //如果完成了小节则课表完成小节数量+1
                .set(finished, LearningLesson::getLearnedSections, lesson.getLearnedSections()+1)
                // .setSql(finished, "learned_sections = learned_sections + 1")
                .eq(LearningLesson::getId, lesson.getId())
                .update();
        if(!update){
            throw new DbException("课表更新失败");
        }

    }

    /**
     * 【已废弃！】更新学习记录，数据库操作版本
     * 缺点：如果多用户持续观看视频就会导致查、改数据库请求过大
     * 心跳是每15秒发送一次, 并发量可能会过大, 会操作两次数据库:
     * + 查询学习记录表
     * + 修改学习记录表
     * 所以需要优化为异步延时阻塞队列版本(优先查Redis记录->修改Redis记录->最后用户离开再把Redis记录持久化到数据库)
     * @param userId 用户id
     * @param recordDTO 当前课表
     * @return
     */
    private boolean handleVideoRecordWithDB(Long userId, LearningRecordFormDTO recordDTO) {
        LearningRecord one = lambdaQuery()
                .eq(LearningRecord::getLessonId, recordDTO.getLessonId())
                .eq(LearningRecord::getSectionId, recordDTO.getSectionId())
                .eq(LearningRecord::getUserId, userId)
                .one();
        //1.没有旧的学习记录
        if(one == null){
            LearningRecord learningRecord = BeanUtils.copyBean(recordDTO, LearningRecord.class);
            learningRecord.setUserId(userId);
            boolean save = save(learningRecord);
            if(!save){
                throw new DbException("新增学习记录失败");
            }
            return false;
        }
        //2.有学习记录，修改学习记录
        //2.1如果该小节视频长度完成50%及以上且小节旧的状态为未完成，才让当前课程表的小节完成数量+1
        boolean finished = false;
        if(!one.getFinished() && recordDTO.getDuration() <= recordDTO.getMoment()*2){
            finished = true;
        }
        //2.2更新小节学习，如果符合完成条件，则更新小节记录的完成时间和状态
        boolean update = lambdaUpdate()
                .set(LearningRecord::getMoment, recordDTO.getMoment())
                .set(finished, LearningRecord::getFinished, true)
                .set(finished, LearningRecord::getFinishTime, recordDTO.getCommitTime())
                .eq(LearningRecord::getId, one.getId())
                .update();
        if(!update){
            throw new DbException("更新学习记录失败");
        }
        return finished;
    }

    /**
     * 异步延时阻塞队列版本(大致思路：优先查Redis记录->修改Redis记录->最后用户离开再把Redis记录持久化到数据库)
     * 减少了对数据库的操作，避免高并发
     * @param userId
     * @param recordDTO
     * @return
     */
    private boolean handleVideoRecordWithRedis(Long userId, LearningRecordFormDTO recordDTO) {
        //查询旧的学习记录（DB 侧按 userId 限定，避免异常数据下串读）
        LearningRecord oldRecord = queryOldRecord(userId, recordDTO.getLessonId(), recordDTO.getSectionId());
        //1.没有旧的学习记录
        if(oldRecord == null){
            LearningRecord learningRecord = BeanUtils.copyBean(recordDTO, LearningRecord.class);
            learningRecord.setUserId(userId);
            //数据库新增学习记录
            boolean save = save(learningRecord);
            if(!save){
                throw new DbException("新增学习记录失败");
            }
            return false;
        }
        //2.有学习记录，修改学习记录
        //2.1如果该小节视频长度完成50%及以上且小节旧的状态为未完成，才让当前课程表的小节完成数量+1
        boolean finished = false;
        if(!oldRecord.getFinished() && recordDTO.getDuration() <= recordDTO.getMoment()*2){
            finished = true;
        }
        //当前小节没有学完就将该小节信息添加到redis、延时队列
        if(!finished){
            LearningRecord nowRecord = new LearningRecord();
            nowRecord.setLessonId(recordDTO.getLessonId());
            nowRecord.setSectionId(recordDTO.getSectionId());
            nowRecord.setMoment(recordDTO.getMoment());
            nowRecord.setFinished(finished);
            nowRecord.setId(oldRecord.getId());

            //添加到redis和延时队列
            taskHandler.addLearningRecordTask(nowRecord);
            //如果不返回会执行另一个分支流程->重复更新小节学习记录
            return finished;
        }
        //2.2更新小节学习，如果符合完成条件，则更新小节记录的完成时间和状态
        boolean update = lambdaUpdate()
                .set(LearningRecord::getMoment, recordDTO.getMoment())
                .set(finished, LearningRecord::getFinished, true)
                .set(finished, LearningRecord::getFinishTime, recordDTO.getCommitTime())
                .eq(LearningRecord::getId, oldRecord.getId())
                .update();
        if(!update){
            throw new DbException("更新学习记录失败");
        }
        //3.如果是第一次学完，则清除redis中的学习记录
        taskHandler.cleanRecordCache(recordDTO.getLessonId(), recordDTO.getSectionId());
        if (finished) {
            Map<String, Object> payload = new HashMap<>(8);
            payload.put("source", "course_video");
            payload.put("lesson_id", recordDTO.getLessonId());
            payload.put("section_id", recordDTO.getSectionId());
            payload.put("watched_seconds", recordDTO.getMoment());
            payload.put("video_duration_seconds", recordDTO.getDuration());
            payload.put("resource_type_hint", "video");
            learningBehaviorCollectionService.collect(
                    userId,
                    2,
                    payload,
                    "section",
                    recordDTO.getSectionId(),
                    "completed",
                    recordDTO.getMoment()
            );
        }
        return finished;
    }

    //查询是否存在记录（Redis 按 lessonId 分区，与课表一一对应；库表再按 userId 收敛）
    private LearningRecord queryOldRecord(Long userId, Long lessonId, Long sectionId) {
        //1.查询redis
        LearningRecord record = taskHandler.readRecordCache(lessonId, sectionId);
        //2.redis存在直接返回该记录
        if(record != null){
            return record;
        }
        //3.redis不存在，查询数据库
        LearningRecord one = lambdaQuery()
                .eq(LearningRecord::getUserId, userId)
                .eq(LearningRecord::getLessonId, lessonId)
                .eq(LearningRecord::getSectionId, sectionId)
                .one();
        //4.如果数据库有记录就存到redis中
        if(one != null){
            taskHandler.writeRecordCache(one);
            return one;
        }else{
            return null;
        }
    }

    /**
     * 课程小节考试：与视频一致，同一用户+课表+小节仅一条记录；首次完成才推进课表已学小节数。
     */
    private boolean handleExamRecord(Long userId, LearningRecordFormDTO recordDTO) {
        LearningRecord existing = lambdaQuery()
                .eq(LearningRecord::getUserId, userId)
                .eq(LearningRecord::getLessonId, recordDTO.getLessonId())
                .eq(LearningRecord::getSectionId, recordDTO.getSectionId())
                .one();
        LocalDateTime now = LocalDateTime.now();
        boolean firstCompletion;
        if (existing == null) {
            LearningRecord learningRecord = new LearningRecord();
            learningRecord.setFinished(true);
            learningRecord.setFinishTime(recordDTO.getCommitTime());
            learningRecord.setSectionId(recordDTO.getSectionId());
            learningRecord.setLessonId(recordDTO.getLessonId());
            learningRecord.setUserId(userId);
            learningRecord.setCreateTime(now);
            learningRecord.setUpdateTime(now);
            if (!save(learningRecord)) {
                throw new DbException("新增考试记录失败");
            }
            firstCompletion = true;
        } else {
            boolean wasFinished = Boolean.TRUE.equals(existing.getFinished());
            firstCompletion = !wasFinished;
            boolean ok = lambdaUpdate()
                    .set(LearningRecord::getFinished, true)
                    .set(LearningRecord::getFinishTime, recordDTO.getCommitTime())
                    .set(LearningRecord::getUpdateTime, now)
                    .eq(LearningRecord::getId, existing.getId())
                    .update();
            if (!ok) {
                throw new DbException("更新考试记录失败");
            }
        }
        if (firstCompletion) {
            Map<String, Object> payload = new HashMap<>(8);
            payload.put("source", "course_section_exam");
            payload.put("lesson_id", recordDTO.getLessonId());
            payload.put("section_id", recordDTO.getSectionId());
            learningBehaviorCollectionService.collect(
                    userId,
                    1,
                    payload,
                    "section",
                    recordDTO.getSectionId(),
                    "completed",
                    null
            );
        }
        return firstCompletion;
    }
}
