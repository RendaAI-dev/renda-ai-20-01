-- Corrigir função buscar_cadastro_por_email_phone com search_path seguro
CREATE OR REPLACE FUNCTION public.buscar_cadastro_por_email_phone(p_email text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS TABLE(user_id uuid, email text, phone text, subscription_status text, plan_type text, current_period_end timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Validar que pelo menos um parâmetro foi fornecido
    IF p_email IS NULL AND p_phone IS NULL THEN
        RAISE EXCEPTION 'É necessário fornecer email ou telefone para a busca';
    END IF;

    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.email,
        u.phone,
        s.status AS subscription_status,
        s.plan_type,
        s.current_period_end
    FROM
        public.poupeja_users u
    LEFT JOIN
        public.poupeja_subscriptions s
        ON u.id = s.user_id AND s.status = 'active'
    WHERE
        (p_email IS NOT NULL AND u.email = p_email)
        OR (p_phone IS NOT NULL AND u.phone = p_phone);
END;
$function$;