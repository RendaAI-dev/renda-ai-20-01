
import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import SimpleTabContent from '@/components/settings/SimpleTabContent';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('preferences');

  return (
    <MainLayout>
      <div className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Configurações</h1>
        
        <SimpleTabContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
