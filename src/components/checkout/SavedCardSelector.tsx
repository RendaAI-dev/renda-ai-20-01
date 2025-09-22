import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus } from 'lucide-react';
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
  credit_card_token: string;
}

interface SavedCardSelectorProps {
  onCardSelect: (cardToken: string | null) => void;
  onNewCard: () => void;
  disabled?: boolean;
}

export const SavedCardSelector: React.FC<SavedCardSelectorProps> = ({
  onCardSelect,
  onNewCard,
  disabled = false
}) => {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>('new');
  const [loading, setLoading] = useState(true);
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
      
      // Auto-select default card if exists
      const defaultCard = data?.find(card => card.is_default);
      if (defaultCard) {
        setSelectedCard(defaultCard.id);
        onCardSelect(defaultCard.credit_card_token);
      }
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

  const handleCardSelection = (cardId: string) => {
    setSelectedCard(cardId);
    
    if (cardId === 'new') {
      onCardSelect(null);
      onNewCard();
    } else {
      const card = savedCards.find(c => c.id === cardId);
      if (card) {
        onCardSelect(card.credit_card_token);
      }
    }
  };

  const getCardIcon = (brand: string) => {
    // You could use brand-specific icons here
    return <CreditCard className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Método de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Método de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={selectedCard} 
          onValueChange={handleCardSelection}
          disabled={disabled}
        >
          {savedCards.map((card) => (
            <div key={card.id} className="flex items-center space-x-2 p-3 border rounded-lg">
              <RadioGroupItem value={card.id} id={card.id} />
              <Label htmlFor={card.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  {getCardIcon(card.credit_card_brand)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{card.credit_card_brand}</span>
                      <span className="text-muted-foreground">•••• {card.credit_card_last_four}</span>
                      {card.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {card.holder_name} • Vence {card.expires_at}
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          ))}
          
          <div className="flex items-center space-x-2 p-3 border rounded-lg border-dashed">
            <RadioGroupItem value="new" id="new" />
            <Label htmlFor="new" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-3">
                <Plus className="h-4 w-4" />
                <span>Usar novo cartão</span>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
};