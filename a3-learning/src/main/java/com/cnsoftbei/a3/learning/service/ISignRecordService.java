package com.cnsoftbei.a3.learning.service;

import com.cnsoftbei.a3.learning.domain.vo.SignResultVO;

import java.util.Deque;
import java.util.List;

public interface ISignRecordService {
    SignResultVO addSignRecords();

    Deque<Integer> querySignRecords();

}