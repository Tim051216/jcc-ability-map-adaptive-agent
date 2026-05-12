package com.cnsoftbei.a3.learning.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 学习行为画像异步转发线程池。
 * {@link com.cnsoftbei.a3.learning.support.ProfileBehaviorForwarder} 使用
 * {@code @Async("learningBehaviorExecutor")}，与此处 Bean 名一致。
 */
@Configuration
@EnableAsync
public class AsyncLearningBehaviorConfiguration {

    /** 关停时最多等待池中任务结束的秒数 */
    private static final int AWAIT_SHUTDOWN_SECONDS = 30;

    @Bean(name = "learningBehaviorExecutor")
    public Executor learningBehaviorExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("learn-behav-");
        // 队列满时由提交线程执行，避免静默丢弃转发（短时可能略增请求线程耗时）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(AWAIT_SHUTDOWN_SECONDS);
        executor.initialize();
        return executor;
    }
}
