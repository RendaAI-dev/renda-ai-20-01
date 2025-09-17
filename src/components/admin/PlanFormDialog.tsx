import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { Plan } from '@/hooks/usePlans';
import { PLAN_PERIODS, PlanPeriod } from '@/utils/planPeriodUtils';

interface PlanFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (planData: Partial<Plan>) => Promise<void>;
  plan?: Plan;
  mode: 'create' | 'edit';
}

export const PlanFormDialog: React.FC<PlanFormDialogProps> = ({
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
    plan_period: 'monthly',
    price: 0,
    price_original: undefined,
    stripe_price_id: '',
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

  useEffect(() => {
    if (plan && mode === 'edit') {
      setFormData({
        ...plan,
        features: [...plan.features],
        limitations: [...plan.limitations]
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        plan_period: 'monthly',
        price: 0,
        price_original: undefined,
        stripe_price_id: '',
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
  }, [plan, mode, isOpen]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleInputChange = (field: keyof Plan, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate slug when name changes
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
    if (!formData.price_original || !formData.price) return 0;
    return Math.round(((formData.price_original - formData.price) / formData.price_original) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.plan_period || !formData.price) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    await onSubmit(formData);
    onClose();
  };

  const periodInfo = PLAN_PERIODS[formData.plan_period as PlanPeriod];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Criar Novo Plano' : 'Editar Plano'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Plano *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ex: Premium"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    placeholder="premium"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="period">Período do Plano *</Label>
                <Select 
                  value={formData.plan_period} 
                  onValueChange={(value) => handleInputChange('plan_period', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
                {periodInfo && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {periodInfo.label} - {periodInfo.shortLabel}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrição do plano..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Preços */}
          <Card>
            <CardHeader>
              <CardTitle>Preços - {periodInfo?.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Preço {periodInfo?.label} (R$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price_original">Preço Original (R$)</Label>
                  <Input
                    id="price_original"
                    type="number"
                    step="0.01"
                    value={formData.price_original || ''}
                    onChange={(e) => handleInputChange('price_original', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.00"
                  />
                  {calculateDiscount() > 0 && (
                    <Badge variant="secondary" className="mt-1">
                      Desconto: {calculateDiscount()}%
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                <Input
                  id="stripe_price_id"
                  value={formData.stripe_price_id}
                  onChange={(e) => handleInputChange('stripe_price_id', e.target.value)}
                  placeholder="price_..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Funcionalidades</CardTitle>
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
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.features?.map((feature, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>{feature}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFeature(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Limitations */}
          <Card>
            <CardHeader>
              <CardTitle>Limitações</CardTitle>
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
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.limitations?.map((limitation, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>{limitation}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLimitation(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_users">Máximo de Usuários</Label>
                  <Input
                    id="max_users"
                    type="number"
                    value={formData.max_users || ''}
                    onChange={(e) => handleInputChange('max_users', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Ilimitado"
                  />
                </div>
                <div>
                  <Label htmlFor="trial_days">Dias de Teste</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    value={formData.trial_days}
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
                  value={formData.sort_order}
                  onChange={(e) => handleInputChange('sort_order', parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_popular"
                    checked={formData.is_popular}
                    onCheckedChange={(checked) => handleInputChange('is_popular', checked)}
                  />
                  <Label htmlFor="is_popular">Plano Popular</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Ativo</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {mode === 'create' ? 'Criar Plano' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanFormDialog;