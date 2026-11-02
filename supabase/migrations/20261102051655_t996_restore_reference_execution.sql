-- Restore the intended authenticated bridge call; the private function retains its auth.uid()/is_admin() guard.
-- No table data or anonymous access changes. Rollback: REVOKE EXECUTE ON FUNCTION t996_private.get_operations_reference(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION t996_private.get_operations_reference(date) TO authenticated;
