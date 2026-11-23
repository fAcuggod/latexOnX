//! Algebraic Data Types (ADTs) mirroring `src/core/types.ts`.
//!
//! For readers coming from Haskell:
//! - Rust `enum` with data variants is the direct equivalent of Haskell `data`.
//! - `&'a str` is a borrowed, zero-copy slice into the original input text.

/// Presentation mode for a mathematical formula.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum MathDisplayMode {
    /// Rendered inline inside a sentence, e.g. `\(x^2 + 1\)`.
    Inline = 0,
    /// Rendered as a centered block equation, e.g. `$$...$$` or `\[...\]`.
    Display = 1,
}

/// A lossless slice of post text, borrowing directly from the source string `'a`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Segment<'a> {
    /// Literal plain text (guaranteed non-empty and never adjacent to another `Text`).
    Text(&'a str),
    /// A delimited math expression.
    Math {
        /// Clean LaTeX source (delimiters stripped and whitespace trimmed).
        content: &'a str,
        /// Inline or display block presentation mode.
        mode: MathDisplayMode,
        /// Exact original substring from the post, including delimiters.
        raw: &'a str,
    },
}

/// Machine-readable reason why a formula was rejected by the anti-DoS validator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum ValidationReason {
    Empty = 1,
    TooLong = 2,
    TooDeep = 3,
    UnbalancedBraces = 4,
    ForbiddenCommand = 5,
}

/// Detailed validation failure returned inside `Err(ValidationError)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError<'a> {
    pub reason: ValidationReason,
    /// Matched disallowed control word when `reason == ValidationReason::ForbiddenCommand`.
    pub forbidden_command: Option<&'a str>,
    pub message: String,
}
