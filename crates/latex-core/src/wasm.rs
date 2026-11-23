//! Zero-dependency WebAssembly linear-memory ABI.
//!
//! Layout of `parse_math_segments_wasm` output buffer (`*const u32`):
//! - word[0] = segment_count (N)
//! - For each segment k in 0..N (6 u32 words starting at 1 + k * 6):
//!   - +0: tag           (0 = text, 1 = math)
//!   - +1: mode          (0 = inline, 1 = display; 0 for text)
//!   - +2: content_start (UTF-8 byte offset into input buffer)
//!   - +3: content_end   (UTF-8 byte offset into input buffer)
//!   - +4: raw_start     (UTF-8 byte offset into input buffer)
//!   - +5: raw_end       (UTF-8 byte offset into input buffer)

use std::alloc::{alloc as std_alloc, dealloc as std_dealloc, Layout};
use std::sync::Mutex;

use crate::parser::parse_math_segments;
use crate::types::{Segment, ValidationReason};
use crate::validator::{validate_latex, ValidationLimits};

struct WasmState {
    parse_out: Vec<u32>,
    last_forbidden_start: u32,
    last_forbidden_end: u32,
}

static STATE: Mutex<WasmState> = Mutex::new(WasmState {
    parse_out: Vec::new(),
    last_forbidden_start: 0,
    last_forbidden_end: 0,
});

/// Allocates `len` bytes in WASM linear memory for JS to copy UTF-8 strings into.
#[no_mangle]
pub extern "C" fn wasm_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let layout = match Layout::from_size_align(len, 1) {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };
    unsafe { std_alloc(layout) }
}

/// Frees a buffer previously allocated via `wasm_alloc`.
#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    if let Ok(layout) = Layout::from_size_align(len, 1) {
        unsafe { std_dealloc(ptr, layout) }
    }
}

/// Parses UTF-8 text at `[ptr..ptr + len]` and writes a compact `u32` offset table
/// into an internal reusable buffer. Returns pointer to word[0] (`segment_count`).
#[no_mangle]
pub extern "C" fn parse_math_segments_wasm(ptr: *const u8, len: usize) -> *const u32 {
    let mut state = STATE.lock().expect("wasm state lock");
    state.parse_out.clear();

    if ptr.is_null() || len == 0 {
        state.parse_out.push(0);
        return state.parse_out.as_ptr();
    }

    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let text = match std::str::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => {
            state.parse_out.push(0);
            return state.parse_out.as_ptr();
        }
    };

    let base_ptr = text.as_ptr() as usize;
    let segments = parse_math_segments(text);

    state.parse_out.reserve(1 + segments.len() * 6);
    state.parse_out.push(segments.len() as u32);

    for seg in segments {
        match seg {
            Segment::Text(s) => {
                let start = (s.as_ptr() as usize - base_ptr) as u32;
                let end = start + s.len() as u32;
                state.parse_out.extend_from_slice(&[0, 0, start, end, start, end]);
            }
            Segment::Math { content, mode, raw } => {
                let content_start = (content.as_ptr() as usize - base_ptr) as u32;
                let content_end = content_start + content.len() as u32;
                let raw_start = (raw.as_ptr() as usize - base_ptr) as u32;
                let raw_end = raw_start + raw.len() as u32;
                state.parse_out.extend_from_slice(&[
                    1,
                    mode as u32,
                    content_start,
                    content_end,
                    raw_start,
                    raw_end,
                ]);
            }
        }
    }

    state.parse_out.as_ptr()
}

/// Validates a UTF-8 LaTeX expression at `[ptr..ptr + len]`.
/// Returns `0` for valid, or `ValidationReason as u32` (`1..=5`) for failure.
/// When returning `5` (`ForbiddenCommand`), query `last_forbidden_start` / `last_forbidden_end`
/// to slice the offending command from the input buffer.
#[no_mangle]
pub extern "C" fn validate_latex_wasm(
    ptr: *const u8,
    len: usize,
    max_length: usize,
    max_brace_depth: usize,
) -> u32 {
    let mut state = STATE.lock().expect("wasm state lock");
    state.last_forbidden_start = 0;
    state.last_forbidden_end = 0;

    let formula = if ptr.is_null() || len == 0 {
        ""
    } else {
        let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
        match std::str::from_utf8(bytes) {
            Ok(s) => s,
            Err(_) => return ValidationReason::Empty as u32,
        }
    };

    let limits = ValidationLimits {
        max_length,
        max_brace_depth,
    };

    match validate_latex(formula, limits) {
        Ok(()) => 0,
        Err(err) => {
            if let Some(cmd) = err.forbidden_command {
                let base_ptr = formula.as_ptr() as usize;
                let start = (cmd.as_ptr() as usize - base_ptr) as u32;
                state.last_forbidden_start = start;
                state.last_forbidden_end = start + cmd.len() as u32;
            }
            err.reason as u32
        }
    }
}

#[no_mangle]
pub extern "C" fn last_forbidden_start() -> u32 {
    STATE.lock().expect("wasm state lock").last_forbidden_start
}

#[no_mangle]
pub extern "C" fn last_forbidden_end() -> u32 {
    STATE.lock().expect("wasm state lock").last_forbidden_end
}

/// Batch-processes NUL-separated UTF-8 posts in a single WASM linear-memory pass,
/// parsing every post and validating every extracted math segment.
/// Returns the total count of valid math segments found across the batch.
#[no_mangle]
pub extern "C" fn process_batch_wasm(
    ptr: *const u8,
    len: usize,
    max_length: usize,
    max_brace_depth: usize,
) -> u32 {
    if ptr.is_null() || len == 0 {
        return 0;
    }

    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let limits = ValidationLimits {
        max_length,
        max_brace_depth,
    };

    let mut valid_formulas = 0u32;
    for chunk in bytes.split(|&b| b == 0) {
        if let Ok(post) = std::str::from_utf8(chunk) {
            let segments = parse_math_segments(post);
            for seg in segments {
                if let Segment::Math { content, .. } = seg {
                    if validate_latex(content, limits).is_ok() {
                        valid_formulas += 1;
                    }
                }
            }
        }
    }

    valid_formulas
}
