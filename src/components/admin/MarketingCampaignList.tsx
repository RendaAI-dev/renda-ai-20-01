import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Send } from 'lucide-react';

export const MarketingCampaignList: React.FC = () => {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          O envio de notificações e campanhas de marketing foi desativado.
        </p>
      </CardContent>
    </Card>
  );
};
