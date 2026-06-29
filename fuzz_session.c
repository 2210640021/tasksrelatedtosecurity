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
