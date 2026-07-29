SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'is_full_control';
