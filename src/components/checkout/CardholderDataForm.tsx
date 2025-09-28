import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CardholderDataFormProps {
  userData?: any;
}

export function CardholderDataForm({ userData }: CardholderDataFormProps) {
  if (!userData) return null;

  return (
    <div className="p-3 bg-muted rounded-lg">
      <h4 className="text-sm font-medium mb-2">Dados de cobrança (do seu perfil):</h4>
      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Nome:</strong> {userData.name}</p>
        <p><strong>Telefone:</strong> {userData.phone}</p>
        <p><strong>Endereço:</strong> {userData.street}, {userData.number}</p>
        <p><strong>Cidade:</strong> {userData.city}/{userData.state}</p>
        <p><strong>CEP:</strong> {userData.cep}</p>
      </div>
    </div>
  );
}