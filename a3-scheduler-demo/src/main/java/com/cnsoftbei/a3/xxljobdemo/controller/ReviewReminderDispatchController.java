package com.cnsoftbei.a3.xxljobdemo.controller;

import com.cnsoftbei.a3.xxljobdemo.job.ReviewReminderDispatchJob;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/scheduler/review-reminders")
@RequiredArgsConstructor
public class ReviewReminderDispatchController {

    private final ReviewReminderDispatchJob reviewReminderDispatchJob;

    @PostMapping("/dispatch-once")
    public String dispatchOnce() {
        return reviewReminderDispatchJob.dispatchOnce();
    }
}
