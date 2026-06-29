# Laborbericht: Schwachstellenidentifikation mittels Protokoll-Fuzzing (potato2-Server)

## 1. Einleitung & Methodik
This report documents the analysis and identification of two separate vulnerabilities in the network component (`src/http_server.c` and `src/session.c`) of the **potato2** project. Unlike previous local attacks on the application console (`./potato console`), this approach focuses on automated fuzzing over the network, targeting the HTTP service on port 80 directly.
---

## 2. Schwachstelle 1: Stack Buffer Overflow via `/api/login`

### Test-Skript (`crash_login.py`)

```python
import requests

url = "[http://127.0.0.1/api/login](http://127.0.0.1/api/login)"
bad_username = "A" * 300
payload = {"username": bad_username, "password": "x"}

print("[*] Sending huge payload to /api/login...")

try:
    response = requests.post(url, data=payload, timeout=3)
    print("Response code:", response.status_code)
except Exception as e:
    print("[!] Connection lost! Check the server terminal for a Segmentation fault!")
```

![](images/fuzzing_attempt1_code_trial1_sucess.png)
![](images/fuzzing_attempt1_task1_sucess.png)

As documented in the screenshots from the testing phase, sending a malformed fuzzing input of 300 bytes (`“A” * 300`) to the `username` parameter results in an immediate denial of service. According to the server logs, the application initially processes the POST request up to the `no such user` validation logic and then abruptly terminates immediately afterward. 
The stack frame is completely overflowed. Sending this large number of characters overwrites the administrative metadata on the stack—the saved return pointer. As soon as the function is about to terminate and attempts to jump back to this manipulated address, the operating system intercepts the illegal memory access and terminates the server process with a `segmentation fault`. This is visually confirmed in the browser by the error message *“Problem loading page”*.



As documented in the code analysis screenshot, in-memory fuzzing of the session management system exposed a critical logical flaw within `src/session.c`, which is flagged by the compiler with the warning `non-void function does not return a value in all control paths`. 

When the `get_session_by_id()` function is fed with randomized, non-existent fuzzer cookie inputs, the internal lookup loop fails, and the program execution reaches the end of the function block (line 64) without hitting an explicit return statement. This triggers classic Undefined Behavior (UB) at the architectural level: instead of returning a safe `NULL` pointer, the function passes back an unpredictable "garbage value" that happened to be left behind in the CPU register. 

While the isolated fuzzer harness does not crash from this (as it discards the return value), it creates a severe vulnerability downstream for the live HTTP server. The web server mistakenly interprets this arbitrary garbage value as a "valid session structure address" and attempts to read or write to that corrupt object location in memory, resulting in unhandled memory faults or critical authentication logic bypasses.

![](images/fuzzing_task1_2nd_attempt_no_crash.png)

Used Code:
```python
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdlib.h>

// Deklaration der zu testenden internen Kernfunktion
extern void* get_session_by_id(const char* session_id);

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    if (size == 0 || size > 512) return 0;
    
    // Konvertierung der rohen Fuzzer-Bytes in einen validen C-String
    char *mock_cookie = malloc(size + 1);
    if (!mock_cookie) return 0;
    memcpy(mock_cookie, data, size);
    mock_cookie[size] = '\0';

    // Kernlogik direkt im Speicher mit Fuzz-Eingaben füttern
    get_session_by_id(mock_cookie);

    free(mock_cookie);
    return 0;
}
```

### Code Triage for Vulnerability 2 (Undefined Behavior in session.c)
During compilation of the fuzzing harness using `clang`, a critical structural vulnerability was identified via compiler diagnostics in `src/session.c`:
`src/session.c:64:1: warning: non-void function does not return a value in all control paths [-Wreturn-type]`

* **Root Cause:** The function `get_session_by_id()` iterates through active sessions. If a fuzzed/non-existent cookie string is provided, the execution path exits the loop and reaches the end of the block without hitting a return statement. 
* **Impact:** This triggers classic Undefined Behavior (UB). The function returns an unpredictable arbitrary value left over in the CPU register instead of a clean pointer. When the calling web server attempts to read from this unvalidated garbage pointer downstream, it leads to memory corruption or application failure.

* **Fix:** Add a default return statement at the end of the function:
```c
// at the very end of get_session_by_id inside src/session.c
return NULL;



