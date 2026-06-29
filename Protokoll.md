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

This Output comes from Kali Linux (server did not crash)
```c
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ clang -fsanitize=fuzzer,address -I./src fuzz_session.c src/session.c -o fuzzer_session
fuzz_session.c:18:5: error: use of undeclared identifier
      't_session'
   18 |     t_session *sess = get_session_by_id(mock_cookie);
      |     ^~~~~~~~~
fuzz_session.c:18:16: error: use of undeclared identifier                       
      'sess'
   18 |     t_session *sess = get_session_by_id(mock_cookie);
      |                ^~~~
fuzz_session.c:19:9: error: use of undeclared identifier                        
      'sess'
   19 |     if (sess) {
      |         ^~~~
fuzz_session.c:21:22: error: unknown type name 't_user'                         
   21 |             volatile t_user *u = sess->logged_in_user;
      |                      ^
fuzz_session.c:21:34: error: use of undeclared identifier                       
      'sess'
   21 |             volatile t_user *u = sess->logged_in_user;
      |                                  ^~~~
5 errors generated.                                                             
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
INFO: Seed: 1327574267
INFO: Loaded 1 modules   (28 inline 8-bit counters): 28 [0x55975da6deb0, 0x55975da6decc), 
INFO: Loaded 1 PC tables (28 PCs): 28 [0x55975da6ded0,0x55975da6e090), 
INFO:        1 files found in corpus/
INFO: -max_len is not provided; libFuzzer will not generate inputs larger than 4096 bytes
INFO: seed corpus: files: 1 min: 513b max: 513b total: 513b rss: 37Mb
#2      INITED cov: 2 ft: 2 corp: 1/513b exec/s: 0 rss: 38Mb
        NEW_FUNC[1/1]: 0x55975da24bf0 in get_session_by_id (/home/kali/Downloads/potato2-main/fuzzer_session+0x151bf0) (BuildId: e2b462b18197102056fcdbc94e915f82b50faea8)
#7      NEW    cov: 7 ft: 8 corp: 2/807b lim: 513 exec/s: 0 rss: 38Mb L: 294/513 MS: 5 CMP-CrossOver-ChangeBinInt-ShuffleBytes-EraseBytes- DE: "\377\377\377\377"-
#53     REDUCE cov: 7 ft: 8 corp: 2/763b lim: 513 exec/s: 0 rss: 41Mb L: 250/513 MS: 1 EraseBytes-
#61     REDUCE cov: 7 ft: 8 corp: 2/751b lim: 513 exec/s: 0 rss: 41Mb L: 238/513 MS: 3 InsertByte-ChangeBit-EraseBytes-
#62     REDUCE cov: 7 ft: 8 corp: 2/707b lim: 513 exec/s: 0 rss: 43Mb L: 194/513 MS: 1 EraseBytes-
#74     REDUCE cov: 7 ft: 8 corp: 2/621b lim: 513 exec/s: 0 rss: 43Mb L: 108/513 MS: 2 ChangeBinInt-EraseBytes-
#79     REDUCE cov: 7 ft: 8 corp: 2/617b lim: 513 exec/s: 0 rss: 43Mb L: 104/513 MS: 5 ChangeBit-CopyPart-PersAutoDict-CopyPart-EraseBytes- DE: "\377\377\377\377"-
#198    REDUCE cov: 7 ft: 8 corp: 2/588b lim: 513 exec/s: 0 rss: 43Mb L: 75/513 MS: 4 ChangeBinInt-CMP-ChangeBit-EraseBytes- DE: "\001\002\000\000\000\000\000\000"-
#226    REDUCE cov: 7 ft: 8 corp: 2/567b lim: 513 exec/s: 0 rss: 43Mb L: 54/513 MS: 3 CMP-InsertByte-EraseBytes- DE: "\310\000\000\000\000\000\000\000"-
#227    REDUCE cov: 7 ft: 8 corp: 2/566b lim: 513 exec/s: 0 rss: 43Mb L: 53/513 MS: 1 EraseBytes-
#238    REDUCE cov: 7 ft: 8 corp: 2/558b lim: 513 exec/s: 0 rss: 43Mb L: 45/513 MS: 1 EraseBytes-
#258    REDUCE cov: 7 ft: 8 corp: 2/549b lim: 513 exec/s: 0 rss: 43Mb L: 36/513 MS: 5 ChangeBit-ShuffleBytes-ChangeBit-InsertByte-EraseBytes-
#259    REDUCE cov: 7 ft: 8 corp: 2/543b lim: 513 exec/s: 0 rss: 43Mb L: 30/513 MS: 1 EraseBytes-
#262    REDUCE cov: 7 ft: 8 corp: 2/539b lim: 513 exec/s: 0 rss: 43Mb L: 26/513 MS: 3 ChangeByte-ShuffleBytes-EraseBytes-
#267    REDUCE cov: 7 ft: 8 corp: 2/532b lim: 513 exec/s: 0 rss: 43Mb L: 19/513 MS: 5 ShuffleBytes-ChangeBinInt-InsertByte-ChangeBit-EraseBytes-
#280    REDUCE cov: 7 ft: 8 corp: 2/524b lim: 513 exec/s: 0 rss: 43Mb L: 11/513 MS: 3 ChangeByte-ChangeBit-EraseBytes-
#362    REDUCE cov: 7 ft: 8 corp: 2/523b lim: 513 exec/s: 0 rss: 43Mb L: 10/513 MS: 2 ChangeByte-EraseBytes-
#477    REDUCE cov: 7 ft: 8 corp: 2/521b lim: 513 exec/s: 0 rss: 43Mb L: 8/513 MS: 5 ChangeBinInt-InsertByte-PersAutoDict-ChangeByte-EraseBytes- DE: "\001\002\000\000\000\000\000\000"-
#515    REDUCE cov: 7 ft: 8 corp: 2/519b lim: 513 exec/s: 0 rss: 43Mb L: 6/513 MS: 3 CMP-InsertByte-EraseBytes- DE: "e\000\000\000"-
#522    REDUCE cov: 7 ft: 8 corp: 2/517b lim: 513 exec/s: 0 rss: 43Mb L: 4/513 MS: 2 InsertByte-EraseBytes-
#545    REDUCE cov: 7 ft: 8 corp: 2/516b lim: 513 exec/s: 0 rss: 43Mb L: 3/513 MS: 3 ChangeByte-ChangeByte-EraseBytes-
#579    REDUCE cov: 7 ft: 8 corp: 2/515b lim: 513 exec/s: 0 rss: 43Mb L: 2/513 MS: 4 CopyPart-ChangeByte-ChangeByte-EraseBytes-
#581    REDUCE cov: 7 ft: 8 corp: 2/514b lim: 513 exec/s: 0 rss: 43Mb L: 1/513 MS: 2 ChangeBit-EraseBytes-
#1048576        pulse  cov: 7 ft: 8 corp: 2/514b lim: 4096 exec/s: 349525 rss: 458Mb
#2097152        pulse  cov: 7 ft: 8 corp: 2/514b lim: 4096 exec/s: 349525 rss: 461Mb
#4194304        pulse  cov: 7 ft: 8 corp: 2/514b lim: 4096 exec/s: 299593 rss: 461Mb
#8388608        pulse  cov: 7 ft: 8 corp: 2/514b lim: 4096 exec/s: 322638 rss: 461Mb
#16777216       pulse  cov: 7 ft: 8 corp: 2/514b lim: 4096 exec/s: 328965 rss: 461Mb
```

Now I tried this 3:17 p.m. latest update (I have two terminals, here the output of 1 Terminal):
```
──(kali㉿kali)-[~]
└─$ cd ~/Downloads/potato2-main
rm -f fuzzer_session potato2 test.py crash-* leak-* timeout-* *.o
rm -rf corpus
mkdir corpus
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ docker system prune -a --volumes --force
permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Head "http://%2Fvar%2Frun%2Fdocker.sock/_ping": dial unix /var/run/docker.sock: connect: permission denied
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ sudo docker system prune -a --volumes --force
[sudo] password for kali: 
Deleted Images:
untagged: rkugler/potato:amd64
deleted: sha256:4b0b3dff75a3c67d50a8af79792b0ddda860d119b8a0e367cd83e900ab17c222
untagged: rkugler/potato:i386
deleted: sha256:f5f63a6d68444dad4d3591cf684d578f0ac126227f788930711d02dfbf30a03e

Deleted build cache objects:
ty59yfwd0o6gqexgie5m9a2xt
76552hc8w12jby755mqz71esi
yfbshdb1a5yzz3hc8sd51cevt
4hyyh5l24wbv4v8gr1ut1kw46
bzkfj9cqkyrq2b5lyas2dmxet
rwr2ge3u0urry02i28zyppzy2
55e3tuodiv5n82dggbs2id83u
dijdjkx3uxxuxq5e1rv1jegdy
ts27nk858lsixhtg78z61g686
dgysvn5nznreroco8ljz49c2i
uh1bjufac4wmicwzejqi8r6tc
f141j8z6d11ce0udtpyndtggg
x8y02t84dxdv99qey344grqxh
ivqu4zck5lxy2wo19go42zg7h
j2qglkcnazq8kbra12rbuqxv8
yiteuebnmtt0ubk3dc355b621
puw54eh4nl3g323tf78nvvh97
rlj3hykz90h4bs4794os744mu
oe26iz2sg5laqu0c7jj0uqvt9
ik9zi040a2mu6eyvj8ggcsyp5
zfpxiovglhvy2k8n14x58clq8
h1y2d0ac8ffdphmh54dv149l3
996h33zdeqq1au82d9yn9oj3v
fvmfa5rxofrnfqo57uhzmb2g5
q3fbnuj5071buxuqz7h1f5ipd
joeistspca2yxl08h3aonke4x
s2zbd3grtndt31vkj0lzhlf41
f0ldpqti7wc7l75rkawvduot8
954n4f57kir1zsfa0za8q9fea
f7q1za5ziauh8ce8r0alemc45
o3kn23wgz9hjl71fcgmrysuny
mgpr098okq2i1ag35juhr2x6l
sh303pka6ho569d8blnbglhsn
bu5l95e2rwfx72gnl9hgbf0dv
vg6l8naat5lirq6icuyhftiqn
q765vfyg7tiyju0hvu6b0zug6
l43577e4xab94q23kze1wy86f
hdj1z6u3vk3etezfqdx2fjhji
3bj618ga0nt6keg4hffv8o7jl

Total reclaimed space: 711.6MB
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./build.sh     
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Head "http://%2Fvar%2Frun%2Fdocker.sock/_ping": dial unix /var/run/docker.sock: connect: permission denied
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Head "http://%2Fvar%2Frun%2Fdocker.sock/_ping": dial unix /var/run/docker.sock: connect: permission denied
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ sudo ./build.sh                              
[+] Building 71.1s (19/19) FINISHED                              docker:default
 => [internal] load build definition from Dockerfile.amd64                 0.0s
 => => transferring dockerfile: 735B                                       0.0s 
 => [internal] load metadata for docker.io/library/ubuntu:24.04            2.8s 
 => [internal] load metadata for docker.io/library/gcc:14                  2.8s
 => [internal] load .dockerignore                                          0.0s
 => => transferring context: 2B                                            0.0s 
 => [builder 1/5] FROM docker.io/library/gcc:14@sha256:df8990c2f53aa9ef5  57.3s 
 => => resolve docker.io/library/gcc:14@sha256:df8990c2f53aa9ef57808e755a  0.0s
 => => sha256:04d8bb482f0ad04a7026fe8594a836bb8426eb5c74f 2.49kB / 2.49kB  0.0s 
 => => sha256:aa3e9ef32f73c30e8b065800ee66429992d3bfea6 49.32MB / 49.32MB  2.9s
 => => sha256:30d0db852850114cc79598cc8ab1ec19da54691d9 67.78MB / 67.78MB  6.5s 
 => => sha256:ac872571052e1627f4c4b05c732d2054894344bc821 7.42kB / 7.42kB  0.0s
 => => sha256:3f59c84a786323367a79d4959142649bb24b16c98 25.63MB / 25.63MB  3.1s 
 => => sha256:df8990c2f53aa9ef57808e755aa8f580dd86b9b34c6 7.63kB / 7.63kB  0.0s
 => => sha256:0252e6abaf0ff12562710faa97dc617e372a42 236.25MB / 236.25MB  21.2s 
 => => extracting sha256:aa3e9ef32f73c30e8b065800ee66429992d3bfea6a1fb822  7.8s 
 => => sha256:d2c6a13602d5d9f20bc6456e0260ee3f6f3351740b1 4.59MB / 4.59MB  3.7s 
 => => sha256:700ea8a4edde0e011518b74e8fab38f4d3a901 156.76MB / 156.76MB  14.4s
 => => sha256:e6b202a778f89dd157b7897f0d57c18b9b4dfd3ab 10.64kB / 10.64kB  6.8s 
 => => sha256:9348e33343cd0e747795741dd81b9f0b82b1cfdfcfe 2.00kB / 2.00kB  7.0s 
 => => extracting sha256:3f59c84a786323367a79d4959142649bb24b16c989bbaae7  3.7s 
 => => extracting sha256:30d0db852850114cc79598cc8ab1ec19da54691d9e326728  9.2s 
 => => extracting sha256:0252e6abaf0ff12562710faa97dc617e372a424bf144947  20.5s 
 => => extracting sha256:d2c6a13602d5d9f20bc6456e0260ee3f6f3351740b1041ce  0.4s 
 => => extracting sha256:700ea8a4edde0e011518b74e8fab38f4d3a901830f752ea  10.8s 
 => => extracting sha256:e6b202a778f89dd157b7897f0d57c18b9b4dfd3ab6d54386  0.0s 
 => => extracting sha256:9348e33343cd0e747795741dd81b9f0b82b1cfdfcfe002bc  0.0s 
 => [internal] load build context                                          0.0s 
 => => transferring context: 53.66kB                                       0.0s
 => [stage-1 1/8] FROM docker.io/library/ubuntu:24.04@sha256:786a8b558f7  19.9s
 => => resolve docker.io/library/ubuntu:24.04@sha256:786a8b558f7be160c6c8  0.0s
 => => sha256:786a8b558f7be160c6c8c4a54f9a57274f3b4fb1491 6.69kB / 6.69kB  0.0s
 => => sha256:023f8a753c22258c9fe2d0005a7d28258038da7d620e9f9 424B / 424B  0.0s
 => => sha256:8bf6fbc94074daccf0d7e43395600ddd71aa5a9e486 2.05kB / 2.05kB  0.0s
 => => sha256:cb259a83ac3dd9fea0b394df41df2b298adf0df9 29.73MB / 29.73MB  14.4s
 => => extracting sha256:cb259a83ac3dd9fea0b394df41df2b298adf0df938fef599  5.1s 
 => [stage-1 2/8] RUN apt-get update -y && apt-get install -y libssl3 li  17.7s 
 => [stage-1 3/8] RUN groupadd -g 22222 potato                             0.4s 
 => [stage-1 4/8] WORKDIR /app                                             0.1s 
 => [builder 2/5] RUN apt-get update -y && apt-get install -y libssl-dev   6.0s 
 => [builder 3/5] WORKDIR /build                                           0.0s 
 => [builder 4/5] COPY ./src/ .                                            0.1s 
 => [builder 5/5] RUN make potato                                          1.2s 
 => [stage-1 5/8] COPY --from=builder /build/potato .                      0.1s 
 => [stage-1 6/8] COPY --chmod=0640 userlist .                             0.0s 
 => [stage-1 7/8] COPY res /app/res                                        0.0s 
 => [stage-1 8/8] RUN curl -o /app/toybox "https://landley.net/bin/toybox  2.4s 
 => exporting to image                                                     0.9s 
 => => exporting layers                                                    0.9s 
 => => writing image sha256:63114a65cbddfa52c1e5896439e8b81cbe2227bf83d2f  0.0s 
 => => naming to docker.io/rkugler/potato:amd64                            0.0s 
[+] Building 248.2s (22/22) FINISHED                             docker:default 
 => [internal] load build definition from Dockerfile.i386                  0.0s
 => => transferring dockerfile: 1.04kB                                     0.0s 
 => [internal] load metadata for docker.io/library/debian:bookworm-slim    2.0s 
 => [internal] load metadata for docker.io/library/debian:bookworm         2.0s
 => [internal] load .dockerignore                                          0.0s
 => => transferring context: 2B                                            0.0s 
 => [builder 1/8] FROM docker.io/library/debian:bookworm@sha256:30482e873  9.5s 
 => => resolve docker.io/library/debian:bookworm@sha256:30482e873082e906a  0.0s
 => => sha256:30482e873082e906a4908c10529180aefb6f77620ae 8.52kB / 8.52kB  0.0s 
 => => sha256:75e79071e2e737c016d1be15341d8f884fe4df4199b 1.02kB / 1.02kB  0.0s 
 => => sha256:c54adc430894be400fc0a6d0ad9217a107556baeb8756ec 450B / 450B  0.0s 
 => => sha256:96cbacad9c1883b9ae87f68a0550ac0bd7e0b7ba2 49.49MB / 49.49MB  2.8s
 => => extracting sha256:96cbacad9c1883b9ae87f68a0550ac0bd7e0b7ba2b15b142  6.3s 
 => [internal] load build context                                          0.0s 
 => => transferring context: 791B                                          0.0s
 => [stage-1 1/8] FROM docker.io/library/debian:bookworm-slim@sha256:60ea  7.1s 
 => => resolve docker.io/library/debian:bookworm-slim@sha256:60eac7597396  0.0s 
 => => sha256:98bf7a598cfbfa55f340155a99410ec58186101143ccbd4 450B / 450B  0.0s 
 => => sha256:df519b11ac99d8e2d452cbd55f824e658d0b86f64 29.23MB / 29.23MB  2.0s
 => => sha256:60eac759739651111db372c07be67863818726f7548 8.56kB / 8.56kB  0.0s 
 => => sha256:4245c176e40fedb66142d1684d9ab29f7c048df0f11 1.02kB / 1.02kB  0.0s 
 => => extracting sha256:df519b11ac99d8e2d452cbd55f824e658d0b86f649745aba  4.9s
 => [stage-1 2/8] RUN apt-get update -y && apt-get install -y libssl3 li  16.8s
 => [builder 2/8] RUN apt-get update && apt-get install -y     build-ess  46.6s
 => [stage-1 3/8] RUN groupadd -g 22222 potato                             0.4s
 => [stage-1 4/8] WORKDIR /app                                             0.0s
 => [builder 3/8] WORKDIR /app                                             0.0s 
 => [builder 4/8] COPY src/ .                                              0.1s 
 => [builder 5/8] RUN gcc -m32 -print-libgcc-file-name                     0.3s 
 => [builder 6/8] WORKDIR /build                                           0.1s 
 => [builder 7/8] COPY ./src/ .                                            0.1s 
 => [builder 8/8] RUN make potato32                                      184.9s 
 => [stage-1 5/8] COPY --from=builder /build/potato32 .                    0.1s 
 => [stage-1 6/8] COPY --chmod=0640 userlist .                             0.0s 
 => [stage-1 7/8] COPY res /app/res                                        0.0s
 => [stage-1 8/8] RUN curl -o /app/toybox "https://landley.net/bin/toybox  3.5s 
 => exporting to image                                                     0.7s 
 => => exporting layers                                                    0.7s 
 => => writing image sha256:ec83abbca3a0021733e613cf855c869c90ef74338aa12  0.0s 
 => => naming to docker.io/rkugler/potato:i386                             0.0s 
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./run32.sh http
docker: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Head "http://%2Fvar%2Frun%2Fdocker.sock/_ping": dial unix /var/run/docker.sock: connect: permission denied

Run 'docker run --help' for more information
                                                                                
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ sudo ./run32.sh http
WARNING: Published ports are discarded when using host network mode
starting up (pid 25566)
reading file userlist
[session.c:51] session ready.
handle_client
cmd> Server running on port 80...
```

This is my Second window terminal output:
```
─(kali㉿kali)-[~]
└─$ cd Downloads/potato2-main 
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ cat fuzz_session.c 
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
└─$ clang -fsanitize=fuzzer,address -I./src fuzz_session.c src/session.c -o fuzzer_session
fuzz_session.c:18:5: error: use of undeclared identifier
      't_session'
   18 |     t_session *sess = get_session_by_id(mock_cookie);
      |     ^~~~~~~~~
fuzz_session.c:18:16: error: use of undeclared identifier                        
      'sess'
   18 |     t_session *sess = get_session_by_id(mock_cookie);
      |                ^~~~
fuzz_session.c:19:9: error: use of undeclared identifier                         
      'sess'
   19 |     if (sess) {
      |         ^~~~
fuzz_session.c:21:22: error: unknown type name 't_user'                          
   21 |             volatile t_user *u = sess->logged_in_user;
      |                      ^
fuzz_session.c:21:34: error: use of undeclared identifier                        
      'sess'
   21 |             volatile t_user *u = sess->logged_in_user;
      |                                  ^~~~
5 errors generated.                                                              
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
zsh: no such file or directory: ./fuzzer_session
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./fuzz_session.c corpus/ 
zsh: permission denied: ./fuzz_session.c
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ sudo ./fuzz_session.c corpus 
[sudo] password for kali: 
sudo: ./fuzz_session.c: command not found
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ ./fuzz_session.c corpus/
zsh: permission denied: ./fuzz_session.c
                                                                                 
┌──(kali㉿kali)-[~/Downloads/potato2-main]
└─$ 
```
