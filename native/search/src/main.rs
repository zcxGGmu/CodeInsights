use std::io::{self, BufRead, Write};

use codeinsights_native_search::handle_protocol_line_with_control;

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let Ok(line) = line else {
            break;
        };
        let outcome = handle_protocol_line_with_control(&line);
        if writeln!(stdout, "{}", outcome.response).is_err() {
            break;
        }
        let _ = stdout.flush();
        if outcome.should_shutdown {
            break;
        }
    }
}
