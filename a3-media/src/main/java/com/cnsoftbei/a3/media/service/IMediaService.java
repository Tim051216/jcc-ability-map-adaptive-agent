package com.cnsoftbei.a3.media.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.media.domain.dto.MediaDTO;
import com.cnsoftbei.a3.media.domain.dto.MediaUploadResultDTO;
import com.cnsoftbei.a3.media.domain.po.Media;
import com.cnsoftbei.a3.media.domain.query.MediaQuery;
import com.cnsoftbei.a3.media.domain.vo.MediaVO;
import com.cnsoftbei.a3.media.domain.vo.VideoPlayVO;

/**
 * <p>
 * 媒资表，主要是视频文件 服务类
 * </p>
 *
 * @author 虎哥
 * @since 2022-06-30
 */
public interface IMediaService extends IService<Media> {

    String getUploadSignature();

    VideoPlayVO getPlaySignatureBySectionId(Long fileId);

    MediaDTO save(MediaUploadResultDTO mediaResult);

    void updateMediaProcedureResult(Media media);

    void deleteMedia(String fileId);

    VideoPlayVO getPlaySignatureByMediaId(Long mediaId);

    PageDTO<MediaVO> queryMediaPage(MediaQuery query);
}
