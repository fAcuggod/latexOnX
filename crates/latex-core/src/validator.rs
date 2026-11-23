//! Anti-DoS LaTeX validator mirroring `src/core/validator.ts`.
//!
//! Runs linear O(n) checks in strict order:
//! 1. Non-empty (after trimming)
//! 2. Max length (UTF-16 code-unit parity with JS `string.length`)
//! 3. Balanced `{...}` braces and max nesting depth (skipping escaped pairs)
//! 4. Disallowed macro/HTML commands (`\def`, `\let`, `\href`, `\htmlStyle`, ...)

use crate::types::{ValidationError, ValidationReason};

pub const DEFAULT_MAX_LENGTH: usize = 500;
pub const DEFAULT_MAX_BRACE_DEPTH: usize = 15;

/// Configurable safety bounds to protect the browser against pathological/DoS formulas.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidationLimits {
    pub max_length: usize,
    pub max_brace_depth: usize,
}

impl Default for ValidationLimits {
    fn default() -> Self {
        Self {
            max_length: DEFAULT_MAX_LENGTH,
            max_brace_depth: DEFAULT_MAX_BRACE_DEPTH,
        }
    }
}

/// Disallowed LaTeX/KaTeX commands (defense in depth).
pub const FORBIDDEN_COMMANDS: [&str; 13] = [
    "\\def",
    "\\gdef",
    "\\edef",
    "\\xdef",
    "\\let",
    "\\newcommand",
    "\\renewcommand",
    "\\href",
    "\\url",
    "\\htmlClass",
    "\\htmlStyle",
    "\\htmlId",
    "\\htmlData",
];

#[inline]
fn is_forbidden_command(cmd: &str) -> bool {
    matches!(
        cmd,
        "\\def"
            | "\\gdef"
            | "\\edef"
            | "\\xdef"
            | "\\let"
            | "\\newcommand"
            | "\\renewcommand"
            | "\\href"
            | "\\url"
            | "\\htmlClass"
            | "\\htmlStyle"
            | "\\htmlId"
            | "\\htmlData"
    )
}

#[inline]
fn utf16_len(s: &str) -> usize {
    if s.is_ascii() {
        s.len()
    } else {
        s.encode_utf16().count()
    }
}

fn check_braces(formula: &str, max_brace_depth: usize) -> Option<ValidationReason> {
    let bytes = formula.as_bytes();
    let mut i = 0usize;
    let mut depth = 0isize;
    let max_depth = max_brace_depth as isize;

    while i < bytes.len() {
        match bytes[i] {
            b'\\' => {
                i += 2;
                continue;
            }
            b'{' => {
                depth += 1;
                if depth > max_depth {
                    return Some(ValidationReason::TooDeep);
                }
            }
            b'}' => {
                depth -= 1;
                if depth < 0 {
                    return Some(ValidationReason::UnbalancedBraces);
                }
            }
            _ => {}
        }
        i += 1;
    }

    if depth != 0 {
        return Some(ValidationReason::UnbalancedBraces);
    }

    None
}

fn find_forbidden_command<'a>(formula: &'a str) -> Option<&'a str> {
    let bytes = formula.as_bytes();
    let mut i = 0usize;

    while i < bytes.len() {
        if bytes[i] != b'\\' {
            i += 1;
            continue;
        }

        let mut j = i + 1;
        while j < bytes.len() && bytes[j].is_ascii_alphabetic() {
            j += 1;
        }

        if j > i + 1 {
            let cmd = &formula[i..j];
            if is_forbidden_command(cmd) {
                return Some(cmd);
            }
            i = j;
        } else {
            // Skip escaped symbol or line break `\\` so `\\def` is not flagged as `\def`
            i += 2;
        }
    }

    None
}

/// Validates a LaTeX expression before passing it to KaTeX.
/// Returns `Ok(())` when safe, or `Err(ValidationError)` with machine-readable reason.
pub fn validate_latex<'a>(
    formula: &'a str,
    limits: ValidationLimits,
) -> Result<(), ValidationError<'a>> {
    if formula.trim().is_empty() {
        return Err(ValidationError {
            reason: ValidationReason::Empty,
            forbidden_command: None,
            message: "Formula is empty.".to_string(),
        });
    }

    if utf16_len(formula) > limits.max_length {
        return Err(ValidationError {
            reason: ValidationReason::TooLong,
            forbidden_command: None,
            message: format!(
                "Formula exceeds the maximum length of {} characters.",
                limits.max_length
            ),
        });
    }

    if let Some(brace_err) = check_braces(formula, limits.max_brace_depth) {
        let message = match brace_err {
            ValidationReason::TooDeep => format!(
                "Formula exceeds the maximum brace nesting depth of {}.",
                limits.max_brace_depth
            ),
            _ => "Formula contains unbalanced braces.".to_string(),
        };
        return Err(ValidationError {
            reason: brace_err,
            forbidden_command: None,
            message,
        });
    }

    if let Some(cmd) = find_forbidden_command(formula) {
        return Err(ValidationError {
            reason: ValidationReason::ForbiddenCommand,
            forbidden_command: Some(cmd),
            message: format!("Formula contains disallowed command {}.", cmd),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_standard_mathematical_expressions() {
        let valid = [
            "x^2 + 1",
            "E = mc^2",
            "\\frac{a + b}{c - d}",
            "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
            "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
        ];
        for formula in valid {
            assert_eq!(validate_latex(formula, ValidationLimits::default()), Ok(()));
        }
    }

    #[test]
    fn rejects_empty_or_whitespace_only_formulas() {
        for empty in ["", "   ", "\n\t  "] {
            let err = validate_latex(empty, ValidationLimits::default()).unwrap_err();
            assert_eq!(err.reason, ValidationReason::Empty);
        }
    }

    #[test]
    fn accepts_exact_max_length_and_rejects_longer() {
        let exact = "x".repeat(DEFAULT_MAX_LENGTH);
        assert_eq!(validate_latex(&exact, ValidationLimits::default()), Ok(()));

        let too_long = "x".repeat(DEFAULT_MAX_LENGTH + 1);
        let err = validate_latex(&too_long, ValidationLimits::default()).unwrap_err();
        assert_eq!(err.reason, ValidationReason::TooLong);
    }

    #[test]
    fn rejects_unbalanced_braces() {
        let broken = ["\\frac{a}{b", "x}", "a} + {b", "{{x}", "\\frac{1}{2}}"];
        for formula in broken {
            let err = validate_latex(formula, ValidationLimits::default()).unwrap_err();
            assert_eq!(err.reason, ValidationReason::UnbalancedBraces);
        }
    }

    #[test]
    fn ignores_escaped_braces_while_counting_real_braces_after_linebreak() {
        assert_eq!(
            validate_latex("\\{1, 2, 3\\}", ValidationLimits::default()),
            Ok(())
        );
        assert_eq!(
            validate_latex("\\left\\{ x \\in \\mathbb{R} \\right.", ValidationLimits::default()),
            Ok(())
        );
        assert_eq!(
            validate_latex("a \\\\ {b}", ValidationLimits::default()),
            Ok(())
        );

        let err = validate_latex("a \\\\ {b", ValidationLimits::default()).unwrap_err();
        assert_eq!(err.reason, ValidationReason::UnbalancedBraces);
    }

    #[test]
    fn accepts_exact_max_brace_depth_and_rejects_deeper() {
        let at_limit = format!(
            "{}x{}",
            "{".repeat(DEFAULT_MAX_BRACE_DEPTH),
            "}".repeat(DEFAULT_MAX_BRACE_DEPTH)
        );
        assert_eq!(validate_latex(&at_limit, ValidationLimits::default()), Ok(()));

        let over_limit = format!(
            "{}x{}",
            "{".repeat(DEFAULT_MAX_BRACE_DEPTH + 1),
            "}".repeat(DEFAULT_MAX_BRACE_DEPTH + 1)
        );
        let err = validate_latex(&over_limit, ValidationLimits::default()).unwrap_err();
        assert_eq!(err.reason, ValidationReason::TooDeep);
    }

    #[test]
    fn rejects_disallowed_commands() {
        let dangerous = [
            ("\\def\\x{1} \\x", "\\def"),
            ("\\gdef\\a{\\a}\\a", "\\gdef"),
            ("\\let\\foo\\bar", "\\let"),
            ("\\newcommand{\\mycmd}{x}", "\\newcommand"),
            ("\\href{https://evil.example}{click}", "\\href"),
            ("\\url{https://evil.example}", "\\url"),
            ("\\htmlStyle{color:red}{x}", "\\htmlStyle"),
        ];
        for (formula, expected_cmd) in dangerous {
            let err = validate_latex(formula, ValidationLimits::default()).unwrap_err();
            assert_eq!(err.reason, ValidationReason::ForbiddenCommand);
            assert_eq!(err.forbidden_command, Some(expected_cmd));
        }
    }

    #[test]
    fn avoids_false_positives_on_shared_prefixes_and_linebreaks() {
        assert_eq!(
            validate_latex("x \\leftarrow 0", ValidationLimits::default()),
            Ok(())
        );
        assert_eq!(
            validate_latex("A \\leftrightarrow B", ValidationLimits::default()),
            Ok(())
        );
        assert_eq!(
            validate_latex("a \\\\def b", ValidationLimits::default()),
            Ok(())
        );
    }

    #[test]
    fn respects_custom_limit_overrides() {
        let custom_len = ValidationLimits {
            max_length: 5,
            max_brace_depth: DEFAULT_MAX_BRACE_DEPTH,
        };
        assert_eq!(
            validate_latex("x^2 + y^2", custom_len).unwrap_err().reason,
            ValidationReason::TooLong
        );

        let custom_depth = ValidationLimits {
            max_length: DEFAULT_MAX_LENGTH,
            max_brace_depth: 2,
        };
        assert_eq!(
            validate_latex("{{{x}}}", custom_depth).unwrap_err().reason,
            ValidationReason::TooDeep
        );
    }
}
