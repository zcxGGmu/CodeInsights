use std::fs::File;
use std::io::{BufRead, BufReader};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const PROTOCOL_VERSION: u32 = 1;
const CACHE_SCHEMA_VERSION: u32 = 1;
const BINARY_VERSION: &str = "0.0.1-dev";
const MAX_LIMIT: usize = 100;
const MAX_QUERY_CHARS: usize = 128;
const MAX_SNIPPET_CHARS: usize = 160;
const DEFAULT_TEXT_FIELDS: &[&str] = &["content", "summary", "error", "text", "message"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProtocolRequest {
    jsonrpc: String,
    id: String,
    method: String,
    #[serde(default)]
    params: Value,
    #[serde(default)]
    deadline_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProtocolResponse {
    jsonrpc: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<ProtocolError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProtocolError {
    code: &'static str,
    message: String,
    recoverable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchParams {
    #[serde(default)]
    request_id: String,
    query: String,
    #[serde(default)]
    limit: Option<usize>,
    sources: Vec<SearchSource>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchSource {
    source_kind: String,
    #[serde(default)]
    source_id: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    workspace_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    file_path: String,
    #[serde(default)]
    text_fields: Option<Vec<String>>,
    #[serde(default)]
    id_field: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    request_id: String,
    query: String,
    matches: Vec<SearchMatch>,
    has_more: bool,
    index_state: &'static str,
    implementation: &'static str,
    searched_at: u128,
    diagnostics: SearchDiagnostics,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchDiagnostics {
    invalid_json_lines: usize,
    missing_files: usize,
    read_errors: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchMatch {
    id: String,
    source_kind: String,
    title: String,
    snippet: String,
    matched_ranges: Vec<MatchedRange>,
    score: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    record_id: Option<String>,
    cursor: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchedRange {
    start: usize,
    length: usize,
}

#[derive(Default)]
struct SearchIssueCounts {
    invalid_json_lines: usize,
    missing_files: usize,
    read_errors: usize,
}

#[derive(Default)]
struct SearchState {
    total_matches: usize,
    matches: Vec<SearchMatch>,
    issues: SearchIssueCounts,
}

struct SearchRuntime<'a> {
    query: &'a str,
    query_lower: &'a str,
    query_char_len: usize,
    limit: usize,
    deadline: Option<Instant>,
}

struct Snippet {
    text: String,
    match_start: usize,
    match_length: usize,
}

pub struct ProtocolLineOutcome {
    pub response: String,
    pub should_shutdown: bool,
}

pub fn handle_protocol_line(line: &str) -> String {
    handle_protocol_line_with_control(line).response
}

pub fn handle_protocol_line_with_control(line: &str) -> ProtocolLineOutcome {
    let request = match serde_json::from_str::<ProtocolRequest>(line) {
        Ok(request) => request,
        Err(_) => {
            return ProtocolLineOutcome {
                response: serialize_response(error_response(
                    None,
                    "invalid_input",
                    "请求 JSON 无效",
                    true,
                )),
                should_shutdown: false,
            }
        }
    };

    let (response, should_shutdown) = handle_request(request);
    ProtocolLineOutcome {
        response: serialize_response(response),
        should_shutdown,
    }
}

fn handle_request(request: ProtocolRequest) -> (ProtocolResponse, bool) {
    if request.jsonrpc != "2.0" {
        return (
            error_response(
                Some(request.id),
                "invalid_input",
                "jsonrpc 必须为 2.0",
                true,
            ),
            false,
        );
    }

    let deadline = request
        .deadline_ms
        .and_then(|deadline_ms| Instant::now().checked_add(Duration::from_millis(deadline_ms)));

    match request.method.as_str() {
        "status" => (success_response(Some(request.id), status_payload()), false),
        "search" => match serde_json::from_value::<SearchParams>(request.params) {
            Ok(params) => match search(params, deadline) {
                Ok(result) => (
                    success_response(
                        Some(request.id),
                        serde_json::to_value(result).unwrap_or(Value::Null),
                    ),
                    false,
                ),
                Err(error) => (
                    error_response(
                        Some(request.id),
                        error.code,
                        &error.message,
                        error.recoverable,
                    ),
                    false,
                ),
            },
            Err(_) => (
                error_response(Some(request.id), "invalid_input", "search 参数无效", true),
                false,
            ),
        },
        "shutdown" => (
            success_response(Some(request.id), json!({ "accepted": true })),
            true,
        ),
        "tail_jsonl" => (
            error_response(
                Some(request.id),
                "invalid_input",
                "tail_jsonl 尚未进入 Phase 5 最小 search sidecar 切片",
                true,
            ),
            false,
        ),
        _ => (
            error_response(Some(request.id), "invalid_input", "未知 method", true),
            false,
        ),
    }
}

fn status_payload() -> Value {
    json!({
        "implementation": "rust-sidecar",
        "binaryVersion": BINARY_VERSION,
        "protocolVersion": PROTOCOL_VERSION,
        "cacheSchemaVersion": CACHE_SCHEMA_VERSION,
        "capabilities": ["diagnostics", "indexed-search"],
    })
}

fn search(params: SearchParams, deadline: Option<Instant>) -> Result<SearchResult, ProtocolError> {
    let query = params.query.trim().to_string();
    let request_id = if params.request_id.is_empty() {
        "native-search".to_string()
    } else {
        params.request_id
    };
    let limit = params.limit.unwrap_or(MAX_LIMIT).clamp(1, MAX_LIMIT);
    let query_char_len = query.chars().count();
    let mut state = SearchState::default();

    if query_char_len > MAX_QUERY_CHARS {
        return Err(ProtocolError {
            code: "invalid_input",
            message: "query 过长".to_string(),
            recoverable: true,
        });
    }

    if query.is_empty() {
        return Ok(SearchResult {
            request_id,
            query,
            matches: state.matches,
            has_more: false,
            index_state: "ready",
            implementation: "rust-sidecar",
            searched_at: now_millis(),
            diagnostics: diagnostics(state.issues),
        });
    }

    check_deadline(deadline)?;
    let query_lower = query.to_lowercase();
    let runtime = SearchRuntime {
        query: &query,
        query_lower: &query_lower,
        query_char_len,
        limit,
        deadline,
    };

    let mut stopped_early = false;
    for (source_index, source) in params.sources.iter().enumerate() {
        if state.matches.len() >= limit {
            stopped_early = source_index < params.sources.len();
            break;
        }
        scan_source(source, &runtime, &mut state)?;
    }

    Ok(SearchResult {
        request_id,
        query,
        matches: state.matches,
        has_more: state.total_matches > limit || stopped_early,
        index_state: "ready",
        implementation: "rust-sidecar",
        searched_at: now_millis(),
        diagnostics: diagnostics(state.issues),
    })
}

fn scan_source(
    source: &SearchSource,
    runtime: &SearchRuntime<'_>,
    state: &mut SearchState,
) -> Result<(), ProtocolError> {
    let file = match File::open(&source.file_path) {
        Ok(file) => file,
        Err(_) => {
            state.issues.missing_files += 1;
            return Ok(());
        }
    };

    for (line_index, line) in BufReader::new(file).lines().enumerate() {
        check_deadline(runtime.deadline)?;
        let Ok(line) = line else {
            state.issues.read_errors += 1;
            continue;
        };
        if line.trim().is_empty() {
            continue;
        }

        let Ok(record) = serde_json::from_str::<Value>(&line) else {
            state.issues.invalid_json_lines += 1;
            continue;
        };

        let text = extract_text(&record, source);
        let Some(match_start) = find_literal_match(&text, runtime.query, runtime.query_lower)
        else {
            continue;
        };

        state.total_matches += 1;
        if state.matches.len() >= runtime.limit {
            continue;
        }

        let snippet = build_snippet(&text, match_start, runtime.query_char_len);
        let id = extract_record_id(&record, source)
            .unwrap_or_else(|| format!("line-{}", line_index + 1));
        let title = source
            .title
            .clone()
            .unwrap_or_else(|| source.source_kind.clone());

        state.matches.push(SearchMatch {
            id: id.clone(),
            source_kind: source.source_kind.clone(),
            title,
            snippet: snippet.text,
            matched_ranges: vec![MatchedRange {
                start: snippet.match_start,
                length: snippet.match_length,
            }],
            score: 1,
            session_id: source
                .session_id
                .clone()
                .or_else(|| source.source_id.clone()),
            workspace_id: source.workspace_id.clone(),
            record_id: Some(id),
            cursor: (line_index + 1).to_string(),
        });
    }

    Ok(())
}

fn extract_text(record: &Value, source: &SearchSource) -> String {
    let fields: Vec<&str> = source
        .text_fields
        .as_ref()
        .map(|items| items.iter().map(String::as_str).collect())
        .unwrap_or_else(|| DEFAULT_TEXT_FIELDS.to_vec());

    let parts: Vec<String> = fields
        .iter()
        .filter_map(|field| {
            record
                .get(*field)
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect();

    redact_sensitive_text(&parts.join("\n"))
}

fn extract_record_id(record: &Value, source: &SearchSource) -> Option<String> {
    if let Some(field) = &source.id_field {
        if let Some(id) = value_to_id(record.get(field)) {
            return Some(id);
        }
    }

    value_to_id(record.get("id")).or_else(|| value_to_id(record.get("seq")))
}

fn value_to_id(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => Some(value.clone()),
        Some(Value::Number(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn find_literal_match(text: &str, query: &str, query_lower: &str) -> Option<usize> {
    if query.is_ascii() {
        return find_ascii_case_insensitive(text.as_bytes(), query_lower.as_bytes());
    }

    text.find(query)
}

fn find_ascii_case_insensitive(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() {
        return Some(0);
    }
    if needle.len() > haystack.len() {
        return None;
    }

    haystack.windows(needle.len()).position(|window| {
        window
            .iter()
            .zip(needle.iter())
            .all(|(left, right)| left.to_ascii_lowercase() == *right)
    })
}

fn build_snippet(text: &str, match_start_byte: usize, query_char_len: usize) -> Snippet {
    let chars: Vec<char> = text.chars().collect();
    let match_start_char = byte_to_char_index(text, match_start_byte);
    let context = (MAX_SNIPPET_CHARS.saturating_sub(query_char_len) / 2).min(48);
    let snippet_start = match_start_char.saturating_sub(context);
    let snippet_end = (match_start_char + query_char_len + context).min(chars.len());
    let snippet_text: String = chars[snippet_start..snippet_end].iter().collect();
    let match_end_char = (match_start_char + query_char_len).min(chars.len());

    Snippet {
        text: snippet_text,
        match_start: utf16_len(&chars[snippet_start..match_start_char]),
        match_length: utf16_len(&chars[match_start_char..match_end_char]),
    }
}

fn byte_to_char_index(text: &str, byte_index: usize) -> usize {
    text[..byte_index].chars().count()
}

fn diagnostics(issues: SearchIssueCounts) -> SearchDiagnostics {
    SearchDiagnostics {
        invalid_json_lines: issues.invalid_json_lines,
        missing_files: issues.missing_files,
        read_errors: issues.read_errors,
    }
}

fn check_deadline(deadline: Option<Instant>) -> Result<(), ProtocolError> {
    if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
        return Err(ProtocolError {
            code: "timeout",
            message: "请求超时".to_string(),
            recoverable: true,
        });
    }
    Ok(())
}

fn utf16_len(chars: &[char]) -> usize {
    chars.iter().map(|ch| ch.len_utf16()).sum()
}

fn redact_sensitive_text(input: &str) -> String {
    let without_headers = redact_authorization_headers(input);
    let without_bearer = redact_bearer_tokens(&without_headers);
    redact_credentialed_urls(&without_bearer)
}

fn redact_authorization_headers(input: &str) -> String {
    let mut output = String::new();
    for line in input.split_inclusive('\n') {
        let newline = if line.ends_with('\n') { "\n" } else { "" };
        let line_without_newline = line.strip_suffix('\n').unwrap_or(line);
        let leading_len = line_without_newline.len() - line_without_newline.trim_start().len();
        let leading = &line_without_newline[..leading_len];
        let trimmed = &line_without_newline[leading_len..];
        if trimmed.to_ascii_lowercase().starts_with("authorization:") {
            output.push_str(leading);
            output.push_str("Authorization: [redacted]");
            output.push_str(newline);
        } else {
            output.push_str(line);
        }
    }
    output
}

fn redact_bearer_tokens(input: &str) -> String {
    let mut output = String::new();
    let mut rest = input;

    while let Some(index) = find_ascii_case_insensitive(rest.as_bytes(), b"bearer ") {
        output.push_str(&rest[..index]);
        let token_start = index + "Bearer ".len();
        output.push_str(&rest[index..token_start]);
        output.push_str("[redacted]");
        let token_remainder = &rest[token_start..];
        let token_end = token_remainder
            .char_indices()
            .find_map(|(offset, ch)| {
                if ch.is_whitespace() || matches!(ch, '"' | '\'' | '`' | '<' | '>') {
                    Some(offset)
                } else {
                    None
                }
            })
            .unwrap_or(token_remainder.len());
        rest = &token_remainder[token_end..];
    }

    output.push_str(rest);
    output
}

fn redact_credentialed_urls(input: &str) -> String {
    let mut output = String::new();
    let mut rest = input;

    while let Some(scheme_end) = rest.find("://") {
        let authority_start = scheme_end + 3;
        let after_scheme = &rest[authority_start..];
        let authority_end = after_scheme
            .char_indices()
            .find_map(|(offset, ch)| {
                if ch.is_whitespace() || matches!(ch, '/' | '"' | '\'' | '`' | '<' | '>') {
                    Some(offset)
                } else {
                    None
                }
            })
            .unwrap_or(after_scheme.len());
        let authority = &after_scheme[..authority_end];

        if let Some(at_index) = authority.find('@') {
            let credentials = &authority[..at_index];
            if credentials.contains(':') {
                output.push_str(&rest[..authority_start]);
                output.push_str("[redacted]");
                output.push_str(&authority[at_index..]);
                rest = &after_scheme[authority_end..];
                continue;
            }
        }

        output.push_str(&rest[..authority_start]);
        rest = &rest[authority_start..];
    }

    output.push_str(rest);
    output
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn success_response(id: Option<String>, result: Value) -> ProtocolResponse {
    ProtocolResponse {
        jsonrpc: "2.0",
        id,
        ok: true,
        result: Some(result),
        error: None,
    }
}

fn error_response(
    id: Option<String>,
    code: &'static str,
    message: &str,
    recoverable: bool,
) -> ProtocolResponse {
    ProtocolResponse {
        jsonrpc: "2.0",
        id,
        ok: false,
        result: None,
        error: Some(ProtocolError {
            code,
            message: message.to_string(),
            recoverable,
        }),
    }
}

fn serialize_response(response: ProtocolResponse) -> String {
    serde_json::to_string(&response).unwrap_or_else(|_| {
        String::from(r#"{"jsonrpc":"2.0","ok":false,"error":{"code":"unknown","message":"响应序列化失败","recoverable":true}}"#)
    })
}

#[cfg(test)]
mod tests {
    use std::fs::{remove_file, write};
    use std::path::PathBuf;

    use serde_json::Value;

    use super::{handle_protocol_line, handle_protocol_line_with_control};

    fn temp_jsonl(name: &str, content: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "codeinsights-native-search-{}-{}.jsonl",
            name,
            std::process::id(),
        ));
        write(&path, content).expect("write fixture");
        path
    }

    fn parse_response(line: &str) -> Value {
        serde_json::from_str(line).expect("valid protocol response")
    }

    #[test]
    fn status_reports_protocol_and_search_capability() {
        let response = parse_response(&handle_protocol_line(
            r#"{"jsonrpc":"2.0","id":"status-1","method":"status","params":{}}"#,
        ));

        assert_eq!(response["ok"], true);
        assert_eq!(response["id"], "status-1");
        assert_eq!(response["result"]["implementation"], "rust-sidecar");
        assert_eq!(response["result"]["protocolVersion"], 1);
        assert_eq!(response["result"]["cacheSchemaVersion"], 1);
        assert_eq!(
            response["result"]["capabilities"].as_array().unwrap(),
            &vec![
                Value::String("diagnostics".into()),
                Value::String("indexed-search".into())
            ],
        );
    }

    #[test]
    fn search_returns_literal_matches_and_skips_bad_json_lines() {
        let path = temp_jsonl(
            "literal",
            concat!(
                "{\"id\":\"skip\",\"content\":\"没有命中\"}\n",
                "{bad json\n",
                "{\"id\":\"hit-1\",\"content\":\"这里包含关键字和上下文\"}\n",
                "{\"seq\":42,\"content\":\"第二条关键字命中\"}\n",
            ),
        );
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-1",
            "method": "search",
            "params": {
                "requestId": "req-search-1",
                "query": "关键字",
                "limit": 10,
                "sources": [{
                    "sourceKind": "chat_message",
                    "sourceId": "chat-1",
                    "title": "Chat 会话",
                    "filePath": path,
                    "textFields": ["content"]
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));
        let _ = remove_file(path);

        assert_eq!(response["ok"], true);
        let result = &response["result"];
        assert_eq!(result["implementation"], "rust-sidecar");
        assert_eq!(result["requestId"], "req-search-1");
        assert_eq!(result["matches"].as_array().unwrap().len(), 2);
        assert_eq!(result["matches"][0]["id"], "hit-1");
        assert_eq!(result["matches"][0]["matchedRanges"][0]["length"], 3);
        assert_eq!(result["matches"][1]["id"], "42");
        assert_eq!(result["diagnostics"]["invalidJsonLines"], 1);
    }

    #[test]
    fn search_clamps_limit_and_caps_snippet_length() {
        let long_prefix = "x".repeat(240);
        let long_suffix = "y".repeat(240);
        let path = temp_jsonl(
            "limit",
            &format!(
                "{{\"id\":\"one\",\"content\":\"{}needle{}\"}}\n{{\"id\":\"two\",\"content\":\"needle again\"}}\n",
                long_prefix, long_suffix
            ),
        );
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-limit",
            "method": "search",
            "params": {
                "requestId": "req-search-limit",
                "query": "needle",
                "limit": 1,
                "sources": [{
                    "sourceKind": "agent_message",
                    "sessionId": "agent-1",
                    "filePath": path,
                    "textFields": ["content"]
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));
        let _ = remove_file(path);

        assert_eq!(response["ok"], true);
        let matches = response["result"]["matches"].as_array().unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(response["result"]["hasMore"], true);
        assert!(matches[0]["snippet"].as_str().unwrap().chars().count() <= 160);
    }

    #[test]
    fn ascii_query_after_unicode_prefix_uses_original_offsets() {
        let path = temp_jsonl(
            "unicode-offset",
            "{\"id\":\"unicode\",\"content\":\"İstanbul 前缀 NEEDLE tail\"}\n",
        );
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-unicode-offset",
            "method": "search",
            "params": {
                "requestId": "req-unicode-offset",
                "query": "needle",
                "limit": 10,
                "sources": [{
                    "sourceKind": "chat_message",
                    "filePath": path,
                    "textFields": ["content"]
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));
        let _ = remove_file(path);

        assert_eq!(response["ok"], true);
        assert_eq!(response["result"]["matches"][0]["id"], "unicode");
        assert_eq!(
            response["result"]["matches"][0]["matchedRanges"][0]["start"],
            12
        );
        assert_eq!(
            response["result"]["matches"][0]["matchedRanges"][0]["length"],
            6
        );
    }

    #[test]
    fn matched_ranges_use_utf16_offsets_for_js_parity() {
        let path = temp_jsonl(
            "utf16-offset",
            "{\"id\":\"emoji\",\"content\":\"🙂 NEEDLE tail\"}\n",
        );
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-utf16-offset",
            "method": "search",
            "params": {
                "requestId": "req-utf16-offset",
                "query": "needle",
                "limit": 10,
                "sources": [{
                    "sourceKind": "chat_message",
                    "filePath": path,
                    "textFields": ["content"]
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));
        let _ = remove_file(path);

        assert_eq!(response["ok"], true);
        assert_eq!(
            response["result"]["matches"][0]["matchedRanges"][0]["start"],
            3
        );
        assert_eq!(
            response["result"]["matches"][0]["matchedRanges"][0]["length"],
            6
        );
    }

    #[test]
    fn search_never_falls_back_to_raw_record_json_and_redacts_selected_text() {
        let path = temp_jsonl(
            "redaction",
            concat!(
                "{\"id\":\"raw\",\"headers\":{\"Authorization\":\"Bearer raw-secret\"}}\n",
                "{\"id\":\"selected\",\"content\":\"Authorization: Bearer selected-secret\\nremote https://user:pass@example.com/repo\"}\n",
            ),
        );
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-redaction",
            "method": "search",
            "params": {
                "requestId": "req-redaction",
                "query": "Authorization",
                "limit": 10,
                "sources": [{
                    "sourceKind": "agent_message",
                    "filePath": path,
                    "textFields": ["content"]
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));
        let _ = remove_file(path);

        assert_eq!(response["ok"], true);
        let matches = response["result"]["matches"].as_array().unwrap();
        assert_eq!(matches.len(), 1);
        let snippet = matches[0]["snippet"].as_str().unwrap();
        assert!(snippet.contains("[redacted]"));
        assert!(!snippet.contains("selected-secret"));
        assert!(!snippet.contains("raw-secret"));
        assert!(!snippet.contains("user:pass"));
    }

    #[test]
    fn long_query_and_expired_deadline_return_typed_errors() {
        let long_query = "x".repeat(129);
        let long_query_request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-long-query",
            "method": "search",
            "params": {
                "requestId": "req-long-query",
                "query": long_query,
                "limit": 10,
                "sources": []
            }
        });
        let long_query_response =
            parse_response(&handle_protocol_line(&long_query_request.to_string()));
        assert_eq!(long_query_response["ok"], false);
        assert_eq!(long_query_response["error"]["code"], "invalid_input");

        let timeout_request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-timeout",
            "method": "search",
            "deadlineMs": 0,
            "params": {
                "requestId": "req-timeout",
                "query": "needle",
                "limit": 10,
                "sources": []
            }
        });
        let timeout_response = parse_response(&handle_protocol_line(&timeout_request.to_string()));
        assert_eq!(timeout_response["ok"], false);
        assert_eq!(timeout_response["error"]["code"], "timeout");
        assert_eq!(timeout_response["error"]["recoverable"], true);
    }

    #[test]
    fn empty_query_returns_empty_result_without_reading_source() {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-empty",
            "method": "search",
            "params": {
                "requestId": "req-empty",
                "query": "   ",
                "limit": 10,
                "sources": [{
                    "sourceKind": "chat_message",
                    "filePath": "/path/that/does/not/exist.jsonl"
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));

        assert_eq!(response["ok"], true);
        assert_eq!(response["result"]["matches"].as_array().unwrap().len(), 0);
        assert_eq!(response["result"]["diagnostics"]["missingFiles"], 0);
    }

    #[test]
    fn missing_source_records_diagnostics_without_failing_search() {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "search-missing",
            "method": "search",
            "params": {
                "requestId": "req-missing",
                "query": "needle",
                "limit": 10,
                "sources": [{
                    "sourceKind": "chat_message",
                    "filePath": "/path/that/does/not/exist.jsonl"
                }]
            }
        });

        let response = parse_response(&handle_protocol_line(&request.to_string()));

        assert_eq!(response["ok"], true);
        assert_eq!(response["result"]["matches"].as_array().unwrap().len(), 0);
        assert_eq!(response["result"]["diagnostics"]["missingFiles"], 1);
    }

    #[test]
    fn invalid_protocol_lines_and_unknown_methods_return_typed_errors() {
        let bad_json = parse_response(&handle_protocol_line("{bad json"));
        assert_eq!(bad_json["ok"], false);
        assert_eq!(bad_json["error"]["code"], "invalid_input");

        let unknown = parse_response(&handle_protocol_line(
            r#"{"jsonrpc":"2.0","id":"unknown-1","method":"unknown","params":{}}"#,
        ));
        assert_eq!(unknown["ok"], false);
        assert_eq!(unknown["id"], "unknown-1");
        assert_eq!(unknown["error"]["code"], "invalid_input");
    }

    #[test]
    fn shutdown_is_acknowledged_and_tail_jsonl_is_explicitly_out_of_scope() {
        let shutdown_outcome = handle_protocol_line_with_control(
            r#"{"jsonrpc":"2.0","id":"shutdown-1","method":"shutdown","params":{}}"#,
        );
        let shutdown = parse_response(&shutdown_outcome.response);
        assert_eq!(shutdown["ok"], true);
        assert_eq!(shutdown["result"]["accepted"], true);
        assert!(shutdown_outcome.should_shutdown);

        let tail = parse_response(&handle_protocol_line(
            r#"{"jsonrpc":"2.0","id":"tail-1","method":"tail_jsonl","params":{}}"#,
        ));
        assert_eq!(tail["ok"], false);
        assert_eq!(tail["error"]["code"], "invalid_input");
    }
}
