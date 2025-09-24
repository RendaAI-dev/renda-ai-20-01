
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/contexts/PreferencesContext';

interface QuickActionsMenuProps {
  onAddTransaction: (type: 'income' | 'expense') => void;
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  onAddTransaction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = usePreferences();
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: TrendingUp,
      label: t('nav.income') || 'Receitas',
      action: () => {
        onAddTransaction('income');
        setIsOpen(false);
      },
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100'
    },
    {
      icon: TrendingDown,
      label: t('nav.expenses') || 'Despesas',
      action: () => {
        onAddTransaction('expense');
        setIsOpen(false);
      },
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100'
    },
    {
      icon: Target,
      label: t('nav.goals') || 'Metas',
      action: () => {
        navigate('/goals');
        setIsOpen(false);
      },
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100'
    },
    {
      icon: Calendar,
      label: 'Agendamentos',
      action: () => {
        navigate('/schedule');
        setIsOpen(false);
      },
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.05
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className="rounded-full w-16 h-16 shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90 hover-scale"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-56 p-2 mb-2" 
          align="center"
          side="top"
        >
          {isOpen && (
            <div className="space-y-1 animate-scale-in">
              {menuItems.map((item, index) => (
                <div 
                  key={item.label}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Button
                    variant="ghost"
                    onClick={item.action}
                    className={`w-full justify-start gap-3 ${item.bgColor} ${item.color} hover-scale`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default QuickActionsMenu;
