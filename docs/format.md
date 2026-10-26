# Format Checker: how it works

The rules `/format` checks for each format. The page's "How it works" gives the short version. The checker reports the first problem it finds, with its line and column where the parser gives one.

## JSON

- Must be valid JSON syntax (RFC 8259).
- Keys must be double-quoted strings.
- No trailing commas.
- No comments.
- Values: strings, numbers, objects, arrays, `true`, `false`, `null`.

## YAML

- Parsed as YAML 1.2; every document in a `---` stream is checked.
- Indentation uses spaces, not tabs.
- Flow collections and quoted strings must be closed.
- No non-printable characters (the YAML c-printable set).

## XML

Checked with the browser's XML parser.

- Must be well-formed XML.
- Every tag must be closed.
- Attribute values must be quoted.
- A root element is required.
- Special characters must be escaped (`&lt;`, `&gt;`, `&amp;`).

## Markdown

CommonMark accepts any text, so these are lint checks.

- Link destinations with spaces must be wrapped in `<>` or encoded.
- Self-closing tags only for void elements.
- Fenced code blocks are not checked.

## Plain text

- No control characters other than tab, line feed, carriage return and form feed (DEL and U+0080 to U+009F are rejected).
- No noncharacters U+FFFE or U+FFFF.
- No lone surrogates (the text must be encodable as UTF-8).
