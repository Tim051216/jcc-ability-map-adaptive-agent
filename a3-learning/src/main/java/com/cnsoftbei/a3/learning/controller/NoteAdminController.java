package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/admin/notes")
public class NoteAdminController {

    @GetMapping("/page")
    public PageDTO<Object> queryNotePageForAdmin() {
        return PageDTO.empty(0L, 0L);
    }

    @GetMapping("/{id}")
    public Map<String, Object> queryNoteDetailForAdmin(@PathVariable("id") Long id) {
        return Collections.emptyMap();
    }

    @PutMapping("/{id}/hidden/{hidden}")
    public void hiddenNoteAdmin(@PathVariable("id") Long id, @PathVariable("hidden") Boolean hidden) {
        // Local stub for admin acceptance.
    }
}
