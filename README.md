The goal of this exercise is to employ fuzzing techniques to identify vulnerabilities. You are not restricted what software you use for this exercise (AFL++, boo-fuzz, self-implemented fuzzer, ...). 

It is not allowed to reuse an existing write-up. It is permitted to use existing materials as a guide. In this case your report needs to show new results.

Scoring

- identify two inputs that trigger a crash or undefined behavior using a fuzzing technique (4 points)

- triage the vulnerability in the source code and explain a possible counter measure (5 points)

- prepare a command line or script file to run the input against the vulnerable program (3 points)

- abuse the exploit to gain code execution (2 points)

You may use:

- sanitizers or assertions to identify another vulnerabiltiy 

- use libfuzzer to fuzz a vulnerable function

- employ source code, in-memory fuzzing or using the protocol

Submission

PDF (!) report (see above)
ZIP of the corpus
