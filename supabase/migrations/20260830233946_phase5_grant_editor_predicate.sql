-- Las políticas RLS ejecutan este predicado para cada petición autenticada.
-- El esquema private sigue sin USAGE para clientes, por lo que el grant no
-- convierte la función en una RPC accesible ni expone las tablas privadas.
grant execute on function private.is_editor() to authenticated;
