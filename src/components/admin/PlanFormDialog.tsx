import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Calculator } from 'lucide-react';
import { Plan } from '@/hooks/usePlans';

interface PlanFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (planData: Partial<Plan>) => Promise<void>;
  plan?: Plan | null;
  mode: 'create' | 'edit';
}

const PlanFormDialog: React.FC<PlanFormDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  plan,
  mode
}) => {
  const [formData, setFormData] = useState<Partial<Plan>>({
    name: '',
    slug: '',
    description: '',
    price_monthly: 0,
    price_annual: 0,
    stripe_price_id_monthly: '',
    stripe_price_id_annual: '',
    features: [],
    limitations: [],
    is_popular: false,
    is_active: true,
    max_users: undefined,
    trial_days: 0,
    sort_order: 0,
    metadata: {}
  });

  const [newFeature, setNewFeature] = useState('');
  const [newLimitation, setNewLimitation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar dados do plano quando em modo de edição
  useEffect(() => {
    if (mode === 'edit' && plan) {
      setFormData(plan);
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        price_monthly: 0,
        price_annual: 0,
        stripe_price_id_monthly: '',
        stripe_price_id_annual: '',
        features: [],
        limitations: [],
        is_popular: false,
        is_active: true,
        max_users: undefined,
        trial_days: 0,
        sort_order: 0,
        metadata: {}
      });
    }
  }, [mode, plan, isOpen]);

  // Gerar slug automaticamente baseado no nome
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }, []);

  const handleInputChange = (field: keyof Plan, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-gerar slug quando o nome muda
      if (field === 'name' && typeof value === 'string') {
        updated.slug = generateSlug(value);
      }
      
      return updated;
    });
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...(prev.features || []), newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features?.filter((_, i) => i !== index) || []
    }));
  };

  const addLimitation = () => {
    if (newLimitation.trim()) {
      setFormData(prev => ({
        ...prev,
        limitations: [...(prev.limitations || []), newLimitation.trim()]
      }));
      setNewLimitation('');
    }
  };

  const removeLimitation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      limitations: prev.limitations?.filter((_, i) => i !== index) || []
    }));
  };

  const calculateDiscount = () => {
    if (formData.price_monthly && formData.price_annual) {
      const monthly = Number(formData.price_monthly);
      const annual = Number(formData.price_annual);
      const yearlyEquivalent = monthly * 12;
      
      if (annual < yearlyEquivalent) {
        const discount = Math.round(((yearlyEquivalent - annual) / yearlyEquivalent) * 100);
        return discount;
      }
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price_monthly) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      // Erro tratado no componente pai
    } finally {
      setIsSubmitting(false);
    }
  };

  const discount = calculateDiscount();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Criar Novo Plano' : 'Editar Plano'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Plano *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Plano Premium"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Slug (URL) *</Label>
                  <Input
                    id="slug"
                    value={formData.slug || ''}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    placeholder="plano-premium"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Descrição do plano..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_popular"
                    checked={formData.is_popular || false}
                    onCheckedChange={(checked) => handleInputChange('is_popular', checked)}
                  />
                  <Label htmlFor="is_popular">Plano mais popular</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active !== false}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Ativo para vendas</Label>
                </div>
              </CardContent>
            </Card>

            {/* Preços */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Configuração de Preços
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="price_monthly">Preço Mensal (R$) *</Label>
                  <Input
                    id="price_monthly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_monthly || ''}
                    onChange={(e) => handleInputChange('price_monthly', parseFloat(e.target.value) || 0)}
                    placeholder="29.90"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="price_annual">Preço Anual (R$)</Label>
                  <Input
                    id="price_annual"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_annual || ''}
                    onChange={(e) => handleInputChange('price_annual', parseFloat(e.target.value) || 0)}
                    placeholder="299.90"
                  />
                </div>

                {discount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-800">
                      <Calculator className="h-4 w-4" />
                      <span className="font-medium">Desconto Anual: {discount}%</span>
                    </div>
                    <p className="text-sm text-green-600">
                      Economia de R$ {((Number(formData.price_monthly) * 12) - Number(formData.price_annual)).toFixed(2).replace('.', ',')} por ano
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="stripe_price_id_monthly">Stripe Price ID (Mensal)</Label>
                  <Input
                    id="stripe_price_id_monthly"
                    value={formData.stripe_price_id_monthly || ''}
                    onChange={(e) => handleInputChange('stripe_price_id_monthly', e.target.value)}
                    placeholder="price_xxxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <Label htmlFor="stripe_price_id_annual">Stripe Price ID (Anual)</Label>
                  <Input
                    id="stripe_price_id_annual"
                    value={formData.stripe_price_id_annual || ''}
                    onChange={(e) => handleInputChange('stripe_price_id_annual', e.target.value)}
                    placeholder="price_xxxxxxxxxxxxx"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Funcionalidades */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funcionalidades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Nova funcionalidade..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <Button type="button" onClick={addFeature} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.features?.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Limitações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Limitações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newLimitation}
                    onChange={(e) => setNewLimitation(e.target.value)}
                    placeholder="Nova limitação..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLimitation())}
                  />
                  <Button type="button" onClick={addLimitation} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.limitations?.map((limitation, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {limitation}
                      <button
                        type="button"
                        onClick={() => removeLimitation(index)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="max_users">Máximo de Usuários</Label>
                    <Input
                      id="max_users"
                      type="number"
                      min="1"
                      value={formData.max_users || ''}
                      onChange={(e) => handleInputChange('max_users', parseInt(e.target.value) || undefined)}
                      placeholder="Ilimitado"
                    />
                  </div>

                  <div>
                    <Label htmlFor="trial_days">Dias de Teste Grátis</Label>
                    <Input
                      id="trial_days"
                      type="number"
                      min="0"
                      value={formData.trial_days || 0}
                      onChange={(e) => handleInputChange('trial_days', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sort_order">Ordem de Exibição</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order || 0}
                    onChange={(e) => handleInputChange('sort_order', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Criar Plano' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanFormDialog;