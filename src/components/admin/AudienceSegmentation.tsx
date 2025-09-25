import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Users, Calculator, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AudienceCalculation {
  count: number;
  totalFound: number;
  segment: string;
  filters: {
    planFilter?: string;
    activeOnly: boolean;
    marketingOnly: boolean;
  };
}

const AudienceSegmentation: React.FC = () => {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [segmentType, setSegmentType] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [marketingOnly, setMarketingOnly] = useState(true);
  const [result, setResult] = useState<AudienceCalculation | null>(null);
  const [plans, setPlans] = useState<Array<{ slug: string; name: string }>>([]);

  // Load available plans
  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase
        .from('poupeja_plans')
        .select('slug, name')
        .eq('is_active', true);
      
      if (data) {
        setPlans(data);
      }
    };
    loadPlans();
  }, []);

  const calculateAudience = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-marketing-audience', {
        body: {
          segmentType,
          planFilter,
          activeOnly: false, // Deprecated, using segmentType instead
          marketingOnly
        }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Público calculado com sucesso",
        description: `Encontrados ${data.count} usuários no segmento selecionado.`
      });
    } catch (error) {
      console.error('Error calculating audience:', error);
      toast({
        title: "Erro ao calcular público",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const getSegmentDescription = (segment: string) => {
    const descriptions = {
      'all': 'Todos os usuários registrados',
      'active': 'Usuários ativos nos últimos 30 dias',
      'inactive': 'Usuários inativos há mais de 30 dias',
      'new': 'Usuários cadastrados nos últimos 7 dias',
      'subscribers': 'Usuários com assinatura ativa'
    };
    return descriptions[segment as keyof typeof descriptions] || segment;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Segmentação de Público-Alvo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros de Segmentação */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="segment">Tipo de Segmento</Label>
              <Select value={segmentType} onValueChange={setSegmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="active">Usuários ativos</SelectItem>
                  <SelectItem value="inactive">Usuários inativos</SelectItem>
                  <SelectItem value="new">Usuários novos</SelectItem>
                  <SelectItem value="subscribers">Assinantes ativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Filtro por Plano</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os planos</SelectItem>
                  {plans.map(plan => (
                    <SelectItem key={plan.slug} value={plan.slug}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketing">Aceita Marketing</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="marketing"
                  checked={marketingOnly}
                  onCheckedChange={setMarketingOnly}
                />
                <span className="text-sm text-muted-foreground">
                  {marketingOnly ? 'Apenas quem aceita' : 'Incluir todos'}
                </span>
              </div>
            </div>
          </div>

          {/* Descrição do Segmento */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Segmento atual:</strong> {getSegmentDescription(segmentType)}
              {planFilter !== 'all' && ` • Plano: ${plans.find(p => p.slug === planFilter)?.name || planFilter}`}
              {marketingOnly && ' • Aceita comunicações de marketing'}
            </p>
          </div>

          {/* Botão de Cálculo */}
          <Button 
            onClick={calculateAudience}
            disabled={isCalculating}
            className="w-full"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              'Calcular Público-Alvo'
            )}
          </Button>

          {/* Resultado */}
          {result && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="text-3xl font-bold text-primary">
                    {result.count.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-muted-foreground">
                    usuários no público-alvo selecionado
                  </p>
                  
                  {result.totalFound !== result.count && (
                    <div className="flex justify-center gap-2">
                      <Badge variant="secondary">
                        Total encontrado: {result.totalFound.toLocaleString('pt-BR')}
                      </Badge>
                      <Badge variant="outline">
                        Após filtros: {result.count.toLocaleString('pt-BR')}
                      </Badge>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Este é o número de usuários que receberão a campanha de marketing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AudienceSegmentation;