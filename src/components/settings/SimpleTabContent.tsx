import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoryManagement from './CategoryManagement';
import PreferencesTab from './PreferencesTab';
import { TokenizedCardsManager } from './TokenizedCardsManager';

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
      default:
        return <CategoryManagement onSaveCategory={async () => {}} />;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="categories">Categorias</TabsTrigger>
        <TabsTrigger value="preferences">Preferências</TabsTrigger>
        <TabsTrigger value="cards">Cartões</TabsTrigger>
      </TabsList>
      
      <TabsContent value={activeTab} className="mt-6">
        {renderTabContent()}
      </TabsContent>
    </Tabs>
  );
};

export default SimpleTabContent;