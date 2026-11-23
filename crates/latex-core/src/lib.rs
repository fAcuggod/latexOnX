//! Pure, zero-dependency Rust core for **LaTeX on X**.
//!
//! Mirrors `src/core/parser.ts` and `src/core/validator.ts` with zero-copy
//! string slicing (`&'a str`) and compiles directly to a compact WebAssembly
//! module (`wasm32-unknown-unknown`) with no external crate dependencies.

pub mod parser;
pub mod types;
pub mod validator;
pub mod wasm;

pub use parser::{parse_math_segments, DelimiterSpec, DELIMITERS};
pub use types::{MathDisplayMode, Segment, ValidationError, ValidationReason};
pub use validator::{
    validate_latex, ValidationLimits, DEFAULT_MAX_BRACE_DEPTH, DEFAULT_MAX_LENGTH,
    FORBIDDEN_COMMANDS,
};
