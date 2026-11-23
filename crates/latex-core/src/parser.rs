//! Zero-copy linear delimiter scanner mirroring `src/core/parser.ts`.
//!
//! Because every text segment and math segment is a contiguous sub-slice of
//! `text`, `parse_math_segments` returns `Vec<Segment<'a>>` without allocating
//! a single `String` on the heap.

use crate::types::{MathDisplayMode, Segment};

/// Opening/closing delimiter pair recognized by the scanner.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DelimiterSpec {
    pub open: &'static str,
    pub close: &'static str,
    pub mode: MathDisplayMode,
}

/// Supported math delimiters in evaluation order.
/// Single `$` is intentionally excluded to avoid collisions with currency notation and cashtags.
pub const DELIMITERS: [DelimiterSpec; 3] = [
    DelimiterSpec {
        open: "$$",
        close: "$$",
        mode: MathDisplayMode::Display,
    },
    DelimiterSpec {
        open: "\\[",
        close: "\\]",
        mode: MathDisplayMode::Display,
    },
    DelimiterSpec {
        open: "\\(",
        close: "\\)",
        mode: MathDisplayMode::Inline,
    },
];

/// Appends a contiguous plain-text slice `&text[start..end]` to `segments`,
/// coalescing with the previous `Segment::Text` slice in O(1) without copying.
fn push_text_span<'a>(segments: &mut Vec<Segment<'a>>, text: &'a str, start: usize, end: usize) {
    if start >= end {
        return;
    }

    if let Some(Segment::Text(prev)) = segments.last_mut() {
        let base = text.as_ptr() as usize;
        let prev_start = prev.as_ptr() as usize - base;
        let prev_end = prev_start + prev.len();
        if prev_end == start {
            *prev = &text[prev_start..end];
            return;
        }
    }

    segments.push(Segment::Text(&text[start..end]));
}

/// Splits raw post text into an ordered list of zero-copy `Segment<'a>` slices
/// alternating between literal text and delimited math expressions.
///
/// Guarantees:
/// - Single `$` (currency notation and cashtags) is never treated as math.
/// - Unclosed delimiters and empty/whitespace-only formulas stay literal text.
/// - Lossless round-trip: concatenating every `Text(s)` and `Math { raw, .. }`
///   reconstructs `text` byte-for-byte.
/// - Complexity: Time O(n), Space O(number of segments) with zero string copies.
pub fn parse_math_segments<'a>(text: &'a str) -> Vec<Segment<'a>> {
    let mut segments: Vec<Segment<'a>> = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0usize;

    while i < len {
        // Fast-path: jump across contiguous non-delimiter bytes in one tight scan.
        // Safe in UTF-8 because ASCII '$' (0x24) and '\\' (0x5C) never occur inside multi-byte sequences.
        if bytes[i] != b'$' && bytes[i] != b'\\' {
            let start = i;
            i += 1;
            while i < len && bytes[i] != b'$' && bytes[i] != b'\\' {
                i += 1;
            }
            push_text_span(&mut segments, text, start, i);
            continue;
        }

        let rest = &text[i..];

        let matched = DELIMITERS
            .iter()
            .copied()
            .find(|delim| rest.starts_with(delim.open));

        match matched {
            None => {
                // Single '$' or non-delimiter '\\' is always 1 ASCII byte
                push_text_span(&mut segments, text, i, i + 1);
                i += 1;
            }
            Some(delim) => {
                let after_open = i + delim.open.len();
                match text[after_open..].find(delim.close) {
                    None => {
                        push_text_span(&mut segments, text, i, after_open);
                        i = after_open;
                    }
                    Some(rel_close) => {
                        let close_idx = after_open + rel_close;
                        let end_idx = close_idx + delim.close.len();
                        let raw = &text[i..end_idx];
                        let inner = text[after_open..close_idx].trim();

                        if inner.is_empty() {
                            push_text_span(&mut segments, text, i, end_idx);
                        } else {
                            segments.push(Segment::Math {
                                content: inner,
                                mode: delim.mode,
                                raw,
                            });
                        }

                        i = end_idx;
                    }
                }
            }
        }
    }

    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reconstruct(segments: &[Segment<'_>]) -> String {
        let mut out = String::new();
        for seg in segments {
            match seg {
                Segment::Text(s) => out.push_str(s),
                Segment::Math { raw, .. } => out.push_str(raw),
            }
        }
        out
    }

    #[test]
    fn returns_empty_vec_for_empty_input() {
        assert_eq!(parse_math_segments(""), Vec::new());
    }

    #[test]
    fn preserves_plain_text_as_single_segment() {
        let input = "Hello X, studying computer science today.";
        assert_eq!(parse_math_segments(input), vec![Segment::Text(input)]);
    }

    #[test]
    fn ignores_single_dollar_currency_and_cashtags() {
        let input = "Spent $50 on $BTC and ranged $10 - $20 on $TSLA.";
        assert_eq!(parse_math_segments(input), vec![Segment::Text(input)]);
    }

    #[test]
    fn parses_inline_math_parentheses() {
        let input = "If \\(x^2 + 1\\) is positive";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Text("If "),
                Segment::Math {
                    content: "x^2 + 1",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(x^2 + 1\\)",
                },
                Segment::Text(" is positive"),
            ]
        );
    }

    #[test]
    fn parses_display_math_double_dollars() {
        let input = "$$E = mc^2$$";
        assert_eq!(
            parse_math_segments(input),
            vec![Segment::Math {
                content: "E = mc^2",
                mode: MathDisplayMode::Display,
                raw: "$$E = mc^2$$",
            }]
        );
    }

    #[test]
    fn parses_display_math_brackets() {
        let input = "Integral: \\[\\int_0^1 x\\,dx = \\frac{1}{2}\\]";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Text("Integral: "),
                Segment::Math {
                    content: "\\int_0^1 x\\,dx = \\frac{1}{2}",
                    mode: MathDisplayMode::Display,
                    raw: "\\[\\int_0^1 x\\,dx = \\frac{1}{2}\\]",
                },
            ]
        );
    }

    #[test]
    fn trims_surrounding_whitespace_while_preserving_raw() {
        let input = "Block:\n$$\n  \\frac{a}{b}\n$$\nEnd";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Text("Block:\n"),
                Segment::Math {
                    content: "\\frac{a}{b}",
                    mode: MathDisplayMode::Display,
                    raw: "$$\n  \\frac{a}{b}\n$$",
                },
                Segment::Text("\nEnd"),
            ]
        );
    }

    #[test]
    fn handles_multiple_mixed_formulas() {
        let input = "Given \\(a = 3\\) and \\(b = 4\\) we get $$c = \\sqrt{a^2 + b^2} = 5$$";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Text("Given "),
                Segment::Math {
                    content: "a = 3",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(a = 3\\)",
                },
                Segment::Text(" and "),
                Segment::Math {
                    content: "b = 4",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(b = 4\\)",
                },
                Segment::Text(" we get "),
                Segment::Math {
                    content: "c = \\sqrt{a^2 + b^2} = 5",
                    mode: MathDisplayMode::Display,
                    raw: "$$c = \\sqrt{a^2 + b^2} = 5$$",
                },
            ]
        );
    }

    #[test]
    fn supports_adjacent_formulas_without_empty_text() {
        let input = "\\(x\\)\\(y\\)";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Math {
                    content: "x",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(x\\)",
                },
                Segment::Math {
                    content: "y",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(y\\)",
                },
            ]
        );
    }

    #[test]
    fn treats_unclosed_delimiters_as_literal_text() {
        let input = "Unclosed $$x^2 but valid: \\(y + 1\\)";
        assert_eq!(
            parse_math_segments(input),
            vec![
                Segment::Text("Unclosed $$x^2 but valid: "),
                Segment::Math {
                    content: "y + 1",
                    mode: MathDisplayMode::Inline,
                    raw: "\\(y + 1\\)",
                },
            ]
        );
    }

    #[test]
    fn treats_empty_or_whitespace_only_formulas_as_literal_text() {
        let input = "Empty: $$$$ and \\(\\) and $$   $$";
        assert_eq!(parse_math_segments(input), vec![Segment::Text(input)]);
    }

    #[test]
    fn preserves_lossless_and_unicode_invariants() {
        let samples = [
            "",
            "Plain text with $BTC and $100",
            "\\(a\\) + \\(b\\) = $$c$$",
            "Broken \\[unclosed and \\(ok\\) and $$   $$ end",
            "$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$",
            "Fórmula en español y 公式 🚀: \\(e^{i\\pi} + 1 = 0\\) listo!",
        ];

        for sample in samples {
            let segments = parse_math_segments(sample);
            assert_eq!(reconstruct(&segments), sample);

            for idx in 0..segments.len() {
                if let Segment::Text(s) = segments[idx] {
                    assert!(!s.is_empty());
                    if idx > 0 {
                        assert!(!matches!(segments[idx - 1], Segment::Text(_)));
                    }
                }
            }
        }
    }
}
