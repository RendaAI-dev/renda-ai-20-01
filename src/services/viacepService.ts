interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface Address {
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
  ddd: string;
}

class ViaCEPService {
  private readonly baseURL = 'https://viacep.com.br/ws';

  async getAddressByCEP(cep: string): Promise<Address | null> {
    try {
      // Remove formatting from CEP
      const cleanCEP = cep.replace(/\D/g, '');
      
      if (cleanCEP.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const response = await fetch(`${this.baseURL}/${cleanCEP}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar CEP');
      }

      const data: ViaCEPResponse = await response.json();
      
      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      return {
        cep: data.cep,
        street: data.logradouro,
        complement: data.complemento,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
        ibge: data.ibge,
        ddd: data.ddd
      };
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      throw error;
    }
  }

  formatCEP(cep: string): string {
    const cleanCEP = cep.replace(/\D/g, '');
    return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  isValidCEP(cep: string): boolean {
    const cleanCEP = cep.replace(/\D/g, '');
    return cleanCEP.length === 8;
  }
}

export const viacepService = new ViaCEPService();