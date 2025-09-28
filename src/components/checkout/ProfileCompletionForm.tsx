import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { viacepService, Address } from '@/services/viacepService';

interface ProfileData {
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ProfileCompletionFormProps {
  currentUser: any;
  onComplete: (data: ProfileData) => void;
  onCancel: () => void;
}

export function ProfileCompletionForm({ currentUser, onComplete, onCancel }: ProfileCompletionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  
  const [formData, setFormData] = useState<ProfileData>({
    name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const handleChange = (field: keyof ProfileData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCepChange = async (cep: string) => {
    setFormData(prev => ({ ...prev, cep }));
    
    // Auto-fetch address when CEP is complete
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const address = await viacepService.getAddressByCEP(cleanCep);
        if (address) {
          setFormData(prev => ({
            ...prev,
            street: address.street,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            complement: address.complement
          }));
          toast({
            title: "Endereço encontrado!",
            description: "Dados preenchidos automaticamente. Confirme o número.",
          });
        }
      } catch (error) {
        toast({
          title: "CEP não encontrado",
          description: "Preencha o endereço manualmente.",
          variant: "destructive"
        });
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const validateForm = (): boolean => {
    const requiredFields = ['name', 'phone', 'cep', 'street', 'number', 'neighborhood', 'city', 'state'];
    
    for (const field of requiredFields) {
      if (!formData[field as keyof ProfileData]?.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: `O campo ${getFieldLabel(field)} é obrigatório.`,
          variant: "destructive"
        });
        return false;
      }
    }

    // Validate phone
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone válido com DDD.",
        variant: "destructive"
      });
      return false;
    }

    // Validate CEP
    if (!viacepService.isValidCEP(formData.cep)) {
      toast({
        title: "CEP inválido",
        description: "Digite um CEP válido.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      name: 'Nome completo',
      phone: 'Telefone',
      cep: 'CEP',
      street: 'Rua',
      number: 'Número',
      neighborhood: 'Bairro',
      city: 'Cidade',
      state: 'Estado'
    };
    return labels[field] || field;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Update user profile in database
      const { error: updateError } = await supabase
        .from('poupeja_users')
        .update({
          name: formData.name,
          phone: formData.phone,
          cep: formData.cep,
          street: formData.street,
          number: formData.number,
          complement: formData.complement || null,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw new Error('Erro ao atualizar perfil');
      }

      toast({
        title: "Perfil atualizado!",
        description: "Dados salvos com sucesso.",
      });

      onComplete(formData);
    } catch (error) {
      console.error('Profile completion error:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete seu perfil</CardTitle>
        <p className="text-sm text-muted-foreground">
          Para continuar com o pagamento, precisamos de alguns dados adicionais.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone com DDD *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="cep">CEP *</Label>
            <div className="relative">
              <Input
                id="cep"
                placeholder="12345-678"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                disabled={loading || loadingCep}
              />
              {loadingCep && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="street">Rua *</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => handleChange('street', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => handleChange('number', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              placeholder="Apt, Casa, etc."
              value={formData.complement}
              onChange={(e) => handleChange('complement', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="neighborhood">Bairro *</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="state">Estado *</Label>
            <Input
              id="state"
              placeholder="SP"
              maxLength={2}
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
            {loading ? 'Salvando...' : 'Continuar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}