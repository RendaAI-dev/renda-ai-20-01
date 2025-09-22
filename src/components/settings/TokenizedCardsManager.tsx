import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Trash2, Star, StarOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SavedCard {
  id: string;
  credit_card_number: string;
  credit_card_brand: string;
  credit_card_last_four: string;
  holder_name: string;
  expires_at: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export const TokenizedCardsManager: React.FC = () => {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedCards();
  }, []);

  const loadSavedCards = async () => {
    try {
      const { data, error } = await supabase
        .from('poupeja_tokenized_cards')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedCards(data || []);
    } catch (error) {
      console.error('Error loading saved cards:', error);
      toast({
        title: "Erro ao carregar cartões",
        description: "Não foi possível carregar seus cartões salvos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (cardId: string) => {
    setActionLoading(cardId);
    try {
      // First, remove default from all cards
      await supabase
        .from('poupeja_tokenized_cards')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      // Then set the selected card as default
      const { error } = await supabase
        .from('poupeja_tokenized_cards')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: "Cartão padrão atualizado",
        description: "O cartão foi definido como padrão com sucesso."
      });

      await loadSavedCards();
    } catch (error) {
      console.error('Error setting default card:', error);
      toast({
        title: "Erro ao definir cartão padrão",
        description: "Não foi possível atualizar o cartão padrão.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    setActionLoading(cardId);
    try {
      const { error } = await supabase
        .from('poupeja_tokenized_cards')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: "Cartão removido",
        description: "O cartão foi removido com sucesso."
      });

      await loadSavedCards();
    } catch (error) {
      console.error('Error removing card:', error);
      toast({
        title: "Erro ao remover cartão",
        description: "Não foi possível remover o cartão.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getCardIcon = (brand: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isCardExpired = (expiresAt: string) => {
    const [month, year] = expiresAt.split('/');
    const expireDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
    return expireDate < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cartões Salvos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cartões Salvos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Gerencie seus cartões de crédito salvos para pagamentos futuros.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedCards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum cartão salvo ainda.</p>
            <p className="text-sm">Os cartões serão salvos automaticamente durante o checkout.</p>
          </div>
        ) : (
          savedCards.map((card) => (
            <div key={card.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getCardIcon(card.credit_card_brand)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{card.credit_card_brand}</span>
                      <span className="text-muted-foreground">{card.credit_card_number}</span>
                      {card.is_default && (
                        <Badge variant="default" className="text-xs">
                          Padrão
                        </Badge>
                      )}
                      {isCardExpired(card.expires_at) && (
                        <Badge variant="destructive" className="text-xs">
                          Expirado
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {card.holder_name} • Vence {card.expires_at}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Adicionado em {formatDate(card.created_at)}
                      {card.last_used_at && ` • Usado em ${formatDate(card.last_used_at)}`}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!card.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(card.id)}
                      disabled={actionLoading === card.id}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Definir como padrão
                    </Button>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={actionLoading === card.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover cartão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover este cartão? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveCard(card.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};