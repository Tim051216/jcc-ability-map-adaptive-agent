package com.cnsoftbei.a3.common.utils;

import cn.hutool.core.convert.impl.TemporalAccessorConverter;

import java.time.temporal.TemporalAccessor;

public class A3TemporalConverter extends TemporalAccessorConverter {
    public A3TemporalConverter(Class<?> targetType) {
        super(targetType);
    }

    public A3TemporalConverter(Class<?> targetType, String format) {
        super(targetType, format);
    }

    @Override
    protected TemporalAccessor convertInternal(Object value) {
        if (value instanceof String) {
            String val = value.toString();
            try {
                return super.convertInternal(Long.parseLong(val));
            } catch (NumberFormatException e) {
                return super.convertInternal(value);
            }
        }
        return super.convertInternal(value);
    }
}
