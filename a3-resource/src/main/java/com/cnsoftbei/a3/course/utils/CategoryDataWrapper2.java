package com.cnsoftbei.a3.course.utils;

import com.cnsoftbei.a3.common.utils.TreeDataUtils;
import com.cnsoftbei.a3.course.domain.po.Category;
import com.cnsoftbei.a3.course.domain.vo.CategoryVO;

import java.util.List;

/**
 * @ClassName CategoryDataWrapper2
 * @Author wusongsong
 * @Date 2022/9/21 19:44
 * @Version
 **/
public class CategoryDataWrapper2 implements TreeDataUtils.DataProcessor<CategoryVO, Category> {
    @Override
    public Object getParentKey(Category category) {
        return category.getParentId();
    }

    @Override
    public Object getKey(Category category) {
        return category.getId();
    }

    @Override
    public Object getRootKey() {
        return 0L;
    }

    @Override
    public List<CategoryVO> getChild(CategoryVO categoryVO) {
        return categoryVO.getChildren();
    }

    @Override
    public void setChild(CategoryVO parent, List<CategoryVO> child) {
        parent.setChildren(child);
    }
}
