import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Megaphone, Users, Send, History } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { MarketingCampaignForm } from './MarketingCampaignForm';
import { MarketingCampaignList } from './MarketingCampaignList';
import { MarketingStats } from './MarketingStats';
import AudienceSegmentation from './AudienceSegmentation';

const MarketingManager: React.FC = () => {
  const { toast } = useToast();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('campaigns');

  if (roleLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <span>Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            Acesso Negado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Você não tem permissões para acessar o painel de marketing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Gerenciamento de Marketing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Nova Campanha
            </TabsTrigger>
            <TabsTrigger value="audience" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Público-Alvo
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-6">
            <MarketingCampaignList />
          </TabsContent>

          <TabsContent value="new" className="mt-6">
            <MarketingCampaignForm onSuccess={() => setActiveTab('campaigns')} />
          </TabsContent>

          <TabsContent value="audience" className="mt-6">
            <AudienceSegmentation />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <MarketingStats />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MarketingManager;