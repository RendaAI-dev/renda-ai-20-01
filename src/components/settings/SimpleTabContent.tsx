import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoryManagement from './CategoryManagement';
import PreferencesTab from './PreferencesTab';
import { TokenizedCardsManager } from './TokenizedCardsManager';
import { NotificationSettings } from './NotificationSettings';

interface SimpleTabContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const SimpleTabContent: React.FC<SimpleTabContentProps> = ({ activeTab, setActiveTab }) => {
  const renderTabContent = () => {
    switch (activeTab) {
      case 'categories':
        return <CategoryManagement onSaveCategory={async () => {}} />;
      case 'preferences':
        return <PreferencesTab />;
      case 'cards':
        return <TokenizedCardsManager />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <CategoryManagement onSaveCategory={async () => {}} />;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="categories">Categorias</TabsTrigger>
        <TabsTrigger value="preferences">Preferências</TabsTrigger>
        <TabsTrigger value="cards">Cartões</TabsTrigger>
        <TabsTrigger value="notifications">Notificações</TabsTrigger>
      </TabsList>
      
      <TabsContent value={activeTab} className="mt-6">
        {renderTabContent()}
      </TabsContent>
    </Tabs>
  );
};

export default SimpleTabContent;