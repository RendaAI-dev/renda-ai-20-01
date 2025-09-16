import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Eye, Settings, TrendingUp } from 'lucide-react';
import { usePlans, Plan } from '@/hooks/usePlans';
import { useUserRole } from '@/hooks/useUserRole';
import PlanFormDialog from './PlanFormDialog';
import PlanPreviewDialog from './PlanPreviewDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const EnhancedPlanManager: React.FC = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { plans, isLoading, createPlan, updatePlan, deletePlan, togglePlanStatus } = usePlans();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const handleCreatePlan = () => {
    setSelectedPlan(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handlePreviewPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsPreviewOpen(true);
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await deletePlan(planId);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleToggleStatus = async (planId: string, currentStatus: boolean) => {
    try {
      await togglePlanStatus(planId, !currentStatus);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleFormSubmit = async (planData: Partial<Plan>) => {
    try {
      if (formMode === 'create') {
        await createPlan(planData as Omit<Plan, 'id' | 'created_at' | 'updated_at'>);
      } else if (selectedPlan) {
        await updatePlan(selectedPlan.id, planData);
      }
      setIsFormOpen(false);
      setSelectedPlan(null);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  if (roleLoading || isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando gerenciador de planos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            Acesso Negado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Você não tem permissões para acessar o gerenciador de planos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Gerenciador de Planos
          </h2>
          <p className="text-muted-foreground">
            Crie, edite e gerencie todos os planos de assinatura
          </p>
        </div>
        <Button onClick={handleCreatePlan} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Criar Novo Plano
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Planos</p>
                <p className="text-xl font-bold">{plans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planos Ativos</p>
                <p className="text-xl font-bold">{plans.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planos Populares</p>
                <p className="text-xl font-bold">{plans.filter(p => p.is_popular).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-xl font-bold">{plans.filter(p => !p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.is_popular ? 'ring-2 ring-primary' : ''}`}>
            {plan.is_popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge variant="default" className="shadow-md">
                  Mais Popular
                </Badge>
              </div>
            )}
            
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={() => handleToggleStatus(plan.id, plan.is_active)}
                  />
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mensal:</span>
                  <span className="font-bold">R$ {plan.price_monthly.toFixed(2).replace('.', ',')}</span>
                </div>
                {plan.price_annual && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anual:</span>
                    <span className="font-bold">R$ {plan.price_annual.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Funcionalidades ({plan.features.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {plan.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{plan.features.length - 3} mais
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewPlan(plan)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPlan(plan)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deletar Plano</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja deletar o plano "{plan.name}"? 
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePlan(plan.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Deletar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      <PlanFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        plan={selectedPlan}
        mode={formMode}
      />
      
      <PlanPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        plan={selectedPlan}
      />
    </div>
  );
};

export default EnhancedPlanManager;