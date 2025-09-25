-- Criar tabela de notificações do usuário
CREATE TABLE public.poupeja_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system', -- 'system', 'marketing', 'transaction', 'goal', 'schedule', 'payment'
  category TEXT, -- 'income', 'expense', 'goal', 'schedule', 'plan_change', 'payment', 'card'
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.poupeja_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own notifications" 
ON public.poupeja_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.poupeja_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notifications" 
ON public.poupeja_notifications 
FOR ALL 
USING (true);

-- Índices para performance
CREATE INDEX idx_poupeja_notifications_user_id ON public.poupeja_notifications(user_id);
CREATE INDEX idx_poupeja_notifications_created_at ON public.poupeja_notifications(created_at DESC);
CREATE INDEX idx_poupeja_notifications_is_read ON public.poupeja_notifications(user_id, is_read);
CREATE INDEX idx_poupeja_notifications_type ON public.poupeja_notifications(user_id, type);

-- Função para criar notificação
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_category TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.poupeja_notifications (
    user_id, title, message, type, category, data
  ) VALUES (
    p_user_id, p_title, p_message, p_type, p_category, p_data
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.poupeja_notifications
  SET is_read = true, read_at = now()
  WHERE id = notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Função para marcar todas as notificações como lidas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.poupeja_notifications
  SET is_read = true, read_at = now()
  WHERE user_id = p_user_id AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(p_user_id UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM public.poupeja_notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN unread_count;
END;
$$;

-- Triggers para notificações automáticas

-- Trigger para transações
CREATE OR REPLACE FUNCTION public.notify_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  action_text TEXT;
  category_name TEXT;
  transaction_type_text TEXT;
BEGIN
  -- Determinar ação
  IF TG_OP = 'INSERT' THEN
    action_text := 'criada';
  ELSIF TG_OP = 'UPDATE' THEN
    action_text := 'editada';
  ELSIF TG_OP = 'DELETE' THEN
    action_text := 'excluída';
  END IF;
  
  -- Usar NEW para INSERT/UPDATE, OLD para DELETE
  DECLARE
    rec RECORD;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      rec := OLD;
    ELSE
      rec := NEW;
    END IF;
    
    -- Buscar nome da categoria
    SELECT name INTO category_name
    FROM public.poupeja_categories
    WHERE id = rec.category_id;
    
    -- Determinar tipo de transação
    transaction_type_text := CASE 
      WHEN rec.type = 'income' THEN 'Receita'
      WHEN rec.type = 'expense' THEN 'Despesa'
      ELSE 'Transação'
    END;
    
    -- Criar notificação
    PERFORM public.create_notification(
      rec.user_id,
      transaction_type_text || ' ' || action_text,
      transaction_type_text || ' de R$ ' || COALESCE(rec.amount::TEXT, '0') || 
      CASE WHEN category_name IS NOT NULL THEN ' na categoria ' || category_name ELSE '' END ||
      ' foi ' || action_text || ' com sucesso.',
      'transaction',
      rec.type,
      jsonb_build_object(
        'transaction_id', rec.id,
        'amount', rec.amount,
        'action', TG_OP,
        'category', category_name
      )
    );
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger de transações
CREATE TRIGGER notification_transaction_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.poupeja_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_transaction_changes();

-- Trigger para metas
CREATE OR REPLACE FUNCTION public.notify_goal_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  action_text TEXT;
BEGIN
  -- Determinar ação
  IF TG_OP = 'INSERT' THEN
    action_text := 'criada';
    
    PERFORM public.create_notification(
      NEW.user_id,
      'Meta ' || action_text,
      'Meta "' || NEW.name || '" foi ' || action_text || ' com valor objetivo de R$ ' || NEW.target_amount::TEXT || '.',
      'goal',
      'goal_created',
      jsonb_build_object(
        'goal_id', NEW.id,
        'goal_name', NEW.name,
        'target_amount', NEW.target_amount,
        'action', TG_OP
      )
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    action_text := 'editada';
    
    PERFORM public.create_notification(
      NEW.user_id,
      'Meta ' || action_text,
      'Meta "' || NEW.name || '" foi ' || action_text || '.',
      'goal',
      'goal_updated',
      jsonb_build_object(
        'goal_id', NEW.id,
        'goal_name', NEW.name,
        'target_amount', NEW.target_amount,
        'current_amount', NEW.current_amount,
        'action', TG_OP
      )
    );
    
    -- Verificar se meta foi atingida
    IF NEW.current_amount >= NEW.target_amount AND OLD.current_amount < OLD.target_amount THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'Meta atingida! 🎉',
        'Parabéns! Você atingiu sua meta "' || NEW.name || '" de R$ ' || NEW.target_amount::TEXT || '!',
        'goal',
        'goal_achieved',
        jsonb_build_object(
          'goal_id', NEW.id,
          'goal_name', NEW.name,
          'target_amount', NEW.target_amount,
          'achieved_amount', NEW.current_amount
        )
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    action_text := 'excluída';
    
    PERFORM public.create_notification(
      OLD.user_id,
      'Meta ' || action_text,
      'Meta "' || OLD.name || '" foi ' || action_text || '.',
      'goal',
      'goal_deleted',
      jsonb_build_object(
        'goal_name', OLD.name,
        'action', TG_OP
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger de metas
CREATE TRIGGER notification_goal_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.poupeja_goals
  FOR EACH ROW EXECUTE FUNCTION public.notify_goal_changes();

-- Trigger para transações agendadas
CREATE OR REPLACE FUNCTION public.notify_scheduled_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  action_text TEXT;
  type_text TEXT;
BEGIN
  -- Determinar ação
  IF TG_OP = 'INSERT' THEN
    action_text := 'agendada';
  ELSIF TG_OP = 'UPDATE' THEN
    action_text := 'atualizada';
  ELSIF TG_OP = 'DELETE' THEN
    action_text := 'cancelada';
  END IF;
  
  -- Usar NEW para INSERT/UPDATE, OLD para DELETE
  DECLARE
    rec RECORD;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      rec := OLD;
    ELSE
      rec := NEW;
    END IF;
    
    type_text := CASE 
      WHEN rec.type = 'income' THEN 'Receita'
      WHEN rec.type = 'expense' THEN 'Despesa'
      ELSE 'Transação'
    END;
    
    PERFORM public.create_notification(
      rec.user_id,
      type_text || ' ' || action_text,
      type_text || ' agendada de R$ ' || COALESCE(rec.amount::TEXT, '0') || 
      ' para ' || COALESCE(rec.scheduled_date::TEXT, 'data indefinida') || ' foi ' || action_text || '.',
      'schedule',
      rec.type,
      jsonb_build_object(
        'scheduled_transaction_id', rec.id,
        'amount', rec.amount,
        'scheduled_date', rec.scheduled_date,
        'action', TG_OP
      )
    );
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger de transações agendadas
CREATE TRIGGER notification_scheduled_transaction_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.poupeja_scheduled_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_scheduled_transaction_changes();

-- Trigger para mudanças de assinatura
CREATE OR REPLACE FUNCTION public.notify_subscription_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'Plano ativado',
      'Seu plano ' || NEW.plan_type || ' foi ativado com sucesso!',
      'payment',
      'subscription_created',
      jsonb_build_object(
        'subscription_id', NEW.id,
        'plan_type', NEW.plan_type,
        'status', NEW.status
      )
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Mudança de status
    IF OLD.status != NEW.status THEN
      DECLARE
        status_message TEXT;
      BEGIN
        status_message := CASE NEW.status
          WHEN 'active' THEN 'Seu plano foi ativado com sucesso!'
          WHEN 'canceled' THEN 'Seu plano foi cancelado.'
          WHEN 'past_due' THEN 'Seu plano está com pagamento em atraso.'
          WHEN 'unpaid' THEN 'Há um problema com o pagamento do seu plano.'
          ELSE 'Status do seu plano foi atualizado para: ' || NEW.status
        END;
        
        PERFORM public.create_notification(
          NEW.user_id,
          'Status do plano alterado',
          status_message,
          'payment',
          'subscription_status_changed',
          jsonb_build_object(
            'subscription_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'plan_type', NEW.plan_type
          )
        );
      END;
    END IF;
    
    -- Mudança de plano
    IF OLD.plan_type != NEW.plan_type THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'Plano alterado',
        'Seu plano foi alterado de ' || OLD.plan_type || ' para ' || NEW.plan_type || '.',
        'payment',
        'plan_changed',
        jsonb_build_object(
          'subscription_id', NEW.id,
          'old_plan', OLD.plan_type,
          'new_plan', NEW.plan_type
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger de assinaturas
CREATE TRIGGER notification_subscription_changes
  AFTER INSERT OR UPDATE ON public.poupeja_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_changes();

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.poupeja_notifications;